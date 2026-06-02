import { describe, it, expect } from 'vitest';
import {
  computeAutoReleasableHolds,
  DEPOSIT_RELEASE_GRACE_MS,
  type HeldDeposit,
} from '@/lib/jobs/deposit-auto-release';

const now = new Date('2026-07-10T12:00:00Z');

function hold(over: Partial<HeldDeposit>): HeldDeposit {
  return {
    holdId: 'h1',
    status: 'held',
    returnCompletedAt: new Date(now.getTime() - 2 * DEPOSIT_RELEASE_GRACE_MS),
    damageEstimateAed: 0,
    ...over,
  };
}

describe('computeAutoReleasableHolds', () => {
  it('releases a clean hold past the grace period', () => {
    expect(computeAutoReleasableHolds([hold({})], now)).toEqual(['h1']);
  });

  it('skips holds still within the grace period', () => {
    expect(
      computeAutoReleasableHolds(
        [hold({ returnCompletedAt: new Date(now.getTime() - 10 * 60 * 1000) })],
        now,
      ),
    ).toEqual([]);
  });

  it('skips holds with outstanding damage', () => {
    expect(computeAutoReleasableHolds([hold({ damageEstimateAed: 300 })], now)).toEqual([]);
  });

  it('skips not-yet-returned bookings', () => {
    expect(computeAutoReleasableHolds([hold({ returnCompletedAt: null })], now)).toEqual([]);
  });

  it('skips already-captured / released holds', () => {
    expect(computeAutoReleasableHolds([hold({ status: 'captured' })], now)).toEqual([]);
    expect(computeAutoReleasableHolds([hold({ status: 'released' })], now)).toEqual([]);
  });

  it('exact grace boundary is eligible', () => {
    expect(
      computeAutoReleasableHolds(
        [hold({ returnCompletedAt: new Date(now.getTime() - DEPOSIT_RELEASE_GRACE_MS) })],
        now,
      ),
    ).toEqual(['h1']);
  });
});
