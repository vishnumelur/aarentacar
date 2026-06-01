# AA Rent A Car — Spec Coverage Audit

**Date:** 2026-06-01
**Audited against:** `docs/superpowers/specs/2026-06-01-aa-rentacar-design.md` (v1.1) + the brainstorming session notes captured in `.superpowers/brainstorm/`.

This is a section-by-section validation. For every spec requirement, we mark:
- ✅ — covered by a shipped plan
- 📝 — covered by a written-but-not-shipped plan
- ⚠️ — covered partially; see notes
- ❌ — gap; tracked in [Plan #14](../plans/2026-06-01-phase-2-and-deferred.md)
- 🛑 — explicitly deferred per spec §3.3

---

## §1 Overview

| Item | Status | Plan |
|---|---|---|
| §1.1 Carry-over: HQ address, branch, phone numbers, email, hours, privacy policy | ✅ | Plan #1 README + landing page |
| §1.2 Goals — online bookings 24/7, manager control, dispatch, disputes via photos, self-hosted | ✅ | All plans collectively |
| §1.3 Non-goals — native apps, marketplace, multi-emirate, AI/wallet/concierge/multi-currency | 🛑 | Out of scope |

## §2 Business model

| Item | Status | Plan |
|---|---|---|
| Single operator (own fleet) | ✅ | (locked in brainstorming) |
| 2 categories: Car + Limousine + sub-types | ✅ | Plan #2 (seeds 9 sub-types) |
| Self-drive + chauffeur rental modes | 📝 | Plan #4 (`rental_kind` enum on bookings) |
| All 4 pricing modes (hourly/daily/weekly/monthly + package) | ✅ | Plan #2 (`vehicle_rates`); Plan #4 picks cheapest |
| Pickup anywhere in Dubai (map pin) | 📝 | Plan #4 (free-form address + lat/lng on bookings); map UI deferred to Plan #8 |
| Advance-book rule per category | ✅ | Plan #2 (`vehicle_categories.advance_book_min_days` + UI) |

## §3 Scope & phasing

| Item | Status | Plan |
|---|---|---|
| Phase 1 launch scope (14 bullets) | ✅+📝 | Plans #1–#13 (3 shipped, 10 written) |
| Phase 2 deferred (ratings, loyalty, corporate, manager 2FA mandatory) | 📝 | Plan #14 §B |
| Deferred indefinitely (wallet, AI, concierge, multi-currency, SMS, WhatsApp) | 🛑 | Plan #14 §C |

## §4 Tech stack

| Item | Status | Plan |
|---|---|---|
| Next.js 15 + React 19 + TS strict | ✅ | Plan #1 |
| Tailwind 4 + shadcn/ui | ✅ | Plan #1 |
| Custom session auth — no third-party | ✅ | Plan #1 |
| Drizzle + Postgres 16 | ✅ | Plan #1 |
| Self-hosted SMTP (Postfix+OpenDKIM/Cloudflare DNS) | 📝 | Plan #12 |
| next-intl EN+AR with RTL | ✅ | Plan #1 |
| Mapbox + Stripe + Tabby + MinIO + pg-boss + Caddy | ✅+📝 | Plans #2 (MinIO), #7 (payments), #8 (Mapbox), #11 (pg-boss), #13 (Caddy) |
| Docker Compose dev | ✅ | Plan #1 |

## §5 System architecture

| Item | Status | Plan |
|---|---|---|
| 8 production containers (app, postgres, minio, caddy, worker, postfix, opendkim, clamav) | 📝 | Plan #2 (minio), Plan #11 (worker), Plan #12 (postfix+opendkim), Plan #13 (caddy+clamav). Dev compose currently has just postgres + minio. |
| Subdomain routing via middleware → route groups | ✅ | Plan #1 |
| Realtime (SSE for tracking) | 📝 | Plan #8 |

## §6 Data model

| Section | Tables | Status | Plan |
|---|---|---|---|
| §6.1 Identity & access | users, sessions, password_resets, agent_permissions | ⚠️ Partial — **password_resets** schema not yet created; **agent_permissions** in Plan #10 | Plan #1 (users, sessions) + **Plan #14 §A.1 (password_resets gap)** + Plan #10 (agent_permissions) |
| §6.2 Customer profile & KYC | customer_profiles, customer_documents | ✅ | Plan #3 |
| §6.3 Inventory | branches, vehicle_categories, vehicle_types, vehicles, vehicle_rates, **vehicle_maintenance_log** | ⚠️ Partial — maintenance_log explicitly deferred | Plan #2 + Plan #14 §B (maintenance_log moved to Phase 2) |
| §6.4 Bookings | bookings, booking_addons, addons, booking_assignments, booking_events | 📝 | Plans #4 + #5 |
| §6.5 Payments | payments, payment_holds, refunds, webhook_events | 📝 | Plan #7 |
| §6.6 Drivers & dispatch | driver_profiles, driver_pings, damage_inspections, agreements | 📝 | Plans #5 + #6 |
| §6.7 Marketing | promo_codes | 📝 | Plans #4 (engine) + #10 (CRUD) |
| §6.8 Loyalty (Phase 2) | loyalty_ledger | 📝 | Plan #14 §B |
| §6.9 System | pg_boss_*, audit_logs, settings, provider_credentials, notifications | ✅+📝 | Plan #1 (audit/settings) + Plan #9 (provider_creds) + Plan #10 (notifications) + Plan #11 (pg-boss) |

## §7 Portals

| Item | Status | Plan |
|---|---|---|
| §7.1 Customer Portal — landing/search/browse/checkout/my-bookings/verification/tracking/e-sign | ✅+📝 | Plans #1 (landing/login), #3 (verification), #4 (browse/book), #6 (e-sign), #8 (tracking) |
| §7.2 Manager Portal — dashboard/bookings/customers/fleet/categories/types/drivers/promos/reports/notifications/settings, agent sub-role | ✅+📝 | Plans #2 (fleet+categories+types), #3 (customers), #5 (bookings+dispatch+drivers), #10 (KPIs+promos+reports+notifications+settings+agent perms) |
| §7.3 Driver Portal — PWA, today screen, job offers, active job map, handover photos, e-sign, return photos | 📝 | Plan #6 |
| §7.4 Super-Admin — system health, users, feature flags, **Provider Credentials UI**, tools, audit logs, danger zone | 📝 | Plan #9 (creds) + Plan #11 (the rest) |

## §8 Customer booking flow

| Step | Status | Plan |
|---|---|---|
| 1-6 search + select + add-ons | 📝 | Plan #4 |
| 7-9 auth + KYC gate + checkout | 📝 | Plan #4 (KYC gate redirects to /verification per Plan #3) |
| 10-13 status transitions | 📝 | Plan #4 (status machine) + Plan #7 (payments) |
| 14-16 manager review + dispatch | 📝 | Plan #5 |
| 17-22 driver execution + handover + return | 📝 | Plan #6 |
| 22-24 completion + deposit settlement | 📝 | Plan #7 (deposit auto-release) |

## §9 KYC & verification

| Item | Status | Plan |
|---|---|---|
| §9.1 Verification Center (tourist + resident matrices) | ✅ | Plan #3 |
| §9.2 Manager review (approve/reject with reason) | ✅ | Plan #3 |
| §9.3 Re-verification on expiry | ⚠️ Partial — pure expiry checker exists, runner wired in Plan #11 | Plan #3 + Plan #11 |
| §9.4 Compliance baseline | ⚠️ Partial — see gaps | |
| ↳ Min driver age 21+ configurable per category | ✅ | Plan #2 has `min_driver_age` field; **but enforcement at booking time gap → Plan #14 §A.4** |
| ↳ License validity check during rental period | ❌ | **Gap → Plan #14 §A.5** |
| ↳ Government ID name matches license name | ⚠️ Manual manager step | **Documented in Plan #14 §A.6** |

## §10 Payments & deposits

| Item | Status | Plan |
|---|---|---|
| §10.1 4 methods (Card/Tabby/COD/Bank Transfer) | 📝 | Plan #7 |
| §10.2 Deposit configuration + auto-release + manager capture | 📝 | Plan #7 |
| §10.3 Webhooks (signature-verified, idempotent) | 📝 | Plan #7 |
| §10.4 Refunds | 📝 | Plan #7 |
| §10.5 Cancellation policy | 📝 | Plan #7 |

## §11 Maps, tracking, notifications, provider credentials

| Item | Status | Plan |
|---|---|---|
| §11.1 Mapbox for customer/driver/manager | 📝 | Plans #4 (pin), #6 (driver nav), #8 (live tracking), #10 (driver map) |
| §11.2 Live tracking architecture (SSE, 10s pings, 60s ETA cache) | 📝 | Plan #8 |
| §11.2.1 **Swiggy-style** animated marker + status pill + camera + reduced-motion + perf budget | 📝 | Plan #8 (full detailed spec) |
| §11.3 Notifications (Email + Web Push + in-app inbox) | 📝 | Plan #6 (push) + Plan #10 (inbox) + Plan #12 (email) |
| §11.4 Provider Credentials UI (Stripe/Tabby/Mapbox/SMTP, AES-256-GCM, env fallback) | 📝 | Plan #9 |
| §11.5 Mail server (Postfix+OpenDKIM, Cloudflare DNS, IP warm-up, fallback to managed SMTP) | 📝 | Plan #12 |

## §12 Internationalization

| Item | Status | Plan |
|---|---|---|
| EN default, AR with full RTL | ✅ | Plan #1 |
| Bilingual DB content (vehicle types, addons) | ✅+📝 | Plan #2 + #4 |
| Manager/Driver/SuperAdmin portals English-only | ✅ | Plans #2–#11 (no AR work) |

## §13 Security & privacy

| Item | Status | Plan |
|---|---|---|
| Passwords bcrypt | ✅ | Plan #1 |
| Sessions httpOnly + Secure + SameSite=Lax | ✅ | Plan #1 |
| CSRF via Server Actions tokens | ✅ | Plan #1 (built-in) |
| **Rate limiting** per-IP and per-user on auth/upload/ping | ❌ | **Gap → Plan #14 §A.2** |
| Role + resource ownership server-side checks | ✅+📝 | Plans #1 + per-action enforcement |
| File uploads MIME + size + **ClamAV scan** | ⚠️ Partial — mime gate done, ClamAV in Plan #13 | Plan #2 + #3 + Plan #13 |
| TLS via Caddy + Let's Encrypt | 📝 | Plan #13 |
| At-rest encryption — provider creds AES-256-GCM | 📝 | Plan #9 |
| At-rest encryption — disk-level via Hetzner | 📝 | Plan #13 runbook |
| PII minimization (audit log IP hashed) | ✅ | Plan #1 hashes IP |
| Backups: nightly pg_dump + age encryption + 30d retention | 📝 | Plan #13 |
| **UAE PDPL compliance — privacy policy + cookie banner + data export/delete request flow** | ⚠️ Partial — policy text carried; **export/delete flow gap → Plan #14 §A.3** |
| 2FA TOTP — Super-Admin mandatory, Manager optional (Phase 1) | 📝 | Plan #11 |
| Git hygiene (.env in .gitignore, pre-commit secret scan) | ✅ | Plan #1 has .gitignore; **pre-commit secret-scan gap → Plan #14 §A.7** |

## §14 Deployment & operations

| Item | Status | Plan |
|---|---|---|
| GitHub repo + branch + .gitignore | ✅ | Plan #1 |
| Local dev workflow | ✅ | Plan #1 |
| Production deploy ritual | 📝 | Plan #13 |
| `.env.production` on server, mode 600 | 📝 | Plan #13 |
| Backups + restore drill | 📝 | Plan #13 |
| Observability (Sentry-compatible GlitchTip + uptime monitor) | 📝 | Plan #13 |
| First-boot bootstrap | ✅ | Plan #1 (bootstrap) + Plan #2 (inventory seed) |

## §15 Out of scope & deferred decisions

All explicitly accepted as deferred per spec:
- Final Mapbox pricing after launch traffic — defer
- SMS gateway — defer
- WhatsApp Business API — defer
- Multi-emirate UI work — defer (data model supports it via `branches`)
- Native mobile apps — defer
- Driver earnings — defer (salaried)
- Wallet, AI search, multi-currency, concierge — defer

→ Captured formally in Plan #14 §C.

## §16 Acceptance criteria

| Criterion | Status |
|---|---|
| 1. Customer end-to-end booking flow | 📝 (Plans #3+4+7+6+8) |
| 2. Manager can do everything described | ✅+📝 (Plans #2+3+5+10) |
| 3. Driver can do everything described | 📝 (Plan #6) |
| 4. Super-Admin can do everything described | 📝 (Plans #9+11) |
| 5. <2s load + 90+ Lighthouse mobile | 📝 (Plan #13 verification step; Next 15 RSC defaults help) |
| 6. EN + AR with full RTL | ✅ (Plan #1) |

---

## Summary of gaps (Phase 1)

7 Phase-1 gaps were identified and are tracked in [Plan #14 §A](../plans/2026-06-01-phase-2-and-deferred.md#a-phase-1-gaps-must-ship-before-go-live):

1. **`password_resets` schema** (spec §6.1) — defined but not migrated
2. **Rate limiting** (spec §13) — auth, upload, ping endpoints
3. **UAE PDPL data export + delete request flow** (spec §13)
4. **Min driver age enforcement at booking time** (spec §9.4)
5. **License validity check at booking time** (spec §9.4)
6. **Government ID name match runbook** (spec §9.4) — manual process documentation
7. **Pre-commit secret scan hook** (spec §13 git hygiene)

## Summary of Phase 2 items

5 Phase-2 features captured in [Plan #14 §B](../plans/2026-06-01-phase-2-and-deferred.md#b-phase-2-after-launch):

1. Post-rental ratings (driver + car)
2. Loyalty program (points + referrals + tiered status)
3. Long-term & corporate accounts (auto-renew + PO billing + employee sub-accounts)
4. Manager TOTP 2FA mandatory (currently optional)
5. Vehicle maintenance log (was deferred from Plan #2)

## Brainstorming alignment

All 8 features selected by the user in the visual brainstorming session are accounted for:

| User selection | Plan |
|---|---|
| ✅ Live driver tracking (Uber-style) | Plan #8 (Swiggy-style per their later request) |
| ✅ Add-ons & extras at checkout | Plan #4 (`addons` + `booking_addons` schemas) |
| ✅ Damage inspection with photos | Plan #6 (`damage_inspections`) |
| ✅ Digital rental agreement signing | Plan #6 (e-signature + PDF generation) |
| ✅ Long-term & corporate accounts | Phase 2 → Plan #14 §B.3 |
| ✅ Loyalty / referral program | Phase 2 → Plan #14 §B.2 |
| ✅ Promo codes & dynamic pricing | Plans #4 (engine) + #10 (CRUD) |
| ✅ Post-rental ratings | Phase 2 → Plan #14 §B.1 |
| ⏭ Customer wallet | Deferred per user choice |
| ⏭ AI search & recommendations | Deferred per user choice |
| ⏭ Concierge / hotel partner links | Deferred per user choice |
| ⏭ Multi-currency display | Deferred per user choice (toggled off twice in the picker) |

All user-added context is captured:
- ✅ "manager option to add car AND change pricing AND bulk add" → Plan #2 (single CRUD + CSV bulk + rate cards)
- ✅ "document upload section in customer portal, verified by manager, can book after" → Plan #3 (Verification Center with KYC gate)
- ✅ "supermodern animation, car moving on tracker" → Plan #8 §11.2.1 (Swiggy-style)
- ✅ "self-hosted SMTP, Cloudflare DNS" → Plan #12 (Postfix + OpenDKIM via Cloudflare)
- ✅ "Super-Admin frontend to add Stripe + Tabby keys, simple" → Plan #9 (Provider Credentials UI)
- ✅ "white / red / black theme, supermodern, mobile responsive" → Plan #1 (Tailwind brand tokens, shadcn defaults)
- ✅ "commit on main, push to GitHub, pull on server" → Plan #1 + #13

## Verdict

The 13 plans cover Phase 1 in full **except for the 7 gaps in §A**, which are tracked in **Plan #14**. The 5 Phase-2 features and 6 indefinitely-deferred items are also captured there. Once Plan #14 §A is folded into the relevant existing plans (small additions to Plans #1, #3, #4, #11, #13) and the remaining 10 written plans (#4–#13) ship, the spec's §16 acceptance criteria is fully met.

Plan #14 is **not a single-execution plan** — it's a holding pen. Items in §A get merged into their natural plan during execution; items in §B get a Phase-2 spec when ready; items in §C are deferred indefinitely.
