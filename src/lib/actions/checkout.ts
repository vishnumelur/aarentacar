'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings, bookingEvents, auditLogs, payments, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import * as stripeProvider from '@/lib/payments/stripe';
import * as tabbyProvider from '@/lib/payments/tabby';
import { placeDepositHold } from './deposits';

type CheckoutError =
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'invalid_status'
  | 'provider_unconfigured'
  | 'provider_error';

export type StartCardOutcome =
  | { ok: true; clientSecret: string; publishableKey: string; paymentId: string }
  | { ok: false; error: CheckoutError };

/**
 * Card payment: creates the rental PaymentIntent and (for card) a separate
 * manual-capture deposit hold. Returns the clientSecret for Stripe Elements.
 * The booking flips to `pending_approval` only when the webhook confirms.
 */
export async function startCardPayment(input: {
  code: string;
}): Promise<StartCardOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') return { ok: false, error: 'forbidden' };
  if (!input.code) return { ok: false, error: 'invalid_input' };

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, input.code)).limit(1);
  if (!booking) return { ok: false, error: 'not_found' };
  if (booking.customerId !== user.id) return { ok: false, error: 'forbidden' };
  if (booking.status !== 'pending_payment') return { ok: false, error: 'invalid_status' };

  const publishableKey = await stripeProvider.getStripePublishableKey();

  let intent;
  try {
    intent = await stripeProvider.createPaymentIntent({
      amountAed: booking.totalAed,
      bookingCode: booking.code,
      customerId: user.id,
    });
  } catch (err) {
    if (err instanceof stripeProvider.StripeNotConfiguredError) {
      return { ok: false, error: 'provider_unconfigured' };
    }
    console.error('startCardPayment intent failed', err);
    return { ok: false, error: 'provider_error' };
  }

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: booking.id,
      method: 'card',
      gatewayRef: intent.intentId,
      amountAed: booking.totalAed,
      status: 'initiated',
    })
    .returning({ id: payments.id });

  // Place the refundable deposit hold (best-effort; failure shouldn't block
  // the rental payment — manager can re-hold later).
  if (booking.depositAed > 0) {
    try {
      await placeDepositHold(booking.id);
    } catch (err) {
      console.warn('deposit hold failed at checkout', err);
    }
  }

  await db.insert(bookingEvents).values({
    bookingId: booking.id,
    actorUserId: user.id,
    kind: 'payment_initiated',
    payload: { method: 'card', amountAed: booking.totalAed },
  });

  revalidatePath(`/my-bookings/${booking.code}`);
  return {
    ok: true,
    clientSecret: intent.clientSecret,
    publishableKey,
    paymentId: payment?.id ?? '',
  };
}

export type StartTabbyOutcome =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: CheckoutError };

export async function startTabbyPayment(input: {
  code: string;
}): Promise<StartTabbyOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') return { ok: false, error: 'forbidden' };
  if (!input.code) return { ok: false, error: 'invalid_input' };

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, input.code)).limit(1);
  if (!booking) return { ok: false, error: 'not_found' };
  if (booking.customerId !== user.id) return { ok: false, error: 'forbidden' };
  if (booking.status !== 'pending_payment') return { ok: false, error: 'invalid_status' };

  const [fullUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  let session;
  try {
    session = await tabbyProvider.createSession({
      amountAed: booking.totalAed,
      bookingCode: booking.code,
      customer: {
        email: fullUser?.email ?? user.email,
        phone: fullUser?.phone ?? null,
        name: fullUser?.fullName ?? user.fullName,
      },
    });
  } catch (err) {
    if (err instanceof tabbyProvider.TabbyNotConfiguredError) {
      return { ok: false, error: 'provider_unconfigured' };
    }
    console.error('startTabbyPayment failed', err);
    return { ok: false, error: 'provider_error' };
  }

  await db.insert(payments).values({
    bookingId: booking.id,
    method: 'tabby',
    gatewayRef: session.sessionId,
    amountAed: booking.totalAed,
    status: 'initiated',
  });

  await db.insert(bookingEvents).values({
    bookingId: booking.id,
    actorUserId: user.id,
    kind: 'payment_initiated',
    payload: { method: 'tabby', amountAed: booking.totalAed },
  });

  revalidatePath(`/my-bookings/${booking.code}`);
  return { ok: true, redirectUrl: session.redirectUrl };
}

export type OfflineIntentOutcome =
  | { ok: true }
  | { ok: false; error: CheckoutError };

/**
 * Cash on Delivery: records a manual_pending payment and moves the booking to
 * `pending_approval` (manager approves; driver collects cash on handover).
 */
export async function recordCashIntent(input: {
  code: string;
}): Promise<OfflineIntentOutcome> {
  return recordOfflineIntent(input.code, 'cod', { advance: true });
}

/**
 * Bank Transfer: records a manual_pending payment and keeps the booking at
 * `pending_payment` until a manager confirms the funds arrived (Plan #10).
 */
export async function recordBankTransferIntent(input: {
  code: string;
  reference?: string;
}): Promise<OfflineIntentOutcome> {
  return recordOfflineIntent(input.code, 'bank_transfer', {
    advance: false,
    reference: input.reference,
  });
}

async function recordOfflineIntent(
  code: string,
  method: 'cod' | 'bank_transfer',
  opts: { advance: boolean; reference?: string },
): Promise<OfflineIntentOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') return { ok: false, error: 'forbidden' };
  if (!code) return { ok: false, error: 'invalid_input' };

  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.code, code)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.customerId !== user.id) return { ok: false as const, error: 'forbidden' };
    if (booking.status !== 'pending_payment') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx.insert(payments).values({
      bookingId: booking.id,
      method,
      amountAed: booking.totalAed,
      status: 'manual_pending',
      rawResponse: opts.reference ? { reference: opts.reference } : null,
    });

    if (opts.advance) {
      await tx
        .update(bookings)
        .set({ status: 'pending_approval', updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
    }

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: user.id,
      kind: 'payment_initiated',
      payload: { method, reference: opts.reference ?? null },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: `payment.${method}_intent`,
      targetType: 'booking',
      targetId: booking.id,
      payload: { code: booking.code },
    });

    revalidatePath(`/my-bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    return { ok: true as const };
  });
}
