# AA Rent A Car — Implementation Plans Index

The approved design spec (`docs/superpowers/specs/2026-06-01-aa-rentacar-design.md`)
covers Phase 1 in full. Implementation is split into 13 sequential plans, each
producing working, testable software on its own.

| # | File | Delivers | Status |
|---|---|---|---|
| 1 | [Foundation](2026-06-01-foundation.md) | Next.js scaffold, auth, DB, subdomain routing, i18n, CI | ✅ shipped |
| 2 | [Inventory](2026-06-01-inventory.md) | Manager fleet CRUD, bulk CSV, rate cards, MinIO photos + polish | ✅ shipped |
| 3 | [Customer KYC](2026-06-01-customer-kyc.md) | Customer registration + Verification Center + manager review queue | ✅ shipped |
| 4 | [Browse & Book](2026-06-01-browse-and-book.md) | Public search, vehicle detail, booking engine (pre-payment) | written |
| 5 | [Manager Dispatch](2026-06-01-manager-dispatch.md) | Booking approval + nearest-driver auto-suggest + confirm | written |
| 6 | [Driver Portal PWA](2026-06-01-driver-portal.md) | Installable PWA, accept job, navigation, photos, e-sign, live ping | written |
| 7 | [Payments](2026-06-01-payments.md) | Stripe, Tabby, COD, Bank Transfer, deposits, refunds, webhooks | written |
| 8 | [Live Tracking](2026-06-01-live-tracking.md) | SSE + Swiggy-style animated tracking UX | written |
| 9 | [Provider Credentials](2026-06-01-provider-credentials.md) | Super-Admin UI for managing API keys at runtime (AES-256-GCM) | written |
| 10 | [Manager Portal Completion](2026-06-01-manager-portal-completion.md) | Real dashboard KPIs, reports, agent permissions, promos, settings | written |
| 11 | [Super-Admin + Workers](2026-06-01-superadmin-completion.md) | Health, feature flags, audit log, TOTP 2FA, pg-boss workers | written |
| 12 | [Mail Server](2026-06-01-mail-server.md) | Postfix + OpenDKIM + Cloudflare DNS + react-email templates | written |
| 13 | [Production Deploy](2026-06-01-production-deploy.md) | Caddy SSL, deploy ritual, nightly backups, GlitchTip, ClamAV | written |
| 14 | [Phase 1 Gaps + Phase 2 + Deferred](2026-06-01-phase-2-and-deferred.md) | Holding pen: 7 Phase-1 gaps to fold in, 5 Phase-2 features, indefinitely-deferred list | written |

After all 13 plans ship + the 7 Phase-1 gaps in Plan #14 §A are folded in:
the acceptance criteria in §16 of the spec is met.

**Validation:** See [Spec Coverage Audit](../specs/2026-06-01-coverage-audit.md)
for the section-by-section spec→plan mapping that produced Plan #14.

## How to execute
Each plan uses the TDD bite-sized-task format from `superpowers:writing-plans`.
Execute via `superpowers:subagent-driven-development` (one subagent per task with
two-stage review) or `superpowers:executing-plans` (inline with checkpoints).
Plans #3–#13 build on the foundation laid by #1 and #2 — execute in order.

## Note on plan depth
Plans #1 and #2 are the most exhaustive (~3000 lines each, full TDD step-by-step
with every code sample). Plans #3–#13 are tightened (~100–700 lines): full file
structure + every server action + acceptance criteria + scope boundaries are
present, but the recurring TDD-cycle ceremony from #1/#2 is implied rather than
repeated. The engineer expanding any plan into per-task code can read the
established conventions in #1/#2 and apply the same shape.
