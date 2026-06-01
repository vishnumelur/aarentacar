# AA Rent A Car — Progress Snapshot

**Last updated:** 2026-06-01
**Repo:** https://github.com/vishnumelur/aarentacar
**Branch:** `main` (all work shipped here per user's deploy flow)

---

## Headline status

**6 of 13 plans shipped** end-to-end. Roadmap is complete (all 13 plans written + Plan #14 holding pen). Customers can register, get verified, browse, book, and reach `pending_payment`. Managers can do the full operational loop including dispatch. Drivers can install the PWA, accept jobs, capture handover + return inspections, and ping their live location. Payments are the next milestone (Plan #7) that unlocks real revenue and natural status flow into `pending_approval`.

| Plan | Title | Status |
|---|---|---|
| #1 | Foundation (Next.js + auth + DB + i18n + subdomain routing + CI) | ✅ shipped |
| #2 | Inventory (manager fleet CRUD, bulk CSV, rate cards, MinIO photos + polish) | ✅ shipped |
| #3 | Customer KYC (Verification Center + manager review queue) | ✅ shipped |
| #4 | Browse & Book (public search, vehicle detail, booking engine pre-payment) | ✅ shipped |
| #5 | Manager Dispatch (approve/reject + nearest-driver auto-suggest + dispatch) | ✅ shipped |
| #6 | Driver Portal PWA (push, accept, handover with PDF e-signature, return diff, live ping) | ✅ shipped |
| #7 | Payments (Stripe + Tabby + COD + Bank Transfer + deposits + refunds) | written, ready |
| #8 | Live Tracking (SSE + Swiggy-style animated map) | written, ready |
| #9 | Provider Credentials UI (AES-256-GCM encrypted store) | written, ready |
| #10 | Manager Portal Completion (dashboard KPIs, reports, promos, agent perms, settings) | written, ready |
| #11 | Super-Admin + pg-boss workers (health, audit, feature flags, TOTP 2FA) | written, ready |
| #12 | Mail Server (Postfix + OpenDKIM + Cloudflare DNS + react-email) | written, ready |
| #13 | Production Deploy (Caddy SSL, backups, GlitchTip, ClamAV) | written, ready |
| #14 | Phase 1 gaps + Phase 2 + indefinitely deferred | holding pen |

---

## Numbers

- **22** Postgres tables across **7** Drizzle migrations
- **~10,000** lines of production code (TypeScript / TSX)
- **94** unit + integration tests (Vitest), all green
- **18** end-to-end tests (Playwright), all green locally
- **8** user roles supported: customer, driver, agent, manager, superadmin (+ 3 statuses each)
- **4** payment methods designed (Card/Tabby/COD/Bank Transfer — wiring in Plan #7)
- **0** third-party SaaS dependencies (everything self-hostable per design spec)

---

## Repository structure

```
docs/
  PROGRESS.md                                 ← you are here
  superpowers/
    specs/
      2026-06-01-aa-rentacar-design.md       ← approved Phase-1 spec v1.1
      2026-06-01-coverage-audit.md           ← spec → plan validation matrix
    plans/
      README.md                              ← index of all 14 plans
      2026-06-01-foundation.md               ← Plan #1 detailed (3,200 lines)
      2026-06-01-inventory.md                ← Plan #2 detailed (2,900 lines)
      2026-06-01-customer-kyc.md             ← Plan #3 detailed
      2026-06-01-browse-and-book.md          ← Plan #4
      2026-06-01-manager-dispatch.md         ← Plan #5
      2026-06-01-driver-portal.md            ← Plan #6
      2026-06-01-payments.md                 ← Plan #7
      2026-06-01-live-tracking.md            ← Plan #8 (Swiggy UX spec)
      2026-06-01-provider-credentials.md     ← Plan #9
      2026-06-01-manager-portal-completion.md← Plan #10
      2026-06-01-superadmin-completion.md    ← Plan #11
      2026-06-01-mail-server.md              ← Plan #12
      2026-06-01-production-deploy.md        ← Plan #13
      2026-06-01-phase-2-and-deferred.md     ← Plan #14 (gaps + Phase 2 + deferred)

src/
  app/
    page.tsx                                 ← public landing with search widget
    layout.tsx                               ← root layout (Inter + Cairo, RTL flip, i18n provider, SW register)
    globals.css                              ← Tailwind + brand red theme
    middleware.ts                            ← subdomain → route group rewrite
    (auth)/login,register/page.tsx           ← shared centered-card layout
    (customer)/                              ← verified-customer area
      profile/page.tsx
      verification/page.tsx                   ← Verification Center
      my-bookings/page.tsx + [code]/page.tsx
    cars/page.tsx + [id]/page.tsx            ← browse + vehicle detail
    checkout/page.tsx                        ← booking confirmation (KYC-gated)
    dashboard/page.tsx                       ← customer home
    manager/                                 ← manager.aa-rentacar.com via middleware
      page.tsx                               ← KPI dashboard skeleton
      bookings/page.tsx + [code]/page.tsx    ← booking list + detail w/ approval + dispatch panels
      categories/page.tsx                    ← Car / Limousine config
      types/page.tsx                         ← sub-type CRUD
      customers/page.tsx + [id]/page.tsx     ← KYC review queue
      drivers/page.tsx + new + [id]/page.tsx ← driver CRUD + status toggle
      fleet/page.tsx + new + [id] + bulk     ← vehicle CRUD + CSV bulk import + rate cards
    driver/                                  ← driver.aa-rentacar.com PWA
      page.tsx                               ← Today screen (status + offers + current job)
      jobs/[id]/page.tsx                     ← active job + Navigate + Accept/Decline
      jobs/[id]/handover/page.tsx            ← 6-photo + signature + PDF
      jobs/[id]/return/page.tsx              ← 6-photo with handover diff + damage flag
    admin/page.tsx                           ← admin.aa-rentacar.com placeholder
    api/
      auth/{register,login,logout,me}/route.ts
      health/route.ts                        ← /api/health with DB ping
      upload/presign/route.ts                ← discriminated-union: vehicle_photo, customer_document, inspection_photo, signature
      driver/ping/route.ts                   ← 10s GPS pings (driver-only)
      push/subscribe/route.ts                ← VAPID PushSubscription endpoint
      manager/vehicles/csv-template/route.ts

  components/
    ui/                                      ← shadcn primitives
    auth/login-form.tsx + register-form.tsx
    customer/profile-form + document-uploader + verification-status-card
    manager/                                 ← 12+ components: shell, nav, fleet-table, vehicle-form, rate-cards-editor, csv-import-uploader, bulk-price-dialog, approval-panel, dispatch-panel, driver-form, document-review-card, etc.
    driver/                                  ← install-prompt, self-status-toggle, job-card, job-actions, photo-slot, signature-pad, handover-form, return-form
    public/                                  ← search-widget, vehicle-result-card, booking-panel, checkout-form
    push-subscribe.tsx                       ← web-push subscription via service worker
    sw-register.tsx                          ← /sw.js registration

  db/
    index.ts                                 ← Drizzle client (lazy postgres-js)
    schema/                                  ← 22 schema files + barrel
      users, sessions, settings, audit-logs                  (P1)
      branches, vehicle-categories, vehicle-types, vehicles, vehicle-rates (P2)
      customer-profiles, customer-documents                  (P3)
      addons, promo-codes, bookings, booking-addons, booking-events (P4)
      driver-profiles, driver-pings, booking-assignments     (P5)
      damage-inspections, agreements, push-subscriptions     (P6)

  lib/
    env.ts                                   ← zod-validated env
    auth/                                    ← password, session, cookies, roles, resolve-portal, get-current-user
    storage/
      minio.ts                               ← S3 client + BUCKETS const
      presign.ts                             ← vehicles + customer-documents
      inspections.ts                         ← handover/return photos + signature
    bookings/code.ts                         ← AA-YYYY-NNNNN generator
    pricing/availability.ts                  ← pure overlap check (TDD)
    pricing/compute-rate.ts                  ← pure cheapest-rate picker (TDD)
    geo/distance.ts                          ← pure Haversine (TDD)
    push/vapid.ts + send.ts                  ← web-push wrapper + sendToUser
    agreements/render-pdf.tsx                ← @react-pdf/renderer rental agreement template
    actions/                                 ← server actions (all 'use server')
      categories.ts, vehicles.ts, csv-import.ts (P2)
      customer-profile.ts, customer-documents.ts, kyc-review.ts (P3)
      bookings.ts (P4)
      dispatch.ts, drivers.ts (P5)
      driver-self.ts, driver-jobs.ts, handover.ts, return-inspection.ts (P6)
    csv-import/validate.ts                   ← pure CSV row validator (TDD)
    jobs/check-document-expiry.ts            ← pure expiry checker (TDD)

  i18n/
    routing.ts + request.ts                  ← next-intl cookie-based locale
messages/
  en.json, ar.json                           ← all customer-facing strings

scripts/
  bootstrap.ts                               ← idempotent super-admin + settings
  seed-inventory.ts                          ← 2 branches + 2 categories + 9 types
  seed-addons.ts                             ← 6 default addons (child seat, GPS, etc.)
  seed-test-users.ts                         ← customer/pending/driver/manager fixtures
  minio-bootstrap.ts                         ← 4 buckets

drizzle/                                     ← generated migrations (0000–0006)
tests/
  setup.ts                                   ← env shim
  helpers/db.ts                              ← truncate-all for vitest
  helpers/dispatch-fixtures.ts               ← raw-SQL fixture for the dispatch e2e
  unit/                                      ← 13 vitest files (env, password, cookies, roles, middleware, env, presign, csv-import, code, availability, compute-rate, distance, check-document-expiry)
  integration/                               ← 2 vitest files (auth-register, presign)
  e2e/                                       ← 7 Playwright files (login, language-toggle, subdomain-routing, manager-fleet, customer-kyc, browse-and-book, manager-dispatch, driver-portal)

.github/workflows/ci.yml                     ← typecheck + lint + db:migrate + vitest + seed + playwright
public/                                      ← manifest.json, sw.js, icons
docker-compose.dev.yml                       ← postgres 16 + minio (local dev)
playwright.config.ts                         ← chromium project, auto-starts dev server
vitest.config.ts                             ← fileParallelism: false (so tests share dev DB)
tsconfig.json                                ← strict + noUncheckedIndexedAccess + noImplicitOverride
eslint.config.mjs                            ← flat config wrapping next/core-web-vitals + next/typescript
.env.local                                   ← local secrets (gitignored)
.env.example                                 ← documented placeholders for all required env vars
```

---

## What works end-to-end right now

Once you run `pnpm db:bootstrap && pnpm db:seed-inventory && pnpm db:seed-addons && pnpm db:seed-test-users`:

1. **Customer signup → verified**
   - `customer@test.com` / `customer-test-password` is pre-seeded with tourist profile + 4 approved KYC docs
   - Fresh customer can register, complete profile, upload docs at `/verification` → manager reviews + approves at `/manager/customers/[id]`

2. **Customer books a car**
   - Search at `/` (Car/Limousine, datetime range)
   - Browse results at `/cars` (sorted cheapest first, advance-book rules enforced)
   - Vehicle detail at `/cars/[id]?pickup=…&return=…` with live booking panel
   - Self-drive or chauffeur, addons, promo code field
   - Checkout enforces KYC verified + age + license validity
   - Booking lands at `pending_payment` with code `AA-2026-NNNNN`
   - Visible at customer's `/my-bookings` and manager's `/manager/bookings`

3. **Manager dispatches a driver** (with test fixture or after Plan #7 ships)
   - For bookings in `pending_approval`: red ApprovalPanel → Approve or Reject (with reason)
   - After approval: blue DispatchPanel auto-loads, suggests up to 5 nearest available drivers via Haversine distance
   - Confirm dispatch → booking_assignments row + booking flips to `dispatched`
   - **Web push fires to the driver** (when VAPID env vars are set + driver has installed the PWA)

4. **Driver completes a job**
   - Driver logs in at `/login` → lands at `/driver` (Today screen)
   - 3-button status toggle (Available / Off-duty / Break)
   - Pending offers list with "Open job" button
   - Job detail: pickup + customer contact + tap-to-call + WhatsApp + "Navigate to pickup" link out to Google Maps
   - Accept (one-click) or Decline (with reason) → booking returns to `approved` if declined
   - **Start handover** → 6-photo capture + odometer + fuel % + damage notes + canvas signature pad → PDF generated via `@react-pdf/renderer` → stored in MinIO `agreements/`
   - Booking flips to `in_progress`, driver pings location every 10s via `/api/driver/ping`
   - **Start return inspection** → side-by-side photo diff with handover + damage toggle + AED estimate → booking flips to `completed`, driver auto-returns to `available`

5. **i18n**
   - English default, full RTL Arabic with `next-intl` cookie-based locale
   - All customer-facing copy translated; manager + driver + super-admin are English-only per spec

---

## Test credentials

| Role | Email | Password |
|---|---|---|
| Super-Admin | `admin@aa-rentacar.com` | `change-me-on-first-login` |
| Manager | `manager@test.com` | `manager-test-password` |
| Driver | `driver1@test.com` | `driver-test-password` |
| Customer (verified, can book) | `customer@test.com` | `customer-test-password` |
| Customer (4 pending docs, manager-reviewable) | `pending@test.com` | `pending-test-password` |

---

## Operational gotchas (in-memory)

These are captured in `~/.claude/projects/-home-vmj-Desktop-aa-rentacar/memory/` for future sessions:

1. **Docker access requires `sg`** until logout/login (group not applied to spawned shells).
2. **`pnpm test` truncates `users / sessions / audit_logs / settings`** — re-seed before browser smoke or e2e.
3. **vitest `fileParallelism: false` is mandatory** — integration tests share the dev Postgres.
4. **Playwright MCP gets stuck on `<input type="file">` modals** — avoid clicking file inputs in MCP-driven flows.
5. **shadcn checkbox is a `<span role="checkbox">`** not a button — use the `aria-label` selector.
6. **Next 15 `'use server'` modules can only export async functions** — keep pure types in a separate module.
7. **`<form action={fn}>` requires the action to return `Promise<void>`** — throw on error rather than returning a discriminated outcome for form-action helpers.
8. **Don't auto-use system `userEmail` for git commits** — user uses `vishnumelur` GitHub identity via local `~/.gitconfig`.

---

## Spec coverage audit

See [`docs/superpowers/specs/2026-06-01-coverage-audit.md`](superpowers/specs/2026-06-01-coverage-audit.md) for the full section-by-section spec → plan mapping. Identified 7 Phase-1 gaps tracked in [Plan #14 §A](superpowers/plans/2026-06-01-phase-2-and-deferred.md):

- A.1 `password_resets` schema + reset flow
- A.2 Rate limiting (auth / upload / ping)
- A.3 UAE PDPL data export + delete request flow
- A.4 Min driver age enforcement at booking time — **DONE inline in Plan #4 createBooking**
- A.5 License validity check at booking time — **DONE inline in Plan #4 createBooking**
- A.6 Government ID name-match runbook
- A.7 Pre-commit gitleaks secret scan hook

5 Phase-2 features captured in [Plan #14 §B](superpowers/plans/2026-06-01-phase-2-and-deferred.md):
post-rental ratings, loyalty program, long-term + corporate accounts, manager 2FA mandatory, vehicle maintenance log.

16 indefinitely-deferred items in §C (wallet, AI search, multi-currency, SMS, WhatsApp, native apps, multi-emirate, driver earnings, etc.) with documented re-evaluation triggers.

---

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push to `main` and pull request:

1. Checkout + pnpm setup (v10) + Node 22
2. `pnpm install --frozen-lockfile`
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm db:migrate` (against Postgres 16 service container)
6. `pnpm test` (vitest, 94 cases)
7. **Re-seed:** `pnpm db:bootstrap && pnpm db:seed-inventory && pnpm db:seed-addons && pnpm db:seed-test-users` (after vitest truncates users)
8. `pnpm exec playwright install --with-deps chromium`
9. `pnpm test:e2e` (Playwright, 18 cases)
10. Upload Playwright HTML report on failure (7-day retention)

Latest run (Plan #6 push) — fix in flight for the missing `db:seed-test-users` step that left CI red on the driver-portal e2e auth assertion.

---

## How to resume in a fresh session

```bash
# Get a working machine state from zero
cd "/home/vmj/Desktop/aa rentacar"
docker compose -f docker-compose.dev.yml up -d              # postgres + minio
cp .env.example .env.local                                  # then fill in ENCRYPTION_KEY etc.
pnpm install
pnpm db:migrate
pnpm minio:bootstrap                                        # 4 MinIO buckets
pnpm db:bootstrap                                           # super-admin
pnpm db:seed-inventory                                      # 2 categories, 9 types, 2 branches
pnpm db:seed-addons                                         # 6 addons
pnpm db:seed-test-users                                     # 4 test users
pnpm dev                                                    # http://localhost:3000
```

**Next plan to execute:** Plan #7 (Payments) — sketched in `docs/superpowers/plans/2026-06-01-payments.md` (10 tasks: schemas, Stripe wrapper, Tabby wrapper, webhook handlers with idempotency, customer checkout UI, deposit holds, refunds, cancellation policy, e2e in Stripe test mode).

After Plan #7: Plan #8 (Live Tracking Swiggy-style) → Plan #9 (Provider Credentials UI) → Plan #10 (Manager Portal completion) → Plan #11 (Super-Admin + pg-boss workers) → Plan #12 (Mail Server) → Plan #13 (Production Deploy).

Plan #14 §A gaps get folded into the relevant plan during execution (e.g. password_resets → Plan #1 polish, rate limiting → Plan #11, PDPL flow → Plan #3 + #10, gitleaks → Plan #1).
