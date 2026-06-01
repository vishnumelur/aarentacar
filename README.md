# AA Rent A Car

Dubai-based car & limousine rental platform, self-hosted on a Hetzner VPS.
Four role-scoped portals (customer, driver, manager, super-admin) served
from one Next.js 15 monolith.

- **Design spec:** [`docs/superpowers/specs/2026-06-01-aa-rentacar-design.md`](docs/superpowers/specs/2026-06-01-aa-rentacar-design.md)
- **Plans index:** [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md)
- **Current plan:** Foundation (Plan #1) — see [`docs/superpowers/plans/2026-06-01-foundation.md`](docs/superpowers/plans/2026-06-01-foundation.md)

## Prerequisites

- **Node.js 22 LTS**
- **pnpm 10+** (`npm i -g pnpm@latest`)
- **Docker + Docker Compose** (for local Postgres + MinIO)

## Local development

```bash
# 1. Copy env template and generate an ENCRYPTION_KEY
cp .env.example .env.local
ENCRYPTION_KEY=$(openssl rand -base64 32)
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env.local

# 2. Bring up Postgres + MinIO
docker compose -f docker-compose.dev.yml up -d

# 3. Install deps + migrate + seed the first Super-Admin
pnpm install
pnpm db:migrate
pnpm db:bootstrap

# 4. Run the dev server
pnpm dev    # http://localhost:3000
```

In dev, hit `http://localhost:3000/?portal=manager` (or `driver` / `superadmin`)
to pretend to be on the corresponding subdomain. Real subdomains kick in
once Caddy is wired up in Plan #13.

## Tests

```bash
pnpm typecheck         # tsc --noEmit
pnpm lint              # next lint
pnpm test              # vitest unit + integration
pnpm test:coverage     # vitest with v8 coverage report
pnpm test:e2e          # playwright e2e (requires dev server)
pnpm test:e2e:ui       # playwright interactive runner
```

Integration tests truncate `users / sessions / audit_logs / settings`
between runs — never point `DATABASE_URL` at a database with real data.

## Deploy to Hetzner VPS

After Plan #13 (production deploy) ships, deploys follow:

```bash
# locally
git add . && git commit -m "..."
git push origin main

# on the VPS
ssh aa-rentacar
cd /opt/aarentacar
git pull
docker compose up -d --build
docker compose exec app pnpm db:migrate
```

`.env.production` lives in `/opt/aarentacar/.env.production` on the
server, owned `root:root`, mode `600`. Provider keys (Stripe, Tabby,
Mapbox, SMTP) are managed via the Super-Admin → Provider Credentials UI
once the platform is up (Plan #9).

## Repository layout

```
src/
  app/              # Next.js App Router
    page.tsx        # public landing
    (auth)/         # /login, /register
    dashboard/      # customer dashboard
    manager/        # manager portal (role-guarded)
    driver/         # driver portal
    admin/          # super-admin portal
    api/            # auth + health route handlers
  components/       # shared UI + shadcn primitives
  db/               # Drizzle client + schemas
  i18n/             # next-intl config (en + ar)
  lib/              # env validation, auth utilities
  middleware.ts     # subdomain + locale routing
messages/           # en.json + ar.json
scripts/            # bootstrap + ops scripts
drizzle/            # generated migration SQL
tests/              # unit, integration, e2e
docs/superpowers/   # design spec + implementation plans
```

## Tech stack

- Next.js 15 App Router · React 19 · TypeScript 5 (strict)
- Tailwind CSS 4 (CSS-based `@theme` config) · shadcn/ui
- PostgreSQL 16 · Drizzle ORM 0.45
- Custom session auth (bcrypt + Postgres sessions + httpOnly cookies — no third-party service)
- next-intl 4 (EN default, AR with full RTL)
- Mapbox GL JS (Plans #4, #8)
- Stripe + Tabby + COD + Bank Transfer (Plan #7)
- Self-hosted Postfix + OpenDKIM mail (Plan #12)
- Vitest 4 · Playwright 1.60
- Docker Compose · Caddy (Plan #13)

## License

Proprietary — AA Rentals / Auto Assist Service (Dubai, UAE).
