/**
 * Pure status-pill state machine (Swiggy-style stages). Kept separate from
 * the React component so the transition logic is unit-testable.
 */

export type StatusKey =
  | 'assigned'
  | 'on_the_way'
  | 'minutes_away'
  | 'almost_there'
  | 'arrived';

export interface StatusInput {
  /** Server ETA in seconds, or null when unknown. */
  durationSec: number | null;
  /** Straight-line distance driver→pickup in metres, or null. */
  distanceMeters: number | null;
  /** Timestamp (ms) the driver first came within the arrival radius, or null. */
  nearSinceMs: number | null;
}

export interface StatusResult {
  key: StatusKey;
  /** Populated only for `minutes_away`. */
  minutes?: number;
}

const ARRIVED_RADIUS_M = 100;
const ARRIVED_DWELL_MS = 20_000;

export function resolveStatus(input: StatusInput, now: number = Date.now()): StatusResult {
  const { durationSec, distanceMeters, nearSinceMs } = input;

  // Arrival wins: within radius for the dwell window.
  if (
    distanceMeters !== null &&
    distanceMeters < ARRIVED_RADIUS_M &&
    nearSinceMs !== null &&
    now - nearSinceMs >= ARRIVED_DWELL_MS
  ) {
    return { key: 'arrived' };
  }

  if (durationSec === null) {
    return { key: 'assigned' };
  }

  const minutes = Math.ceil(durationSec / 60);

  if (durationSec <= 3 * 60) {
    return { key: 'almost_there' };
  }
  if (durationSec <= 15 * 60) {
    return { key: 'minutes_away', minutes };
  }
  return { key: 'on_the_way' };
}
