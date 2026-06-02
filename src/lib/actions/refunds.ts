'use server';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings, bookingEvents, auditLogs, payments, refunds } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import * as stripeProvider from '@/lib/payments/stripe';
import * as tabbyProvider from '@/lib/payments/tabby';

export type IssueRefundOutcome =
  | { ok: true; refundId: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'no_refundable_payment'
        | 'amount_exceeds_payment'
        | 'unsupported_method'
        | 'provider_unconfigured'
        | 'provider_error';
    };

/**
 * Manager-only refund against a booking's successful card or Tabby payment.
 * Defaults to a full refund; amount may be a partial. Inserts a `refunds` row,
 * marks the payment `refunded`, and appends a booking event.
 */
export async function issueRefund(input: {
  bookingId: string;
  amountAed?: number;
  reason?: string;
}): Promise<IssueRefundOutcome> {
  const user = await getCurrentUser();
  // Money-movement path: agents are excluded; managers/superadmins only.
  if (!user || (user.role !== 'manager' && user.role !== 'superadmin')) {
    return { ok: false, error: 'forbidden' };
  }
  if (!input.bookingId) return { ok: false, error: 'invalid_input' };
  if (input.reason && input.reason.length > 500) return { ok: false, error: 'invalid_input' };

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) return { ok: false, error: 'not_found' };

  // Most recent succeeded card/tabby payment is the refund target.
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.status, 'succeeded'),
        inArray(payments.method, ['card', 'tabby']),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!payment) return { ok: false, error: 'no_refundable_payment' };

  const amountAed = input.amountAed ?? payment.amountAed;
  if (!Number.isInteger(amountAed) || amountAed <= 0) {
    return { ok: false, error: 'invalid_input' };
  }
  if (amountAed > payment.amountAed) return { ok: false, error: 'amount_exceeds_payment' };
  if (!payment.gatewayRef) return { ok: false, error: 'no_refundable_payment' };

  // Guard against cumulative over-refunding: the new amount must fit within the
  // remaining (un-refunded) balance, not just the original charge.
  const priorRefunds = await db
    .select({ amountAed: refunds.amountAed })
    .from(refunds)
    .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'succeeded')));
  const alreadyRefunded = priorRefunds.reduce((sum, r) => sum + r.amountAed, 0);
  const remaining = payment.amountAed - alreadyRefunded;
  if (amountAed > remaining) return { ok: false, error: 'amount_exceeds_payment' };

  let gatewayRefundId = '';
  try {
    if (payment.method === 'card') {
      const r = await stripeProvider.refundPayment(payment.gatewayRef, amountAed);
      gatewayRefundId = r.refundId;
    } else if (payment.method === 'tabby') {
      const r = await tabbyProvider.refundPayment(payment.gatewayRef, amountAed);
      gatewayRefundId = r.refundId;
    } else {
      return { ok: false, error: 'unsupported_method' };
    }
  } catch (err) {
    if (
      err instanceof stripeProvider.StripeNotConfiguredError ||
      err instanceof tabbyProvider.TabbyNotConfiguredError
    ) {
      return { ok: false, error: 'provider_unconfigured' };
    }
    console.error('issueRefund provider call failed', err);
    return { ok: false, error: 'provider_error' };
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(refunds)
      .values({
        bookingId: booking.id,
        paymentId: payment.id,
        gatewayRef: gatewayRefundId,
        amountAed,
        reason: input.reason ?? null,
        status: 'succeeded',
        issuedByUserId: user.id,
      })
      .returning({ id: refunds.id });

    // The payment is fully refunded only once cumulative refunds reach the
    // original charge; otherwise it stays 'succeeded' (partially refunded).
    const fullRefund = alreadyRefunded + amountAed === payment.amountAed;
    if (fullRefund) {
      await tx
        .update(payments)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      await tx
        .update(bookings)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
    }

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: user.id,
      kind: 'refund_issued',
      payload: { amountAed, method: payment.method, reason: input.reason ?? null },
    });
    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'payment.refunded',
      targetType: 'booking',
      targetId: booking.id,
      payload: { amountAed, paymentId: payment.id },
    });

    return row?.id ?? '';
  });

  revalidatePath(`/manager/bookings/${booking.code}`);
  revalidatePath(`/my-bookings/${booking.code}`);
  return { ok: true, refundId: result };
}
