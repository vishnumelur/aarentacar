/**
 * Shared credential types + env-fallback mapping for the provider-credential
 * store (Plan #9). Kept in a plain (non-'use server') module so types and the
 * static mapping can be imported by client components and tests without pulling
 * in the DB.
 */

export type CredentialProvider = 'stripe' | 'tabby' | 'mapbox' | 'smtp';
export type CredentialEnv = 'live' | 'test';

/**
 * Which env var each (provider, key) pair falls back to when the DB has no
 * stored value. This preserves the existing Plan #7/#8 env behaviour so a
 * fresh deploy keeps working before any key is pasted into the UI.
 *
 * NOTE: the PUBLIC Mapbox token (`NEXT_PUBLIC_MAPBOX_TOKEN`) is intentionally
 * NOT here — it is a public client token that stays env-only.
 */
export const ENV_FALLBACK: Record<string, string> = {
  'stripe:secret_key': 'STRIPE_SECRET_KEY',
  'stripe:publishable_key': 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'stripe:webhook_secret': 'STRIPE_WEBHOOK_SECRET',
  'tabby:secret_key': 'TABBY_SECRET_KEY',
  'tabby:public_key': 'TABBY_PUBLIC_KEY',
  'tabby:webhook_secret': 'TABBY_WEBHOOK_SECRET',
  'mapbox:access_token': 'MAPBOX_TOKEN',
  'smtp:host': 'SMTP_HOST',
  'smtp:port': 'SMTP_PORT',
  'smtp:user': 'SMTP_USER',
  'smtp:password': 'SMTP_PASSWORD',
  'smtp:from': 'SMTP_FROM',
  'smtp:from_name': 'SMTP_FROM_NAME',
};

export function envFallbackVar(provider: CredentialProvider, key: string): string | undefined {
  return ENV_FALLBACK[`${provider}:${key}`];
}

/** Mask a secret for display, never revealing more than the last 4 chars. */
export function maskValue(value: string): string {
  const tail = value.slice(-4);
  return `••${tail}`;
}

/** The fields each provider card manages, in display order. */
export interface CredentialFieldDef {
  key: string;
  label: string;
  secret: boolean;
}

export const PROVIDER_FIELDS: Record<CredentialProvider, CredentialFieldDef[]> = {
  stripe: [
    { key: 'secret_key', label: 'Secret key', secret: true },
    { key: 'publishable_key', label: 'Publishable key', secret: false },
    { key: 'webhook_secret', label: 'Webhook signing secret', secret: true },
  ],
  tabby: [
    { key: 'secret_key', label: 'Secret key', secret: true },
    { key: 'public_key', label: 'Public / merchant key', secret: false },
    { key: 'webhook_secret', label: 'Webhook signing secret', secret: true },
  ],
  mapbox: [{ key: 'access_token', label: 'Access token', secret: true }],
  smtp: [
    { key: 'host', label: 'Host', secret: false },
    { key: 'port', label: 'Port', secret: false },
    { key: 'user', label: 'Username', secret: false },
    { key: 'password', label: 'Password', secret: true },
    { key: 'from', label: 'From address', secret: false },
    { key: 'from_name', label: 'From name', secret: false },
  ],
};

export const PROVIDER_LABELS: Record<CredentialProvider, string> = {
  stripe: 'Stripe',
  tabby: 'Tabby',
  mapbox: 'Mapbox',
  smtp: 'SMTP (email)',
};
