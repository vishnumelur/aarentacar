import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb } from '../../helpers/db';
import { users } from '@/db/schema';
import { stagePendingSecret, confirmSecret, verifyLoginCode } from '@/lib/totp/store';
import { generateTotp } from '@/lib/totp/totp';

async function clearTotpDomain(): Promise<void> {
  await testDb.execute(sql`TRUNCATE totp_secrets, sessions, users RESTART IDENTITY CASCADE`);
}

async function makeUser(): Promise<string> {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `totp-${Date.now()}@test.com`,
      passwordHash: 'x',
      fullName: 'TOTP User',
      role: 'superadmin',
    })
    .returning({ id: users.id });
  return u!.id;
}

// A base32 secret whose TOTP we can compute deterministically.
const SECRET = 'JBSWY3DPEHPK3PXP';

describe('verifyLoginCode replay guard', () => {
  beforeEach(async () => {
    await clearTotpDomain();
  });

  it('accepts a code once, then rejects the same code (replay within window)', async () => {
    const userId = await makeUser();

    await stagePendingSecret(userId, SECRET, []);
    // Confirm with the current code so the secret is enabled. confirmSecret does
    // NOT advance the replay counter, so the same code is still usable once at
    // login below.
    const code = generateTotp(SECRET);
    expect(await confirmSecret(userId, code)).toBe(true);

    // First login use of `code` succeeds and records its counter.
    expect(await verifyLoginCode(userId, code)).toBe(true);
    // Immediate replay of the very same code is rejected.
    expect(await verifyLoginCode(userId, code)).toBe(false);
  });
});
