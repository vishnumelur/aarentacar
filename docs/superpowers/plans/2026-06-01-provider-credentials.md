# AA Rent A Car — Plan #9: Provider Credentials UI Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Super-Admin can paste API keys for Stripe, Tabby, Mapbox, and SMTP into the browser; the app picks them up without a restart. Keys are encrypted with AES-256-GCM using `ENCRYPTION_KEY` from env. "Test connection" button verifies each one before save. Audit logs every save and every read. **After this plan ships:** rotating any provider key is a 30-second browser action — no SSH, no `.env` editing.

**Spec reference:** §6.9 provider_credentials schema, §7.4 Super-Admin Provider Credentials UI, §11.4 full spec including the AES-256-GCM model, env fallback, and test-connection buttons.

---

## File Structure
- Schema: `src/db/schema/provider-credentials.ts`
- `src/lib/crypto/aes-gcm.ts` (pure, TDD): encrypt/decrypt with master key
- `src/lib/credentials/store.ts`: getCredential(provider, key), setCredential(provider, key, value), listCredentials() — all read/write through the encrypted store with audit logging
- `src/lib/credentials/test-connection.ts`: per-provider connection check
- `src/app/admin/credentials/page.tsx`
- `src/components/admin/credential-card.tsx` (per provider)
- Modify Stripe/Tabby/Mapbox/SMTP modules to read from `getCredential(...)` with env fallback (Plans #7, #8, #12 modules)

## Task 1: Schema
Per spec §6.9, `provider_credentials` with provider enum, env enum, key_name text, value_encrypted bytea, last_four text, etc. Apply migration.

## Task 2: AES-GCM helpers (TDD)
```ts
// src/lib/crypto/aes-gcm.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export function encrypt(plaintext: string, masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]); // 12 + 16 + N
}
export function decrypt(blob: Buffer, masterKeyBase64: string): string {
  const key = Buffer.from(masterKeyBase64, 'base64');
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const enc = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```
Tests: round-trip, tampered ciphertext throws, tampered tag throws, wrong key throws.

## Task 3: Credential store
```ts
export async function setCredential(provider: Provider, key: string, value: string, env: 'live'|'test' = 'live') {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') throw new Error('forbidden');
  const encrypted = encrypt(value, env_().ENCRYPTION_KEY);
  const lastFour = `••${value.slice(-4)}`;
  await db.insert(providerCredentials).values({ provider, env, keyName: key, valueEncrypted: encrypted, lastFour, updatedByUserId: user.id })
    .onConflictDoUpdate({ target: [providerCredentials.provider, providerCredentials.env, providerCredentials.keyName],
      set: { valueEncrypted: encrypted, lastFour, updatedByUserId: user.id, updatedAt: new Date() } });
  await db.insert(auditLogs).values({ actorUserId: user.id, action: 'credential.set', targetType: 'provider_credential', targetId: `${provider}.${key}`, payload: { env } });
}

const cache = new Map<string, { value: string; expiresAt: number }>();
export async function getCredential(provider: Provider, key: string, env: 'live'|'test' = 'live'): Promise<string | null> {
  const cacheKey = `${provider}:${env}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const rows = await db.select().from(providerCredentials)
    .where(and(eq(providerCredentials.provider, provider), eq(providerCredentials.env, env), eq(providerCredentials.keyName, key))).limit(1);
  const dbValue = rows[0] ? decrypt(Buffer.from(rows[0].valueEncrypted), env_().ENCRYPTION_KEY) : null;
  // Env fallback
  const envValue = dbValue ?? (process.env[`${provider.toUpperCase()}_${key.toUpperCase()}`] ?? null);
  if (envValue) cache.set(cacheKey, { value: envValue, expiresAt: Date.now() + 30_000 });
  return envValue;
}
```

## Task 4: Test-connection per provider
- Stripe: `new Stripe(key).balance.retrieve()` should return 200.
- Tabby: GET /v1/me with key.
- Mapbox: small geocode call.
- SMTP: `nodemailer.createTransport({...}).verify()`.

## Task 5: Super-Admin Credentials UI
Per-provider card on `/admin/credentials`:
- Form fields per provider (Stripe needs secret + publishable + webhook secret; Tabby similar; Mapbox just access token; SMTP needs host/port/user/password/from/from-name).
- Each field shows masked value if set (`sk_•••••1234`), with "Edit" toggle.
- "Test connection" button at the bottom.
- Audit log row at the bottom of the card with last 5 events.

## Task 6: Wire payment + map + mail modules
Replace `process.env.STRIPE_SECRET_KEY` with `await getCredential('stripe','secret_key')` in `src/lib/payments/stripe.ts` (Plan #7). Same for Tabby, Mapbox (NEXT_PUBLIC token stays env — public), SMTP (Plan #12).

## Task 7: E2E
- Login as super-admin
- Visit /admin/credentials → cards render with masked values from env
- Type a new Stripe secret, click Save → success toast → field shows new masked value
- Click Test connection → success
- Verify audit_logs has `credential.set` entry

## Acceptance
- Setting a key in the UI takes effect within 30s (cache TTL) without restart
- Wrong key shown by "Test connection" failure with helpful message
- DB dump alone can't read secrets (no ENCRYPTION_KEY = no decryption)
- Audit log shows who changed what and when

## Not in this plan
- Key rotation reminders (Phase 2 polish)
- Per-environment isolation beyond `live` vs `test` (deferred)
- 2FA gate on the page (Plan #11 adds TOTP mandatory for super-admin)
