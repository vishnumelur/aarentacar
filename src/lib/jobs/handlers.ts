/**
 * Pure job-handler orchestration logic (Plan #11).
 *
 * Each `run*` function takes its IO as injected dependencies so the decision
 * logic is unit-testable without a running pg-boss or DB. The real wiring
 * (DB queries, Stripe calls, audit inserts) lives in scripts/worker.ts which
 * builds the deps and passes them in.
 */

import {
  computeExpiredDocs,
  type DocSummary,
} from './check-document-expiry';
import {
  computeAutoReleasableHolds,
  type HeldDeposit,
} from './deposit-auto-release';

type AuditFn = (action: string, payload: Record<string, unknown>) => Promise<void>;

export interface DocumentExpiryDeps {
  loadDocs: () => Promise<DocSummary[]>;
  markExpired: (ids: string[]) => Promise<void>;
  audit: AuditFn;
  now: Date;
}

export async function runDocumentExpiry(
  deps: DocumentExpiryDeps,
): Promise<{ expiredCount: number }> {
  const docs = await deps.loadDocs();
  const expiredIds = computeExpiredDocs(docs, deps.now);
  if (expiredIds.length > 0) {
    await deps.markExpired(expiredIds);
  }
  await deps.audit('job.document_expiry.completed', { expiredCount: expiredIds.length });
  return { expiredCount: expiredIds.length };
}

export interface DepositReleaseDeps {
  loadHeldDeposits: () => Promise<HeldDeposit[]>;
  releaseHold: (holdId: string) => Promise<void>;
  audit: AuditFn;
  now: Date;
}

export async function runDepositRelease(
  deps: DepositReleaseDeps,
): Promise<{ releasedCount: number; failedCount: number }> {
  const holds = await deps.loadHeldDeposits();
  const eligible = computeAutoReleasableHolds(holds, deps.now);
  let releasedCount = 0;
  let failedCount = 0;
  for (const holdId of eligible) {
    try {
      await deps.releaseHold(holdId);
      releasedCount++;
    } catch (err) {
      failedCount++;
      await deps.audit('job.deposit_release.failed', {
        holdId,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
  await deps.audit('job.deposit_release.completed', { releasedCount, failedCount });
  return { releasedCount, failedCount };
}

export interface DriverPingsPruneDeps {
  deleteOlderThan: (cutoff: Date) => Promise<number>;
  audit: AuditFn;
  now: Date;
  retentionMs: number;
}

export async function runDriverPingsPrune(
  deps: DriverPingsPruneDeps,
): Promise<{ deletedCount: number }> {
  const cutoff = new Date(deps.now.getTime() - deps.retentionMs);
  const deletedCount = await deps.deleteOlderThan(cutoff);
  await deps.audit('job.driver_pings_prune.completed', { deletedCount });
  return { deletedCount };
}
