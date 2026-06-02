import { getProviderCredential } from '@/lib/payments/credentials';
import { verifyTabbySignature } from '@/lib/payments/tabby';
import {
  reserveWebhookEvent,
  markPaymentSucceeded,
  markPaymentFailed,
} from '@/lib/payments/webhook-process';

export const runtime = 'nodejs';

interface TabbyWebhook {
  id?: string;
  status?: string;
  order?: { reference_id?: string };
}

/**
 * Tabby webhook receiver. HMAC-verified (when a secret is set), idempotent via
 * the `webhook_events` table. Tabby signs the body and sends the signature in
 * the `x-tabby-signature` header.
 *
 * verify-on-deploy: confirm Tabby's exact header name + payload shape against
 * the live dashboard before going to production.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const secret = await getProviderCredential('tabby', 'webhook_secret');

  if (secret) {
    const sig = req.headers.get('x-tabby-signature') ?? '';
    if (!verifyTabbySignature(body, sig, secret)) {
      return new Response('invalid signature', { status: 400 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Never trust an unsigned body in production — a forged request could mark
    // unpaid bookings as paid. Fail closed until a secret is configured.
    console.error('tabby webhook secret not configured in production — refusing to process');
    return new Response('webhook secret not configured', { status: 503 });
  }

  let event: TabbyWebhook;
  try {
    event = JSON.parse(body) as TabbyWebhook;
  } catch {
    return new Response('invalid body', { status: 400 });
  }
  if (!event.id) return new Response('invalid event', { status: 400 });

  const first = await reserveWebhookEvent(`tabby:${event.id}`);
  if (!first) return new Response('ok', { status: 200 });

  try {
    // Tabby payment ids map to our payments.gateway_ref (the session id).
    if (event.status === 'AUTHORIZED' || event.status === 'CLOSED') {
      await markPaymentSucceeded(event.id, event);
    } else if (event.status === 'REJECTED' || event.status === 'EXPIRED') {
      await markPaymentFailed(event.id, event);
    }
  } catch (err) {
    console.error('tabby webhook processing error', err);
    return new Response('processing error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
