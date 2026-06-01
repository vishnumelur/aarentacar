# AA Rent A Car — Plan #5: Manager Dispatch Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Manager reviews each `pending_approval` booking (created in Plan #4 / paid in Plan #7), approves or rejects with a reason, and on approval the system auto-suggests the nearest available driver (Haversine from `driver_profiles.current_lat/lng`). Manager confirms or picks alternate. Driver row in `booking_assignments` is created with status `offered`. Driver-side actions happen in Plan #6. **After this plan ships:** a booking can be approved + a specific driver can be assigned and notified (notification firing wired in Plan #6).

**Architecture:** Adds `driver_profiles` and `booking_assignments` schemas. New manager actions: `approveBooking`, `rejectBooking`, `dispatchDriver`, `reassignDriver`. Pure Haversine helper (`src/lib/geo/distance.ts`). All status changes append to `booking_events`. Auto-suggest is a server-side select query that finds drivers with `status='available'` AND no overlapping active assignment, then sorts by Haversine distance to pickup.

**Spec reference:** §6.4 booking_assignments, §6.6 driver_profiles + driver_pings (pings schema lives here, populated by Plan #6), §7.2 manager portal Bookings + Drivers sections, §8 step 16 dispatch.

---

## File Structure
- `src/db/schema/driver-profiles.ts`, `src/db/schema/driver-pings.ts`, `src/db/schema/booking-assignments.ts`
- `src/lib/geo/distance.ts` (TDD)
- `src/lib/actions/dispatch.ts`: approveBooking, rejectBooking, suggestDrivers, dispatchDriver
- `src/app/manager/bookings/[code]/page.tsx` (extend Plan #4 page) — adds approval panel + dispatch panel
- `src/components/manager/approval-panel.tsx`, `src/components/manager/dispatch-panel.tsx`
- `src/app/manager/drivers/page.tsx` + `[id]/page.tsx` — driver CRUD (license, status toggle)
- `src/lib/actions/drivers.ts` — createDriver, updateDriver, toggleDriverStatus

## Task 1: Schemas
```ts
export const driverStatusEnum = pgEnum('driver_status', ['available', 'on_duty', 'off_duty', 'suspended']);
export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  licenseNo: text('license_no').notNull(),
  licenseExpiry: date('license_expiry').notNull(),
  status: driverStatusEnum('status').notNull().default('off_duty'),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
  ratingAvg: integer('rating_avg'),
  photoUrl: text('photo_url'),
});

export const driverPings = pgTable('driver_pings', { /* id, driver, booking?, lat, lng, recorded_at */ });

export const assignmentStatusEnum = pgEnum('assignment_status', ['offered','accepted','declined','reassigned']);
export const bookingAssignments = pgTable('booking_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id').notNull().references(() => users.id),
  assignedByUserId: uuid('assigned_by_user_id').notNull().references(() => users.id),
  status: assignmentStatusEnum('status').notNull().default('offered'),
  declineReason: text('decline_reason'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
});
```

Generate + apply migration.

## Task 2: Haversine distance (pure, TDD)
`src/lib/geo/distance.ts`:
```ts
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
```
Test: known points (Burj Khalifa <-> DXB airport ≈ 13km ±0.5).

## Task 3: approveBooking + rejectBooking server actions
- approveBooking: status `pending_approval` → `approved`. Append booking_event `approved`. Trigger SSE/notification stub (real in Plan #6).
- rejectBooking: required reason. Status → `cancelled`, refund flow in Plan #7.

## Task 4: suggestDrivers + dispatchDriver
```ts
export async function suggestDrivers(input: { bookingId: string }) {
  // Load booking pickup_lat/lng
  // Query: drivers WHERE status='available' AND no overlapping booking_assignment in active states
  // Compute Haversine to pickup, sort ascending, return top 5 with { driverId, fullName, photoUrl, distanceKm, lastPingMinutesAgo }
}
export async function dispatchDriver(input: { bookingId: string; driverId: string }) {
  // Manager role check
  // Insert booking_assignments row (status=offered), update booking.status='dispatched'
  // Append booking_event 'dispatched' with driver id
  // Wake up driver via web push (Plan #6 implements the push send)
}
```

## Task 5: Manager booking detail — approval + dispatch panels
- If booking.status === 'pending_approval': show approval panel (Approve / Reject + note)
- If booking.status === 'approved': show dispatch panel with suggestion list, "Confirm" per driver row, fallback "Pick another" search.

## Task 6: Drivers CRUD
`/manager/drivers` list + add driver form (creates user with role='driver' + driver_profiles row). Edit license + status (off-duty toggle).

## Task 7: E2E
```ts
test('manager approves booking, dispatches driver, status flips to dispatched', async ({ page }) => {
  // setup: seed booking pending_approval + 2 drivers (one with current_lat near pickup)
  // login as manager
  // open booking, click Approve
  // dispatch panel shows nearest driver first
  // click Confirm dispatch
  // booking status badge updates to "dispatched"
});
```

## Acceptance
- Pure Haversine tests green
- Booking approve/reject works with audit log
- Suggested-drivers list is correctly ordered by distance
- Confirmed dispatch flips both booking + creates assignment row
- Manager can add a new driver and they appear in `/manager/drivers`

## Not in this plan
- Driver accepts/declines (Plan #6)
- Live tracking SSE (Plan #8)
- Push notification delivery (Plan #6 — driver PWA install + VAPID setup)
- Refund on rejection (Plan #7)
