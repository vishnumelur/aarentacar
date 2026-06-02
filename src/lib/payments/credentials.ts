import { env } from '@/lib/env';

/**
 * Provider credential lookup. Plan #9 introduces a `provider_credentials` table
 * (manager-managed, encrypted) that this will read from first. Until then we
 * resolve straight from env.
 *
 * TODO(Plan #9): read from `provider_credentials` table, falling back to env
 * for bootstrap. The signature is intentionally stable so the retrofit is
 * internal-only.
 */
export type Provider = 'stripe' | 'tabby';
export type CredentialKey =
  | 'secret_key'
  | 'publishable_key'
  | 'public_key'
  | 'webhook_secret';

export function getProviderCredential(
  provider: Provider,
  key: CredentialKey,
): string | undefined {
  const e = env();
  if (provider === 'stripe') {
    if (key === 'secret_key') return e.STRIPE_SECRET_KEY;
    if (key === 'publishable_key') return e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (key === 'webhook_secret') return e.STRIPE_WEBHOOK_SECRET;
  }
  if (provider === 'tabby') {
    if (key === 'secret_key') return e.TABBY_SECRET_KEY;
    if (key === 'public_key') return e.TABBY_PUBLIC_KEY;
    if (key === 'webhook_secret') return e.TABBY_WEBHOOK_SECRET;
  }
  return undefined;
}
