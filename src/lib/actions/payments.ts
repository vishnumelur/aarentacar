'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { payments, bookings, bookingEvents, auditLogs, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { createNotification } from '@/lib/notifications/create';
import { enqueueEmailSafe } from '@/lib/mail/send';

export type ConfirmBankTransferOutcome =
  | { ok: true }
  | {
      ok: false;
      error: 'forbidden' | 'invalid_input' | 'not_found' | 'invalid_status';
    };

/**
 * Manager confirms a bank-transfer payment arrived: flips the
 * `manual_pending` bank_transfer payment to `succeeded` and advances the
 * booking from `pending_payment` → `pending_approval`.
 */
export async function confirmBankTransfer(formData: FormData): Promise<ConfirmBankTransferOutcome> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const paymentId = String(formData.get('paymentId') ?? '');
  if (!paymentId) return { ok: false, error: 'invalid_input' };

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) return { ok: false as const, error: 'not_found' };
    if (payment.method !== 'bank_transfer' || payment.status !== 'manual_pending') {
      return { ok: false as const, error: 'invalid_status' };
    }

    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'pending_payment') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx
      .update(payments)
      .set({ status: 'succeeded', capturedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'manual_pending')));

    await tx
      .update(bookings)
      .set({ status: 'pending_approval', updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: user.id,
      kind: 'payment_confirmed',
      payload: { method: 'bank_transfer', amountAed: payment.amountAed },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'payment.bank_transfer_confirmed',
      targetType: 'booking',
      targetId: booking.id,
      payload: { code: booking.code, paymentId },
    });

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    revalidatePath(`/my-bookings/${booking.code}`);

    // Notify the customer their transfer was received. Best-effort.
    // TODO(Plan #11): move to pg-boss async enqueue.
    try {
      await createNotification({
        userId: booking.customerId,
        kind: 'payment_confirmed',
        title: 'Bank transfer received',
        body: `We confirmed your bank transfer for booking ${booking.code}.`,
        payload: { code: booking.code, bookingId: booking.id },
      });
    } catch (err) {
      console.warn('confirmBankTransfer notification failed', err);
    }

    // Payment receipt email (Plan #12). Best-effort, off the request path.
    const [cust] = await tx
      .select({ email: users.email, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, booking.customerId))
      .limit(1);
    if (cust) {
      await enqueueEmailSafe({
        to: cust.email,
        templateName: 'payment-receipt',
        locale: 'en',
        payload: {
          name: cust.fullName,
          bookingCode: booking.code,
          amountAed: payment.amountAed,
        },
      });
    }

    return { ok: true as const };
  });
}

/** Void-returning wrapper for direct use as a `<form action>`. */
export async function confirmBankTransferForm(formData: FormData): Promise<void> {
  await confirmBankTransfer(formData);
}
