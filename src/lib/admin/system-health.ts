import { sql, gte, like, and } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { env } from '@/lib/env';
import { pendingJobCount } from '@/lib/jobs/queue';

export interface SystemHealth {
  db: { ok: boolean; latencyMs: number | null };
  jobs: { pending: number | null; ok: boolean };
  errors: { failedLast24h: number };
  minio: { ok: boolean; note: string };
  build: { gitSha: string; nodeEnv: string };
}

/** Gather the super-admin cockpit health snapshot. Each probe degrades
 *  gracefully so one failing dependency never blanks the whole page. */
export async function getSystemHealth(): Promise<SystemHealth> {
  // DB ping + latency.
  let dbOk = false;
  let latencyMs: number | null = null;
  try {
    const start = Date.now();
    await db.execute(sql`select 1`);
    latencyMs = Date.now() - start;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // pg-boss pending jobs (queued + active). Null if boss can't be reached.
  let pending: number | null = null;
  let jobsOk = false;
  try {
    pending = await pendingJobCount();
    jobsOk = true;
  } catch {
    pending = null;
    jobsOk = false;
  }

  // Error rate: audit rows whose action ends with `.failed` in the last 24h.
  let failedLast24h = 0;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(gte(auditLogs.createdAt, since), like(auditLogs.action, '%.failed')));
    failedLast24h = row?.count ?? 0;
  } catch {
    failedLast24h = 0;
  }

  // MinIO: `mc admin info` is not available from the app runtime; we mark it
  // verify-on-deploy rather than block the page. A HEAD on a bucket could be
  // added, but disk-usage truly needs the admin API.
  const minio = {
    ok: false,
    note: 'Disk usage requires `mc admin info` — verify on deploy (Plan #13).',
  };

  return {
    db: { ok: dbOk, latencyMs },
    jobs: { pending, ok: jobsOk },
    errors: { failedLast24h },
    minio,
    build: { gitSha: env().GIT_SHA ?? 'dev', nodeEnv: env().NODE_ENV },
  };
}
