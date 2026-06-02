import { getCredential } from '@/lib/credentials/store';
import type { LatLng } from './interpolation';

/**
 * Server-side ETA helper backed by the Mapbox Directions API.
 *
 * Results are cached in-process for 60s per (from,to) pair. A simple Map is
 * fine at AA's scale (one customer watches one driver). Swap for Redis if we
 * ever fan out across instances.
 *
 * The token + fetch are injectable so tests never touch the network.
 */

export interface EtaResult {
  durationSec: number;
  distanceMeters: number;
  polyline: LatLng[];
}

interface GetEtaArgs {
  from: LatLng;
  to: LatLng;
  /** Override the resolved token (used by tests). */
  token?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

const TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  value: EtaResult | null;
}

const cache = new Map<string, CacheEntry>();

/** Test-only: reset the in-memory cache between cases. */
export function __clearEtaCache(): void {
  cache.clear();
}

function cacheKey(from: LatLng, to: LatLng): string {
  // ~11m precision is plenty for caching; avoids a fresh fetch on every jitter.
  const r = (n: number) => n.toFixed(4);
  return `${r(from.lat)},${r(from.lng)}->${r(to.lat)},${r(to.lng)}`;
}

export async function getEta({
  from,
  to,
  token,
  fetchImpl,
}: GetEtaArgs): Promise<EtaResult | null> {
  // Plan #9: server-side Mapbox token now resolves through the encrypted
  // credential store (which falls back to the MAPBOX_TOKEN env var). The public
  // NEXT_PUBLIC_MAPBOX_TOKEN remains env-only and is unaffected here.
  const resolvedToken =
    token ?? (await getCredential('mapbox', 'access_token')) ?? undefined;
  if (!resolvedToken) return null;

  const key = cacheKey(from, to);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const doFetch = fetchImpl ?? fetch;

  // verify-on-deploy: live Mapbox Directions API call. Needs a real token
  // (env MAPBOX_TOKEN or provider_credentials in Plan #9) and network egress.
  const coordsParam = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsParam}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(resolvedToken)}`;

  let value: EtaResult | null = null;
  try {
    const res = await doFetch(url);
    if (res.ok) {
      const data = (await res.json()) as {
        routes?: Array<{
          duration: number;
          distance: number;
          geometry: { coordinates: [number, number][] };
        }>;
      };
      const route = data.routes?.[0];
      if (route) {
        value = {
          durationSec: route.duration,
          distanceMeters: route.distance,
          // Mapbox GeoJSON coords are [lng, lat]; normalise to { lat, lng }.
          polyline: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        };
      }
    }
  } catch {
    value = null;
  }

  cache.set(key, { expiresAt: now + TTL_MS, value });
  return value;
}
