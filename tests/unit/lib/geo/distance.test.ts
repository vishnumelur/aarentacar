import { describe, it, expect } from 'vitest';
import { haversineKm } from '@/lib/geo/distance';

const BURJ_KHALIFA = { lat: 25.197197, lng: 55.274376 };
const DXB_AIRPORT = { lat: 25.252777, lng: 55.364445 };
const DUBAI_MARINA = { lat: 25.080406, lng: 55.140869 };
const ABU_DHABI = { lat: 24.466667, lng: 54.366669 };

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(BURJ_KHALIFA, BURJ_KHALIFA)).toBeCloseTo(0, 5);
  });

  it('Burj Khalifa to DXB airport is about 10.4 km', () => {
    // Real-world ground-truth (driving is ~13km, straight-line is ~10.4km)
    expect(haversineKm(BURJ_KHALIFA, DXB_AIRPORT)).toBeGreaterThan(10);
    expect(haversineKm(BURJ_KHALIFA, DXB_AIRPORT)).toBeLessThan(11);
  });

  it('Burj Khalifa to Dubai Marina is about 18 km', () => {
    expect(haversineKm(BURJ_KHALIFA, DUBAI_MARINA)).toBeGreaterThan(16);
    expect(haversineKm(BURJ_KHALIFA, DUBAI_MARINA)).toBeLessThan(20);
  });

  it('Dubai to Abu Dhabi is about 122 km', () => {
    expect(haversineKm(BURJ_KHALIFA, ABU_DHABI)).toBeGreaterThan(115);
    expect(haversineKm(BURJ_KHALIFA, ABU_DHABI)).toBeLessThan(130);
  });

  it('is commutative — distance(a,b) === distance(b,a)', () => {
    const ab = haversineKm(BURJ_KHALIFA, ABU_DHABI);
    const ba = haversineKm(ABU_DHABI, BURJ_KHALIFA);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('handles antipodal-ish points without NaN', () => {
    const north = { lat: 89.99, lng: 0 };
    const south = { lat: -89.99, lng: 0 };
    expect(Number.isNaN(haversineKm(north, south))).toBe(false);
  });
});
