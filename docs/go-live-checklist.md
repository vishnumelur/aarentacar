# First Go-Live Checklist (Plan #13, Task 9)

Work top to bottom. Each box is **verify-on-deploy** unless noted. References:
`docs/hetzner-setup.md` (provisioning), `docs/dns.md` (records),
`docs/mail-setup.md` (Plan #12 mail).

## Pre-flight (can verify before touching the VPS)
- [ ] All 13 plans implemented + CI green on `main` (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).
- [ ] `pnpm build` succeeds with **no** Sentry DSN and no prod env (SDK no-ops).
- [ ] `docker compose config` parses for `docker-compose.yml` and `docker-compose.dev.yml`.

## Infrastructure
- [ ] Hetzner VPS provisioned, **full-disk encrypted**, hostname `aa-rentacar`.
- [ ] SSH hardened (key-only), `fail2ban` active, `ufw` allows only 22/80/443/25.
- [ ] Docker + Compose v2 installed; repo cloned to `/opt/aarentacar`.
- [ ] Host volumes created: `/srv/aa/{postgres,minio,backups}`.
- [ ] `.env.production` filled, mode `600 root:root`; `ENCRYPTION_KEY` stored offline.

## DNS / mail
- [ ] Cloudflare DNS records configured: apex + `www` + `manager` + `driver` +
      `admin` + `mail`, plus SPF / DKIM / DMARC (see `docs/dns.md`).
- [ ] PTR / reverse DNS set in the Hetzner console (`<IP>` → `aa-rentacar.com`).
- [ ] DKIM key generated (`scripts/dkim-keygen.sh`) and the public key published.

## First deploy
- [ ] `docker compose up -d` built and started all services.
- [ ] Migrations + bootstrap + seed + `minio:bootstrap` ran successfully.
- [ ] First deploy succeeded; **`/api/health` returns OK on all subdomains**
      (apex, manager, driver, admin from an allowlisted IP).
- [ ] All 4 subdomains serve via Caddy with valid Let's Encrypt certs.
- [ ] `admin.aa-rentacar.com` returns 403 from a non-allowlisted IP.

## Security / credentials
- [ ] Super-admin **TOTP** enabled (first login flow).
- [ ] Provider credentials filled in the Super-Admin UI for: Stripe (LIVE keys),
      Tabby (LIVE keys), Mapbox, SMTP, and GlitchTip DSN.

## Observability
- [ ] GlitchTip up; project created; DSN pasted into Super-Admin → Provider
      Credentials. A test error appears in GlitchTip with a stack trace
      (and source maps if source-map upload was enabled at build).

## Functional smoke
- [ ] Test email delivers to a Gmail address with SPF + DKIM + DMARC all passing
      (check the Gmail "Show original" auth results).
- [ ] Test booking end-to-end with a small **AED 1** real-card charge, then
      immediately refund it.
- [ ] Upload a document and confirm the ClamAV `scan-uploaded-file` job runs
      (clean → stays pending/approved; EICAR test file → flips to `rejected`
      with `review_note='malware_detected'`) within ~60 s.

## Backups
- [ ] `scripts/backup.sh` produces an encrypted object in
      `minio/backups/postgres/`.
- [ ] **Restore drill** (`scripts/restore-drill.sh` on the operator laptop with
      the offline age key) completes with `PASS`.
- [ ] Backup cron scheduled at 02:00 and verified to run **two consecutive
      nights**.

## Acceptance (spec)
- [ ] Landing serves in < 2 s on Dubai 4G.
- [ ] Errors appear automatically in GlitchTip with stack traces + source maps.
- [ ] ClamAV scans every uploaded file within 60 s.
- [ ] Daily encrypted backups visible in the MinIO `backups/` bucket.
