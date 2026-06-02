/**
 * Cancellation policy refund computation (pure). Settings-driven: the policy
 * object is loaded from the `settings` table (key `cancellation_policy`) with
 * the spec §10.5 default below as fallback.
 */
export interface CancellationPolicy {
  /** Cancel more than this many hours before pickup → full refund. */
  freeUntilHoursBefore: number;
  /** Cancel more than this many hours before pickup → 50% refund. */
  halfUntilHoursBefore: number;
  /** If true, no refund once the vehicle has been handed over. */
  noRefundUntilHandover: boolean;
}

/** Spec §10.5: free until 24h before pickup, 50% until 2h before, then nothing. */
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeUntilHoursBefore: 24,
  halfUntilHoursBefore: 2,
  noRefundUntilHandover: true,
};

export function computeRefundOnCancel(
  now: Date,
  pickupAt: Date,
  totalAed: number,
  policy: CancellationPolicy,
): number {
  const hoursToPickup = (pickupAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursToPickup > policy.freeUntilHoursBefore) return totalAed;
  if (hoursToPickup > policy.halfUntilHoursBefore) return Math.floor(totalAed / 2);
  return 0;
}
