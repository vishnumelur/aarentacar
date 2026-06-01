# AA Rent A Car — Plan #6: Driver Portal (PWA) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Drivers can install the portal as a PWA, receive push notifications when dispatched, accept or decline jobs, navigate to the pickup (link out to Mapbox / Google Maps / Apple Maps), capture handover photos + customer e-signature, ping their location every 10s while on duty, and mark handover/return complete. **After this plan ships:** a booking can flow from dispatch → driver accept → handover → return.

**Architecture:** Adds PWA manifest + service worker (`next-pwa` or hand-rolled). Web Push via VAPID keys (server-generated, stored in `provider_credentials` table — wait, Plan #9 hasn't shipped yet, so for now read from env). New schemas: `damage_inspections`, `agreements`, `push_subscriptions`. Driver portal lives at `src/app/driver/` (already role-gated by Plan #1).

**Spec reference:** §6.6 damage_inspections + agreements, §7.3 Driver Portal sections, §8 steps 18-22 driver execution.

---

## File Structure
- `public/manifest.json`, `public/sw.js` (or via next-pwa config)
- `src/db/schema/damage-inspections.ts`, `src/db/schema/agreements.ts`, `src/db/schema/push-subscriptions.ts`
- `src/lib/push/vapid.ts` (key loading + send), `src/lib/push/subscribe.ts`
- `src/app/api/push/subscribe/route.ts` POST
- `src/app/api/driver/ping/route.ts` POST (used here + Plan #8)
- `src/lib/actions/driver-jobs.ts`: acceptJob, declineJob, recordHandover, recordReturn, recordLocationPing
- `src/app/driver/page.tsx` (Today screen — status toggle + current job + today's list)
- `src/app/driver/jobs/[id]/page.tsx` (active job)
- `src/app/driver/jobs/[id]/handover/page.tsx`
- `src/app/driver/jobs/[id]/return/page.tsx`
- `src/components/driver/status-toggle.tsx`, `job-card.tsx`, `photo-capture.tsx`, `signature-pad.tsx`
- PDF generation: `src/lib/agreements/render-pdf.ts` (pdfkit or @react-pdf/renderer)

## Task 1: PWA basics
- Install `next-pwa`. Configure `next.config.ts` to wrap with `withPWA`.
- `public/manifest.json` with brand colors, icons (192/512), `display: standalone`, `start_url: /driver`.
- "Add to Home Screen" prompt component on first driver login.

## Task 2: VAPID + push subscription
- Install `web-push`. Generate VAPID keys via `npx web-push generate-vapid-keys`. Store public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private in `.env.production`.
- `push_subscriptions` schema: user_id, endpoint, p256dh, auth, user_agent, created_at.
- Service worker registers `push` event → shows notification.
- `/api/push/subscribe` POST stores the subscription.
- `src/lib/push/send.ts` `sendToUser(userId, payload)` — loads all subs, calls webpush.sendNotification for each, deletes 410-gone subs.

## Task 3: New schemas
```ts
export const damageInspectionStageEnum = pgEnum('inspection_stage', ['handover','return']);
export const damageInspections = pgTable('damage_inspections', {
  id, bookingId (cascade), stage, photos: jsonb<string[]>().notNull(),
  odometer integer, fuelLevel integer, // 0-100 percent
  damageNotes text, signedByCustomerAt timestamp, signatureImageUrl text,
  driverId, createdAt
});
export const agreements = pgTable('agreements', { id, bookingId (unique), pdfUrl text, generatedAt, customerSignatureImageUrl });
```

## Task 4: Driver Today screen
- Status toggle (Available / Off-duty / Break). Server action updates `driver_profiles.status`.
- "Current job" card if there's an active assignment. Today's pending offers + accepted jobs.

## Task 5: Job notification + accept/decline
- When `dispatchDriver` runs (Plan #5), call `sendToUser(driverId, { title: 'New job', body: 'Pickup at Burj Khalifa 11:30', url: '/driver/jobs/<assignmentId>' })`.
- Job detail page: pickup details, customer name+phone (tap-to-call/WhatsApp), Accept + Decline buttons.
- acceptJob: `booking_assignments.status='accepted'`, append booking_event, `booking.status` stays `dispatched` until handover.
- declineJob: requires reason, `booking_assignments.status='declined'`, `bookings.status='approved'` (back to dispatch queue), append event, notify manager.

## Task 6: Live ping endpoint
`/api/driver/ping` POST `{ lat, lng, heading?, speed? }` — auth required, role=driver, upserts `driver_profiles.current_lat/lng/last_ping_at`, inserts `driver_pings` row. Returns `{ ok: true }`. Used here and by Plan #8.

## Task 7: Handover flow
- 6 photo slots (front, back, left, right, odometer, fuel gauge) using camera input. Each presigned to `inspections/` bucket.
- Odometer + fuel level numeric fields.
- Customer signature pad (react-signature-canvas or hand-rolled <canvas> with pointer events) — output base64 PNG, upload, store URL.
- "Confirm handover" → server action `recordHandover`: creates `damage_inspections` row stage=handover, generates rental PDF via `renderRentalAgreementPdf({ bookingId, signatureUrl })`, stores in `agreements/<bookingId>.pdf`, status → `in_progress`.

## Task 8: PDF rental agreement
- Use `@react-pdf/renderer` for declarative server-side PDF.
- Template includes: brand header, booking summary, customer details, vehicle details, addons, totals, terms (Phase 1 stub), signature image, date.

## Task 9: Return flow
- Same 6 photos, side-by-side diff with handover (load handover photos via presigned GET).
- "Damage found?" toggle → damage photos + AED estimate.
- "Confirm return" → `damage_inspections` row stage=return, booking → `completed` (or stays for manager deposit settlement — handled in Plan #7).

## Task 10: E2E
Hard to fully test PWA install in headless chromium. Limited scope: confirm Today screen renders for a driver user, accept-job action works, ping endpoint accepts a POST.

## Acceptance
- Driver can install PWA on mobile (manual test on real device)
- Push notification fires within 5s of dispatch
- Accept/Decline updates `booking_assignments.status` and creates `booking_events`
- `/api/driver/ping` accepts 10s pings, `driver_profiles.current_lat/lng` updates
- Handover flow produces a stored PDF + 6 photos in MinIO + e-signature image
- Return flow produces the comparison set

## Not in this plan
- Live customer tracking UX (Plan #8 — SSE + Swiggy animation)
- Manager-side damage settlement (Plan #7)
- Driver ratings (Phase 2)
- Driver earnings / payout system (deferred)
