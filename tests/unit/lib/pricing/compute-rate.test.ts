import { describe, it, expect } from 'vitest';
import { computeBestRate, type Rate } from '@/lib/pricing/compute-rate';

const HOURLY: Rate = { rateKind: 'hourly', priceAed: 100 };
const DAILY: Rate = { rateKind: 'daily', priceAed: 350 };
const WEEKLY: Rate = { rateKind: 'weekly', priceAed: 2000 };
const MONTHLY: Rate = { rateKind: 'monthly', priceAed: 6500 };
const PACKAGE_3H: Rate = {
  rateKind: 'package',
  priceAed: 220,
  packageHours: 3,
  packageName: 'Half-Day Tour',
};

describe('computeBestRate', () => {
  it('picks hourly for a 3-hour booking when cheaper than package', () => {
    const pick = computeBestRate(
      [HOURLY, DAILY],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-01T13:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'hourly', quantity: 3, totalAed: 300 });
  });

  it('picks package for a 3-hour booking when cheaper than hourly', () => {
    const pick = computeBestRate(
      [HOURLY, PACKAGE_3H],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-01T13:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'package', priceAed: 220, packageName: 'Half-Day Tour' });
  });

  it('picks daily for a 24h booking when daily beats 24x hourly', () => {
    const pick = computeBestRate(
      [HOURLY, DAILY],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-02T10:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'daily', quantity: 1, totalAed: 350 });
  });

  it('rounds up to next day for a 25-hour window', () => {
    const pick = computeBestRate(
      [DAILY],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-02T11:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'daily', quantity: 2, totalAed: 700 });
  });

  it('picks weekly when 7+ days', () => {
    const pick = computeBestRate(
      [DAILY, WEEKLY],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-08T10:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'weekly', quantity: 1, totalAed: 2000 });
  });

  it('picks monthly for a 30-day stay', () => {
    const pick = computeBestRate(
      [DAILY, WEEKLY, MONTHLY],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-31T10:00:00Z'),
    );
    expect(pick).toMatchObject({ unit: 'monthly', quantity: 1, totalAed: 6500 });
  });

  it('returns null when no rate cards', () => {
    expect(
      computeBestRate(
        [],
        new Date('2026-07-01T10:00:00Z'),
        new Date('2026-07-02T10:00:00Z'),
      ),
    ).toBeNull();
  });

  it('returns null for zero or negative duration', () => {
    expect(
      computeBestRate(
        [DAILY],
        new Date('2026-07-01T10:00:00Z'),
        new Date('2026-07-01T10:00:00Z'),
      ),
    ).toBeNull();
  });

  it('package not eligible when hours > packageHours', () => {
    const pick = computeBestRate(
      [HOURLY, PACKAGE_3H],
      new Date('2026-07-01T10:00:00Z'),
      new Date('2026-07-01T14:00:00Z'), // 4 hours, > package's 3
    );
    // Only hourly is eligible, so we should NOT see package
    expect(pick?.unit).toBe('hourly');
    expect(pick?.quantity).toBe(4);
  });
});
