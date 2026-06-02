import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { getProviderCredential } from './credentials';

/**
 * Tabby BNPL wrapper. Tabby has no official Node SDK, so this hits their REST
 * API directly. Flow: server creates a Checkout Session → customer is
 * redirected to Tabby's hosted UI → Tabby calls our webhook on completion.
 *
 * verify-on-deploy: exact Tabby request/response shapes and the live API base
 * differ between sandbox and production; confirm against the Tabby dashboard
 * before going live.
 */

const TABBY_API_BASE = 'https://api.tabby.ai';

export class TabbyNotConfiguredError extends Error {
  constructor() {
    super('Tabby secret key is not configured');
    this.name = 'TabbyNotConfiguredError';
  }
}

export interface CreateSessionInput {
  amountAed: number;
  bookingCode: string;
  customer: { email: string; phone: string | null; name: string };
}

export interface CreatedSession {
  sessionId: string;
  redirectUrl: string;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<CreatedSession> {
  const secret = getProviderCredential('tabby', 'secret_key');
  if (!secret) throw new TabbyNotConfiguredError();
  const baseUrl = env().APP_BASE_URL;
  const successUrl = `${baseUrl}/my-bookings/${input.bookingCode}?payment=tabby_success`;
  const cancelUrl = `${baseUrl}/my-bookings/${input.bookingCode}/checkout?payment=tabby_cancel`;

  const res = await fetch(`${TABBY_API_BASE}/api/v2/checkout`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      payment: {
        amount: input.amountAed.toFixed(2),
        currency: 'AED',
        description: `AA Rent A Car booking ${input.bookingCode}`,
        buyer: {
          email: input.customer.email,
          phone: input.customer.phone ?? '',
          name: input.customer.name,
        },
        order: { reference_id: input.bookingCode },
      },
      lang: 'en',
      merchant_code: getProviderCredential('tabby', 'public_key') ?? '',
      merchant_urls: { success: successUrl, cancel: cancelUrl, failure: cancelUrl },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tabby checkout failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    id?: string;
    configuration?: { available_products?: { installments?: { web_url?: string }[] } };
  };
  const redirectUrl =
    json.configuration?.available_products?.installments?.[0]?.web_url ?? '';
  return { sessionId: json.id ?? '', redirectUrl };
}

export async function refundPayment(
  paymentId: string,
  amountAed: number,
): Promise<{ refundId: string }> {
  const secret = getProviderCredential('tabby', 'secret_key');
  if (!secret) throw new TabbyNotConfiguredError();
  const res = await fetch(`${TABBY_API_BASE}/api/v2/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount: amountAed.toFixed(2) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tabby refund failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { id?: string };
  return { refundId: json.id ?? '' };
}

/**
 * Verify a Tabby webhook HMAC signature. Tabby signs the raw body with the
 * webhook secret (HMAC-SHA256, hex). Exported so the route handler and tests
 * share one implementation.
 */
export function verifyTabbySignature(
  body: string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}
