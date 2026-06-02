'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  generateTotpSecret,
  buildOtpauthUri,
  generateRecoveryCodes,
} from '@/lib/totp/totp';
import {
  stagePendingSecret,
  confirmSecret,
  isTotpEnabled,
  deleteTotp,
} from '@/lib/totp/store';

const ISSUER = 'AA Rent A Car';

export type BeginSetupOutcome =
  | { ok: true; secret: string; otpauthUri: string; recoveryCodes: string[] }
  | { ok: false; error: 'forbidden' | 'already_enabled' };

/**
 * Generate a fresh secret + 10 recovery codes, stage them (pending, encrypted),
 * and return the plaintext once for the user to scan/save. Re-running before
 * confirmation regenerates — only `confirmSetup` flips it to enabled.
 */
export async function beginTotpSetup(): Promise<BeginSetupOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };
  if (await isTotpEnabled(user.id)) return { ok: false, error: 'already_enabled' };

  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  await stagePendingSecret(user.id, secret, recoveryCodes);

  const otpauthUri = buildOtpauthUri({ secret, accountName: user.email, issuer: ISSUER });
  return { ok: true, secret, otpauthUri, recoveryCodes };
}

export type ConfirmSetupOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_code' };

export async function confirmTotpSetup(formData: FormData): Promise<ConfirmSetupOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };

  const code = String(formData.get('code') ?? '').trim();
  const ok = await confirmSecret(user.id, code);
  if (!ok) return { ok: false, error: 'invalid_code' };

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'auth.totp.enabled',
    targetType: 'user',
    targetId: user.id,
  });
  revalidatePath('/admin/security/setup-2fa');
  return { ok: true };
}

export type DisableOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' };

export async function disableTotp(): Promise<DisableOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };
  await deleteTotp(user.id);
  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'auth.totp.disabled',
    targetType: 'user',
    targetId: user.id,
  });
  revalidatePath('/admin/security/setup-2fa');
  return { ok: true };
}
