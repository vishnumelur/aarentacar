import type Stripe from 'stripe';
import { getProviderCredential } from '@/lib/payments/credentials';
import { constructWebhookEvent } from '@/lib/payments/stripe';
import {
  reserveWebhookEvent,
  markPaymentSucceeded,
  markPaymentFailed,
  markRefundSucceeded,
} from '@/lib/payments/webhook-process';

export const runtime = 'nodejs';

/**
 * Stripe webhook receiver. Signature-verified (when a webhook secret is set),
 * idempotent via the `webhook_events` dedupe table.
 *
 * In dev/CI without a webhook secret, the raw JSON body is trusted so synthetic
 * events can drive the status machine. verify-on-deploy: a real
 * STRIPE_WEBHOOK_SECRET must be configured in production.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const webhookSecret = await getProviderCredential('stripe', 'webhook_secret');

  let event: Stripe.Event;
  if (webhookSecret) {
    const sig = req.headers.get('stripe-signature') ?? '';
    try {
      event = await constructWebhookEvent(body, sig, webhookSecret);
    } catch (err) {
      console.warn('stripe webhook signature verification failed', err);
      return new Response('invalid signature', { status: 400 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Never trust an unsigned body in production — a forged request could mark
    // unpaid bookings as paid. Fail closed until a secret is configured.
    console.error('stripe webhook secret not configured in production — refusing to process');
    return new Response('webhook secret not configured', { status: 503 });
  } else {
    // No secret configured (dev/test only): trust the body so synthetic events
    // can drive the status machine.
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return new Response('invalid body', { status: 400 });
    }
  }

  if (!event?.id || !event?.type) {
    return new Response('invalid event', { status: 400 });
  }

  const first = await reserveWebhookEvent(`stripe:${event.id}`);
  if (!first) return new Response('ok', { status: 200 });

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await markPaymentSucceeded(pi.id, pi);
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      await markPaymentFailed(pi.id, pi);
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      // We issue one refund per charge, so data[0] is the relevant refund.
      const refundId = charge.refunds?.data?.[0]?.id;
      if (refundId) await markRefundSucceeded(refundId);
    }
  } catch (err) {
    console.error('stripe webhook processing error', err);
    return new Response('processing error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
