import { describe, it, expect } from 'vitest';
import { resolveStatus } from '@/lib/tracking/status';

describe('resolveStatus', () => {
  it('returns assigned when ETA is unknown', () => {
    expect(resolveStatus({ durationSec: null, distanceMeters: null, nearSinceMs: null }).key).toBe(
      'assigned',
    );
  });

  it('returns on_the_way when ETA > 15 min', () => {
    expect(
      resolveStatus({ durationSec: 16 * 60, distanceMeters: 9000, nearSinceMs: null }).key,
    ).toBe('on_the_way');
  });

  it('returns minutes_away (with n) when 3 < ETA <= 15 min', () => {
    const s = resolveStatus({ durationSec: 10 * 60, distanceMeters: 4000, nearSinceMs: null });
    expect(s.key).toBe('minutes_away');
    expect(s.minutes).toBe(10);
  });

  it('returns almost_there when ETA <= 3 min', () => {
    expect(
      resolveStatus({ durationSec: 2 * 60, distanceMeters: 800, nearSinceMs: null }).key,
    ).toBe('almost_there');
  });

  it('returns arrived when within 100m for >= 20s, regardless of ETA', () => {
    const now = 100_000;
    const s = resolveStatus(
      { durationSec: 30, distanceMeters: 50, nearSinceMs: now - 21_000 },
      now,
    );
    expect(s.key).toBe('arrived');
  });

  it('does not declare arrived if within 100m for < 20s', () => {
    const now = 100_000;
    const s = resolveStatus(
      { durationSec: 30, distanceMeters: 50, nearSinceMs: now - 5_000 },
      now,
    );
    expect(s.key).not.toBe('arrived');
  });
});
