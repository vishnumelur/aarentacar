import { describe, it, expect } from 'vitest';
import { hasOverlap, type ExistingBooking } from '@/lib/pricing/availability';

const v = 'v-1';

function b(
  pickup: string,
  ret: string,
  status: ExistingBooking['status'] = 'approved',
  vehicleId = v,
): ExistingBooking {
  return {
    vehicleId,
    pickupAt: new Date(pickup),
    returnAt: new Date(ret),
    status,
  };
}

describe('hasOverlap', () => {
  it('detects exact window overlap', () => {
    expect(
      hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z')], {
        vehicleId: v,
        pickupAt: new Date('2026-07-01T10:00:00Z'),
        returnAt: new Date('2026-07-05T10:00:00Z'),
      }),
    ).toBe(true);
  });

  it('detects partial overlap (existing starts before, request starts during)', () => {
    expect(
      hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-10T10:00:00Z')], {
        vehicleId: v,
        pickupAt: new Date('2026-07-05T10:00:00Z'),
        returnAt: new Date('2026-07-12T10:00:00Z'),
      }),
    ).toBe(true);
  });

  it('treats adjacent windows as non-overlapping', () => {
    expect(
      hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z')], {
        vehicleId: v,
        pickupAt: new Date('2026-07-05T10:00:00Z'),
        returnAt: new Date('2026-07-08T10:00:00Z'),
      }),
    ).toBe(false);
  });

  it('ignores different vehicle', () => {
    expect(
      hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z', 'approved', 'other')], {
        vehicleId: v,
        pickupAt: new Date('2026-07-01T10:00:00Z'),
        returnAt: new Date('2026-07-05T10:00:00Z'),
      }),
    ).toBe(false);
  });

  it.each(['completed', 'cancelled', 'refunded', 'draft', 'pending_kyc'] as const)(
    'ignores non-active status %s',
    (status) => {
      expect(
        hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z', status)], {
          vehicleId: v,
          pickupAt: new Date('2026-07-02T10:00:00Z'),
          returnAt: new Date('2026-07-04T10:00:00Z'),
        }),
      ).toBe(false);
    },
  );

  it.each(['pending_payment', 'pending_approval', 'approved', 'dispatched', 'in_progress'] as const)(
    'blocks active status %s',
    (status) => {
      expect(
        hasOverlap([b('2026-07-01T10:00:00Z', '2026-07-05T10:00:00Z', status)], {
          vehicleId: v,
          pickupAt: new Date('2026-07-02T10:00:00Z'),
          returnAt: new Date('2026-07-04T10:00:00Z'),
        }),
      ).toBe(true);
    },
  );

  it('returns false when there are no existing bookings', () => {
    expect(
      hasOverlap([], {
        vehicleId: v,
        pickupAt: new Date('2026-07-01T10:00:00Z'),
        returnAt: new Date('2026-07-05T10:00:00Z'),
      }),
    ).toBe(false);
  });
});
