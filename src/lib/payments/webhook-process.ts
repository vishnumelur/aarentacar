import { eq } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { db } from '@/db';
import { bookings, bookingEvents, payments, refunds, webhookEvents } from '@/db/schema';

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0] | typeof db;

/**
 * Reserve a webhook event id for processing. Returns true if this is the first
 * time we've seen it (caller should process), false if already handled.
 * Implemented as an INSERT ... ON CONFLICT DO NOTHING for atomic dedupe.
 */
export async function reserveWebhookEvent(id: string): Promise<boolean> {
  const inserted = await db
    .insert(webhookEvents)
    .values({ id })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
}

/**
 * Mark a payment succeeded by its gateway ref and advance the booking from
 * `pending_payment` to `pending_approval`. Idempotent at the data level: only
 * a `pending_payment` booking is advanced, and the payment is keyed by ref.
 */
export async function markPaymentSucceeded(
  gatewayRef: string,
  raw: unknown,
): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.gatewayRef, gatewayRef))
      .limit(1);
    if (!payment) return;

    await tx
      .update(payments)
      .set({ status: 'succeeded', capturedAt: new Date(), rawResponse: raw, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1);
    if (booking && booking.status === 'pending_payment') {
      await tx
        .update(bookings)
        .set({ status: 'pending_approval', updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        kind: 'payment_succeeded',
        payload: { method: payment.method, amountAed: payment.amountAed },
      });
    }
  });
}

/** Mark a payment failed by gateway ref. Booking stays `pending_payment`. */
export async function markPaymentFailed(
  gatewayRef: string,
  raw: unknown,
): Promise<void> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.gatewayRef, gatewayRef))
    .limit(1);
  if (!payment) return;
  await db
    .update(payments)
    .set({ status: 'failed', rawResponse: raw, updatedAt: new Date() })
    .where(eq(payments.id, payment.id));
  await db.insert(bookingEvents).values({
    bookingId: payment.bookingId,
    kind: 'payment_failed',
    payload: { method: payment.method },
  });
}

/** Reconcile a refund webhook: mark the matching refund row succeeded. */
export async function markRefundSucceeded(gatewayRefundId: string): Promise<void> {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.gatewayRef, gatewayRefundId))
    .limit(1);
  if (!refund) return;
  await db
    .update(refunds)
    .set({ status: 'succeeded', updatedAt: new Date() })
    .where(eq(refunds.id, refund.id));
}
