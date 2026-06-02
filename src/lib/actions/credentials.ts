'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getCredential, setCredential } from '@/lib/credentials/store';
import {
  testStripeConnection,
  testTabbyConnection,
  testMapboxConnection,
} from '@/lib/credentials/test-connection';
import type { CredentialProvider } from '@/lib/credentials/types';
import { PROVIDER_FIELDS } from '@/lib/credentials/types';

export type SetCredentialOutcome =
  | { ok: true; lastFour: string }
  | { ok: false; error: 'forbidden' | 'invalid_input' };

const PROVIDERS: readonly CredentialProvider[] = ['stripe', 'tabby', 'mapbox', 'smtp'];

function isValidField(provider: CredentialProvider, key: string): boolean {
  return PROVIDER_FIELDS[provider]?.some((f) => f.key === key) ?? false;
}

export async function setCredentialAction(
  formData: FormData,
): Promise<SetCredentialOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };

  const provider = String(formData.get('provider') ?? '') as CredentialProvider;
  const key = String(formData.get('key') ?? '');
  const value = String(formData.get('value') ?? '');

  if (!PROVIDERS.includes(provider) || !isValidField(provider, key)) {
    return { ok: false, error: 'invalid_input' };
  }
  if (value.trim() === '') return { ok: false, error: 'invalid_input' };

  try {
    await setCredential(provider, key, value);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  revalidatePath('/admin/credentials');
  return { ok: true, lastFour: `••${value.slice(-4)}` };
}

export type TestConnectionOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function testConnectionAction(
  provider: CredentialProvider,
): Promise<TestConnectionOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') {
    return { ok: false, error: 'Forbidden.' };
  }

  if (provider === 'stripe') {
    const key = (await getCredential('stripe', 'secret_key')) ?? '';
    return testStripeConnection(key);
  }
  if (provider === 'tabby') {
    const key = (await getCredential('tabby', 'secret_key')) ?? '';
    return testTabbyConnection(key);
  }
  if (provider === 'mapbox') {
    const token = (await getCredential('mapbox', 'access_token')) ?? '';
    return testMapboxConnection(token);
  }
  // SMTP test-connection lands with the mail server (Plan #12).
  return { ok: false, error: 'Connection test not available for this provider yet.' };
}
