'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerDocuments, users, auditLogs, customerProfiles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

async function logAudit(actorId: string, action: string, targetId: string, payload: object) {
  await db.insert(auditLogs).values({
    actorUserId: actorId,
    action,
    targetType: 'customer_document',
    targetId,
    payload,
  });
}

/**
 * Recompute the customer's overall verification status based on their current
 * document set + residency requirements.
 */
async function recomputeCustomerStatus(customerId: string): Promise<void> {
  const docs = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.customerId, customerId));

  const approvedTypes = new Set(
    docs.filter((d) => d.status === 'approved').map((d) => d.type),
  );
  const anyRejected = docs.some((d) => d.status === 'rejected');
  const anyPending = docs.some((d) => d.status === 'pending');

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, customerId))
    .limit(1);

  let requiredCovered = false;
  if (profile) {
    const drivingLicenseCovered =
      approvedTypes.has('driving_license_front') &&
      approvedTypes.has('driving_license_back');
    const idCovered =
      profile.residency === 'tourist'
        ? approvedTypes.has('passport')
        : approvedTypes.has('emirates_id_front') && approvedTypes.has('emirates_id_back');
    requiredCovered = drivingLicenseCovered && idCovered;
  }

  const next: 'unverified' | 'pending' | 'verified' | 'rejected' = anyPending
    ? 'pending'
    : requiredCovered
      ? 'verified'
      : anyRejected
        ? 'rejected'
        : 'unverified';

  await db
    .update(users)
    .set({ verificationStatus: next, updatedAt: new Date() })
    .where(eq(users.id, customerId));
}

export async function approveDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'invalid_input' };

  const [doc] = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.id, id))
    .limit(1);
  if (!doc) return { ok: false as const, error: 'not_found' };

  await db
    .update(customerDocuments)
    .set({
      status: 'approved',
      reviewerId: user.id,
      reviewedAt: new Date(),
      reviewNote: null,
    })
    .where(eq(customerDocuments.id, id));

  await logAudit(user.id, 'document.approved', id, { type: doc.type });
  await recomputeCustomerStatus(doc.customerId);
  revalidatePath(`/manager/customers/${doc.customerId}`);
  revalidatePath('/manager/customers');
  return { ok: true as const };
}

export async function rejectDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  const note = String(formData.get('note') ?? '')
    .trim()
    .slice(0, 500);
  if (!id || !note) return { ok: false as const, error: 'invalid_input' };

  const [doc] = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.id, id))
    .limit(1);
  if (!doc) return { ok: false as const, error: 'not_found' };

  await db
    .update(customerDocuments)
    .set({
      status: 'rejected',
      reviewerId: user.id,
      reviewedAt: new Date(),
      reviewNote: note,
    })
    .where(eq(customerDocuments.id, id));

  await logAudit(user.id, 'document.rejected', id, { type: doc.type, note });
  await recomputeCustomerStatus(doc.customerId);
  revalidatePath(`/manager/customers/${doc.customerId}`);
  revalidatePath('/manager/customers');
  return { ok: true as const };
}
