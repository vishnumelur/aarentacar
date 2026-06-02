/**
 * Pure function: given held deposits and "now", return the hold IDs that are
 * eligible for automatic release.
 *
 * A deposit hold auto-releases when:
 *   - it is still `held`
 *   - its booking's return inspection has cleared (no outstanding damage), and
 *   - the grace period (default 1 hour) since the return completed has elapsed.
 *
 * The real runner in Plan #11 wires this to pg-boss + calls `releaseDeposit`.
 */

export interface HeldDeposit {
  holdId: string;
  status: 'held' | 'released' | 'captured' | 'partially_captured';
  /** When the return inspection completed (null = not yet returned). */
  returnCompletedAt: Date | null;
  /** Outstanding damage estimate in AED from the return inspection. */
  damageEstimateAed: number;
}

export const DEPOSIT_RELEASE_GRACE_MS = 60 * 60 * 1000; // 1 hour

export function computeAutoReleasableHolds(
  holds: HeldDeposit[],
  now: Date,
  graceMs: number = DEPOSIT_RELEASE_GRACE_MS,
): string[] {
  return holds
    .filter(
      (h) =>
        h.status === 'held' &&
        h.damageEstimateAed === 0 &&
        h.returnCompletedAt !== null &&
        now.getTime() - h.returnCompletedAt.getTime() >= graceMs,
    )
    .map((h) => h.holdId);
}
