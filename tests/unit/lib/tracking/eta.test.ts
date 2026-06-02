import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getEta, __clearEtaCache } from '@/lib/tracking/eta';
import type { LatLng } from '@/lib/tracking/interpolation';
import * as credentialStore from '@/lib/credentials/store';

const FROM: LatLng = { lat: 25.092, lng: 55.149 };
const TO: LatLng = { lat: 25.197, lng: 55.274 };

function fakeDirectionsResponse(durationSec: number, coords: [number, number][]) {
  return {
    ok: true,
    json: async () => ({
      routes: [
        {
          duration: durationSec,
          distance: 8000,
          geometry: { coordinates: coords },
        },
      ],
    }),
  } as unknown as Response;
}

describe('getEta', () => {
  beforeEach(() => {
    __clearEtaCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses duration + decoded polyline from the Directions response', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeDirectionsResponse(600, [
        [55.149, 25.092],
        [55.274, 25.197],
      ]),
    );
    const res = await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    expect(res).not.toBeNull();
    expect(res!.durationSec).toBe(600);
    // Mapbox returns [lng, lat]; we normalise to { lat, lng }.
    expect(res!.polyline[0]).toEqual({ lat: 25.092, lng: 55.149 });
    expect(res!.polyline[1]).toEqual({ lat: 25.197, lng: 55.274 });
  });

  it('caches results for 60s per (from,to) pair — no second network call', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeDirectionsResponse(600, [[55.149, 25.092]]),
    );
    await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after the 60s TTL expires', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeDirectionsResponse(600, [[55.149, 25.092]]),
    );
    await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    vi.advanceTimersByTime(61_000);
    await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns null when no token is available', async () => {
    // Plan #9: with no explicit token, getEta resolves through the credential
    // store. Stub it to "unset" so this stays a pure unit test (no DB / network).
    vi.spyOn(credentialStore, 'getCredential').mockResolvedValue(null);
    const fetchImpl = vi.fn();
    const res = await getEta({ from: FROM, to: TO, token: undefined, fetchImpl });
    expect(res).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('returns null on a non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response);
    const res = await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    expect(res).toBeNull();
  });

  it('returns null when the response has no routes', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: true, json: async () => ({ routes: [] }) }) as Response,
    );
    const res = await getEta({ from: FROM, to: TO, token: 't', fetchImpl });
    expect(res).toBeNull();
  });
});
