'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { enqueue, JOB_NAMES } from '@/lib/jobs/queue';
import { __clearCredentialCache } from '@/lib/credentials/store';

type Outcome = { ok: true; message: string } | { ok: false; error: string };

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return null;
  return user;
}

/** Enqueue a one-off DB backup job (the worker runs pg_dump → MinIO). */
export async function triggerManualBackup(): Promise<Outcome> {
  const user = await requireSuperadmin();
  if (!user) return { ok: false, error: 'forbidden' };
  try {
    await enqueue(JOB_NAMES.dailyPgDump, { manual: true });
    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'admin.backup_triggered',
      targetType: 'system',
    });
    revalidatePath('/admin');
    return { ok: true, message: 'Backup job enqueued.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'enqueue_failed' };
  }
}

/** Enqueue the driver-ping prune job immediately. */
export async function triggerPingPrune(): Promise<Outcome> {
  const user = await requireSuperadmin();
  if (!user) return { ok: false, error: 'forbidden' };
  try {
    await enqueue(JOB_NAMES.driverPingsPrune, { manual: true });
    revalidatePath('/admin');
    return { ok: true, message: 'Ping-prune job enqueued.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'enqueue_failed' };
  }
}

/**
 * Clear the in-process credentials cache. (Workers + other web instances clear
 * on their own 30s TTL; this is a best-effort local bust on this instance.)
 */
export async function clearCredentialsCache(): Promise<Outcome> {
  const user = await requireSuperadmin();
  if (!user) return { ok: false, error: 'forbidden' };
  __clearCredentialCache();
  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'admin.credentials_cache_cleared',
    targetType: 'system',
  });
  return { ok: true, message: 'Credentials cache cleared on this instance.' };
}
