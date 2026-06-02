import Stripe from 'stripe';
import { getProviderCredential } from './credentials';

/**
 * Stripe provider wrapper. The client is lazily instantiated from the secret
 * key so this module imports cleanly even when no key is configured (e.g. in
 * dev / CI). Payment actions that actually call Stripe will throw a clear error
 * if the key is missing.
 *
 * Amounts are stored in this app as whole AED integers; Stripe expects the
 * smallest currency unit (fils, 1 AED = 100 fils).
 */

let cached: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe secret key is not configured');
    this.name = 'StripeNotConfiguredError';
  }
}

export async function getStripe(): Promise<Stripe> {
  const key = await getProviderCredential('stripe', 'secret_key');
  if (!key) throw new StripeNotConfiguredError();
  if (!cached) {
    // Pin to the SDK's bundled API version (Stripe types enforce the literal).
    cached = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  }
  return cached;
}

/** For tests: reset the memoized client so a re-mocked key takes effect. */
export function __resetStripeForTests(): void {
  cached = null;
}

export function aedToFils(aed: number): number {
  return Math.round(aed * 100);
}

/** Publishable key for Stripe Elements (safe to send to the browser). */
export async function getStripePublishableKey(): Promise<string> {
  return (await getProviderCredential('stripe', 'publishable_key')) ?? '';
}

export interface CreateIntentInput {
  amountAed: number;
  bookingCode: string;
  customerId: string;
}

export interface CreatedIntent {
  clientSecret: string;
  intentId: string;
}

/** Capture-on-confirm intent for the rental charge. */
export async function createPaymentIntent(
  input: CreateIntentInput,
): Promise<CreatedIntent> {
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: aedToFils(input.amountAed),
    currency: 'aed',
    capture_method: 'automatic',
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingCode: input.bookingCode,
      customerId: input.customerId,
      kind: 'rental',
    },
  });
  return { clientSecret: pi.client_secret ?? '', intentId: pi.id };
}

/** Manual-capture intent used to place a refundable deposit hold. */
export async function createManualCaptureHold(input: {
  amountAed: number;
  bookingCode: string;
  customerId: string;
}): Promise<CreatedIntent> {
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: aedToFils(input.amountAed),
    currency: 'aed',
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingCode: input.bookingCode,
      customerId: input.customerId,
      kind: 'deposit_hold',
    },
  });
  return { clientSecret: pi.client_secret ?? '', intentId: pi.id };
}

export async function releaseHold(intentId: string): Promise<void> {
  const stripe = await getStripe();
  await stripe.paymentIntents.cancel(intentId);
}

export async function captureHold(
  intentId: string,
  amountAed: number,
): Promise<void> {
  const stripe = await getStripe();
  await stripe.paymentIntents.capture(intentId, {
    amount_to_capture: aedToFils(amountAed),
  });
}

export async function refundPayment(
  paymentIntentId: string,
  amountAed: number,
): Promise<{ refundId: string }> {
  const stripe = await getStripe();
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: aedToFils(amountAed),
  });
  return { refundId: refund.id };
}

/**
 * Verify + parse a Stripe webhook payload. Split out so handlers (and tests)
 * can inject the signing secret.
 */
export async function constructWebhookEvent(
  body: string,
  signature: string,
  webhookSecret: string,
): Promise<Stripe.Event> {
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
