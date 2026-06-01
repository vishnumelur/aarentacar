# AA Rent A Car — Plan #4: Browse & Book Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Public visitors can search vehicles by date + location, see filtered results, view vehicle detail with full rate breakdown, choose self-drive or chauffeur, pick add-ons, and (if verified) create a booking that lands in the manager queue. No payment yet — Plan #7 wires that in. **After this plan ships:** a real booking can be created end-to-end and is visible in the manager portal's bookings list.

**Architecture:** New schemas (`bookings`, `booking_addons`, `addons`, `booking_events`, `promo_codes`). Public landing's search widget posts to a server action that runs the availability check (no overlapping bookings on the same vehicle + advance-book rule from `vehicle_categories.advanceBookMinDays` + branch coverage). Vehicle detail page server-renders the rate card pick (cheapest applicable unit between hourly/daily/weekly/monthly + any matching package). Booking creation is a server action that gates on `users.verificationStatus === 'verified'` and writes a `bookings` row with status `pending_payment` (payment + approval come in Plans #5/#7). Customers see their bookings under `/(customer)/my-bookings`.

**Tech additions:** `date-fns` for date math (already common dep).

**Spec reference:** §6.4 bookings + booking_addons + booking_events, §6.5 promo_codes (CRUD lives in Plan #10), §7.1 search + browse + booking flow, §8 booking flow end-to-end.

---

## File Structure

**Schemas (new):** `bookings.ts`, `booking-addons.ts`, `addons.ts`, `booking-events.ts`, `promo-codes.ts` under `src/db/schema/`. Update barrel.

**Pricing helpers (pure, TDD):** `src/lib/pricing/compute-rate.ts`, `src/lib/pricing/availability.ts`.

**Server actions:** `src/lib/actions/bookings.ts` — `searchVehicles`, `priceQuote`, `createBooking`, `cancelBookingAsCustomer`.

**Public pages:**
- `src/app/page.tsx` (updated) — search widget hero
- `src/app/cars/page.tsx` — results grid with filters
- `src/app/cars/[id]/page.tsx` — vehicle detail with booking panel
- `src/components/public/search-widget.tsx`
- `src/components/public/vehicle-result-card.tsx`
- `src/components/public/booking-panel.tsx`

**Customer pages:**
- `src/app/(customer)/my-bookings/page.tsx`
- `src/app/(customer)/my-bookings/[code]/page.tsx`

**Manager:**
- `src/app/manager/bookings/page.tsx` — list with status filter
- `src/app/manager/bookings/[code]/page.tsx` — detail (review + approve comes in Plan #5)

**Seed:** `scripts/seed-addons.ts` — child seat, GPS, extra driver, full-cover insurance upgrade, fuel pre-pay, airport meet-and-greet.

**Tests:** unit for pricing + availability, integration for createBooking (happy + KYC-gate + advance-book violation + overlap), e2e for full search→detail→book.

---

## Task 1: Schemas (bookings core)

**Files:** 5 new schema files + barrel.

- [ ] **bookings.ts** with the spec's full enum:

```ts
export const bookingStatusEnum = pgEnum('booking_status', [
  'draft', 'pending_kyc', 'pending_payment', 'pending_approval',
  'approved', 'dispatched', 'in_progress', 'completed', 'cancelled', 'refunded',
]);
export const rentalKindEnum = pgEnum('rental_kind', ['self_drive', 'chauffeur']);

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // AA-2026-00123
  customerId: uuid('customer_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'restrict' }),
  rentalKind: rentalKindEnum('rental_kind').notNull(),
  pickupAt: timestamp('pickup_at', { withTimezone: true }).notNull(),
  returnAt: timestamp('return_at', { withTimezone: true }).notNull(),
  pickupLat: doublePrecision('pickup_lat'),
  pickupLng: doublePrecision('pickup_lng'),
  pickupAddress: text('pickup_address').notNull(),
  returnAddress: text('return_address'),
  status: bookingStatusEnum('status').notNull().default('draft'),
  subtotalAed: integer('subtotal_aed').notNull(),
  addonsAed: integer('addons_aed').notNull().default(0),
  discountAed: integer('discount_aed').notNull().default(0),
  depositAed: integer('deposit_aed').notNull(),
  totalAed: integer('total_aed').notNull(),
  appliedPromoCode: text('applied_promo_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('bookings_customer_idx').on(t.customerId),
  index('bookings_vehicle_idx').on(t.vehicleId),
  index('bookings_status_idx').on(t.status),
  index('bookings_pickup_at_idx').on(t.pickupAt),
]);
```

- [ ] **addons.ts** + **booking-addons.ts** + **booking-events.ts** + **promo-codes.ts** (all per spec §6.4 / §6.5; addons has slug+name_en+name_ar+price_aed+max_qty+active+sort_order, booking_events is append-only with kind text + payload jsonb).

- [ ] **Generate + apply migration. Commit.**

---

## Task 2: Booking code generator (TDD)

**Files:** `src/lib/bookings/code.ts`, test.

```ts
// Generates monotonic codes AA-YYYY-NNNNN using a SELECT MAX + 1 in a transaction.
export async function nextBookingCode(tx: PgTx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AA-${year}-`;
  const [row] = await tx.execute<{ max: string | null }>(sql`
    SELECT MAX(SUBSTRING(code FROM ${prefix.length + 1})) as max
    FROM bookings WHERE code LIKE ${prefix + '%'}
  `);
  const next = row && row.max ? parseInt(row.max, 10) + 1 : 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}
```

Test asserts: starts at 00001 for empty year; increments; doesn't collide across years.

---

## Task 3: Availability checker (pure, TDD)

**Files:** `src/lib/pricing/availability.ts`, test.

```ts
export interface Booking { vehicleId: string; pickupAt: Date; returnAt: Date; status: BookingStatus }
export function hasOverlap(existing: Booking[], request: { vehicleId: string; pickupAt: Date; returnAt: Date }): boolean {
  const ACTIVE_STATUSES: BookingStatus[] = ['pending_payment','pending_approval','approved','dispatched','in_progress'];
  return existing.some(b =>
    b.vehicleId === request.vehicleId &&
    ACTIVE_STATUSES.includes(b.status) &&
    b.pickupAt < request.returnAt &&
    b.returnAt > request.pickupAt,
  );
}
```

Tests: same window overlap, adjacent windows OK (`returnAt === pickupAt` of next), completed/cancelled don't block, different vehicles don't conflict.

---

## Task 4: Rate computation (pure, TDD)

**Files:** `src/lib/pricing/compute-rate.ts`, test.

```ts
export interface Rate { rateKind: RateKind; priceAed: number; packageHours?: number | null }
export interface RatePick { unit: RateKind; quantity: number; priceAed: number; totalAed: number }

export function computeBestRate(rates: Rate[], pickupAt: Date, returnAt: Date): RatePick | null {
  const hours = Math.ceil((returnAt.getTime() - pickupAt.getTime()) / 3600_000);
  const days = Math.ceil(hours / 24);
  const weeks = Math.ceil(days / 7);
  const months = Math.ceil(days / 30);

  const candidates: RatePick[] = [];
  for (const r of rates) {
    if (r.rateKind === 'hourly') candidates.push({ unit: 'hourly', quantity: hours, priceAed: r.priceAed, totalAed: hours * r.priceAed });
    if (r.rateKind === 'daily') candidates.push({ unit: 'daily', quantity: days, priceAed: r.priceAed, totalAed: days * r.priceAed });
    if (r.rateKind === 'weekly' && weeks > 0) candidates.push({ unit: 'weekly', quantity: weeks, priceAed: r.priceAed, totalAed: weeks * r.priceAed });
    if (r.rateKind === 'monthly' && months > 0) candidates.push({ unit: 'monthly', quantity: months, priceAed: r.priceAed, totalAed: months * r.priceAed });
    if (r.rateKind === 'package' && r.packageHours && hours <= r.packageHours) {
      candidates.push({ unit: 'package', quantity: 1, priceAed: r.priceAed, totalAed: r.priceAed });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.totalAed - b.totalAed);
  return candidates[0]!;
}
```

Tests: 3-hour pick chooses hourly if cheaper than daily; 25-hour window rounds to 2 days; package <= packageHours wins when cheaper; null when no rates.

---

## Task 5: searchVehicles + priceQuote server actions

**Files:** `src/lib/actions/bookings.ts`.

- [ ] **searchVehicles({ categoryId, pickupAt, returnAt, lat, lng })**:
  1. Validate inputs (zod, dates within bounds, returnAt > pickupAt).
  2. Load category to check `advanceBookMinDays` — fail with `advance_book_violation` if pickup too soon.
  3. Query active vehicles in matching category types (status='active', deletedAt IS NULL).
  4. For each candidate, load rates, query existing bookings for overlap (single grouped query: `WHERE vehicle_id = ANY($1) AND status IN (...)`).
  5. Filter out overlapping; return remaining as `[{ vehicle, type, bestRate }]`.

- [ ] **priceQuote({ vehicleId, pickupAt, returnAt, addonIds: [], rentalKind })**:
  1. Returns the subtotal + addons subtotal + deposit (from category default) + total.
  2. Includes the best rate pick. No DB write.

---

## Task 6: Public landing + search widget

**Files:** `src/app/page.tsx` (replace landing), `src/components/public/search-widget.tsx`.

- Hero with brand red headline + Cairo-styled Arabic.
- Search widget: category radio (Car / Limousine), pickup datetime, return datetime, pickup location input (free text for now; map pin in Plan #8).
- Submits to `/cars?categoryId=...&pickup=...&return=...&address=...`.

---

## Task 7: Cars list + filters

**Files:** `src/app/cars/page.tsx`, `src/components/public/vehicle-result-card.tsx`.

- Server component reads searchParams, calls `searchVehicles`.
- Filter rail (client): type, transmission, seats, max budget.
- Each result card: photo (presigned GET from MinIO if primary_photo_url exists), make/model, type, seats, transmission, price `From AED 350 / day` (best rate).
- "Book" button → `/cars/[id]?pickup=...&return=...`.

---

## Task 8: Vehicle detail + booking panel

**Files:** `src/app/cars/[id]/page.tsx`, `src/components/public/booking-panel.tsx`.

- Server component: load vehicle + type + rates + branch.
- Layout: photo carousel left, spec list, rate card table.
- BookingPanel (client): rental_kind toggle (Self-drive / Chauffeur), addons multi-select, promo code field, live total (calls `priceQuote` on change with debounce), "Continue to checkout" button.

---

## Task 9: createBooking server action + KYC gate

**Files:** `src/lib/actions/bookings.ts` (extend).

```ts
export async function createBooking(input: CreateBookingInput) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') return { ok: false as const, error: 'forbidden' };
  if (user.verificationStatus !== 'verified') return { ok: false as const, error: 'kyc_required' };

  return await db.transaction(async (tx) => {
    // Re-check availability under lock
    const overlap = await checkOverlapInTx(tx, input.vehicleId, input.pickupAt, input.returnAt);
    if (overlap) return { ok: false as const, error: 'vehicle_taken' };

    // Re-quote pricing server-side (don't trust client totals)
    const quote = await computeQuoteInTx(tx, input);

    const code = await nextBookingCode(tx);
    const [booking] = await tx.insert(bookings).values({
      code, customerId: user.id, vehicleId: input.vehicleId,
      rentalKind: input.rentalKind,
      pickupAt: input.pickupAt, returnAt: input.returnAt,
      pickupAddress: input.pickupAddress,
      pickupLat: input.pickupLat ?? null, pickupLng: input.pickupLng ?? null,
      status: 'pending_payment',
      subtotalAed: quote.subtotal, addonsAed: quote.addons, discountAed: quote.discount,
      depositAed: quote.deposit, totalAed: quote.total,
      appliedPromoCode: input.promoCode ?? null,
    }).returning();
    if (!booking) throw new Error('insert_failed');

    if (input.addonIds.length > 0) {
      await tx.insert(bookingAddons).values(quote.addonRows.map(a => ({ bookingId: booking.id, ...a })));
    }
    await tx.insert(bookingEvents).values({
      bookingId: booking.id, actorUserId: user.id,
      kind: 'created', payload: { totalAed: quote.total },
    });

    return { ok: true as const, code: booking.code };
  });
}
```

KYC gate redirects unverified customers to `/verification?next=...`.

---

## Task 10: Customer's My Bookings + manager bookings list

- `(customer)/my-bookings/page.tsx`: list by `customerId`, status badges, link to detail.
- `(customer)/my-bookings/[code]/page.tsx`: full detail + cancel button (if status in `pending_payment | pending_approval`).
- `manager/bookings/page.tsx`: filterable list (status, date range, customer search).
- `manager/bookings/[code]/page.tsx`: read-only detail with timeline (`booking_events`). Approve/reject in Plan #5.

---

## Task 11: E2E happy path

```ts
test('verified customer creates a booking visible in manager queue', async ({ page, request }) => {
  test.setTimeout(120_000);
  // 1. Seed verified customer via direct DB write (helper)
  // 2. Login as customer
  // 3. Visit /, fill search widget for Car, +2 days pickup, +5 days return
  // 4. Pick first result, choose self-drive, click Continue
  // 5. Booking summary, click "Place booking" -> redirects to /my-bookings/[code]
  // 6. Switch to super-admin, /manager/bookings -> sees the booking
});
```

---

## Acceptance
- `pnpm test` + e2e green
- Search returns only non-overlapping vehicles
- Advance-book rule blocks too-soon pickups
- Unverified customer is redirected to `/verification`
- Booking visible in both portals with correct code (`AA-2026-NNNNN`)

## Not in this plan
- Promo code application logic (writes promo_codes via Plan #10; engine reads it here but doesn't validate uses_count edge cases — done in Plan #10 too)
- Map pin pickup location (Plan #8 + map provider integration)
- Customer email confirmation (Plan #12)
- Payment + deposit hold (Plan #7) — booking goes to `pending_payment` and stays there until Plan #7
