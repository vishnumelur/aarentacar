import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { providerCredentials, auditLogs } from '@/db/schema';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { encrypt, decrypt } from '@/lib/crypto/aes-gcm';
import { resetStripeClient } from '@/lib/payments/stripe';
import {
  type CredentialProvider,
  type CredentialEnv,
  envFallbackVar,
  maskValue,
} from './types';

/**
 * Encrypted provider-credential store (Plan #9).
 *
 * Reads resolve: in-process cache (30s TTL) → DB (decrypted) → env fallback.
 * Writes are super-admin only, encrypt with AES-256-GCM under ENCRYPTION_KEY,
 * upsert by (provider, env, key_name), and append a `credential.set` audit row.
 *
 * This is a server-only module (not a 'use server' action module) so it can
 * export the sync cache helper and be imported by other server modules like
 * the Stripe/Tabby/Mapbox wrappers.
 */

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(provider: CredentialProvider, env_: CredentialEnv, key: string): string {
  return `${provider}:${env_}:${key}`;
}

/** Test-only: drop the in-memory cache between cases. */
export function __clearCredentialCache(): void {
  cache.clear();
}

export async function getCredential(
  provider: CredentialProvider,
  key: string,
  credEnv: CredentialEnv = 'live',
): Promise<string | null> {
  const ck = cacheKey(provider, credEnv, key);
  const hit = cache.get(ck);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let resolved: string | null = null;
  try {
    const rows = await db
      .select({ valueEncrypted: providerCredentials.valueEncrypted })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.provider, provider),
          eq(providerCredentials.env, credEnv),
          eq(providerCredentials.keyName, key),
        ),
      )
      .limit(1);
    if (rows[0]) {
      resolved = decrypt(Buffer.from(rows[0].valueEncrypted), env().ENCRYPTION_KEY);
    }
  } catch (err) {
    // A decrypt failure (e.g. ENCRYPTION_KEY rotated without re-encrypting)
    // must not silently fall through to a stale env value without a trace.
    await safeAudit('credential.read_failed', `${provider}.${key}`, {
      env: credEnv,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    resolved = null;
  }

  // Env fallback preserves pre-Plan-#9 behaviour for un-stored keys.
  if (resolved === null) {
    const varName = envFallbackVar(provider, key);
    if (varName) {
      const v = process.env[varName];
      resolved = v && v !== '' ? v : null;
    }
  }

  cache.set(ck, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

export async function setCredential(
  provider: CredentialProvider,
  key: string,
  value: string,
  credEnv: CredentialEnv = 'live',
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') throw new Error('forbidden');

  const encrypted = encrypt(value, env().ENCRYPTION_KEY);
  const lastFour = maskValue(value);

  await db
    .insert(providerCredentials)
    .values({
      provider,
      env: credEnv,
      keyName: key,
      valueEncrypted: encrypted,
      lastFour,
      updatedByUserId: user.id,
    })
    .onConflictDoUpdate({
      target: [
        providerCredentials.provider,
        providerCredentials.env,
        providerCredentials.keyName,
      ],
      set: {
        valueEncrypted: encrypted,
        lastFour,
        updatedByUserId: user.id,
        updatedAt: new Date(),
      },
    });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'credential.set',
    targetType: 'provider_credential',
    targetId: `${provider}.${key}`,
    payload: { env: credEnv, lastFour },
  });

  // Invalidate so the next read reflects the new value immediately.
  cache.delete(cacheKey(provider, credEnv, key));

  // The Stripe SDK client is memoized from the secret key; drop it on rotation
  // so the next call re-instantiates with the new credentials.
  if (provider === 'stripe') {
    resetStripeClient();
  }
}

export interface CredentialListing {
  provider: CredentialProvider;
  env: CredentialEnv;
  keyName: string;
  lastFour: string | null;
  updatedAt: Date;
  updatedByUserId: string | null;
}

/** Masked metadata for the UI — never returns decrypted values. */
export async function listCredentials(): Promise<CredentialListing[]> {
  const rows = await db
    .select({
      provider: providerCredentials.provider,
      env: providerCredentials.env,
      keyName: providerCredentials.keyName,
      lastFour: providerCredentials.lastFour,
      updatedAt: providerCredentials.updatedAt,
      updatedByUserId: providerCredentials.updatedByUserId,
    })
    .from(providerCredentials)
    .orderBy(desc(providerCredentials.updatedAt));
  return rows;
}

async function safeAudit(
  action: string,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action,
      targetType: 'provider_credential',
      targetId,
      payload,
    });
  } catch {
    // Never let audit logging break a read.
  }
}
