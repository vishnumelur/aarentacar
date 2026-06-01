# AA Rent A Car — Plan #11: Super-Admin Completion + pg-boss workers

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Super-Admin portal goes from a placeholder to a real ops cockpit: system health, audit log viewer, feature flags, pg-boss dashboard, danger zone, TOTP 2FA mandatory at login. Also wires up pg-boss workers for the deferred jobs (document expiry, deposit auto-release, driver-ping retention, daily DB backup).

**Spec reference:** §7.4 Super-Admin Portal, §13 security 2FA, §11.5 mail server (TOTP cross-references).

---

## File Structure
- pg-boss worker entrypoint: `src/lib/jobs/worker.ts` + `scripts/worker.ts` (`pnpm worker:start`)
- Schemas: `feature_flags`, `totp_secrets`
- `src/app/admin/page.tsx` (rewrite — system health card grid)
- `src/app/admin/users/page.tsx`, `[id]/page.tsx`
- `src/app/admin/feature-flags/page.tsx`
- `src/app/admin/audit-logs/page.tsx`
- `src/app/admin/jobs/page.tsx` (pg-boss state browser)
- `src/app/admin/danger/page.tsx`
- `src/app/(auth)/totp/page.tsx` (TOTP challenge during login)
- `src/lib/totp/totp.ts` (using `@oslojs/otp` or `otpauth`)
- `src/lib/jobs/queue.ts` — pg-boss wrapper: enqueue, list, cancel

## Task 1: pg-boss setup
- `pnpm add pg-boss`
- `src/lib/jobs/queue.ts`: lazy singleton, `await boss.start()` once
- `scripts/worker.ts`: starts the boss, registers handlers for `document-expiry`, `deposit-release`, `driver-pings-prune`, `daily-pg-dump`
- docker-compose `worker` service runs this script with the same image as the app

## Task 2: Wire deferred jobs
- `document-expiry`: cron daily 02:00, calls Plan #3's `computeExpiredDocs` over all customers
- `deposit-release`: cron every 15min, finds bookings with completed return + cleared inspection + payment_holds.status=held, calls Stripe releaseHold
- `driver-pings-prune`: cron daily 03:00, DELETE FROM driver_pings WHERE recorded_at < now() - 24h
- `daily-pg-dump`: cron daily 02:00, runs `pg_dump` to MinIO backups/ bucket

## Task 3: TOTP 2FA for super-admin
- `totp_secrets` table: user_id, secret_encrypted, enabled_at, last_used_at, recovery_codes_hashed (jsonb)
- Setup flow at `/admin/security/setup-2fa`: generates QR (otpauth://...), user scans, enters first code to confirm
- Login flow change: when user.role='superadmin' AND totp.enabled, redirect to `/totp` after password → enter 6-digit code → on success, session is finalized
- 10 recovery codes generated at setup, shown once, hashed (bcrypt) in DB
- Manager 2FA is optional in Phase 1 (mandatory in Phase 2 per spec §13)

## Task 4: System health page
- DB pool stats (postgres-js exposes `idle`, `total`)
- MinIO disk usage (via `mc admin info`)
- pg-boss pending jobs count
- Error rate last 24h (count audit_logs where kind ends with `.failed`)
- Build info (git SHA from `GIT_SHA` env)
- Quick action buttons: trigger manual DB backup, restart workers, clear credentials cache

## Task 5: Audit logs viewer
- Filterable list (actor, action, target type, date range)
- Export CSV
- Read-only — immutable per spec §13

## Task 6: Feature flags
- `feature_flags` table: key (unique), enabled (bool), description
- Helper: `await isFeatureEnabled('live-tracking')` with 30s cache
- Toggleable in UI per spec §3.1 phase 1: include `live-tracking`, `customer-ratings`, `loyalty-points`, `corporate-accounts`, `maintenance-mode`
- maintenance-mode renders a banner + blocks new bookings

## Task 7: User/role management
- List all users with role + status
- Promote/demote (any role transition, audit-logged)
- Reset password (sends magic-link email)
- Suspend (sessions invalidated; user can't log in)

## Task 8: pg-boss jobs page
- Browse queue states (created, active, completed, failed, cancelled)
- Filter by job name + date
- Retry a failed job
- Cancel a pending job

## Task 9: Danger zone
- Two-step confirmation (`type DROP to confirm`)
- DROP TABLE (any table)
- PURGE OLD DATA (delete bookings/users older than X days that have no recent activity — for GDPR/PDPL)
- Reset password (any user)

## Acceptance
- pg-boss worker runs in Docker Compose
- Document expiry job runs and flips a test expired-tomorrow doc to expired the next day
- Super-admin login redirects through TOTP challenge
- Feature flag toggle takes effect within 30s
- Audit log exports CSV with all expected columns

## Not in this plan
- Real Sentry integration (could be added as a feature flag toggle here, but actual deploy/wiring is Plan #13)
- Cross-user activity tracking (deferred)
