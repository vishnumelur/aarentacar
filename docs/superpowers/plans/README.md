# AA Rent A Car — Implementation Plans Index

The approved design spec (`docs/superpowers/specs/2026-06-01-aa-rentacar-design.md`)
covers Phase 1 in full. Implementation is split into 13 sequential plans, each
producing working, testable software on its own.

Write each plan only after the previous one is implemented and merged, so the
plan reflects the real state of the repo at that moment.

| # | File | Delivers |
|---|---|---|
| 1 | [2026-06-01-foundation.md](2026-06-01-foundation.md) | Next.js scaffold, auth, DB, subdomain routing, i18n, CI |
| 2 | [2026-06-01-inventory.md](2026-06-01-inventory.md) | Manager fleet CRUD, bulk CSV, rate cards, MinIO photo upload |
| 3 | `NNNN-NN-NN-customer-kyc.md` | Customer registration + Verification Center + manager review queue |
| 4 | `NNNN-NN-NN-browse-and-book.md` | Public search, vehicle detail, booking engine (no payment yet) |
| 5 | `NNNN-NN-NN-manager-dispatch.md` | Booking approval + nearest-driver auto-suggest + confirm |
| 6 | `NNNN-NN-NN-driver-portal.md` | Installable PWA, accept job, navigation, photos, e-sign, live ping |
| 7 | `NNNN-NN-NN-payments.md` | Stripe, Tabby, COD, Bank Transfer, deposits, refunds, webhooks |
| 8 | `NNNN-NN-NN-live-tracking.md` | SSE + Swiggy-style animated tracking UX |
| 9 | `NNNN-NN-NN-provider-credentials.md` | Super-Admin UI for managing API keys at runtime |
| 10 | `NNNN-NN-NN-manager-portal-completion.md` | Dashboard, reports, agent permissions, promos, settings |
| 11 | `NNNN-NN-NN-superadmin-completion.md` | Health, feature flags, audit log, tools, danger zone |
| 12 | `NNNN-NN-NN-mail-server.md` | Postfix + OpenDKIM + Cloudflare DNS + IP warm-up |
| 13 | `NNNN-NN-NN-production-deploy.md` | Caddy SSL, deploy ritual, nightly backups, observability |

After all 13 plans ship: the acceptance criteria in §16 of the spec is met.
