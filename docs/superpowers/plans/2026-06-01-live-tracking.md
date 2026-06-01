# AA Rent A Car — Plan #8: Live Tracking (Swiggy-style) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Customer watches their driver glide toward them on a map with 60fps interpolation, direction-aware icon rotation, pulse halo, animated trail polyline, live ETA countdown, and status-pill transitions (assigned → on the way → X min away → almost there → arrived). **After this plan ships:** post-dispatch tracking is a premium, sub-second-feeling UX that justifies the brand.

**Architecture:** Mapbox GL JS on the client; pings flow via Server-Sent Events from `/api/booking/[code]/track`. Server tails `driver_pings` for the booking's assigned driver, emits new pings as they arrive. Client interpolates between pings using `requestAnimationFrame`. Route-mode (gliding along Mapbox Directions polyline) is computed once per route segment (cached). Mapbox token is sourced from `provider_credentials` (Plan #9) with env fallback.

**Spec reference:** §11.2 + §11.2.1 (the full Swiggy UX spec).

---

## File Structure
- `src/app/api/booking/[code]/track/route.ts` — SSE GET
- `src/app/(customer)/my-bookings/[code]/track/page.tsx` — full-screen map
- `src/components/tracking/live-map.tsx` (client; uses mapbox-gl)
- `src/components/tracking/status-pill.tsx` (framer-motion)
- `src/components/tracking/eta-card.tsx`
- `src/lib/tracking/interpolation.ts` — pure helpers (bearing, lerp, polyline-glide, ETA formatting) — all TDD
- `src/lib/tracking/eta.ts` — server: fetch Mapbox Directions, cache 60s
- `tests/unit/lib/tracking/interpolation.test.ts`

## Task 1: Mapbox + framer-motion install + token wiring
`pnpm add mapbox-gl framer-motion`. Read public token from `NEXT_PUBLIC_MAPBOX_TOKEN` (or provider_credentials at runtime). Add Mapbox CSS to layout.

## Task 2: SSE endpoint
```ts
// /api/booking/[code]/track/route.ts
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const user = await getCurrentUser();
  // Authorize: customer must own the booking, or be manager/superadmin
  // Load booking + active assignment
  return new Response(new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      function send(event: { driverId: string; lat: number; lng: number; recordedAt: string }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      // Initial state
      send(currentPosition);
      // Poll driver_pings every 2s (lighter than Postgres LISTEN/NOTIFY for first pass)
      const interval = setInterval(async () => {
        const latest = await db.select().from(driverPings)
          .where(and(eq(driverPings.driverId, assignment.driverId), gt(driverPings.recordedAt, lastSeen)))
          .orderBy(asc(driverPings.recordedAt));
        for (const p of latest) {
          send({ driverId: p.driverId, lat: p.lat, lng: p.lng, recordedAt: p.recordedAt.toISOString() });
          lastSeen = p.recordedAt;
        }
      }, 2000);
      req.signal.addEventListener('abort', () => { clearInterval(interval); controller.close(); });
    },
  }), { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } });
}
```

## Task 3: Pure interpolation helpers (TDD)
```ts
export function bearing(a: LatLng, b: LatLng): number; // degrees 0-360
export function lerp(a: LatLng, b: LatLng, t: number): LatLng;
export function alongPolyline(coords: LatLng[], t: number): LatLng; // 0..1 along the line
export function formatEta(secondsRemaining: number, locale: 'en'|'ar'): string;
```
Tests cover known fixtures (NY → London bearing ≈ 51°, equator lerp, polyline midpoint, "12 min" vs "12 د".

## Task 4: ETA server helper
`src/lib/tracking/eta.ts`: `getEta({ from, to }) → Promise<{ durationSec, polyline }>`. Calls Mapbox Directions API, caches 60s per (from, to) pair in a simple in-memory map (Redis later if needed).

## Task 5: LiveMap component (client)
Heart of Plan #8. Reads SSE from `/api/booking/[code]/track`. Maintains:
- `positions: LatLng[]` — full ping history
- `targetPosition: LatLng` — most recent ping
- `displayPosition: LatLng` — animated position (state via useState + requestAnimationFrame)
- `currentBearing: number`
- `routePolyline: LatLng[]` — fetched once per significant route change

On each animation frame:
- Compute `t` = (now - lastPingAt) / pingInterval, clamped [0,1]
- If in route mode AND route fetched: displayPosition = alongPolyline(route, t * progress)
- Else (snap mode): displayPosition = lerp(prev, target, t)
- Update Mapbox marker setLngLat + setRotation
- Pulse halo as a separate <div> overlay with CSS animation

Trail polyline: Mapbox `line` source with `line-progress` paint expression, animated via setData.

Pickup pin: drop-and-bounce on mount (framer-motion).

## Task 6: StatusPill
Reads `eta.durationSec` and `currentDistanceMeters`. Pill states:
- ETA unknown → "Driver assigned"
- ETA > 15min → "On the way"
- ETA ≤ 15min and > 3min → "{n} minutes away"
- ETA ≤ 3min → "Almost there"
- distance < 100m for ≥ 20s → "Driver has arrived"

framer-motion `AnimatePresence` for crossfade + slight slide.

## Task 7: EtaCard (overlay)
Bottom of screen. Driver photo, name, car model, plate. ETA countdown ticks every second client-side; re-syncs every 30s by re-fetching server ETA. Tap-to-call + WhatsApp deep links.

## Task 8: Accessibility + perf
- Respect `prefers-reduced-motion`: disable interpolation + pulse + status-pill animations
- Camera auto-frame the bounds of (driver, pickup) — Mapbox `fitBounds` with padding, easeTo
- Recenter FAB
- Dark map style by local time (`mapbox/dark-v11` vs `streets-v12`)
- Bundle budget: < 200KB JS for the tracking page (excluding Mapbox GL JS)

## Task 9: E2E (limited)
Animation testing in headless chrome is brittle. Instead:
- Test the SSE endpoint with a fixture: insert pings, GET with EventSource, expect 3 messages in order.
- Test the interpolation/bearing/eta helpers (already TDD'd in Task 3).

## Acceptance
- Customer on `/my-bookings/[code]/track` sees the driver icon move smoothly between pings, rotating to direction of travel
- Pulse halo visible around marker
- Trail polyline draws itself in
- ETA card updates every second
- Status pill transitions through stages
- reduced-motion users get jump-cuts instead
- Manual: mobile test on actual UAE 4G to confirm SSE survives

## Not in this plan
- Replacing SSE with Postgres LISTEN/NOTIFY (Plan #11 ops upgrade if needed)
- Customer-side "driver assigned" push notification (Plan #6 + tracking page link)
- Multi-customer support pages (not needed at AA's scale)
