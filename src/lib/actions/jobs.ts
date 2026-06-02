'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { retryJob, cancelJob, JOB_NAMES, type JobName } from '@/lib/jobs/queue';

type Outcome = { ok: true } | { ok: false; error: 'forbidden' | 'invalid_input' | 'failed' };

const VALID_NAMES = new Set<string>(Object.values(JOB_NAMES));

export async function retryJobAction(formData: FormData): Promise<Outcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };
  const name = String(formData.get('name') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!VALID_NAMES.has(name) || !id) return { ok: false, error: 'invalid_input' };
  try {
    await retryJob(name as JobName, id);
    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'job.retried',
      targetType: 'job',
      targetId: id,
      payload: { name },
    });
    revalidatePath('/admin/jobs');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function cancelJobAction(formData: FormData): Promise<Outcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };
  const name = String(formData.get('name') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!VALID_NAMES.has(name) || !id) return { ok: false, error: 'invalid_input' };
  try {
    await cancelJob(name as JobName, id);
    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'job.cancelled',
      targetType: 'job',
      targetId: id,
      payload: { name },
    });
    revalidatePath('/admin/jobs');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
