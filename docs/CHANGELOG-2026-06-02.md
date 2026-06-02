# Session Changelog — 2026-06-02

Phase 1 taken from **6/13 plans** to **13/13 code-complete**, hardened via review,
then validated end-to-end with a full Playwright walkthrough that surfaced and
fixed 5 real bugs. All work is on `main` and pushed to GitHub
(`1a2ae1b..23fb6f2`).

---

## 1. Plans shipped (#7–#13)

| Commit | Plan | Delivered |
|---|---|---|
| `a954647` | #7 Payments | Stripe/Tabby/COD/Bank-transfer checkout, deposits (manual-capture holds), refunds, cancellation policy, **idempotent signature-verified webhooks** |
| `1089390` | #8 Live Tracking | SSE `/api/booking/[code]/track`, Mapbox animated map, TDD interpolation/bearing/ETA helpers, status pill, graceful no-token fallback |
| `b809f33` | #9 Provider Credentials | AES-256-GCM encrypted store + super-admin UI; retrofitted payments + server-side Mapbox to read through it (env fallback) |
| `9481f6c` | #10 Manager Portal | Real KPI dashboard, promotions CRUD + apply, revenue/occupancy/payment-mix reports w/ CSV, agent-permission matrix (`canAgent`), notifications inbox, settings, bank-transfer confirm |
| `7d117ea` | #11 Super-Admin + workers | System health, audit-log viewer, feature flags, pg-boss jobs browser, danger zone, **TOTP 2FA**, pg-boss worker (`scripts/worker.ts`) + 4 cron jobs |
| `f3c596f` | #12 Mail Server | Postfix/OpenDKIM docker, react-email bilingual templates, `send-email` pg-boss handler, app-event wiring, `docs/mail-setup.md` runbook |
| `546385a` | #13 Production Deploy | Production `docker-compose.yml`, multi-stage `Dockerfile`, Caddyfile (4 subdomains, IP-allowlisted admin), backup/restore scripts, GlitchTip/Sentry, ClamAV accept-then-scan, runbooks + go-live checklist |

Migrations advanced `0007 → 0013`.

## 2. Security review + fixes (`4419e32`)

A consolidated review found 4 Critical + several Important issues; all fixed:
- Webhooks **fail closed** in production when no signing secret is configured (were forgeable).
- **Cumulative partial-refund accounting** (could previously re-refund past the charge total).
- **TOTP replay prevention** via a `last_used_counter` column.
- `pg_dump` credentials moved **off the CLI** (were visible in `ps aux`).
- Refund/deposit actions restricted to **manager/superadmin** (agents excluded).
- Webhook signature verification decoupled from the Stripe API client; Stripe client cache busted on key rotation; domain-separated TOTP-pending HMAC key.

## 3. Customer dashboard (`7cb8225`)

Replaced the Plan #1 placeholder `/dashboard` stub with a real customer home:
quick-links (Browse Cars / My Bookings / Profile / Verification), KYC-status
banner, recent-bookings preview, and a **Sign-out** button (no logout UI existed
anywhere before).

## 4. Bugs found & fixed during the Playwright walkthrough (`23fb6f2`)

| # | Severity | Bug | Root cause | Fix |
|---|---|---|---|---|
| 1 | **Critical** | 2nd booking 500s (unique `code` violation); every booking gets `AA-2026-00001` | `nextBookingCode` passed the `SUBSTRING` start position as a **bound parameter** → Postgres used the regex form `substring(string FROM pattern)` → `NULL` | Emit position as SQL literal via `sql.raw`; + new integration test `tests/integration/lib/booking-code.test.ts` |
| 2 | **Critical** | Login 404s on `driver.`/`manager.`/`admin.` subdomains | Middleware rewrote `/login` → `/{segment}/login` (no such route) | Exclude shared auth paths (`/login`, `/register`, `/totp`) from the portal rewrite (`src/middleware.ts`) |
| 3 | Minor | Price shows "AED 450 / **dai**" | `"daily".replace(/ly$/,'')` → "dai" | New `rateUnitLabel()` map in `compute-rate.ts`; used in `cars/page.tsx` + `booking-panel.tsx` |
| 4 | Minor | Stale "ships in Plan #6/#7" copy | Placeholders from earlier plans | Refreshed copy in checkout-form, manager booking detail, driver job |

Also cleaned **test-data contamination**: integration tests share the dev DB and
create `car-<timestamp>` categories; these had leaked in and produced duplicate
"Car" categories + an unbookable Toyota Camry.

## 5. Verification

`pnpm typecheck` ✓ · `pnpm test` **254 passing** (+2 new) · `pnpm lint` ✓ ·
`pnpm build` compiled ✓. Walkthrough screenshots captured for customer dashboard,
manager dashboard, driver portal, and super-admin health (gitignored under
`.playwright-mcp/` + `demo-*.png`).

## 6. Known issues / dev-environment notes

- **Dev DB is shared with the test runner.** `pnpm test` truncates `users`,
  `sessions`, etc., and the reports/booking-code integration tests additionally
  truncate `vehicles`, `vehicle_categories`, `vehicle_types`, `bookings`. After
  any test run, re-seed: `pnpm db:seed-all`. **Seeds do NOT create bookable
  vehicles** (no vehicle/rate seed) — a manager must add fleet + rate cards, or
  we add a `db:seed-demo` script (see Next session).
- Building (`pnpm build`) while `pnpm dev` is running can emit a spurious
  `/_document` error from `.next` contention — stop dev servers for a clean build.
- **verify-on-deploy** (unchanged from Plan #13): live Stripe/Tabby/Mapbox/SMTP
  keys, Hetzner VPS, Cloudflare DNS/PTR, GlitchTip image, ClamAV — see
  `docs/go-live-checklist.md`. The map + real payment confirmation need live keys.

## 7. Local credentials (dev only)

`customer@test.com` / `customer-test-password` (verified) ·
`pending@test.com` / `pending-test-password` ·
`driver1@test.com` / `driver-test-password` (no driver_profile — onboard via Manager → Drivers) ·
`manager@test.com` / `manager-test-password` ·
`admin@aa-rentacar.com` / `change-me-on-first-login` (superadmin; TOTP not yet enrolled).

Local portal access: `http://localhost:3002/login`, then `?portal=driver|manager|superadmin`.

## 8. Next session — frontend + testing focus

Suggested starting points:
1. **`db:seed-demo` script** — a handful of bookable vehicles (car + limousine)
   with rate cards + a driver_profile for `driver1`, so the full demo survives
   test runs. Removes the biggest demo-setup friction.
2. **Frontend polish** — the portals are functional but plain (`PortalShell` is a
   bare header). Candidates: vehicle photos on `/cars` (presign wired manager-side
   only), consistent customer nav across `/cars`/`/profile`/`/verification`,
   loading/empty states, the live-tracking map with a real Mapbox token.
3. **Further testing** — Playwright e2e specs for the lifecycle proven manually
   this session (book → pay → approve → dispatch → accept), bank-transfer +
   promo-code apply paths, and the subdomain-login regression (Bug #2).
