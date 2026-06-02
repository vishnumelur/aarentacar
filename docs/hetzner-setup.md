# Hetzner VPS Provisioning Runbook (Plan #13, Task 1)

First-time setup of the production host for AA Rent A Car. Everything here is
**verify-on-deploy** — it requires the live Hetzner VPS, a real public IP with
reverse DNS, and DNS records (see `docs/dns.md`). None of it runs in CI.

> **Compose-file naming.** The canonical production stack is
> **`docker-compose.yml`** (Plan #13 merged Plan #12's mail block into it).
> `docker-compose.prod.yml` is now a thin `include:` alias that resolves to the
> same stack, so both `docker compose up -d` and
> `docker compose -f docker-compose.prod.yml up -d` work. `docker-compose.dev.yml`
> is dev-only (postgres + minio + worker) and is unaffected.

---

## 1. Order the server
- Hetzner Cloud **CX31 / CPX31** or larger — ≥ 4 GB RAM, 2 vCPU, 80 GB SSD.
  (GlitchTip + ClamAV + Postgres + MinIO + the app comfortably need ≥ 4 GB.)

## 2. Full-disk encryption
- Enable Hetzner's encrypted volume / LUKS at provisioning so data at rest is
  encrypted (spec §13). Record the passphrase in your password manager.

## 3. Hostname
```bash
sudo hostnamectl set-hostname aa-rentacar
```

## 4. Reverse DNS (PTR)
- In the Hetzner console set the PTR for the IPv4 (and IPv6) to
  `aa-rentacar.com`, and additionally `mail.aa-rentacar.com` for the Plan #12
  mail stack. PTR mismatches hurt deliverability.

## 5. SSH hardening + firewall
```bash
# key-only auth
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# brute-force protection
sudo apt-get update && sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban

# firewall — only SSH + HTTP(S) + SMTP
sudo apt-get install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 25/tcp     # outbound/inbound SMTP for the mail stack (Plan #12)
sudo ufw --force enable
```

## 6. Install Docker + Compose v2
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out / back in for group to take effect
docker compose version            # confirm v2
```

## 7. Clone the repo
```bash
sudo mkdir -p /opt/aarentacar && sudo chown "$USER" /opt/aarentacar
cd /opt/aarentacar
git clone git@github.com:vishnumelur/aarentacar.git .
```

## 8. Create `.env.production`
```bash
cd /opt/aarentacar
cp .env.example .env.production   # then edit
chmod 600 .env.production
sudo chown root:root .env.production
```
Fill in (generate secrets with `openssl rand -base64 32`, store offline):

| var | notes |
|-----|-------|
| `ENCRYPTION_KEY` | 32-byte base64 — Plan #9 credential encryption. Keep offline. |
| `DATABASE_URL` | `postgres://aa:<POSTGRES_PASSWORD>@postgres:5432/aa_db` |
| `POSTGRES_PASSWORD` | strong random |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO admin creds |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | app access (can equal root) |
| `SESSION_COOKIE_DOMAIN` | `.aa-rentacar.com` |
| `APP_BASE_URL` | `https://aa-rentacar.com` |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | first super-admin (rotate on first login) |
| `GLITCHTIP_DB_PASSWORD` | GlitchTip's own Postgres password |
| `GLITCHTIP_SECRET_KEY` | GlitchTip Django secret |
| `SENTRY_DSN` (optional) | env fallback; preferred path is the Super-Admin credential UI |

Provider live keys (Stripe / Tabby / Mapbox / SMTP) are pasted into
**Super-Admin → Provider Credentials** post-boot, not into env.

## 9. Prepare host volumes + DKIM key
```bash
sudo mkdir -p /srv/aa/{postgres,minio,backups}
# DKIM key for the mail stack (Plan #12):
./scripts/dkim-keygen.sh            # writes docker/opendkim/keys (gitignored)
# age backup keypair — generate on your LAPTOP, not here:
#   age-keygen -o ~/.age/aa-backup.key
# then paste the printed public key into .age-recipient and commit it.
```

## 10. First boot (builds images)
```bash
cd /opt/aarentacar
export GIT_SHA="$(git rev-parse --short HEAD)"
docker compose up -d            # canonical production stack
```

## 11. Migrate + bootstrap + seed + storage
```bash
docker compose run --rm app pnpm db:migrate
docker compose run --rm app pnpm db:bootstrap
docker compose run --rm app pnpm db:seed-inventory
docker compose run --rm app pnpm db:seed-addons
docker compose run --rm app pnpm minio:bootstrap
```

## 12. Verify
- Visit `https://aa-rentacar.com` — Caddy serves the landing with a valid
  Let's Encrypt cert.
- `curl -H 'Host: aa-rentacar.com' http://localhost/api/health` → `{"status":"ok"}`.
- Confirm `admin.aa-rentacar.com` returns 403 from a non-allowlisted IP and 200
  from your office IP (edit `docker/caddy/Caddyfile`, then
  `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`).

---

## Day-2 operations

### Deploy a new release
```bash
cd /opt/aarentacar && ./scripts/deploy.sh
```
(pull → build → migrate → restart → `/api/health` gate.)

### Nightly backups (Plan #13, Task 4)
`scripts/backup.sh` runs `pg_dump`, age-encrypts with the **public** recipient
in `.age-recipient`, uploads to `minio/backups/postgres/`, and prunes > 30 days.
Schedule via cron:
```bash
crontab -e
# m h  dom mon dow  command
0 2 * * * cd /opt/aarentacar && MINIO_ROOT_USER=… MINIO_ROOT_PASSWORD=… ./scripts/backup.sh >> /var/log/aa-backup.log 2>&1
```
Verify it ran for **two consecutive nights** before go-live.

### Quarterly restore drill (Plan #13, Task 5)
Run on your **laptop** (where the age private key lives):
```bash
AGE_IDENTITY=~/.age/aa-backup.key ./scripts/restore-drill.sh
```
It pulls the latest dump, decrypts, restores into a throwaway Postgres
container, smoke-checks the table count, and tears down. Must print `PASS`.

### Observability (GlitchTip)
- GlitchTip runs in-stack (`glitchtip` + `glitchtip-postgres` + `glitchtip-redis`).
- Create a project in the GlitchTip UI, copy its DSN, and paste it into
  **Super-Admin → Provider Credentials → GlitchTip → DSN**. The app picks it up
  within 30 s (credential cache TTL) — no redeploy. App errors then appear with
  stack traces; enable source-map upload by building with
  `SENTRY_UPLOAD_SOURCE_MAPS=1 SENTRY_AUTH_TOKEN=… SENTRY_URL=https://glitchtip…`.

### Virus scanning (ClamAV)
The `clamav` container scans every uploaded customer document out-of-band via the
pg-boss `scan-uploaded-file` job (accept-then-scan). Infected documents are
flipped to `rejected` with `review_note='malware_detected'`. First boot, ClamAV
downloads its signature DB (~few minutes) before its healthcheck passes.
