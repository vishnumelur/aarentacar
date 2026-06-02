import { describe, it, expect } from 'vitest';
import {
  bearing,
  lerp,
  alongPolyline,
  formatEta,
  haversineMeters,
  type LatLng,
} from '@/lib/tracking/interpolation';

const NY: LatLng = { lat: 40.7128, lng: -74.006 };
const LONDON: LatLng = { lat: 51.5074, lng: -0.1278 };

describe('bearing', () => {
  it('NY → London is roughly 51° (north-east great-circle initial bearing)', () => {
    const b = bearing(NY, LONDON);
    expect(b).toBeGreaterThan(48);
    expect(b).toBeLessThan(54);
  });

  it('due north is 0°', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 1);
  });

  it('due east is 90°', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 1);
  });

  it('always returns a value in [0, 360)', () => {
    const b = bearing({ lat: 0, lng: 0 }, { lat: -1, lng: -1 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('lerp', () => {
  it('t=0 returns a', () => {
    expect(lerp({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0)).toEqual({ lat: 0, lng: 0 });
  });

  it('t=1 returns b', () => {
    expect(lerp({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 1)).toEqual({ lat: 10, lng: 20 });
  });

  it('t=0.5 on the equator returns the midpoint', () => {
    const mid = lerp({ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, 0.5);
    expect(mid.lat).toBeCloseTo(0, 6);
    expect(mid.lng).toBeCloseTo(5, 6);
  });

  it('clamps t outside [0,1]', () => {
    expect(lerp({ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, -1).lat).toBe(0);
    expect(lerp({ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, 2).lat).toBe(10);
  });
});

describe('alongPolyline', () => {
  const line: LatLng[] = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
  ];

  it('t=0 returns the first coord', () => {
    expect(alongPolyline(line, 0)).toEqual({ lat: 0, lng: 0 });
  });

  it('t=1 returns the last coord', () => {
    expect(alongPolyline(line, 1)).toEqual({ lat: 0, lng: 10 });
  });

  it('t=0.5 returns the midpoint of a 2-point line', () => {
    const mid = alongPolyline(line, 0.5);
    expect(mid.lat).toBeCloseTo(0, 6);
    expect(mid.lng).toBeCloseTo(5, 6);
  });

  it('t=0.5 on an L-shaped equal-length 3-point line lands at the corner', () => {
    const l: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
    ];
    // Two segments roughly equal in length; midpoint of total distance
    // sits near the corner vertex.
    const mid = alongPolyline(l, 0.5);
    expect(mid.lng).toBeCloseTo(10, 0);
  });

  it('handles a single-point line gracefully', () => {
    expect(alongPolyline([{ lat: 5, lng: 5 }], 0.7)).toEqual({ lat: 5, lng: 5 });
  });
});

describe('formatEta', () => {
  it('renders English minutes', () => {
    expect(formatEta(12 * 60, 'en')).toBe('12 min');
  });

  it('renders Arabic minutes', () => {
    expect(formatEta(12 * 60, 'ar')).toBe('12 د');
  });

  it('rounds up partial minutes', () => {
    expect(formatEta(61, 'en')).toBe('2 min');
  });

  it('shows "<1 min" / "<1 د" for sub-minute', () => {
    expect(formatEta(30, 'en')).toBe('<1 min');
    expect(formatEta(30, 'ar')).toBe('<1 د');
  });

  it('clamps negatives to <1 min', () => {
    expect(formatEta(-5, 'en')).toBe('<1 min');
  });
});

describe('haversineMeters', () => {
  it('is ~0 for the same point', () => {
    expect(haversineMeters({ lat: 25, lng: 55 }, { lat: 25, lng: 55 })).toBeCloseTo(0, 3);
  });

  it('1° of latitude is ~111km', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});
