import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sql, and, eq } from 'drizzle-orm';
import { testDb } from '../../helpers/db';
import { users, providerCredentials, auditLogs } from '@/db/schema';
import {
  getCredential,
  setCredential,
  listCredentials,
  __clearCredentialCache,
} from '@/lib/credentials/store';
import * as getUser from '@/lib/auth/get-current-user';
import type { User } from '@/db/schema';

async function clearCredsDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE provider_credentials, audit_logs, sessions, users RESTART IDENTITY CASCADE`,
  );
}

async function makeSuperadmin(): Promise<User> {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `sa-${Date.now()}@test.com`,
      passwordHash: 'x',
      fullName: 'Super Admin',
      role: 'superadmin',
    })
    .returning();
  return u!;
}

async function makeManager(): Promise<User> {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `mgr-${Date.now()}@test.com`,
      passwordHash: 'x',
      fullName: 'Manager',
      role: 'manager',
    })
    .returning();
  return u!;
}

describe('credential store', () => {
  beforeEach(async () => {
    await clearCredsDomain();
    __clearCredentialCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('set → read back decrypts to the original value', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);

    await setCredential('stripe', 'secret_key', 'sk_live_abcd1234');
    __clearCredentialCache();
    const got = await getCredential('stripe', 'secret_key');
    expect(got).toBe('sk_live_abcd1234');
  });

  it('stores ciphertext (not plaintext) in the DB and a masked last_four', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);

    await setCredential('stripe', 'secret_key', 'sk_live_abcd1234');
    const [row] = await testDb
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.provider, 'stripe'),
          eq(providerCredentials.keyName, 'secret_key'),
        ),
      )
      .limit(1);
    expect(row).toBeDefined();
    expect(Buffer.isBuffer(row!.valueEncrypted)).toBe(true);
    expect(row!.valueEncrypted.toString('utf8')).not.toContain('sk_live_abcd1234');
    expect(row!.lastFour).toBe('••1234');
  });

  it('writes a credential.set audit row', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);

    await setCredential('stripe', 'secret_key', 'sk_live_abcd1234');
    const rows = await testDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'credential.set'));
    expect(rows.length).toBe(1);
    expect(rows[0]!.actorUserId).toBe(sa.id);
    expect(rows[0]!.targetId).toBe('stripe.secret_key');
  });

  it('upserts: setting the same key again overwrites the value', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);

    await setCredential('stripe', 'secret_key', 'sk_live_first0001');
    await setCredential('stripe', 'secret_key', 'sk_live_second002');
    __clearCredentialCache();
    expect(await getCredential('stripe', 'secret_key')).toBe('sk_live_second002');

    const rows = await testDb
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.provider, 'stripe'),
          eq(providerCredentials.keyName, 'secret_key'),
        ),
      );
    expect(rows.length).toBe(1);
  });

  it('rejects a non-superadmin (manager) caller', async () => {
    const mgr = await makeManager();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(mgr);
    await expect(setCredential('stripe', 'secret_key', 'x')).rejects.toThrow(/forbidden/);
  });

  it('rejects an unauthenticated caller', async () => {
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(null);
    await expect(setCredential('stripe', 'secret_key', 'x')).rejects.toThrow(/forbidden/);
  });

  it('falls back to env when no DB value exists', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_env_fallback99';
    __clearCredentialCache();
    expect(await getCredential('stripe', 'secret_key')).toBe('sk_env_fallback99');
  });

  it('DB value takes precedence over env fallback', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);
    process.env.STRIPE_SECRET_KEY = 'sk_env_fallback99';
    await setCredential('stripe', 'secret_key', 'sk_db_wins0001');
    __clearCredentialCache();
    expect(await getCredential('stripe', 'secret_key')).toBe('sk_db_wins0001');
  });

  it('returns null when neither DB nor env has the value', async () => {
    __clearCredentialCache();
    expect(await getCredential('mapbox', 'access_token')).toBeNull();
  });

  it('listCredentials returns masked metadata (no plaintext) for set keys', async () => {
    const sa = await makeSuperadmin();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(sa);
    await setCredential('stripe', 'secret_key', 'sk_live_abcd1234');

    const list = await listCredentials();
    const entry = list.find((c) => c.provider === 'stripe' && c.keyName === 'secret_key');
    expect(entry).toBeDefined();
    expect(entry!.lastFour).toBe('••1234');
    // The listing must never carry the decrypted secret.
    expect(JSON.stringify(list)).not.toContain('sk_live_abcd1234');
  });
});
