# AA Rent A Car — Design Spec

**Date:** 2026-06-01
**Project:** Web-based car & limousine rental booking platform
**Repo:** https://github.com/vishnumelur/aarentacar.git (branch `main`)
**Host:** Self-hosted on Hetzner VPS
**Status:** Approved design, ready for implementation planning

---

## 1. Overview

AA Rent A Car (legal name *Auto Assist Service*) is a Dubai-based car rental and limousine company with 500+ vehicles, currently fielding a non-functional WordPress brochure site. This spec describes the full replacement: a modern booking platform with four role-scoped portals (customer, driver, manager, super-admin), supporting both self-drive and chauffeured rentals across Car and Limousine categories.

The platform is self-hosted on the customer's Hetzner VPS with PostgreSQL, ships in English + Arabic with full RTL, and integrates Stripe, Tabby BNPL, cash-on-delivery, and bank-transfer payments. The customer-facing site is mobile-responsive web; the driver portal is an installable PWA.

### 1.1 Carry-over from existing site

The following content from `aa-rentacar.com` (about/contact pages only — old WordPress site retired) is carried into the new platform:

- HQ address: Al Karama, Khalifa bin Zayed Street, near ADCB Metro Station
- Branch: Dubai Media City
- Phone numbers: +971 4 3377877, +971 55 3377877, +971 50 6943808, +971 50 7700088, Limousine +971 50 3377877
- Email: manager@aa-rentacar.com
- Business hours: Sat–Thu 8:00–21:30, Fri 8:30–12:00 + 17:00–21:30
- Privacy policy text

### 1.2 Goals

1. Capture online bookings 24/7 with a modern, fast, bilingual UX
2. Give the manager full operational control without engineering involvement (cars, pricing, KYC, dispatch, promos)
3. Dispatch the right driver to the right pickup with minimal manual work
4. Reduce disputes via photographed handovers and e-signed agreements
5. Stay 100% self-hosted — no dependency on third-party SaaS for core function

### 1.3 Non-goals (Phase 1)

- Native iOS/Android apps (PWA covers it)
- Multi-tenant / marketplace (single operator)
- Multi-emirate (Dubai-only at launch; data model allows for expansion)
- AI search, customer wallet, multi-currency, hotel-concierge links (deferred — see §3.2)

---

## 2. Business model

Single operator. AA Rentals owns the fleet, employs the drivers, and runs the manager portal in-house.

- **Categories** (top level): `Car`, `Limousine` — extensible
- **Vehicle types within Car**: Economy, Compact, Medium, Family, Luxury, Sports
- **Vehicle types within Limousine**: Sedan, SUV, Stretch (configurable by manager)
- **Rental modes** (customer picks at booking):
  - **Self-drive**: driver delivers the car, customer drives, driver picks it up at return time
  - **With chauffeur**: driver stays with the customer for the entire booking
- **Pricing modes** supported simultaneously per vehicle:
  - Hourly rate
  - Daily rate
  - Weekly rate
  - Monthly rate
  - Package (fixed price for a defined duration / route — e.g. "Half-Day Tour", "Airport Transfer")
  The booking engine auto-picks the cheapest applicable rate for the requested duration, but the manager can flag specific vehicles as "package-only" if needed.
- **Pickup model**: anywhere in Dubai via map pin. Driver gets exact GPS coordinates.
- **Advance booking rule**: per-category configurable minimum days in advance (e.g. Cars: 0 days = same-day OK; Limousine: 2 days minimum). Manager sets in Settings.

---

## 3. Scope & phasing

### 3.1 Phase 1 — Launch scope

The minimum platform that takes real bookings end-to-end with a modern UX:

- Public landing + search + browse (EN + AR with RTL)
- Customer auth (email + password, magic-link reset, no third-party auth service)
- Customer Verification Center (KYC upload + manager approval)
- Booking flow (search → select → add-ons → checkout)
- Payments: Card (Stripe), Tabby (BNPL), Cash on Delivery, Bank Transfer
- Deposit / security hold handling
- Manager Portal: full CRUD on cars (single + bulk CSV), pricing, advance-book rules, booking approval, KYC review, driver dispatch (auto-suggest nearest + manager confirm), promo codes, basic reports, agent sub-permissions
- Driver Portal: installable PWA, push notifications, job accept, navigation, live location ping, handover + return photo inspection, in-app digital signature capture
- Super-Admin Portal: system health, user/role management, audit log, feature flags, provider credentials UI (Stripe/Tabby/Mapbox/Resend keys via encrypted DB storage), maintenance mode
- TOTP 2FA: mandatory for Super-Admin (Phase 1)
- Live driver tracking on map (customer-side, after dispatch)
- Add-ons & extras at checkout
- Damage inspection with photos at handover + return
- Digital rental agreement e-signature, PDF generated and stored
- Promo codes & manager-configurable dynamic pricing

### 3.2 Phase 2 — Post-launch

Built once Phase 1 has steady booking flow and real customer data:

- Post-rental ratings (driver + car)
- Loyalty program (points per booking, tiered status, referral codes)
- Long-term & corporate accounts (monthly auto-renew, PO billing, employee sub-accounts, consolidated invoices)
- TOTP 2FA mandatory for Manager (was optional in Phase 1)

### 3.3 Deferred / out of scope

- Customer wallet / store credit
- AI search & recommendations
- WhatsApp concierge links
- Multi-currency display
- SMS notifications (email + web push only at launch — SMS gateway can be added later)
- WhatsApp Business API integration

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | Single monolith, route groups for portal scoping |
| Database | PostgreSQL 16 | Self-hosted on Hetzner VPS via Docker |
| ORM | Drizzle | TypeScript-native, simple SQL, easy to debug |
| Auth | Custom — bcrypt + Postgres-backed sessions + httpOnly cookies | No third-party auth service; fully owned by us |
| UI | Tailwind CSS + shadcn/ui (themed white / red / black) | "Supermodern" baseline |
| i18n / RTL | next-intl | EN default, AR with full RTL flip |
| Maps | Mapbox GL JS + Mapbox Geocoding + Mapbox Directions | Free tier covers launch; cheaper than Google |
| Payments | Stripe (cards, Apple/Google Pay) + Tabby SDK (BNPL) + manual COD + manual Bank Transfer | Stripe operates in UAE in AED |
| File storage | MinIO (S3-compatible, self-hosted) | Customer docs, vehicle photos, damage photos, PDFs |
| Email | Resend (transactional) | 3K/month free tier; swap to self-hosted SMTP later if needed |
| Push notifications | Web Push API with self-generated VAPID keys | Free, browser-native, works on Android + iOS 16.4+ when PWA installed |
| PWA | Driver portal is installable; customer is web-only | next-pwa or hand-rolled service worker |
| Background jobs | pg-boss (Postgres-backed queue) | No extra Redis needed |
| Reverse proxy / SSL | Caddy | Auto Let's Encrypt for all subdomains |
| Container orchestration | Docker Compose | 5 containers: app, postgres, minio, caddy, worker |
| CI / deploy | Manual at launch: local → `git push` → VPS → `git pull` → `docker compose up -d --build`. Add GitHub Actions later. | `.env.production` lives on server, never in git |

All software in the stack is free / open-source. Recurring costs at launch: Hetzner VPS rental + domain renewal + payment gateway transaction fees. Optional later costs if usage grows past free tiers: Mapbox, Resend.

---

## 5. System architecture

### 5.1 Containers (Docker Compose, single Hetzner VPS)

1. **`app`** — Next.js production build, port 3000 (internal)
2. **`postgres`** — PostgreSQL 16, persistent volume, daily `pg_dump` to MinIO at 02:00 UAE
3. **`minio`** — S3-compatible object storage, persistent volume, separate buckets for `documents/`, `vehicles/`, `inspections/`, `agreements/`, `backups/`
4. **`caddy`** — public-facing reverse proxy, auto Let's Encrypt SSL for `aa-rentacar.com`, `manager.aa-rentacar.com`, `driver.aa-rentacar.com`, `admin.aa-rentacar.com`
5. **`worker`** — same Next.js image with `pg-boss` worker entrypoint; runs scheduled jobs (deposit-release sweep, doc-expiry warnings, driver-ping retention, daily DB backup, etc.)

Caddy is the only container with ports exposed to the host (`80`, `443`).

### 5.2 Subdomain routing

| Subdomain | Route group | Audience |
|---|---|---|
| `aa-rentacar.com` (and `www`) | `(public)` + `(customer)` | Anyone / verified customers |
| `manager.aa-rentacar.com` | `(manager)` | Manager + agents |
| `driver.aa-rentacar.com` | `(driver)` | Drivers (PWA installable) |
| `admin.aa-rentacar.com` | `(superadmin)` | You / future developers |

A single Next.js middleware reads `host` + session role and rewrites to the appropriate route group, denying access if role mismatches. All four portals share components, types, DB connection, and auth.

### 5.3 Realtime (live tracking)

Driver PWA POSTs `{ lat, lng }` to `/api/driver/ping` every 10 seconds while their job status ∈ {`dispatched`, `in_progress`}. Customer's booking page connects via Server-Sent Events to `/api/booking/{code}/track` and receives position updates as they arrive. SSE is preferred over WebSockets because it works over plain HTTP through Caddy with no special config.

---

## 6. Data model

~25 tables, each with one well-defined job. All FK constraints + CHECK constraints enforce status transitions. Soft delete via `deleted_at` only where needed (e.g. `vehicles`, `users`).

### 6.1 Identity & access

- **`users`** — id, email (unique), password_hash, full_name, phone, role (`customer | driver | agent | manager | superadmin`), preferred_language (`en | ar`), verification_status (`unverified | pending | verified | rejected`), created_at, updated_at, deleted_at
- **`sessions`** — id, user_id, token_hash, expires_at, user_agent, ip, created_at
- **`password_resets`** — id, user_id, token_hash, expires_at, consumed_at, created_at
- **`agent_permissions`** — id, user_id, can_approve_bookings, can_review_kyc, can_edit_pricing, can_manage_promos, can_view_revenue, can_manage_drivers, can_edit_settings — boolean matrix for agent role only

### 6.2 Customer profile & KYC

- **`customer_profiles`** — id, user_id, residency (`tourist | resident`), date_of_birth, nationality, loyalty_points (Phase 2), lifetime_bookings, created_at
- **`customer_documents`** — id, customer_id, type (`passport | visa | emirates_id | driving_license | international_permit`), file_url (MinIO key), expiry_date, status (`pending | approved | rejected`), reviewer_id, review_note, uploaded_at, reviewed_at

### 6.3 Inventory

- **`branches`** — id, name, address, lat, lng (HQ + Media City initially; extensible)
- **`vehicle_categories`** — id, name_en, name_ar, slug, advance_book_min_days, min_driver_age, default_deposit_aed, sort_order
- **`vehicle_types`** — id, category_id, name_en, name_ar, sort_order
- **`vehicles`** — id, type_id, branch_id, make, model, year, plate, color, transmission, seats, doors, fuel_type, features (jsonb), status (`active | maintenance | rented | retired`), primary_photo_url, photos (jsonb array), created_at, updated_at, deleted_at
- **`vehicle_rates`** — id, vehicle_id, rate_kind (`hourly | daily | weekly | monthly | package`), price_aed, package_name (nullable), package_hours (nullable), package_description (nullable), valid_from, valid_to (nullable)
- **`vehicle_maintenance_log`** — id, vehicle_id, started_at, ended_at, mileage, notes

### 6.4 Bookings

- **`bookings`** — id, code (e.g. `AA-2026-00123`), customer_id, vehicle_id, rental_kind (`self_drive | chauffeur`), pickup_at, return_at, pickup_lat, pickup_lng, pickup_address, return_lat (nullable), return_lng (nullable), return_address (nullable), status (`draft | pending_kyc | pending_payment | pending_approval | approved | dispatched | in_progress | completed | cancelled | refunded`), subtotal_aed, addons_aed, discount_aed, deposit_aed, total_aed, applied_promo_code (nullable), created_at, updated_at
- **`booking_addons`** — id, booking_id, addon_id, quantity, unit_price_aed
- **`addons`** — id, slug, name_en, name_ar, description_en, description_ar, price_aed, max_qty, active, sort_order
- **`booking_assignments`** — id, booking_id, driver_id, assigned_by_user_id, status (`offered | accepted | declined | reassigned`), decline_reason (nullable), assigned_at, accepted_at
- **`booking_events`** — id, booking_id, actor_user_id (nullable for system events), kind, payload (jsonb), created_at — append-only audit/timeline

### 6.5 Payments

- **`payments`** — id, booking_id, method (`card | tabby | cod | bank_transfer`), gateway_ref (nullable), amount_aed, currency, status (`initiated | succeeded | failed | refunded | manual_pending`), captured_at, raw_response (jsonb), created_at
- **`payment_holds`** — id, booking_id, kind (`deposit`), method (`card | cash`), amount_aed, gateway_hold_ref (nullable), status (`held | released | captured | partially_captured`), captured_amount_aed (nullable), created_at, released_at
- **`refunds`** — id, payment_id, amount_aed, reason, status (`initiated | succeeded | failed | manual`), gateway_ref (nullable), processed_at, processed_by_user_id

### 6.6 Drivers & dispatch

- **`driver_profiles`** — id, user_id, license_no, license_expiry, status (`available | on_duty | off_duty | suspended`), current_lat (nullable), current_lng (nullable), last_ping_at (nullable), rating_avg (Phase 2), photo_url
- **`driver_pings`** — id, driver_id, booking_id (nullable), lat, lng, recorded_at — rolling 24h retention; pruned nightly
- **`damage_inspections`** — id, booking_id, stage (`handover | return`), photos (jsonb array of MinIO keys), odometer, fuel_level, damage_notes (nullable), signed_by_customer_at, signature_image_url, driver_id, created_at
- **`agreements`** — id, booking_id, pdf_url (MinIO key), generated_at, customer_signature_image_url

### 6.7 Marketing

- **`promo_codes`** — id, code (unique), kind (`percent | fixed`), value, min_amount_aed, max_uses (nullable), used_count, valid_from, valid_to, applies_to_categories (jsonb array of category ids; null = all), active, created_at

### 6.8 Loyalty (Phase 2)

- **`loyalty_ledger`** — id, customer_id, change, balance_after, reason, booking_id (nullable), created_at — append-only

### 6.9 System

- **`pg_boss_*`** — managed by pg-boss library
- **`audit_logs`** — id, actor_user_id, action, target_type, target_id, payload (jsonb), ip_hash, created_at — immutable
- **`settings`** — id, key (unique), value (jsonb), updated_by_user_id, updated_at — single-row-per-key config
- **`provider_credentials`** — id, provider (`stripe | tabby | mapbox | resend`), env (`live | test`), key_name, value_encrypted (bytea, AES-256-GCM with master key from `ENCRYPTION_KEY` env), last_four (for masked display), updated_by_user_id, updated_at, last_used_at
- **`notifications`** — id, user_id, kind, title, body, payload (jsonb), read_at, created_at

---

## 7. The four portals

### 7.1 Customer Portal — `aa-rentacar.com`

Public landing + signed-in customer area, sharing the same site. Modern, fast, mobile-responsive, themed white / red / black, EN + AR with full RTL.

**Public surfaces**
- Landing hero with search widget (category, pickup datetime, return datetime, pickup location)
- Featured vehicle showcase
- Categories overview (Car / Limousine sub-types)
- About / Contact (carries content from old site)
- Privacy policy + Terms

**Authenticated surfaces**
- My Bookings — upcoming, in-progress, past
- Verification Center — document upload, status tracker, expiry reminders
- Profile — name, phone, email, language, password change

**Search & browse**
- Vehicle results grid with filters (type, seats, transmission, max budget)
- Vehicle detail page with photo carousel, specs, rate breakdown, "Self-drive" / "With chauffeur" toggle
- Add-ons selection screen

**Checkout**
- Order summary, promo code field, payment method picker (Card / Tabby / COD / Bank Transfer), deposit disclosure
- KYC gate: if `verification_status ≠ verified`, customer is sent to Verification Center; booking is saved as `draft`

**Live tracking**
- After driver dispatch, customer's booking page shows a live Mapbox view with the driver's pin moving in real-time and an ETA. Falls back to a static map + "Driver assigned" if browser doesn't support SSE.

**Digital signing**
- Customer signs the rental agreement on the driver's phone at handover. A copy is emailed and surfaced in their booking detail.

### 7.2 Manager Portal — `manager.aa-rentacar.com`

Operational nerve center for the manager + any agents.

- **Dashboard**: KPIs (today revenue, active rentals, pending approvals, pending KYC, available cars), today's schedule strip, attention panel, live driver map
- **Bookings**: filterable list with full timeline, KYC docs, payments, dispatch state; actions (approve, reject, reassign, refund, cancel, edit)
- **Customers**: search, KYC review queue, customer detail with booking history, block/unblock
- **Fleet → Cars**: list + filters; add single; **bulk add via CSV upload** with downloadable template, dry-run validation report (X OK, Y errored with reasons), confirm-then-insert; edit; status changes with reason; per-car rate cards with hourly/daily/weekly/monthly/package; bulk price update across selection; maintenance log
- **Fleet → Categories & types**: manage Car / Limousine, set per-category advance-book min days, min driver age, default deposit, sort order
- **Drivers**: list, performance, add/edit, license details + expiry warning, force off-duty
- **Promotions**: promo code CRUD + active campaigns + usage stats
- **Reports**: revenue by day/week/month, occupancy per vehicle, top types, payment method mix, CSV export
- **Notifications inbox**: system events for the manager
- **Settings**: business hours, default deposits per category, advance-book rules, cancellation policy, email templates, language settings

**Agent sub-role**: configurable permission matrix (approve bookings? review KYC? edit pricing? manage promos? view revenue? manage drivers? edit settings?). Default agent has only `can_approve_bookings` and `can_review_kyc`.

### 7.3 Driver Portal — `driver.aa-rentacar.com` (installable PWA)

Mobile-first. On first login: prompt to add to home screen, grant notification permission, grant location permission.

- **Today**: status toggle (Available / Off-duty / Break), current job card, today's jobs list
- **Job offer notification**: loud push with sound + vibration; tap to view detail with map preview; Accept / Decline (reason required for decline)
- **Active job screen**: map with pickup + return, big "Navigate" button (Mapbox Directions; hand-off to Google/Apple Maps respected), customer name + tap-to-call + WhatsApp deep link, booking details, **live location ping every 10s while job is active**
- **Handover screen**: required 6 photos (front, back, left, right, odometer, fuel gauge), notes for existing damage, **embedded customer signature pad on driver's phone**, "Confirm Handover" generates PDF and flips status
- **Return screen**: same 6 photos, side-by-side diff with handover, damage toggle with photo + estimate
- **History**: past jobs
- **Profile**: license info + expiry, photo, change password

### 7.4 Super-Admin Portal — `admin.aa-rentacar.com`

For developers / system owner. IP-allowlistable. **Not for daily operations.**

- **System**: health (uptime, DB pool, MinIO usage, pending jobs, error rate), build info, logs viewer, manual DB backup, restart workers
- **Users & roles**: list, create/promote/demote/suspend, reset password, agent permission matrix
- **Feature flags**: toggle Phase 2 features (live tracking, ratings, loyalty, corporate), maintenance mode
- **Provider Credentials UI** *(new in spec, see §11.4)*: form per provider (Stripe, Tabby, Mapbox, Resend); paste once, then masked display `sk_•••••••1234`; "Test connection" button before save; audit-logged
- **Tools**: read-only DB query runner (writes require explicit confirmation), re-send any system email, reprocess failed payment, manage sessions, pg-boss dashboard
- **Audit logs**: immutable, filterable
- **Secrets reference**: lists which env vars the app expects + purpose + last-rotated date (values themselves live in `.env.production` or `provider_credentials` table, never displayed)
- **Danger zone**: drop tables (multi-step confirmation), purge old data per retention policy

---

## 8. Customer booking flow (end-to-end)

1. **Land** on `aa-rentacar.com`. Default EN; toggle to AR flips layout to RTL.
2. **Search**: category, pickup datetime, return datetime, pickup location (map pin or "Use my current location")
3. **Availability check** filters by: advance-book rule per category, real-time vehicle availability (no overlapping bookings), branch coverage
4. **Results grid** with filters; vehicle card shows photo, type, specs, total price for the chosen window (auto-picks cheapest unit between hourly / daily / weekly / monthly / package)
5. **Vehicle detail page** — photos, specs, rate breakdown; choose **Self-drive** or **With chauffeur**
6. **Add-ons screen** — child seat, extra driver, GPS, full-cover insurance, fuel pre-pay, airport meet-and-greet with name sign
7. **Continue to Checkout** → auth gate:
   - Not logged in → sign up (email + password + phone + full name + EN/AR pref) or log in
   - Logged in but not verified → redirected to Verification Center; booking saved as `draft`; email + web push when KYC approved; customer returns and continues
   - Verified → proceed
8. **Checkout** — summary, promo code, deposit disclosure, payment method picker, "Confirm Booking"
9. **Status transitions** depending on method:
   - Card / Tabby → `pending_approval` (paid online)
   - COD / Bank Transfer → `pending_payment → pending_approval`
10. **Manager review** — manager approves; system auto-suggests nearest available driver; manager confirms or picks alternate; status → `dispatched`; driver gets push
11. **Driver execution** — accepts job; navigates to pickup; live location streams to customer; handover photos + e-signature; status → `in_progress`
12. **Rental period** — depending on rental_kind:
    - Self-drive: driver leaves, customer drives, driver returns at `return_at`
    - Chauffeur: driver stays for the duration
13. **Return** — return photos, damage assessment, status → `completed`
14. **Deposit settlement** — auto-release if no damage, partial/full capture if damage (manager approves capture amount)
15. **Receipt + PDF agreement** emailed to customer
16. *(Phase 2)* Customer prompted to rate driver + car

---

## 9. KYC & verification

### 9.1 Verification Center (customer portal)

Customer self-identifies:
- **Tourist**: passport (with visa / entry stamp page), driving license OR international driving permit + home-country license
- **UAE Resident**: Emirates ID (front + back), UAE driving license

Each document upload captures expiry date. Customer submits set → status `pending`.

### 9.2 Manager review (manager portal → Verification Queue)

Manager opens each document, can zoom, can approve or reject (reject requires reason). On all-approved, customer's `verification_status` → `verified`. Customer notified by email + push. Until verified, customer cannot complete checkout.

### 9.3 Re-verification

`verified` status is durable across bookings. pg-boss job runs nightly and:
- Sends a 30-day-before-expiry warning email for any uploaded document
- Sends a 7-day warning + a notification banner in the customer portal
- On expiry: flips that document to `expired` and reverts customer to `verification_status = pending` — customer must re-upload

### 9.4 Compliance baseline

- Minimum driver age: 21 (configurable per category — 25 default for Luxury, Sports, Limousine, settable by manager)
- License validity check: license must be valid through the rental period
- Government ID match: manager visually verifies name on license matches name on passport / Emirates ID

---

## 10. Payments & deposits

### 10.1 Methods

| Method | Gateway | Flow | Deposit handling |
|---|---|---|---|
| Card | Stripe Elements (inline) | Charge total in AED; separate manual-capture `payment_intent` for deposit | Auth hold on card; released or captured at return |
| Tabby | Tabby SDK (redirect) | Pay-in-4 or Pay-in-6 picker; Tabby pays merchant upfront | Deposit collected separately at handover (cash with driver or card swipe via Stripe Terminal later) |
| Cash on Delivery | n/a — booking flagged | Driver collects cash at handover, marks "Paid" in driver app | Deposit in cash with driver, returned at return inspection |
| Bank Transfer | n/a — manual | Bank details emailed; manager confirms receipt in dashboard | Deposit collected separately (cash or card at handover) |

### 10.2 Deposit configuration

- Default amount per category (Cars: AED 1,000; Limousine: AED 3,000) — manager-configurable in Settings
- Manager can override per booking
- Deposit auth happens at booking confirmation (Card) or at handover (other methods)
- Auto-release runs as a pg-boss job 1 hour after return inspection clears
- Capture (full or partial) requires manager action: manager enters captured amount, system captures from Stripe hold, releases remainder

### 10.3 Webhooks

- `/api/webhooks/stripe` — signature-verified (Stripe secret), idempotent via `event.id` dedupe
- `/api/webhooks/tabby` — signature-verified (Tabby HMAC), idempotent

### 10.4 Refunds

Manager-triggered from booking detail. Refund button is gated by payment method:
- Card → Stripe Refunds API
- Tabby → Tabby Refunds API
- COD / Bank Transfer → manual; logged with reference, no API call

All refunds logged in `refunds` table and surfaced in booking timeline.

### 10.5 Cancellation policy

Manager-configurable default:
- Free cancellation more than 24h before pickup
- 50% refund 24h–2h before pickup
- No refund within 2h of pickup or after handover

Customer-facing cancellation is allowed until handover; after handover, only manager can cancel (treated as early return).

---

## 11. Maps, tracking, notifications, provider credentials

### 11.1 Maps

- **Customer-facing**: Mapbox GL JS map for pickup-location pin, vehicle search location, and live driver tracking
- **Driver-facing**: Mapbox GL JS map; "Navigate" button opens Mapbox Directions in app or hands off to Google/Apple Maps if the driver prefers
- **Manager-facing**: Mapbox GL JS map showing all on-duty drivers; updates every 30s

### 11.2 Live tracking architecture

- Driver PWA POSTs `{lat, lng}` to `/api/driver/ping` every 10s while job is active
- Server upserts `driver_profiles.current_lat/lng/last_ping_at` and inserts into `driver_pings`
- Customer subscribes to `/api/booking/{code}/track` via Server-Sent Events; server pushes updates as pings arrive
- ETA computed via Mapbox Directions API; cached 60s per (driver_pos, pickup_pos) pair to stay under free tier
- pg-boss job nightly prunes `driver_pings` older than 24h

### 11.3 Notifications

- **Email** (Resend): account verification, KYC outcome, booking confirmation, payment receipt, driver dispatch, ETA updates, return reminder, agreement PDF
- **Web push** (VAPID): driver job offer (loud), customer "driver is on the way / 5 min away", customer KYC approved, customer booking approved
- **In-app inbox**: persistent notification list in each portal

Templates stored in code with i18n keys; rendered in the customer's `preferred_language`.

### 11.4 Provider credentials UI (Super-Admin)

Replaces the need to edit `.env.production` on the server for API keys.

- Super-Admin → Provider Credentials page lists Stripe, Tabby, Mapbox, Resend; each has its own card
- Each card supports `live` and `test` environments
- Form fields per provider (Stripe: secret key + publishable key + webhook signing secret; Tabby: public key + secret key + webhook signing secret; Mapbox: access token; Resend: API key)
- Paste once; on save the value is encrypted with AES-256-GCM using `ENCRYPTION_KEY` from env (rotation-safe) and stored as `bytea` in `provider_credentials.value_encrypted`. `last_four` is stored separately for masked display
- After save: input shown as `sk_•••••••1234`; full value never returned by the API
- **"Test connection"** button per provider hits a tiny endpoint that exercises the key (e.g. Stripe: list 1 charge; Tabby: token check; Mapbox: small geocode; Resend: account info) — confirms before commit
- Every save and every server-side decryption is `audit_logs`-logged
- App initialization order: try DB credentials first, fall back to env vars (so we can bootstrap before the UI is reachable, and operate even if DB is empty)

`ENCRYPTION_KEY` (32 random bytes, base64-encoded) is the only secret that *must* live in `.env.production`. Loss of `ENCRYPTION_KEY` = inability to read stored credentials (which is why "Test connection" should be used before relying on saved values, and rotation requires re-entering every key).

---

## 12. Internationalization

- **Languages**: English (default), Arabic
- **RTL**: when AR is selected, `<html dir="rtl">` flips the entire layout. Tailwind logical-property utilities (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`) used throughout to keep components automatically correct in both directions
- **Translation files**: next-intl JSON message catalogs under `messages/en.json`, `messages/ar.json`
- **Numbers, dates, currency**: `Intl.NumberFormat`, `Intl.DateTimeFormat` with locale-appropriate formatting (Arabic numerals optional)
- **Database content** (vehicle types, addons, etc.): bilingual columns `name_en`, `name_ar` — manager edits both
- **Manager / Driver / Super-Admin portals**: English only at launch (staff-facing). Customer portal: full EN + AR.

---

## 13. Security & privacy

- **Passwords**: bcrypt, cost 12; never stored plaintext or recoverable
- **Sessions**: random 32-byte token, hashed before DB write; httpOnly + Secure + SameSite=Lax cookie; 7-day rolling expiry; session table indexed by token_hash for lookup
- **Server Actions CSRF**: Next.js built-in; explicit double-submit-cookie tokens on the few REST endpoints. Webhooks excluded (signature-verified)
- **Rate limiting**: per-IP and per-user on auth, signup, password-reset, document upload, ping endpoints. In-memory bucket + Postgres counter for cross-restart enforcement
- **Authorization**: middleware re-checks role + resource ownership server-side on every request — never trust the client
- **File uploads**: server-side MIME-type + size validation, ClamAV scan in a sidecar container, UUID file names (no PII in object keys), signed time-limited MinIO URLs only (never expose raw paths)
- **TLS**: end-to-end via Caddy + Let's Encrypt for every subdomain
- **At-rest encryption**:
  - Provider credentials: AES-256-GCM with `ENCRYPTION_KEY`
  - Disk: enable Hetzner disk encryption at provisioning (one-time setup)
- **PII minimization**: audit logs hash IP addresses (`sha256(ip + salt)`); logs scrub auth headers and tokens
- **Backups**: nightly `pg_dump` → MinIO `backups/`, 30-day retention; weekly full MinIO bucket snapshot; backups encrypted with `age` before upload
- **Compliance**: UAE PDPL — Privacy Policy + Terms pages; cookie banner; customer-portal "Export my data" + "Delete my account" requests routed to manager review (legal retention obligations: 5 years for tax / dispute purposes — confirm with legal)
- **2FA**: TOTP **mandatory** for Super-Admin from Phase 1; **optional** for Manager in Phase 1, **mandatory** in Phase 2
- **Git hygiene**: `.env*` and `.superpowers/` in `.gitignore`; `.env.example` committed with no values; secrets rotated on documented schedule; pre-commit hook scans for high-entropy strings

---

## 14. Deployment & operations

### 14.1 Repository

- GitHub: `https://github.com/vishnumelur/aarentacar.git`
- Branch: `main` (production); short-lived feature branches encouraged
- `.gitignore` includes: `.env*`, `.next/`, `node_modules/`, `.superpowers/`, `data/`, `backups/`

### 14.2 Local development

```bash
git clone https://github.com/vishnumelur/aarentacar.git
cd aarentacar
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up   # postgres + minio
pnpm install
pnpm db:migrate
pnpm db:seed                                  # creates an initial superadmin + sample data
pnpm dev                                      # next dev on localhost:3000
```

### 14.3 Production deploy ritual

Local:
```bash
git add .
git commit -m "..."
git push origin main
```

On Hetzner VPS:
```bash
ssh aa-rentacar
cd /opt/aarentacar
git pull
docker compose up -d --build
docker compose exec app pnpm db:migrate
```

`.env.production` lives in `/opt/aarentacar/.env.production` on the server, owned `root:root`, mode `600`. Contains only: `DATABASE_URL`, `MINIO_*`, `ENCRYPTION_KEY`, `SESSION_COOKIE_DOMAIN`, `RESEND_API_KEY` (bootstrap), `STRIPE_SECRET_KEY` (bootstrap), `TABBY_SECRET_KEY` (bootstrap), `MAPBOX_TOKEN` (bootstrap). Provider keys are bootstrap-only: once the Super-Admin UI is reachable, keys are managed in DB.

### 14.4 Backups & restore drill

- Nightly `pg_dump --format=custom` → MinIO `backups/postgres/{date}.dump`
- Encrypted with `age` before upload using a backup public key; private key stored offline
- Weekly MinIO bucket snapshot via `mc mirror`
- Quarterly restore drill: spin up scratch VPS, restore from latest backup, verify booking-flow smoke test passes

### 14.5 Observability (lightweight at launch)

- Application logs: `pino` JSON to stdout; Docker captures; rotate at 100MB
- Error tracking: Sentry self-hosted (Docker) **or** GlitchTip (lightweight Sentry-compatible) — pick at implementation time
- Uptime: external uptime monitor (UptimeRobot free tier) pinging `/healthz`
- Metrics: simple Prometheus + Grafana later if needed; not Phase 1

### 14.6 First-boot bootstrap

`pnpm db:bootstrap` script:
- Runs migrations
- Creates default Super-Admin (email from env, password from env, force-rotate on first login)
- Seeds categories (Car, Limousine) with default advance-book days (Cars: 0, Limo: 2)
- Seeds default vehicle types for each category
- Seeds default addons (child seat, extra driver, GPS, etc.)
- Seeds default settings (deposit defaults, business hours)

---

## 15. Out of scope & deferred decisions

These are intentionally not specified here and will be decided during or after implementation, when more concrete needs surface:

- Final pricing for Mapbox / Resend after launch traffic is real
- SMS gateway choice (Etisalat, Unifonic, Twilio) — add when SMS becomes desired
- WhatsApp Business API — add if WhatsApp becomes desired
- Multi-emirate expansion — data model supports it via `branches`; UI work deferred
- Mobile-native apps — PWA covers it for now; native apps are a future project
- Driver earnings / payout — out of scope at launch (drivers are salaried employees, not gig workers)
- Customer wallet, AI search, multi-currency, hotel-concierge links — deferred

---

## 16. Acceptance criteria

The Phase 1 implementation is complete when:

1. A new customer can: visit the site → browse → book a car → upload KYC → wait for approval → return and complete booking → pay by Card, Tabby, COD, or Bank Transfer → see the driver dispatched and live-tracked → meet the driver and sign the agreement → return the car → receive the receipt and signed PDF.
2. A manager can: log in → see all bookings → approve / reject KYC → approve / reject bookings → dispatch drivers with the auto-suggested nearest driver → add a new car individually or via CSV bulk import → set pricing per car (hourly/daily/weekly/monthly/package) → set advance-book days per category → create promo codes → view revenue and occupancy reports.
3. A driver can: install the PWA → log in → toggle availability → receive a push notification when dispatched → accept a job → navigate to pickup → take handover photos → capture the customer's signature → mark handover complete → at return time, take return photos → flag damage if any → mark return complete.
4. A super-admin can: log in (with TOTP 2FA) → view system health → manage users and roles → toggle feature flags → paste Stripe + Tabby + Mapbox + Resend API keys via the Provider Credentials UI and have the app pick them up without a restart → view audit logs → run a manual DB backup.
5. The site loads in under 2 seconds on a typical Dubai mobile network (3G/4G) and scores 90+ on Lighthouse Mobile for the customer landing page.
6. Both English and Arabic versions render correctly with full RTL flip in Arabic.

---

*End of design spec — version 1.0, 2026-06-01.*
