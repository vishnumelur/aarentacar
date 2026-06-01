# AA Rent A Car — Plan #13: Production Deploy Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship the platform to the customer's Hetzner VPS. Caddy reverse proxy with auto Let's Encrypt SSL for all four subdomains. Nightly encrypted `pg_dump` to MinIO with 30-day retention. ClamAV sidecar wired into upload paths. Observability via self-hosted GlitchTip (Sentry-compatible). One-command deploy ritual. **After this plan ships:** the platform is live in production at `https://aa-rentacar.com` and observable.

**Spec reference:** §5.1 8-container compose, §13 security/backups/encryption-at-rest, §14 deploy ritual + observability.

---

## File Structure
- `docker-compose.yml` — production-grade (vs `docker-compose.dev.yml` which is dev-only)
- `docker/caddy/Caddyfile`
- `docker/clamav/` — re-uses Plan #12's clamav service
- `scripts/deploy.sh` — pull, build, migrate, restart, health-check
- `scripts/backup.sh` — pg_dump + age-encrypt + mc cp to MinIO
- `scripts/restore-drill.sh` — quarterly restore-from-backup verification
- `docs/hetzner-setup.md` — first-time VPS provisioning runbook
- `docs/dns.md` — Cloudflare DNS records for all subdomains
- `.github/workflows/deploy.yml` — optional auto-deploy on push to main (deferred to manual deploy initially per user preference)

## Task 1: Hetzner VPS provisioning runbook (docs)
`docs/hetzner-setup.md`:
1. Order CX31 or CPX31 (≥4GB RAM, 2 vCPU, 80GB SSD)
2. Enable full-disk encryption (Hetzner offers it at provisioning)
3. Set hostname to `aa-rentacar`
4. Reverse DNS record for IP → `aa-rentacar.com` (and `mail.aa-rentacar.com` for Plan #12)
5. SSH harden: disable password auth, enable key-only, install fail2ban, ufw allow 22/80/443 only
6. Install Docker + Docker Compose v2 (apt)
7. `mkdir -p /opt/aarentacar && cd /opt/aarentacar && git clone git@github.com:vishnumelur/aarentacar.git .`
8. Create `.env.production` with `ENCRYPTION_KEY` (run `openssl rand -base64 32` and store offline), `DATABASE_URL`, MinIO secrets, SUPERADMIN_*. Mode 600 root:root.
9. `docker compose up -d` (first time builds)
10. `docker compose exec app pnpm db:migrate && pnpm db:bootstrap && pnpm db:seed-inventory && pnpm minio:bootstrap`
11. Visit https://aa-rentacar.com — should serve via Caddy with valid cert

## Task 2: Caddyfile
```caddyfile
{
  email manager@aa-rentacar.com
}

aa-rentacar.com, www.aa-rentacar.com {
  encode gzip zstd
  reverse_proxy app:3000
}
manager.aa-rentacar.com {
  encode gzip zstd
  reverse_proxy app:3000
}
driver.aa-rentacar.com {
  encode gzip zstd
  reverse_proxy app:3000
}
admin.aa-rentacar.com {
  encode gzip zstd
  reverse_proxy app:3000
  @allowedIps remote_ip <YOUR_OFFICE_IP> <DEV_IP>
  handle @allowedIps { reverse_proxy app:3000 }
  handle { respond 403 }
}
```
admin subdomain IP-allowlisted per spec §7.4.

## Task 3: Production docker-compose.yml
Reverse-proxy in front of everything. Volumes pinned to host paths in `/srv/aa/{postgres,minio,backups}` for backup ease. `restart: always`. Healthchecks on every service. Workers: 1 replica of `worker` service (the pg-boss runner from Plan #11).

## Task 4: Backups
`scripts/backup.sh`:
```bash
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U aa -d aa_db --format=custom > /tmp/${DATE}.dump
age -r $(cat /opt/aarentacar/.age-recipient) /tmp/${DATE}.dump > /tmp/${DATE}.dump.age
docker compose exec minio mc cp /tmp/${DATE}.dump.age minio/backups/postgres/
rm /tmp/${DATE}.dump /tmp/${DATE}.dump.age
# Retention: delete >30 days old
docker compose exec minio mc rm --recursive --force --older-than 30d minio/backups/postgres/
```
- age recipient (public key) committed to repo; private key kept offline on user's machine
- cron via system cron at 02:00

## Task 5: Restore drill script
`scripts/restore-drill.sh` — provisions a temporary scratch container, downloads latest backup, decrypts, restores, runs `pnpm test` against it as a smoke. Document in runbook for quarterly execution.

## Task 6: GlitchTip (or Sentry) observability
- Add `glitchtip` service to docker-compose (uses its own postgres + redis OR shares ours if config supports)
- Install `@sentry/nextjs` (Sentry SDK is Sentry-API compatible, so it works with GlitchTip)
- Configure `sentry.client.config.ts` + `sentry.server.config.ts` with DSN from `provider_credentials` (Plan #9)
- Source maps uploaded during build via the Sentry plugin
- Error rate visible in Super-Admin System tab

## Task 7: ClamAV integration
Wire `clamav-sidecar` into upload presign flow:
- After a file uploads to MinIO (via the customer document or vehicle photo path), trigger a pg-boss `scan-uploaded-file` job
- Worker downloads file from MinIO via signed GET, streams to clamav daemon over TCP, on infected → mark document `rejected` with review_note = 'malware_detected'
- This runs OUT of the upload critical path — accept-then-scan model

## Task 8: GitHub Actions deploy workflow (optional)
`.github/workflows/deploy.yml`:
- Trigger on push to `main`
- SSH to VPS via configured secret
- Run `/opt/aarentacar/scripts/deploy.sh`
- Slack/email notify on failure
Marked as deferred — initial deploys are manual per user preference. Add when stable.

## Task 9: First-go-live checklist (docs)
`docs/go-live-checklist.md`:
- [ ] All 13 plans implemented + CI green
- [ ] Hetzner VPS provisioned, hardened, encrypted
- [ ] Cloudflare DNS records configured (apex + 3 subdomains + mail + SPF/DKIM/DMARC)
- [ ] PTR / reverse DNS set
- [ ] First production deploy succeeded; `/api/health` returns OK on all subdomains
- [ ] Super-admin TOTP enabled
- [ ] Provider credentials filled in for Stripe (live keys), Tabby (live keys), Mapbox, SMTP
- [ ] Test email delivers to a Gmail address with all auth headers passing
- [ ] Test booking end-to-end with a small AED 1 amount using a real card (immediately refund)
- [ ] Restore drill from latest backup completes successfully
- [ ] Backup cron job scheduled and verified for two consecutive nights

## Acceptance
- Live site at https://aa-rentacar.com serves the landing in <2s on Dubai 4G
- All 4 subdomains serve via Caddy with valid Let's Encrypt certs
- Errors automatically appear in GlitchTip with stack traces + source maps
- ClamAV scans every uploaded file within 60s
- Daily backups visible in MinIO backups/ bucket, encrypted

## Not in this plan
- Multi-region failover (Phase 2 if business demands)
- CDN in front of Caddy (Cloudflare proxy could be turned on, but Mapbox + Stripe Elements need careful CSP — defer)
- IaC / Terraform (manual provisioning per spec)
