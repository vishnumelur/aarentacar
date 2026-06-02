'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { agentPermissions, users, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

type Outcome = { ok: true } | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' };

const FLAG_FIELDS = [
  'canApproveBookings',
  'canReviewKyc',
  'canEditPricing',
  'canManagePromos',
  'canViewRevenue',
  'canManageDrivers',
  'canEditSettings',
] as const;

const FORM_FIELDS: Record<(typeof FLAG_FIELDS)[number], string> = {
  canApproveBookings: 'can_approve_bookings',
  canReviewKyc: 'can_review_kyc',
  canEditPricing: 'can_edit_pricing',
  canManagePromos: 'can_manage_promos',
  canViewRevenue: 'can_view_revenue',
  canManageDrivers: 'can_manage_drivers',
  canEditSettings: 'can_edit_settings',
};

/**
 * Save an agent's fine-grained permissions. Only managers/superadmins may set
 * them (agents cannot escalate their own access — `edit_settings` is NOT a
 * gate here on purpose). Upserts the row keyed by userId.
 */
export async function saveAgentPermissions(formData: FormData): Promise<Outcome> {
  const actor = await getCurrentUser();
  if (!actor || !(actor.role === 'manager' || actor.role === 'superadmin')) {
    return { ok: false, error: 'forbidden' };
  }
  if (!canAccessPortal(actor.role, 'manager')) return { ok: false, error: 'forbidden' };

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { ok: false, error: 'invalid_input' };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: 'not_found' };
  if (target.role !== 'agent') return { ok: false, error: 'invalid_input' };

  const flags = Object.fromEntries(
    FLAG_FIELDS.map((field) => {
      const raw = formData.get(FORM_FIELDS[field]);
      return [field, raw === 'on' || raw === 'true'];
    }),
  ) as Record<(typeof FLAG_FIELDS)[number], boolean>;

  await db
    .insert(agentPermissions)
    .values({ userId, ...flags, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: agentPermissions.userId,
      set: { ...flags, updatedAt: new Date() },
    });

  await db.insert(auditLogs).values({
    actorUserId: actor.id,
    action: 'agent_permissions.updated',
    targetType: 'user',
    targetId: userId,
    payload: flags,
  });

  revalidatePath('/manager/users');
  return { ok: true };
}
