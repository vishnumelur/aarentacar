import { describe, it, expect } from 'vitest';
import {
  computeRefundOnCancel,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicy,
} from '@/lib/payments/cancellation';

// Spec §10.5 default: free until 24h before pickup, 50% until 2h before, then nothing.
const policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY;

const pickup = new Date('2026-07-10T12:00:00Z');

function at(hoursBefore: number): Date {
  return new Date(pickup.getTime() - hoursBefore * 3_600_000);
}

describe('computeRefundOnCancel', () => {
  it('full refund when cancelling more than freeUntilHoursBefore (24h) ahead', () => {
    expect(computeRefundOnCancel(at(48), pickup, 1000, policy)).toBe(1000);
    expect(computeRefundOnCancel(at(25), pickup, 1000, policy)).toBe(1000);
  });

  it('half refund between halfUntil (2h) and freeUntil (24h)', () => {
    expect(computeRefundOnCancel(at(23), pickup, 1000, policy)).toBe(500);
    expect(computeRefundOnCancel(at(3), pickup, 1000, policy)).toBe(500);
  });

  it('floors the half refund for odd totals', () => {
    expect(computeRefundOnCancel(at(10), pickup, 999, policy)).toBe(499);
  });

  it('no refund within halfUntilHoursBefore (2h) of pickup', () => {
    expect(computeRefundOnCancel(at(2), pickup, 1000, policy)).toBe(0);
    expect(computeRefundOnCancel(at(1), pickup, 1000, policy)).toBe(0);
  });

  it('no refund after pickup has passed', () => {
    expect(computeRefundOnCancel(at(-5), pickup, 1000, policy)).toBe(0);
  });

  it('exact boundary at freeUntil is not free (strictly greater required)', () => {
    expect(computeRefundOnCancel(at(24), pickup, 1000, policy)).toBe(500);
  });

  it('exact boundary at halfUntil is not half (strictly greater required)', () => {
    expect(computeRefundOnCancel(at(2), pickup, 1000, policy)).toBe(0);
  });
});
