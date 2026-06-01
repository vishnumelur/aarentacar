# AA Rent A Car — Plan #14: Phase 1 Gaps + Phase 2 + Deferred

> **Not a single-execution plan** — this is a holding pen. Items in §A get
> folded into the relevant existing plan (#1/#3/#4/#11/#13) during execution
> as small additional tasks. §B becomes a separate Phase-2 spec when the
> business is ready. §C is deferred indefinitely and tracked here so we don't
> re-litigate the decision.

**Companion document:** [Spec Coverage Audit](../specs/2026-06-01-coverage-audit.md).

---

## A. Phase 1 gaps — must ship before go-live

Each item below is a small addition (≤1 day of work) that closes a spec
requirement currently not covered by Plans #1–#13. Fold each into the
existing plan named under "Where to put it" during execution.

### A.1 `password_resets` schema + reset flow

**Spec:** §6.1 lists `password_resets` table.
**Status:** ❌ schema not created; reset endpoint never wired.
**Where to put it:** Plan #1 (foundation) — add to the next plan-execution
session, OR roll into Plan #12 (mail server) since the reset flow needs the
email channel to actually deliver the link.

**Tasks:**

```ts
// src/db/schema/password-resets.ts
export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
);
```

- `POST /api/auth/request-reset { email }` — generates token, hashes (sha256), stores, enqueues email via Plan #12
- `POST /api/auth/reset { token, newPassword }` — validates token, expires after 1 hour, single-use (marks consumed_at)
- Rate-limited per email (see A.2)
- E2E: request reset → click magic link → set new password → login

### A.2 Rate limiting

**Spec:** §13 "Rate limiting: per-IP and per-user on auth, document upload, ping endpoints".
**Status:** ❌ no implementation yet.
**Where to put it:** Plan #11 (super-admin + workers) as a new middleware module, since the table backing the counters belongs in the ops layer.

**Tasks:**

```ts
// src/lib/rate-limit/limiter.ts — Postgres-backed sliding window
// Schema: rate_limit_buckets (key text PK, count int, window_started_at timestamp)
// Function: await consume({ key, max, windowSec }) returns { allowed, retryAfterSec }
// Helper: rateLimitedHandler(req, { keyFn, max, windowSec }, handler)
```

Apply to:
- `POST /api/auth/login` — 5 attempts per (ip, email) per 15 minutes
- `POST /api/auth/register` — 3 per ip per hour
- `POST /api/auth/request-reset` — 3 per email per hour
- `POST /api/upload/presign` — 30 per user per minute
- `POST /api/driver/ping` — 12 per driver per minute (10s interval expected)

429 response includes `Retry-After` header.

### A.3 UAE PDPL — data export + account delete request flow

**Spec:** §13 "Privacy Policy + Terms pages; cookie banner; customer-portal 'Export my data' + 'Delete my account' requests routed to manager review (legal retention obligations: 5 years for tax / dispute purposes)".
**Status:** ❌ no flow; carry-over privacy text only.
**Where to put it:** Plan #3 (KYC, expand the customer profile area) + Plan #10 (manager queue).

**Tasks:**

- `customer_data_requests` schema: id, customer_id, kind ('export' | 'delete'), status ('pending' | 'fulfilled' | 'denied'), reason, fulfilled_at
- Customer Profile page: "Request my data" + "Request account deletion" buttons → confirm dialog → insert request row
- Manager → new "Data requests" page in nav (read-only queue)
- Export flow: manager clicks "Fulfill" → server bundles all customer data (profile, docs (signed URLs), bookings, payments, audit_logs.where(actor=customer)) into a JSON zip, presigns 24h GET, emails the link
- Delete flow: manager reviews; if no active bookings + no recent contract retention windows, mark fulfilled and call a `purgeCustomer(userId)` server action that anonymizes (email → `deleted-{id}@aa-rentacar.com`, fullName → 'Deleted Customer', soft-delete profile/docs); refuses if retention windows still active (returns reason)
- Cookie banner: client component on first visit, sets `cookie_consent=accepted` for 1 year

### A.4 Min driver age enforcement at booking time

**Spec:** §9.4 "Minimum driver age: 21 (configurable per category — 25 for Luxury/Sports/Limousine)".
**Status:** ❌ category field exists; not enforced at booking creation.
**Where to put it:** Plan #4 (booking engine) — add to `createBooking` validation.

**Tasks:**

```ts
// inside createBooking, after vehicle + category lookup
const profile = await tx.select().from(customerProfiles).where(eq(customerProfiles.userId, user.id)).limit(1);
if (!profile[0]) return { ok: false, error: 'profile_required' };
const ageYears = (input.pickupAt.getTime() - new Date(profile[0].dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
if (ageYears < category.minDriverAge) return { ok: false, error: 'driver_under_age' };
```

Customer-side: when browsing, show a tag "21+ required" / "25+ required" on each category and pre-filter results to vehicles the customer is eligible for (if they're logged in with a profile).

### A.5 License validity check at booking time

**Spec:** §9.4 "License validity check: license must be valid through the rental period".
**Status:** ❌ no enforcement.
**Where to put it:** Plan #4 (booking engine).

**Tasks:**

```ts
// Find the customer's most recent approved driving_license_front document
const license = await tx.select().from(customerDocuments)
  .where(and(
    eq(customerDocuments.customerId, user.id),
    eq(customerDocuments.type, 'driving_license_front'),
    eq(customerDocuments.status, 'approved'),
  ))
  .orderBy(desc(customerDocuments.reviewedAt)).limit(1);
if (!license[0]) return { ok: false, error: 'license_required' };
if (license[0].expiryDate && license[0].expiryDate < input.returnAt.toISOString().slice(0, 10)) {
  return { ok: false, error: 'license_expired_during_rental' };
}
```

Customer-side: surface a warning on the verification page if any expiring-soon (<30 days) doc, with re-upload prompt.

### A.6 Government ID name match runbook

**Spec:** §9.4 "Manager visually verifies name on license matches name on passport / Emirates ID".
**Status:** ⚠️ Manual process; needs explicit documentation.
**Where to put it:** Plan #3 — add to the manager-facing runbook page.

**Tasks:**

- `docs/runbooks/manager-kyc-review.md` — checklist for the manager:
  1. Compare full name on each document (transliterations matter — "Mohamed" vs "Muhammad" are common)
  2. Verify document expiry date is in the future
  3. Verify the customer's profile DOB matches the DOB visible on the ID
  4. For UAE residents: Emirates ID must be a current resident card (not visit visa)
  5. For tourists: passport visa stamp / e-visa entry must cover the rental period
  6. If any mismatch, reject with a clear note in the rejection field — the customer sees this verbatim
- Link this runbook from the manager customer-detail page (small "?" icon next to the document list)

### A.7 Pre-commit secret scan hook

**Spec:** §13 "Git hygiene: pre-commit hook scans for high-entropy strings".
**Status:** ❌ no hook; relying on .gitignore alone.
**Where to put it:** Plan #1 — add as a polish task during the next commit cycle.

**Tasks:**

- Install `gitleaks` (Go binary, no Node dep) — single static binary checked into `tools/` directory or pinned to a release
- `.gitleaks.toml` — minimal config catching `AKIA`, `sk_live_*`, `pk_live_*`, generic high-entropy 32+ char strings near `KEY` or `TOKEN`
- `scripts/install-git-hooks.sh` — adds a `.git/hooks/pre-commit` running `gitleaks protect --staged --redact`
- README: instruct contributors to run `pnpm setup-hooks` after clone
- Also: `pnpm dlx audit-ci --moderate` on `pnpm install` to catch CVE deps

---

## B. Phase 2 — after launch

These ship after Phase 1 is stable in production for ≥30 days. Each gets its
own spec doc when ready. Sketches below.

### B.1 Post-rental ratings (driver + car)

**Schemas:**
- `ratings` — id, booking_id (unique), customer_id, driver_rating (1-5), car_rating (1-5), comment text, created_at

**Customer:**
- Email + push notification 1 hour after booking completes with a link to rate
- 2-question form (driver stars + car stars + optional comment)
- Submission updates `driver_profiles.rating_avg` (rolling average) + appends to a `vehicles_ratings` cache (or compute on read)

**Manager:**
- New "Driver performance" report — rolling 90-day average per driver, complaints list
- Top-rated cars get a "Customer favorite" badge on the homepage

**Effort:** ~1 week.

### B.2 Loyalty program

**Schemas:**
- `loyalty_ledger` — id, customer_id, change (signed), balance_after, reason, booking_id?, created_at (already in spec §6.8)
- `customer_profiles.loyalty_points` (already exists in Plan #3)

**Earning rules (manager-configurable):**
- 1 point per AED 10 spent on completed bookings
- 100 bonus on first booking
- 200 referral bonus on referee's first completed booking

**Redemption:**
- At checkout, customer can apply up to 50% of points to discount
- 100 points = AED 10 off

**Tiered status:**
- Silver < 1,000 points/year, Gold 1,000-5,000, Platinum 5,000+
- Tier perks (free upgrade, free chauffeur hour, etc.) — manager-configurable

**Referral codes:** every customer gets a unique referral code at signup. Visible on profile.

**Effort:** ~2 weeks.

### B.3 Long-term & corporate accounts

**Schemas:**
- `corporate_accounts` — id, name, billing_address, billing_email, po_number_required, monthly_credit_limit_aed, created_at
- `corporate_employees` — id, corporate_account_id, user_id, can_book (bool), per_booking_limit_aed
- Modify `bookings` — add nullable `corporate_account_id` + `po_number` text
- `invoices` — id, corporate_account_id, period_start, period_end, total_aed, pdf_url, sent_at, paid_at

**Flows:**
- Manager onboards a corporate client (B2B): creates account + adds employee customer accounts
- Employees book under their account; charges defer to monthly invoice instead of immediate payment
- Monthly invoice job: pg-boss cron on 1st of each month, generates PDF, emails to billing address
- Long-term self-drive monthly contracts: same `bookings` but with `rental_kind='self_drive'` and `return_at` 30+ days out, auto-renew flag, monthly Stripe subscription instead of one-shot charge

**Effort:** ~3 weeks (most complex Phase-2 piece).

### B.4 Manager TOTP 2FA mandatory

**Status:** Plan #11 makes 2FA mandatory for super-admin in Phase 1, optional for manager. Phase 2 flips manager to mandatory too.

**Effort:** 1 day — flip a feature flag + force-enrollment on next login.

### B.5 Vehicle maintenance log

**Status:** spec §6.3 includes `vehicle_maintenance_log`; explicitly deferred from Plan #2.

**Schema:**
- `vehicle_maintenance_log` — id, vehicle_id, started_at, ended_at, mileage, kind ('service'|'repair'|'inspection'|'other'), cost_aed, vendor, notes, created_by_user_id

**UI:** new tab on vehicle detail page (Plan #2's edit page) — log entry form + history table. Vehicle status auto-flips to `maintenance` when a row is open (no ended_at), back to `active` on close.

**Effort:** ~3 days.

---

## C. Deferred indefinitely

Captured here so the decision is durable. Re-evaluate annually based on actual customer demand.

| Feature | Why deferred | Re-evaluation trigger |
|---|---|---|
| Customer wallet / store credit | User toggled off in brainstorming | Customer support volume on refund delays |
| AI search & recommendations | User toggled off in brainstorming; LLM cost + complexity | Once 1000+ bookings/mo and search exit rate > 30% |
| Hotel concierge / referral links | User toggled off | When sales team has a hotel partnership |
| Multi-currency display | User toggled off (twice in the picker) | Tourist conversion rate < spec target |
| SMS gateway (Etisalat/Unifonic/Twilio) | Email + Push deemed sufficient | If customer churn correlates with missed pickups |
| WhatsApp Business API | Adds vendor + monthly cost | Manager team feedback that customers prefer it |
| Multi-emirate (Abu Dhabi, Sharjah) | Data model supports via `branches` | Business expansion decision |
| Native iOS/Android apps | PWA covers; native is a separate project | App store presence required by partners |
| Driver earnings / payout system | Drivers are salaried employees | If business model shifts to gig drivers |
| Live driver tracking via Postgres LISTEN/NOTIFY | SSE-with-polling sufficient at expected scale | If polling load on dev becomes the bottleneck |
| GitHub Actions auto-deploy on push | Manual deploys preferred initially | Once deploy ritual is stable + multiple commits/day |
| CDN in front of Caddy | Caddy + Hetzner network is fast in UAE | If page load times degrade |
| Customer-side cancellation pre-handover | Manager-only currently | Customer support volume |
| Vehicle 360° view / virtual tour | Phase 2 polish if customers ask | Conversion rate analysis |
| Driver ratings in customer view | Privacy concern + low signal | If customer demand is loud |
| Booking modification (date change, vehicle swap) | Cancel + rebook for now | Customer support volume |
| Multi-language Manager portal | Staff-facing, English-only by spec | Hiring of non-English-fluent agents |

---

## How to use this document

- During plan execution: if you hit a §A item, add it as 1–3 tasks at the end of the matching existing plan, not as a standalone plan.
- Phase 2 trigger: 30 days post-launch + management sign-off + business case. Then write a Phase-2 design spec (parallel to Phase 1 spec) covering §B items in detail.
- Quarterly review: re-check §C deferred list against actual operational data; promote items as needed.
