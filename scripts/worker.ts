import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load env BEFORE any module that reads `@/lib/env` (ESM hoists static imports,
// so the real work is dynamically imported in main()).
for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

/**
 * pg-boss worker entrypoint (Plan #11). Starts the boss, registers handlers for
 * the deferred jobs, and (re)installs their cron schedules. Run via
 * `pnpm worker:start` (locally) or the `worker` service in docker-compose.
 *
 * Handler decision logic lives in src/lib/jobs/handlers.ts (unit-tested with
 * mocked deps); this file is the thin IO wiring that builds those deps.
 *
 * The send-email handler is Plan #12 — add it to JOB_NAMES + register below.
 */
async function main(): Promise<void> {
  const { and, eq, lt, isNotNull } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const {
    customerDocuments,
    paymentHolds,
    bookings,
    damageInspections,
    driverPings,
    auditLogs,
  } = await import('@/db/schema');
  const { getBoss, JOB_NAMES } = await import('@/lib/jobs/queue');
  const { runDocumentExpiry, runDepositRelease, runDriverPingsPrune } = await import(
    '@/lib/jobs/handlers'
  );
  const { systemReleaseDeposit } = await import('@/lib/actions/deposits');

  const audit = async (action: string, payload: Record<string, unknown>): Promise<void> => {
    await db.insert(auditLogs).values({ action, targetType: 'job', payload });
  };

  const boss = await getBoss();

  // pg-boss v12 requires queues to exist before sending/scheduling.
  for (const name of Object.values(JOB_NAMES)) {
    await boss.createQueue(name);
  }

  // ---- document-expiry --------------------------------------------------
  await boss.work(JOB_NAMES.documentExpiry, async () => {
    const result = await runDocumentExpiry({
      now: new Date(),
      loadDocs: async () => {
        const rows = await db
          .select({
            id: customerDocuments.id,
            status: customerDocuments.status,
            expiryDate: customerDocuments.expiryDate,
          })
          .from(customerDocuments);
        return rows.map((r) => ({ id: r.id, status: r.status, expiryDate: r.expiryDate }));
      },
      markExpired: async (ids) => {
        const { inArray } = await import('drizzle-orm');
        await db
          .update(customerDocuments)
          .set({ status: 'expired' })
          .where(inArray(customerDocuments.id, ids));
      },
      audit,
    });
    console.warn(`[document-expiry] expired ${result.expiredCount} docs`);
  });

  // ---- deposit-release --------------------------------------------------
  await boss.work(JOB_NAMES.depositRelease, async () => {
    const result = await runDepositRelease({
      now: new Date(),
      releaseHold: systemReleaseDeposit,
      loadHeldDeposits: async () => {
        const rows = await db
          .select({
            holdId: paymentHolds.id,
            status: paymentHolds.status,
            bookingId: paymentHolds.bookingId,
          })
          .from(paymentHolds)
          .where(eq(paymentHolds.status, 'held'));

        const out = [];
        for (const r of rows) {
          // Latest return inspection for this booking (if any).
          const [insp] = await db
            .select({
              createdAt: damageInspections.createdAt,
              damageEstimateAed: damageInspections.damageEstimateAed,
            })
            .from(damageInspections)
            .where(
              and(
                eq(damageInspections.bookingId, r.bookingId),
                eq(damageInspections.stage, 'return'),
              ),
            )
            .orderBy(damageInspections.createdAt)
            .limit(1);
          out.push({
            holdId: r.holdId,
            status: r.status,
            returnCompletedAt: insp?.createdAt ?? null,
            damageEstimateAed: insp?.damageEstimateAed ?? 0,
          });
        }
        return out;
      },
      audit,
    });
    console.warn(
      `[deposit-release] released ${result.releasedCount}, failed ${result.failedCount}`,
    );
  });

  // ---- driver-pings-prune ----------------------------------------------
  await boss.work(JOB_NAMES.driverPingsPrune, async () => {
    const result = await runDriverPingsPrune({
      now: new Date(),
      retentionMs: 24 * 60 * 60 * 1000,
      audit,
      deleteOlderThan: async (cutoff) => {
        const deleted = await db
          .delete(driverPings)
          .where(lt(driverPings.recordedAt, cutoff))
          .returning({ id: driverPings.id });
        return deleted.length;
      },
    });
    console.warn(`[driver-pings-prune] deleted ${result.deletedCount} pings`);
  });

  // ---- daily-pg-dump ----------------------------------------------------
  await boss.work(JOB_NAMES.dailyPgDump, async () => {
    const { runPgDumpToBackups } = await import('@/lib/jobs/pg-dump');
    try {
      const key = await runPgDumpToBackups();
      await audit('job.daily_pg_dump.completed', { key });
      console.warn(`[daily-pg-dump] uploaded ${key}`);
    } catch (err) {
      await audit('job.daily_pg_dump.failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  });

  // ---- schedules (cron, server-local time) ------------------------------
  // document-expiry daily 02:00; deposit-release every 15 min;
  // driver-pings-prune daily 03:00; daily-pg-dump daily 02:00.
  await boss.schedule(JOB_NAMES.documentExpiry, '0 2 * * *');
  await boss.schedule(JOB_NAMES.depositRelease, '*/15 * * * *');
  await boss.schedule(JOB_NAMES.driverPingsPrune, '0 3 * * *');
  await boss.schedule(JOB_NAMES.dailyPgDump, '0 2 * * *');

  // Mark unused imports as intentionally available for future handlers.
  void bookings;
  void isNotNull;

  console.warn('[worker] pg-boss started; handlers + schedules registered.');

  const shutdown = async (): Promise<void> => {
    console.warn('[worker] shutting down…');
    const { stopBoss } = await import('@/lib/jobs/queue');
    await stopBoss();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
