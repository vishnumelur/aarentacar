import { describe, it, expect } from 'vitest';
import { formatBookingCode } from '@/lib/bookings/code';

describe('formatBookingCode', () => {
  it('pads to 5 digits', () => {
    expect(formatBookingCode(2026, 1)).toBe('AA-2026-00001');
    expect(formatBookingCode(2026, 42)).toBe('AA-2026-00042');
    expect(formatBookingCode(2026, 12345)).toBe('AA-2026-12345');
  });
  it('handles 6-digit overflow without truncating', () => {
    expect(formatBookingCode(2026, 100000)).toBe('AA-2026-100000');
  });
});
