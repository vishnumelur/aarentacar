'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings, bookingEvents, auditLogs, paymentHolds } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import * as stripeProvider from '@/lib/payments/stripe';

/**
 * Create a Stripe manual-capture PaymentIntent for the deposit and record the
 * hold. Called at card checkout time. Returns the created hold's gateway ref.
 * Not a server action entry point on its own — invoked from checkout.
 */
export async function placeDepositHold(
  bookingId: string,
): Promise<{ holdId: string; clientSecret: string }> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new Error('booking_not_found');

  const hold = await stripeProvider.createManualCaptureHold({
    amountAed: booking.depositAed,
    bookingCode: booking.code,
    customerId: booking.customerId,
  });

  const [row] = await db
    .insert(paymentHolds)
    .values({
      bookingId: booking.id,
      gatewayRef: hold.intentId,
      amountAed: booking.depositAed,
      status: 'held',
    })
    .returning({ id: paymentHolds.id });

  await db.insert(bookingEvents).values({
    bookingId: booking.id,
    kind: 'deposit_held',
    payload: { amountAed: booking.depositAed, gatewayRef: hold.intentId },
  });

  return { holdId: row?.id ?? '', clientSecret: hold.clientSecret };
}

type DepositError =
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'invalid_status'
  | 'provider_unconfigured'
  | 'provider_error';

export type ReleaseDepositOutcome =
  | { ok: true }
  | { ok: false; error: DepositError };

/** Manager (or Plan #11 auto-job) releases the full deposit hold. */
export async function releaseDeposit(input: {
  holdId: string;
}): Promise<ReleaseDepositOutcome> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  if (!input.holdId) return { ok: false, error: 'invalid_input' };

  const [hold] = await db.select().from(paymentHolds).where(eq(paymentHolds.id, input.holdId)).limit(1);
  if (!hold) return { ok: false, error: 'not_found' };
  if (hold.status !== 'held') return { ok: false, error: 'invalid_status' };

  if (hold.gatewayRef) {
    try {
      await stripeProvider.releaseHold(hold.gatewayRef);
    } catch (err) {
      if (err instanceof stripeProvider.StripeNotConfiguredError) {
        return { ok: false, error: 'provider_unconfigured' };
      }
      console.error('releaseDeposit failed', err);
      return { ok: false, error: 'provider_error' };
    }
  }

  await db
    .update(paymentHolds)
    .set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(paymentHolds.id, hold.id));

  await db.insert(bookingEvents).values({
    bookingId: hold.bookingId,
    actorUserId: user.id,
    kind: 'deposit_released',
    payload: { amountAed: hold.amountAed },
  });
  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'deposit.released',
    targetType: 'booking',
    targetId: hold.bookingId,
    payload: { holdId: hold.id, amountAed: hold.amountAed },
  });

  revalidatePath('/manager/bookings');
  return { ok: true };
}

/**
 * System (job-run) deposit release — no logged-in user. Called by the
 * `deposit-release` pg-boss handler for auto-eligible holds. Audited with a
 * null actor (system). Throws on provider error so the handler can count it.
 */
export async function systemReleaseDeposit(holdId: string): Promise<void> {
  const [hold] = await db.select().from(paymentHolds).where(eq(paymentHolds.id, holdId)).limit(1);
  if (!hold) throw new Error('not_found');
  if (hold.status !== 'held') throw new Error('invalid_status');

  if (hold.gatewayRef) {
    await stripeProvider.releaseHold(hold.gatewayRef);
  }

  await db
    .update(paymentHolds)
    .set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(paymentHolds.id, hold.id));

  await db.insert(bookingEvents).values({
    bookingId: hold.bookingId,
    kind: 'deposit_released',
    payload: { amountAed: hold.amountAed, auto: true },
  });
  await db.insert(auditLogs).values({
    actorUserId: null,
    action: 'deposit.auto_released',
    targetType: 'booking',
    targetId: hold.bookingId,
    payload: { holdId: hold.id, amountAed: hold.amountAed, system: true },
  });
}

export type CaptureDepositOutcome =
  | { ok: true }
  | { ok: false; error: DepositError | 'amount_exceeds_hold' };

/**
 * Manager captures part/all of the deposit (e.g. damage). Stripe captures the
 * specified amount and releases the remainder automatically.
 */
export async function captureDeposit(input: {
  holdId: string;
  amountAed: number;
}): Promise<CaptureDepositOutcome> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  if (!input.holdId || !Number.isInteger(input.amountAed) || input.amountAed <= 0) {
    return { ok: false, error: 'invalid_input' };
  }

  const [hold] = await db.select().from(paymentHolds).where(eq(paymentHolds.id, input.holdId)).limit(1);
  if (!hold) return { ok: false, error: 'not_found' };
  if (hold.status !== 'held') return { ok: false, error: 'invalid_status' };
  if (input.amountAed > hold.amountAed) return { ok: false, error: 'amount_exceeds_hold' };

  if (hold.gatewayRef) {
    try {
      await stripeProvider.captureHold(hold.gatewayRef, input.amountAed);
    } catch (err) {
      if (err instanceof stripeProvider.StripeNotConfiguredError) {
        return { ok: false, error: 'provider_unconfigured' };
      }
      console.error('captureDeposit failed', err);
      return { ok: false, error: 'provider_error' };
    }
  }

  const fullCapture = input.amountAed === hold.amountAed;
  await db
    .update(paymentHolds)
    .set({
      status: fullCapture ? 'captured' : 'partially_captured',
      capturedAmountAed: input.amountAed,
      capturedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentHolds.id, hold.id));

  await db.insert(bookingEvents).values({
    bookingId: hold.bookingId,
    actorUserId: user.id,
    kind: 'deposit_captured',
    payload: { amountAed: input.amountAed, fullCapture },
  });
  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'deposit.captured',
    targetType: 'booking',
    targetId: hold.bookingId,
    payload: { holdId: hold.id, amountAed: input.amountAed },
  });

  revalidatePath('/manager/bookings');
  return { ok: true };
}
