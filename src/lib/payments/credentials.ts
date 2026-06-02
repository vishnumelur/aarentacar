import { getCredential } from '@/lib/credentials/store';

/**
 * Provider credential lookup for the payment modules.
 *
 * As of Plan #9 this delegates to the encrypted `provider_credentials` store
 * (`getCredential`), which itself falls back to env vars when no value has been
 * pasted into the Super-Admin UI. The signature stays narrow (stripe/tabby +
 * the payment key names) so the payment code is unaffected by the retrofit.
 */
export type Provider = 'stripe' | 'tabby';
export type CredentialKey =
  | 'secret_key'
  | 'publishable_key'
  | 'public_key'
  | 'webhook_secret';

export async function getProviderCredential(
  provider: Provider,
  key: CredentialKey,
): Promise<string | undefined> {
  const value = await getCredential(provider, key);
  return value ?? undefined;
}
