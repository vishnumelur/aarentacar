/**
 * Pure geo/interpolation helpers for the live-tracking map.
 *
 * Everything here is deterministic and side-effect free so it can be
 * unit-tested without a browser, a network, or Mapbox. The client
 * `live-map` component drives these on each requestAnimationFrame tick.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Initial great-circle bearing from `a` to `b`, in degrees [0, 360).
 * 0 = north, 90 = east. Used to rotate the driver icon to its heading.
 */
export function bearing(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = toDeg(Math.atan2(y, x));
  return (deg + 360) % 360;
}

/**
 * Linear interpolation between two coordinates. `t` is clamped to [0,1].
 * Adequate for the short hops between 2s pings (snap mode).
 */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  const c = clamp01(t);
  return {
    lat: a.lat + (b.lat - a.lat) * c,
    lng: a.lng + (b.lng - a.lng) * c,
  };
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // Earth radius (m)
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Position at fraction `t` (0..1) of the cumulative length of a polyline.
 * `t` is clamped. Empty polylines throw; single-point lines return that point.
 * Used in route-mode to glide the driver along the Mapbox Directions route.
 */
export function alongPolyline(coords: LatLng[], t: number): LatLng {
  if (coords.length === 0) {
    throw new Error('alongPolyline: empty polyline');
  }
  if (coords.length === 1) {
    return coords[0]!;
  }

  const c = clamp01(t);

  // Cumulative segment lengths.
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const len = haversineMeters(coords[i]!, coords[i + 1]!);
    segLengths.push(len);
    total += len;
  }

  if (total === 0) {
    return coords[0]!;
  }

  if (c <= 0) return coords[0]!;
  if (c >= 1) return coords[coords.length - 1]!;

  const target = c * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const len = segLengths[i]!;
    if (acc + len >= target) {
      const local = len === 0 ? 0 : (target - acc) / len;
      return lerp(coords[i]!, coords[i + 1]!, local);
    }
    acc += len;
  }
  return coords[coords.length - 1]!;
}

/**
 * Human-readable ETA. Rounds *up* to the next whole minute so we never
 * promise a sooner arrival than reality. Sub-minute (and negative)
 * collapses to "<1 min" / "<1 د".
 *
 * Note: we intentionally keep Western digits in both locales — UAE users
 * are accustomed to Western numerals; only the unit token is localised.
 */
export function formatEta(secondsRemaining: number, locale: 'en' | 'ar'): string {
  const unit = locale === 'ar' ? 'د' : 'min';
  if (secondsRemaining < 60) {
    return `<1 ${unit}`;
  }
  const minutes = Math.ceil(secondsRemaining / 60);
  return `${minutes} ${unit}`;
}
