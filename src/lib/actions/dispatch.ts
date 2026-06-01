'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings, bookingEvents, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export type ApproveOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'invalid_status' };

export async function approveBooking(formData: FormData): Promise<ApproveOutcome> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'pending_approval') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx
      .update(bookings)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(bookings.id, id));

    await tx.insert(bookingEvents).values({
      bookingId: id,
      actorUserId: user.id,
      kind: 'approved',
      payload: { code: booking.code },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'booking.approved',
      targetType: 'booking',
      targetId: id,
      payload: { code: booking.code },
    });

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    revalidatePath(`/my-bookings/${booking.code}`);
    return { ok: true as const };
  });
}

export type RejectOutcome =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'invalid_status'
        | 'reason_required';
    };

export async function rejectBooking(formData: FormData): Promise<RejectOutcome> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) return { ok: false, error: 'invalid_input' };
  if (!reason) return { ok: false, error: 'reason_required' };
  if (reason.length > 500) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'pending_approval') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, id));

    await tx.insert(bookingEvents).values({
      bookingId: id,
      actorUserId: user.id,
      kind: 'rejected',
      payload: { code: booking.code, reason },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'booking.rejected',
      targetType: 'booking',
      targetId: id,
      payload: { code: booking.code, reason },
    });

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    revalidatePath(`/my-bookings/${booking.code}`);
    // Refund flow will land in Plan #7 when payments are wired
    return { ok: true as const };
  });
}
