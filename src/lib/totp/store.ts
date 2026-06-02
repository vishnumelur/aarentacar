import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { totpSecrets, type TotpSecret } from '@/db/schema';
import { env } from '@/lib/env';
import { encrypt, decrypt } from '@/lib/crypto/aes-gcm';
import { verifyTotp } from './totp';

/**
 * Server-only TOTP store (Plan #11). Encrypts the shared secret at rest with
 * AES-256-GCM (Plan #9 helper) and bcrypt-hashes the single-use recovery codes.
 * Not a 'use server' module so it can export sync/typed helpers and be imported
 * by the login route and server actions.
 */

const RECOVERY_CODE_COST = 10;

export async function getTotpRow(userId: string): Promise<TotpSecret | null> {
  const [row] = await db.select().from(totpSecrets).where(eq(totpSecrets.userId, userId)).limit(1);
  return row ?? null;
}

/** True only when a confirmed (enabled) TOTP secret exists for the user. */
export async function isTotpEnabled(userId: string): Promise<boolean> {
  const row = await getTotpRow(userId);
  return row !== null && row.enabledAt !== null;
}

export function decryptSecret(row: TotpSecret): string {
  return decrypt(Buffer.from(row.secretEncrypted), env().ENCRYPTION_KEY);
}

/**
 * Upsert a pending (not-yet-confirmed) secret + freshly hashed recovery codes.
 * Returns nothing; the caller already holds the plaintext secret + codes to show.
 */
export async function stagePendingSecret(
  userId: string,
  secretBase32: string,
  recoveryCodesPlain: string[],
): Promise<void> {
  const secretEncrypted = encrypt(secretBase32, env().ENCRYPTION_KEY);
  const recoveryCodesHashed = await Promise.all(
    recoveryCodesPlain.map((c) => bcrypt.hash(c.toUpperCase(), RECOVERY_CODE_COST)),
  );
  await db
    .insert(totpSecrets)
    .values({ userId, secretEncrypted, recoveryCodesHashed, enabledAt: null })
    .onConflictDoUpdate({
      target: totpSecrets.userId,
      set: { secretEncrypted, recoveryCodesHashed, enabledAt: null, updatedAt: new Date() },
    });
}

/** Confirm setup: verify the first code against the staged secret, then enable. */
export async function confirmSecret(userId: string, code: string): Promise<boolean> {
  const row = await getTotpRow(userId);
  if (!row) return false;
  const secret = decryptSecret(row);
  if (!verifyTotp(secret, code)) return false;
  await db
    .update(totpSecrets)
    .set({ enabledAt: new Date(), lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(totpSecrets.userId, userId));
  return true;
}

/** Verify a login-time TOTP code against an enabled secret. */
export async function verifyLoginCode(userId: string, code: string): Promise<boolean> {
  const row = await getTotpRow(userId);
  if (!row || row.enabledAt === null) return false;
  const secret = decryptSecret(row);
  if (!verifyTotp(secret, code)) return false;
  await db
    .update(totpSecrets)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(totpSecrets.userId, userId));
  return true;
}

/** Verify + consume a single-use recovery code (constant-ish time over all hashes). */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const row = await getTotpRow(userId);
  if (!row || row.enabledAt === null) return false;
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < row.recoveryCodesHashed.length; i++) {
    const hash = row.recoveryCodesHashed[i]!;
    if (await bcrypt.compare(normalized, hash)) {
      const remaining = row.recoveryCodesHashed.filter((_, idx) => idx !== i);
      await db
        .update(totpSecrets)
        .set({ recoveryCodesHashed: remaining, lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(totpSecrets.userId, userId));
      return true;
    }
  }
  return false;
}

export async function deleteTotp(userId: string): Promise<void> {
  await db.delete(totpSecrets).where(eq(totpSecrets.userId, userId));
}
