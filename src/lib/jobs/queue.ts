import { PgBoss } from 'pg-boss';
import type { SendOptions, QueueResult, JobWithMetadata } from 'pg-boss';
import { env } from '@/lib/env';

/**
 * pg-boss singleton (Plan #11). pg-boss runs its own job tables in the same
 * Postgres database. We lazily start a single boss instance per process and
 * reuse it for enqueue / list / cancel from the app, and for the long-running
 * worker (scripts/worker.ts) that registers the handlers.
 */

export const JOB_NAMES = {
  documentExpiry: 'document-expiry',
  depositRelease: 'deposit-release',
  driverPingsPrune: 'driver-pings-prune',
  dailyPgDump: 'daily-pg-dump',
  // send-email lands in Plan #12 — registration list stays easy to extend.
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({ connectionString: env().DATABASE_URL });
      boss.on('error', (err: Error) => console.error('[pg-boss]', err));
      await boss.start();
      return boss;
    })();
  }
  return bossPromise;
}

/** Enqueue a job. Returns the job id (or null if pg-boss dedupes it). */
export async function enqueue<T extends object>(
  name: JobName,
  data: T,
  options?: SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(name, data, options ?? {});
}

export interface QueueSummary {
  name: string;
  queued: number;
  active: number;
  deferred: number;
  total: number;
}

/** Per-queue counts (queued/active/deferred/total) for the jobs dashboard. */
export async function listQueueSummaries(): Promise<QueueSummary[]> {
  const boss = await getBoss();
  const queues = await boss.getQueues();
  return queues.map((q: QueueResult) => ({
    name: q.name,
    queued: q.queuedCount,
    active: q.activeCount,
    deferred: q.deferredCount,
    total: q.totalCount,
  }));
}

/** Total pending (queued + active) job count across all queues, for health. */
export async function pendingJobCount(): Promise<number> {
  const summaries = await listQueueSummaries();
  return summaries.reduce((sum, q) => sum + q.queued + q.active, 0);
}

export interface BrowsableJob {
  id: string;
  name: string;
  state: string;
  createdOn: Date;
  startedOn: Date | null;
  completedOn: Date | null;
  retryCount: number;
  output: unknown;
}

/** List recent jobs for a queue (newest first). Used by the jobs browser. */
export async function findRecentJobs(name: JobName, limit = 50): Promise<BrowsableJob[]> {
  const boss = await getBoss();
  // findJobs without `queued:true` returns completed/failed/cancelled history.
  const jobs = await boss.findJobs<object>(name, {});
  return jobs
    .map((j: JobWithMetadata<object>) => ({
      id: j.id,
      name: j.name,
      state: j.state,
      createdOn: j.createdOn,
      startedOn: j.startedOn ?? null,
      completedOn: j.completedOn ?? null,
      retryCount: j.retryCount,
      output: j.output,
    }))
    .sort((a: BrowsableJob, b: BrowsableJob) => b.createdOn.getTime() - a.createdOn.getTime())
    .slice(0, limit);
}

export async function retryJob(name: JobName, id: string): Promise<void> {
  const boss = await getBoss();
  await boss.retry(name, id);
}

export async function cancelJob(name: JobName, id: string): Promise<void> {
  const boss = await getBoss();
  await boss.cancel(name, id);
}

export async function stopBoss(): Promise<void> {
  if (bossPromise) {
    const boss = await bossPromise;
    await boss.stop({ graceful: true });
    bossPromise = null;
  }
}
