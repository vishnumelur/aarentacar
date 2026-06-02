import Stripe from 'stripe';
import type { CredentialProvider } from './types';

/**
 * Per-provider "test connection" checks (Plan #9 Task 4). Each makes a single
 * cheap authenticated call and reports a friendly outcome. The Stripe factory
 * and fetch are injectable so tests never touch the network.
 *
 * verify-on-deploy: these are live API calls against the real providers when
 * triggered from the UI — they need network egress and a valid key.
 */

export type ConnectionResult = { ok: true } | { ok: false; error: string };

type StripeFactory = (key: string) => Pick<Stripe, 'balance'>;

const defaultStripeFactory: StripeFactory = (key) =>
  new Stripe(key, { apiVersion: '2026-05-27.dahlia' });

export async function testStripeConnection(
  secretKey: string,
  factory: StripeFactory = defaultStripeFactory,
): Promise<ConnectionResult> {
  if (!secretKey) return { ok: false, error: 'No Stripe secret key configured.' };
  try {
    const stripe = factory(secretKey);
    await stripe.balance.retrieve();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err, 'Stripe') };
  }
}

export async function testTabbyConnection(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionResult> {
  if (!secretKey) return { ok: false, error: 'No Tabby secret key configured.' };
  try {
    const res = await fetchImpl('https://api.tabby.ai/api/v1/me', {
      headers: { authorization: `Bearer ${secretKey}` },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Tabby rejected the key (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, error: friendly(err, 'Tabby') };
  }
}

export async function testMapboxConnection(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionResult> {
  if (!accessToken) return { ok: false, error: 'No Mapbox access token configured.' };
  try {
    const url =
      'https://api.mapbox.com/geocoding/v5/mapbox.places/dubai.json' +
      `?limit=1&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchImpl(url);
    if (res.ok) return { ok: true };
    return { ok: false, error: `Mapbox rejected the token (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, error: friendly(err, 'Mapbox') };
  }
}

function friendly(err: unknown, provider: string): string {
  if (err instanceof Error && err.message) return err.message;
  return `Could not reach ${provider}.`;
}

export const TESTABLE_PROVIDERS: readonly CredentialProvider[] = [
  'stripe',
  'tabby',
  'mapbox',
];
