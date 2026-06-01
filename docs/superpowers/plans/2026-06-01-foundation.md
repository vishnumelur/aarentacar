# AA Rent A Car — Plan #1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the AA Rent A Car platform foundation — a Next.js 15 monolith with custom session-based auth (no third-party service), PostgreSQL + Drizzle, Tailwind + shadcn/ui themed white/red/black, EN + AR i18n with full RTL, subdomain-based portal routing, Docker Compose local dev, Vitest + Playwright tests, GitHub Actions CI, and a bootstrap script that seeds the first Super-Admin. **After this plan ships:** you can `pnpm dev`, register and log in, switch between English and Arabic with RTL flip, see the four role-gated subdomain placeholder pages, and have green CI on every push.

**Architecture:** One Next.js 15 (App Router) monolith. Host-based middleware rewrites requests to one of five route groups (`(public)`, `(customer)`, `(manager)`, `(driver)`, `(superadmin)`) based on the request subdomain, then enforces role on protected groups. Custom auth: bcrypt password hashing + cryptographically random session tokens hashed-at-rest in Postgres + `httpOnly; Secure; SameSite=Lax` cookies. Drizzle ORM for TypeScript-first schemas. shadcn/ui components themed in AA brand colors.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS 4 · shadcn/ui · PostgreSQL 16 · Drizzle ORM 0.36+ · `bcryptjs` · `next-intl` · Vitest · Playwright · pnpm · Docker Compose · GitHub Actions

**Spec reference:** `docs/superpowers/specs/2026-06-01-aa-rentacar-design.md` — primarily §4 (tech stack), §5 (architecture), §6.1–6.9 (data model for users/sessions/audit_logs/settings), §7 (portals), §12 (i18n), §13 (security), §14 (deployment).

---

## File Structure

This plan creates / modifies these files. Each has one clear responsibility.

**Project root**
- `package.json` — pnpm scripts, deps
- `pnpm-lock.yaml` — generated
- `tsconfig.json` — strict TS config
- `next.config.ts` — Next.js config with i18n + experimental flags
- `tailwind.config.ts` — brand tokens
- `postcss.config.mjs` — Tailwind 4 PostCSS
- `components.json` — shadcn/ui CLI config
- `drizzle.config.ts` — Drizzle CLI config
- `vitest.config.ts` — unit test runner
- `playwright.config.ts` — e2e test runner
- `docker-compose.dev.yml` — local Postgres + MinIO
- `.env.example` — example env vars (committed; real `.env.local` is gitignored)
- `.eslintrc.json` — ESLint config
- `.prettierrc` — Prettier config
- `.github/workflows/ci.yml` — lint + typecheck + test on push/PR
- `README.md` — project intro, local dev, deploy ritual outline

**Source: app shell**
- `src/middleware.ts` — host parsing + subdomain → route group rewrite + role guard
- `src/app/layout.tsx` — root layout (HTML lang/dir, fonts, providers)
- `src/app/page.tsx` — landing redirect
- `src/app/globals.css` — Tailwind directives + theme tokens
- `src/app/not-found.tsx` — 404
- `src/app/error.tsx` — global error boundary

**Source: pages — landing + auth + customer + portal placeholders**

The landing lives at `src/app/page.tsx` (URL `/`). Auth pages share a centered-card layout via the `(auth)` route group (parens = no URL segment). Customer authenticated routes live directly under `/dashboard`. Manager / Driver / Admin portals live under real path segments (`/manager`, `/driver`, `/admin`) so the middleware can rewrite subdomain requests into them.

- `src/app/page.tsx` — landing (URL `/`)
- `src/app/(auth)/layout.tsx` — shared centered-card layout
- `src/app/(auth)/login/page.tsx` — URL `/login`
- `src/app/(auth)/register/page.tsx` — URL `/register`
- `src/app/dashboard/page.tsx` — URL `/dashboard` (customer)
- `src/app/manager/layout.tsx` — manager role guard + shell
- `src/app/manager/page.tsx` — URL `/manager` (manager portal placeholder)
- `src/app/driver/layout.tsx` — driver role guard + shell
- `src/app/driver/page.tsx` — URL `/driver` (driver portal placeholder)
- `src/app/admin/layout.tsx` — superadmin role guard + shell
- `src/app/admin/page.tsx` — URL `/admin` (super-admin placeholder)

**Source: API routes**
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/health/route.ts`

**Source: data layer**
- `src/db/index.ts` — Drizzle client
- `src/db/schema/index.ts` — barrel export
- `src/db/schema/users.ts`
- `src/db/schema/sessions.ts`
- `src/db/schema/settings.ts`
- `src/db/schema/audit-logs.ts`

**Source: auth + helpers**
- `src/lib/env.ts` — zod-validated env vars
- `src/lib/auth/password.ts` — bcrypt wrappers
- `src/lib/auth/session.ts` — session create/read/destroy
- `src/lib/auth/cookies.ts` — cookie name + options
- `src/lib/auth/get-current-user.ts` — server helper
- `src/lib/auth/roles.ts` — role types + portal mapping

**Source: components**
- `src/components/ui/*` — shadcn primitives (added via CLI)
- `src/components/language-toggle.tsx`
- `src/components/auth/login-form.tsx`
- `src/components/auth/register-form.tsx`

**Source: i18n**
- `src/i18n/request.ts` — next-intl request config
- `src/i18n/routing.ts` — locales + default
- `messages/en.json`
- `messages/ar.json`

**Scripts**
- `scripts/bootstrap.ts` — seeds first Super-Admin

**Tests**
- `tests/unit/lib/env.test.ts`
- `tests/unit/lib/auth/password.test.ts`
- `tests/unit/lib/auth/session.test.ts`
- `tests/unit/lib/auth/cookies.test.ts`
- `tests/unit/middleware.test.ts`
- `tests/integration/api/auth.test.ts`
- `tests/e2e/login.spec.ts`
- `tests/e2e/language-toggle.spec.ts`
- `tests/e2e/subdomain-routing.spec.ts`

---

## Conventions used throughout this plan

- **Package manager:** `pnpm` (8.x). All install/run commands use it.
- **Node version:** 22 LTS (latest LTS as of plan date).
- **Commit prefix convention:** `feat:`, `chore:`, `test:`, `docs:`, `refactor:`, `fix:`. Each task ends with one commit.
- **TDD pattern:** for code with behavior, every task is "Write failing test → run (fail) → implement → run (pass) → commit". For pure config tasks (Next init, Docker Compose), no failing-test stage.
- **All commands are run from the repo root** unless otherwise stated.

---

## Task 1: Initialize Next.js 15 project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `postcss.config.mjs`, `tailwind.config.ts`

- [ ] **Step 1: Verify Node + pnpm versions**

Run:
```bash
node --version    # expect v22.x
pnpm --version    # expect 8.x or newer
```

If pnpm is missing: `npm i -g pnpm@latest`.

- [ ] **Step 2: Initialize Next.js inside the existing repo root**

The repo root already exists with `.git`, `.gitignore`, and `docs/`. Initialize Next.js in place:

```bash
cd "/home/vmj/Desktop/aa rentacar"
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack --no-experimental-https
```

When prompted "would you like to customize..." answer No. When prompted about overwriting `.gitignore` or `README.md`, choose **No** (keep ours).

Expected: project files appear; `src/app/page.tsx` exists; `node_modules/` populated.

- [ ] **Step 3: Pin Node version + add engines field**

Edit `package.json` and add:
```json
{
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

- [ ] **Step 4: Tighten TypeScript strictness**

Edit `tsconfig.json` `"compilerOptions"` to ensure these are set:
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true
}
```

- [ ] **Step 5: Verify dev server boots**

Run:
```bash
pnpm dev
```

Expected: log shows `▲ Next.js 15.x` and `Local: http://localhost:3000`. Visit it; default Next welcome page renders. Stop with Ctrl+C.

- [ ] **Step 6: Verify type check passes**

Run:
```bash
pnpm tsc --noEmit
```

Expected: exits 0 with no output (clean).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js 15 + TypeScript strict + Tailwind"
```

---

## Task 2: Configure brand theme tokens in Tailwind + globals.css

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts` with brand tokens**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#0a0a0b',
          white: '#ffffff',
          red: {
            DEFAULT: '#dc2626',
            50: '#fef2f2',
            100: '#fee2e2',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
            900: '#7f1d1d',
          },
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Replace `src/app/globals.css` with shadcn theme variables**

```css
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 4%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 4%;
    --primary: 0 72% 51%;            /* AA brand red */
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 10%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 0 72% 51%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 0 72% 51%;
    --radius: 0.625rem;
  }
  .dark {
    --background: 240 10% 4%;
    --foreground: 0 0% 98%;
    --card: 240 10% 4%;
    --card-foreground: 0 0% 98%;
    --primary: 0 72% 51%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 4% 16%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 4% 16%;
    --muted-foreground: 240 5% 65%;
    --accent: 0 72% 51%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 4% 16%;
    --input: 240 4% 16%;
    --ring: 0 72% 51%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
  html[dir='rtl'] body { font-family: var(--font-arabic), system-ui, sans-serif; }
}
```

- [ ] **Step 3: Verify build still works**

```bash
pnpm dev
```

Visit http://localhost:3000 — page renders without errors. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: configure Tailwind brand theme (white/red/black) and shadcn CSS variables"
```

---

## Task 3: Install shadcn/ui and base components

**Files:**
- Create: `components.json`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/card.tsx`, `src/components/ui/form.tsx`, `src/components/ui/sonner.tsx`, `src/lib/utils.ts`

- [ ] **Step 1: Initialize shadcn/ui CLI**

Run:
```bash
pnpm dlx shadcn@latest init -y -d --base-color slate
```

When prompted, confirm `src/app/globals.css` already exists and use it.

This creates `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2: Edit `components.json` to set brand defaults**

After CLI runs, verify `components.json` contains:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3: Install the components we need now**

```bash
pnpm dlx shadcn@latest add button input label card form sonner -y
```

Expected: files created under `src/components/ui/`.

- [ ] **Step 4: Verify TS compiles**

```bash
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: install shadcn/ui CLI and base components (button, input, label, card, form, sonner)"
```

---

## Task 4: Configure ESLint + Prettier + .editorconfig

**Files:**
- Modify: `.eslintrc.json`, `package.json`
- Create: `.prettierrc`, `.prettierignore`, `.editorconfig`

- [ ] **Step 1: Replace `.eslintrc.json` content**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "eqeqeq": ["error", "always"]
  }
}
```

- [ ] **Step 2: Install Prettier + Tailwind plugin**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
node_modules
.next
out
dist
pnpm-lock.yaml
messages/*.json
```

- [ ] **Step 5: Create `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 6: Add lint + format scripts to `package.json`**

In the `"scripts"` block:
```json
{
  "lint": "next lint",
  "lint:fix": "next lint --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 7: Run format + lint**

```bash
pnpm format
pnpm lint
pnpm typecheck
```

Expected: all three commands succeed with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: configure ESLint, Prettier, EditorConfig, and lint/format scripts"
```

---

## Task 5: Set up Vitest for unit tests

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/unit/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest + helpers**

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**/page.tsx', 'src/app/**/layout.tsx', 'src/components/ui/**'],
    },
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 5: Verify it runs (no tests yet)**

```bash
pnpm test
```

Expected: "No test files found" — exits cleanly (treat as success for now).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: configure Vitest for unit + integration tests with coverage"
```

---

## Task 6: Env validation with zod (TDD)

**Files:**
- Create: `src/lib/env.ts`, `tests/unit/lib/env.test.ts`, `.env.example`

- [ ] **Step 1: Install zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/lib/env.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('parseEnv', () => {
  beforeEach(() => vi.resetModules());

  it('parses valid env', async () => {
    const { parseEnv } = await import('@/lib/env');
    const parsed = parseEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/aa',
      ENCRYPTION_KEY: 'a'.repeat(44),
      SESSION_COOKIE_DOMAIN: 'localhost',
      NODE_ENV: 'test',
    });
    expect(parsed.DATABASE_URL).toBe('postgres://u:p@localhost:5432/aa');
    expect(parsed.NODE_ENV).toBe('test');
  });

  it('throws on missing required vars', async () => {
    const { parseEnv } = await import('@/lib/env');
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws on short ENCRYPTION_KEY', async () => {
    const { parseEnv } = await import('@/lib/env');
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgres://u:p@localhost:5432/aa',
        ENCRYPTION_KEY: 'too-short',
        SESSION_COOKIE_DOMAIN: 'localhost',
        NODE_ENV: 'test',
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });
});
```

- [ ] **Step 3: Run test — expect failure**

```bash
pnpm test tests/unit/lib/env.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/env'".

- [ ] **Step 4: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(43, 'ENCRYPTION_KEY must be 32 bytes base64-encoded (44 chars)'),
  SESSION_COOKIE_DOMAIN: z.string().min(1),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(25),
  SMTP_FROM: z.string().email().default('no-reply@aa-rentacar.com'),
  STRIPE_SECRET_KEY: z.string().optional(),
  TABBY_SECRET_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minio-dev'),
  MINIO_SECRET_KEY: z.string().default('minio-dev-secret'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
pnpm test tests/unit/lib/env.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Create `.env.example`**

```bash
# --- required ---
DATABASE_URL=postgres://aa:aa@localhost:5432/aa_dev
ENCRYPTION_KEY=replace-with-44-char-base64-of-32-random-bytes
SESSION_COOKIE_DOMAIN=localhost

# --- mail (bootstrap; UI manages later via Provider Credentials) ---
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_FROM=no-reply@aa-rentacar.com

# --- payment + maps (bootstrap; can be moved to Provider Credentials UI in §11.4) ---
STRIPE_SECRET_KEY=
TABBY_SECRET_KEY=
MAPBOX_TOKEN=

# --- minio (local dev) ---
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio-dev
MINIO_SECRET_KEY=minio-dev-secret
MINIO_USE_SSL=false

# --- bootstrap superadmin (used by scripts/bootstrap.ts) ---
SUPERADMIN_EMAIL=admin@aa-rentacar.com
SUPERADMIN_PASSWORD=change-me-on-first-login
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(env): zod-validated env loader with .env.example template"
```

---

## Task 7: Docker Compose for local development

**Files:**
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Create `docker-compose.dev.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: aa
      POSTGRES_PASSWORD: aa
      POSTGRES_DB: aa_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U aa -d aa_dev']
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio-dev
      MINIO_ROOT_PASSWORD: minio-dev-secret
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - minio-data:/data
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  minio-data:
```

- [ ] **Step 2: Bring it up**

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Expected: both `postgres` and `minio` show status `running (healthy)` within 10 seconds.

- [ ] **Step 3: Verify Postgres connectivity**

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U aa -d aa_dev -c "select 'ok' as status;"
```

Expected: returns one row with `status | ok`.

- [ ] **Step 4: Verify MinIO console**

Visit http://localhost:9001 — MinIO login screen renders. Don't log in yet (we'll provision buckets later).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "chore(dev): docker compose for local Postgres + MinIO"
```

---

## Task 8: Install Drizzle ORM + create DB client

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema/index.ts`

- [ ] **Step 1: Install Drizzle + Postgres driver**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://aa:aa@localhost:5432/aa_dev',
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 3: Install dotenv (for drizzle-kit CLI)**

```bash
pnpm add -D dotenv
```

- [ ] **Step 4: Create `src/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

const queryClient = postgres(env().DATABASE_URL, {
  max: env().NODE_ENV === 'production' ? 20 : 5,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
```

- [ ] **Step 5: Create `src/db/schema/index.ts` (empty barrel for now)**

```ts
// Re-exports for Drizzle CLI + app usage. Populated by later tasks.
export {};
```

- [ ] **Step 6: Add drizzle scripts to `package.json`**

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:push": "drizzle-kit push"
}
```

- [ ] **Step 7: Verify drizzle-kit can read the config**

Ensure `.env.local` exists with `DATABASE_URL=postgres://aa:aa@localhost:5432/aa_dev` (copy from `.env.example`).

```bash
cp .env.example .env.local
# edit .env.local: fill in ENCRYPTION_KEY (run `openssl rand -base64 32` to generate one)
pnpm db:generate
```

Expected: "No schema changes, nothing to generate" (since schema is empty).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): install Drizzle ORM, create client, configure drizzle-kit"
```

---

## Task 9: Schema — users + sessions

**Files:**
- Create: `src/db/schema/users.ts`, `src/db/schema/sessions.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Create `src/db/schema/users.ts`**

```ts
import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'driver',
  'agent',
  'manager',
  'superadmin',
]);

export const languageEnum = pgEnum('language', ['en', 'ar']);

export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    role: userRoleEnum('role').notNull().default('customer'),
    preferredLanguage: languageEnum('preferred_language').notNull().default('en'),
    verificationStatus: verificationStatusEnum('verification_status').notNull().default('unverified'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2: Create `src/db/schema/sessions.ts`**

```ts
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: index('sessions_token_hash_idx').on(table.tokenHash),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

- [ ] **Step 3: Update `src/db/schema/index.ts`**

```ts
export * from './users';
export * from './sessions';
```

- [ ] **Step 4: Generate migration**

```bash
pnpm db:generate
```

Expected: a new file appears under `drizzle/` (e.g. `0000_first_migration.sql`).

- [ ] **Step 5: Verify migration SQL**

Open the generated SQL file. Verify it contains `CREATE TABLE "users"`, `CREATE TABLE "sessions"`, the enums, and the indexes.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema drizzle
git commit -m "feat(db): schemas for users and sessions with enums and indexes"
```

---

## Task 10: Schema — settings + audit_logs

**Files:**
- Create: `src/db/schema/settings.ts`, `src/db/schema/audit-logs.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Create `src/db/schema/settings.ts`**

```ts
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const settings = pgTable('settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
```

- [ ] **Step 2: Create `src/db/schema/audit-logs.ts`**

```ts
import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    payload: jsonb('payload'),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index('audit_logs_actor_idx').on(table.actorUserId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

- [ ] **Step 3: Update `src/db/schema/index.ts`**

```ts
export * from './users';
export * from './sessions';
export * from './settings';
export * from './audit-logs';
```

- [ ] **Step 4: Generate next migration**

```bash
pnpm db:generate
```

Expected: a new file `0001_*.sql` appears under `drizzle/`.

- [ ] **Step 5: Apply all migrations to local Postgres**

```bash
pnpm db:migrate
```

Expected: "migrations applied".

- [ ] **Step 6: Verify tables exist**

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U aa -d aa_dev -c "\dt"
```

Expected: lists `users`, `sessions`, `settings`, `audit_logs`, `__drizzle_migrations`.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema drizzle
git commit -m "feat(db): schemas for settings and audit_logs; apply initial migration"
```

---

## Task 11: Password utilities (TDD)

**Files:**
- Create: `src/lib/auth/password.ts`, `tests/unit/lib/auth/password.test.ts`

- [ ] **Step 1: Install bcryptjs**

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/lib/auth/password.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('hashes a password and verifies it back', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces different hashes for the same password (salt)', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Run test — expect failure**

```bash
pnpm test tests/unit/lib/auth/password.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/auth/password.ts`**

```ts
import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
pnpm test tests/unit/lib/auth/password.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/password.ts tests/unit/lib/auth/password.test.ts
git commit -m "feat(auth): password hashing utilities with bcrypt (cost 12)"
```

---

## Task 12: Cookie helpers (TDD)

**Files:**
- Create: `src/lib/auth/cookies.ts`, `tests/unit/lib/auth/cookies.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/lib/auth/cookies.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SESSION_COOKIE_NAME, buildSessionCookie } from '@/lib/auth/cookies';

describe('cookies', () => {
  it('exposes a stable cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('aa_session');
  });

  it('builds a cookie with secure defaults in production', () => {
    const cookie = buildSessionCookie({
      token: 'abc',
      expiresAt: new Date(2030, 0, 1),
      production: true,
      domain: 'aa-rentacar.com',
    });
    expect(cookie.name).toBe('aa_session');
    expect(cookie.value).toBe('abc');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.domain).toBe('aa-rentacar.com');
  });

  it('disables Secure flag in development', () => {
    const cookie = buildSessionCookie({
      token: 'abc',
      expiresAt: new Date(2030, 0, 1),
      production: false,
      domain: 'localhost',
    });
    expect(cookie.secure).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/unit/lib/auth/cookies.test.ts
```

- [ ] **Step 3: Implement `src/lib/auth/cookies.ts`**

```ts
export const SESSION_COOKIE_NAME = 'aa_session';

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain: string;
  path: string;
  expires: Date;
}

export function buildSessionCookie(opts: {
  token: string;
  expiresAt: Date;
  production: boolean;
  domain: string;
}): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: opts.token,
    httpOnly: true,
    secure: opts.production,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/',
    expires: opts.expiresAt,
  };
}

export function buildClearSessionCookie(opts: {
  production: boolean;
  domain: string;
}): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: opts.production,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/',
    expires: new Date(0),
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/lib/auth/cookies.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): session cookie helpers (name + secure builder)"
```

---

## Task 13: Session create/read/destroy (TDD against test DB)

**Files:**
- Create: `src/lib/auth/session.ts`, `tests/unit/lib/auth/session.test.ts`, `tests/helpers/db.ts`

- [ ] **Step 1: Write test helper for an isolated test DB**

Create `tests/helpers/db.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

const TEST_URL = process.env.DATABASE_URL ?? 'postgres://aa:aa@localhost:5432/aa_dev';

export const testClient = postgres(TEST_URL, { max: 1, prepare: false });
export const testDb = drizzle(testClient, { schema });

export async function clearAllTables(): Promise<void> {
  await testDb.execute(sql`TRUNCATE sessions, users, audit_logs, settings RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/lib/auth/session.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearAllTables } from '../../../helpers/db';
import { users } from '@/db/schema';
import { createSession, readSession, destroySession } from '@/lib/auth/session';

async function makeUser() {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `u${Date.now()}@test.com`,
      passwordHash: 'x',
      fullName: 'Test User',
    })
    .returning();
  return u!;
}

describe('session', () => {
  beforeEach(() => clearAllTables());

  it('creates a session and reads it back via its token', async () => {
    const user = await makeUser();
    const { token, expiresAt } = await createSession(testDb, {
      userId: user.id,
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const session = await readSession(testDb, token);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(user.id);
  });

  it('returns null for an unknown token', async () => {
    expect(await readSession(testDb, 'totally-fake')).toBeNull();
  });

  it('destroys a session by token', async () => {
    const user = await makeUser();
    const { token } = await createSession(testDb, {
      userId: user.id,
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });
    await destroySession(testDb, token);
    expect(await readSession(testDb, token)).toBeNull();
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
pnpm test tests/unit/lib/auth/session.test.ts
```

- [ ] **Step 4: Implement `src/lib/auth/session.ts`**

```ts
import { randomBytes, createHash } from 'node:crypto';
import { eq, gt, and } from 'drizzle-orm';
import { sessions, type Session } from '@/db/schema';
import type { Database } from '@/db';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ip?: string;
}

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

export async function createSession(
  db: Database,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash,
      expiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    })
    .returning({ id: sessions.id });
  return { token, expiresAt, sessionId: row!.id };
}

export async function readSession(
  db: Database,
  token: string,
): Promise<Session | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(db: Database, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function destroyAllSessionsForUser(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
```

- [ ] **Step 5: Run — expect pass**

```bash
pnpm test tests/unit/lib/auth/session.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): session create/read/destroy backed by Postgres (token hashed at rest)"
```

---

## Task 14: Role + portal mapping helper

**Files:**
- Create: `src/lib/auth/roles.ts`, `tests/unit/lib/auth/roles.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/lib/auth/roles.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { canAccessPortal } from '@/lib/auth/roles';

describe('canAccessPortal', () => {
  it('lets a customer into customer portal only', () => {
    expect(canAccessPortal('customer', 'customer')).toBe(true);
    expect(canAccessPortal('customer', 'manager')).toBe(false);
    expect(canAccessPortal('customer', 'driver')).toBe(false);
    expect(canAccessPortal('customer', 'superadmin')).toBe(false);
  });

  it('lets a manager into manager + customer portals', () => {
    expect(canAccessPortal('manager', 'manager')).toBe(true);
    expect(canAccessPortal('manager', 'customer')).toBe(true);
    expect(canAccessPortal('manager', 'driver')).toBe(false);
  });

  it('lets superadmin into all portals', () => {
    expect(canAccessPortal('superadmin', 'customer')).toBe(true);
    expect(canAccessPortal('superadmin', 'manager')).toBe(true);
    expect(canAccessPortal('superadmin', 'driver')).toBe(true);
    expect(canAccessPortal('superadmin', 'superadmin')).toBe(true);
  });

  it('lets driver only into driver portal', () => {
    expect(canAccessPortal('driver', 'driver')).toBe(true);
    expect(canAccessPortal('driver', 'manager')).toBe(false);
  });

  it('agent inherits manager portal access', () => {
    expect(canAccessPortal('agent', 'manager')).toBe(true);
    expect(canAccessPortal('agent', 'superadmin')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/unit/lib/auth/roles.test.ts
```

- [ ] **Step 3: Implement `src/lib/auth/roles.ts`**

```ts
export type Role = 'customer' | 'driver' | 'agent' | 'manager' | 'superadmin';
export type Portal = 'public' | 'customer' | 'driver' | 'manager' | 'superadmin';

/**
 * URL path segment each portal's rewritten requests land on.
 * Empty string = no rewrite (lives at root of the public subdomain).
 */
export const PORTAL_TO_SEGMENT: Record<Portal, string> = {
  public: '',
  customer: '', // customer routes (/dashboard, /my-bookings) share the public subdomain
  driver: 'driver',
  manager: 'manager',
  superadmin: 'admin', // admin.aa-rentacar.com -> /admin/*
};

const ACCESS: Record<Role, Portal[]> = {
  customer: ['public', 'customer'],
  driver: ['public', 'driver'],
  agent: ['public', 'customer', 'manager'],
  manager: ['public', 'customer', 'manager'],
  superadmin: ['public', 'customer', 'driver', 'manager', 'superadmin'],
};

export function canAccessPortal(role: Role, portal: Portal): boolean {
  return ACCESS[role].includes(portal);
}

export function portalFromHost(host: string): Portal {
  const sub = host.split('.')[0]?.toLowerCase() ?? '';
  if (sub === 'manager') return 'manager';
  if (sub === 'driver') return 'driver';
  if (sub === 'admin') return 'superadmin';
  return 'public';
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): role + portal access matrix and subdomain parser"
```

---

## Task 15: getCurrentUser server helper

**Files:**
- Create: `src/lib/auth/get-current-user.ts`

- [ ] **Step 1: Implement (no separate test — exercised by integration tests later)**

```ts
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';
import { readSession } from './session';
import { SESSION_COOKIE_NAME } from './cookies';

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await readSession(db, token);
  if (!session) return null;

  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/get-current-user.ts
git commit -m "feat(auth): getCurrentUser server helper for RSC + route handlers"
```

---

## Task 16: Auth API — register endpoint (integration test)

**Files:**
- Create: `src/app/api/auth/register/route.ts`, `tests/integration/api/auth-register.test.ts`

- [ ] **Step 1: Write failing integration test**

`tests/integration/api/auth-register.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, clearAllTables } from '../../helpers/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { POST } from '@/app/api/auth/register/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => clearAllTables());

  it('creates a user with hashed password and returns 201', async () => {
    const res = await POST(makeRequest({
      email: 'new@user.com',
      password: 'correct horse battery staple',
      fullName: 'New User',
      phone: '+971500000000',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe('new@user.com');
    expect(body.user).not.toHaveProperty('passwordHash');

    const [row] = await testDb.select().from(users).where(eq(users.email, 'new@user.com'));
    expect(row).toBeDefined();
    expect(row!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('returns 400 on invalid input', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    await POST(makeRequest({
      email: 'dup@user.com',
      password: 'password1234',
      fullName: 'A',
    }));
    const res = await POST(makeRequest({
      email: 'dup@user.com',
      password: 'password1234',
      fullName: 'B',
    }));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test tests/integration/api/auth-register.test.ts
```

- [ ] **Step 3: Implement `src/app/api/auth/register/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(128),
  fullName: z.string().min(1).max(120).trim(),
  phone: z.string().min(7).max(20).optional(),
  preferredLanguage: z.enum(['en', 'ar']).default('en'),
});

export async function POST(req: Request): Promise<NextResponse> {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.password);
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.email,
      passwordHash,
      fullName: parsed.fullName,
      phone: parsed.phone ?? null,
      preferredLanguage: parsed.preferredLanguage,
      role: 'customer',
    })
    .returning();

  const { token, expiresAt } = await createSession(db, {
    userId: user!.id,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  });

  const cookie = buildSessionCookie({
    token,
    expiresAt,
    production: env().NODE_ENV === 'production',
    domain: env().SESSION_COOKIE_DOMAIN,
  });

  const response = NextResponse.json(
    {
      user: {
        id: user!.id,
        email: user!.email,
        fullName: user!.fullName,
        role: user!.role,
        preferredLanguage: user!.preferredLanguage,
      },
    },
    { status: 201 },
  );
  response.cookies.set(cookie);
  return response;
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): POST /api/auth/register with zod validation and session cookie"
```

---

## Task 17: Auth API — login + logout endpoints

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `tests/integration/api/auth-login.test.ts`

- [ ] **Step 1: Write failing test for login**

`tests/integration/api/auth-login.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllTables, testDb } from '../../helpers/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await clearAllTables();
    await testDb.insert(users).values({
      email: 'a@b.com',
      passwordHash: await hashPassword('rightpassword'),
      fullName: 'A',
    });
  });

  it('returns 200 + sets cookie on correct credentials', async () => {
    const res = await login(req({ email: 'a@b.com', password: 'rightpassword' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/aa_session=/);
  });

  it('returns 401 on wrong password', async () => {
    const res = await login(req({ email: 'a@b.com', password: 'WRONG' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await login(req({ email: 'noone@example.com', password: 'rightpassword' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie (200)', async () => {
    const res = await logout(req({}));
    expect(res.status).toBe(200);
    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toMatch(/aa_session=/);
    expect(set).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/app/api/auth/login/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request): Promise<NextResponse> {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(db, {
    userId: user.id,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  });

  const cookie = buildSessionCookie({
    token,
    expiresAt,
    production: env().NODE_ENV === 'production',
    domain: env().SESSION_COOKIE_DOMAIN,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
    },
  });
  response.cookies.set(cookie);
  return response;
}
```

- [ ] **Step 4: Implement `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { destroySession } from '@/lib/auth/session';
import { buildClearSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await destroySession(db, token);
  }
  const cookie = buildClearSessionCookie({
    production: env().NODE_ENV === 'production',
    domain: env().SESSION_COOKIE_DOMAIN,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
```

- [ ] **Step 5: Run — expect pass**

```bash
pnpm test tests/integration/api/auth-login.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): POST /api/auth/login and /api/auth/logout endpoints"
```

---

## Task 18: Auth API — /me endpoint

**Files:**
- Create: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Implement `src/app/api/auth/me/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      verificationStatus: user.verificationStatus,
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): GET /api/auth/me returns current user or null"
```

---

## Task 19: next-intl setup with EN + AR messages

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `messages/en.json`, `messages/ar.json`
- Modify: `next.config.ts`, `src/middleware.ts` (created in next task), `src/app/layout.tsx`

- [ ] **Step 1: Install next-intl**

```bash
pnpm add next-intl
```

- [ ] **Step 2: Create `src/i18n/routing.ts`**

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Create `src/i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'en' | 'ar')) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create `messages/en.json`**

```json
{
  "Brand": {
    "name": "AA Rent A Car",
    "tagline": "Experience luxury in every drive."
  },
  "Nav": {
    "home": "Home",
    "cars": "Cars",
    "limousines": "Limousines",
    "myBookings": "My Bookings",
    "login": "Log in",
    "register": "Sign up",
    "logout": "Log out"
  },
  "Auth": {
    "loginTitle": "Welcome back",
    "loginSubtitle": "Log in to continue.",
    "email": "Email",
    "password": "Password",
    "loginCta": "Log in",
    "registerTitle": "Create an account",
    "registerCta": "Sign up",
    "fullName": "Full name",
    "phone": "Phone (optional)"
  },
  "Language": {
    "switchToArabic": "العربية",
    "switchToEnglish": "English"
  }
}
```

- [ ] **Step 5: Create `messages/ar.json`**

```json
{
  "Brand": {
    "name": "إيه إيه لتأجير السيارات",
    "tagline": "اختبر الفخامة في كل رحلة."
  },
  "Nav": {
    "home": "الرئيسية",
    "cars": "السيارات",
    "limousines": "ليموزين",
    "myBookings": "حجوزاتي",
    "login": "تسجيل الدخول",
    "register": "إنشاء حساب",
    "logout": "تسجيل الخروج"
  },
  "Auth": {
    "loginTitle": "مرحبًا بعودتك",
    "loginSubtitle": "سجّل الدخول للمتابعة.",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "loginCta": "تسجيل الدخول",
    "registerTitle": "أنشئ حسابًا",
    "registerCta": "اشتراك",
    "fullName": "الاسم الكامل",
    "phone": "الهاتف (اختياري)"
  },
  "Language": {
    "switchToArabic": "العربية",
    "switchToEnglish": "English"
  }
}
```

- [ ] **Step 6: Update `next.config.ts`**

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(i18n): next-intl with EN + AR messages and routing config"
```

---

## Task 20: Subdomain + locale middleware (TDD)

**Files:**
- Create: `src/middleware.ts`, `tests/unit/middleware.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/middleware.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolvePortalFromRequest } from '@/middleware';

function reqFor(host: string) {
  return new Request(`https://${host}/`, { headers: { host } });
}

describe('resolvePortalFromRequest', () => {
  it('returns public for the apex / www host', () => {
    expect(resolvePortalFromRequest(reqFor('aa-rentacar.com'))).toBe('public');
    expect(resolvePortalFromRequest(reqFor('www.aa-rentacar.com'))).toBe('public');
  });

  it('returns manager / driver / superadmin for the matching subdomain', () => {
    expect(resolvePortalFromRequest(reqFor('manager.aa-rentacar.com'))).toBe('manager');
    expect(resolvePortalFromRequest(reqFor('driver.aa-rentacar.com'))).toBe('driver');
    expect(resolvePortalFromRequest(reqFor('admin.aa-rentacar.com'))).toBe('superadmin');
  });

  it('returns public for localhost in dev', () => {
    expect(resolvePortalFromRequest(reqFor('localhost:3000'))).toBe('public');
  });

  it('lets dev pretend to be a portal via ?portal= query', () => {
    const r = new Request('https://localhost:3000/?portal=manager');
    expect(resolvePortalFromRequest(r)).toBe('manager');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { portalFromHost, PORTAL_TO_SEGMENT, type Portal } from '@/lib/auth/roles';

const intlMiddleware = createIntlMiddleware(routing);

export function resolvePortalFromRequest(req: Request): Portal {
  const url = new URL(req.url);
  const overrideQuery = url.searchParams.get('portal');
  if (overrideQuery && ['public', 'customer', 'driver', 'manager', 'superadmin'].includes(overrideQuery)) {
    return overrideQuery as Portal;
  }
  const host = req.headers.get('host') ?? url.host;
  return portalFromHost(host);
}

export function middleware(req: NextRequest) {
  // 1. Apply i18n first (locale routing handled by next-intl).
  const intlResponse = intlMiddleware(req);

  // 2. Portal routing: rewrite path so each subdomain renders its segment.
  const portal = resolvePortalFromRequest(req);
  const segment = PORTAL_TO_SEGMENT[portal];

  if (segment) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith(`/${segment}`)) {
      url.pathname = `/${segment}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url, intlResponse);
    }
  }
  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

Note: `customer` portal has an empty segment, so customer-area URLs like `/dashboard` and `/my-bookings` live directly on the public domain without a rewrite. Manager/driver/admin subdomains rewrite to `/manager/*`, `/driver/*`, `/admin/*` respectively.

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/middleware.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(middleware): subdomain → portal resolution + next-intl locale routing"
```

---

## Task 21: Root layout + landing page + language toggle

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/components/language-toggle.tsx`

The landing replaces the default Next.js welcome page at `src/app/page.tsx`. We do NOT create a `(public)` route group — that would conflict with `src/app/page.tsx` since both resolve to `/`. The `(auth)` route group used in Task 23 is fine because it only contains `/login` and `/register`, not `/`.

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Inter, Cairo } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-arabic' });

export const metadata: Metadata = {
  title: 'AA Rent A Car',
  description: 'Premium car and limousine rentals in Dubai.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${cairo.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `src/components/language-toggle.tsx`**

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next = locale === 'en' ? 'ar' : 'en';

  function toggle() {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.replace(pathname);
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
      {next === 'ar' ? 'العربية' : 'English'}
    </Button>
  );
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with the landing page**

```tsx
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/language-toggle';
import Link from 'next/link';

export default function LandingPage() {
  const t = useTranslations('Brand');
  const tNav = useTranslations('Nav');

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="text-xl font-bold text-primary">{t('name')}</div>
        <nav className="flex items-center gap-2">
          <Link href="/login"><Button variant="ghost">{tNav('login')}</Button></Link>
          <Link href="/register"><Button>{tNav('register')}</Button></Link>
          <LanguageToggle />
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">{t('name')}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t('tagline')}</p>
        <Card className="mt-12">
          <CardContent className="p-8 text-muted-foreground">
            Booking widget — built in Plan #4 (Browse &amp; Book).
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
pnpm dev
```

Visit:
- http://localhost:3000 → landing renders with EN
- Click language toggle → page reloads in AR with RTL layout (verify `<html dir="rtl">` in devtools)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): root layout with i18n provider + landing page + language toggle"
```

---

## Task 22: Placeholder pages for the private portals

**Files:**
- Create: `src/components/portal-shell.tsx`, `src/app/manager/layout.tsx`, `src/app/manager/page.tsx`, `src/app/driver/layout.tsx`, `src/app/driver/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/dashboard/page.tsx`

Portal placeholders live at REAL path segments (no parens) so the middleware rewrite targets a real route:
- `manager.aa-rentacar.com/*` → rewrite to `/manager/*` → `src/app/manager/*`
- `driver.aa-rentacar.com/*` → rewrite to `/driver/*` → `src/app/driver/*`
- `admin.aa-rentacar.com/*` → rewrite to `/admin/*` → `src/app/admin/*`
- Customer (`/dashboard`, future `/my-bookings`, etc.) lives directly on the public domain — no rewrite needed

- [ ] **Step 1: Create the shared portal shell**

`src/components/portal-shell.tsx`:
```tsx
import type { ReactNode } from 'react';

export function PortalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-primary px-6 py-3 text-primary-foreground">
        <div className="text-lg font-semibold">{title}</div>
      </header>
      <section className="p-6">{children}</section>
    </main>
  );
}
```

- [ ] **Step 2: Create the manager portal**

`src/app/manager/layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'manager')) redirect('/');
  return <>{children}</>;
}
```

`src/app/manager/page.tsx`:
```tsx
import { PortalShell } from '@/components/portal-shell';

export default function ManagerHome() {
  return (
    <PortalShell title="Manager Portal">
      <p className="text-muted-foreground">Built in Plans #2, #5, #10.</p>
    </PortalShell>
  );
}
```

- [ ] **Step 3: Create the driver portal**

`src/app/driver/layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'driver')) redirect('/');
  return <>{children}</>;
}
```

`src/app/driver/page.tsx`:
```tsx
import { PortalShell } from '@/components/portal-shell';

export default function DriverHome() {
  return (
    <PortalShell title="Driver Portal">
      <p className="text-muted-foreground">Built in Plan #6.</p>
    </PortalShell>
  );
}
```

- [ ] **Step 4: Create the admin (super-admin) portal**

`src/app/admin/layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'superadmin')) redirect('/');
  return <>{children}</>;
}
```

`src/app/admin/page.tsx`:
```tsx
import { PortalShell } from '@/components/portal-shell';

export default function AdminHome() {
  return (
    <PortalShell title="Super-Admin Portal">
      <p className="text-muted-foreground">Built in Plans #9, #11.</p>
    </PortalShell>
  );
}
```

- [ ] **Step 5: Create the customer dashboard**

`src/app/dashboard/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PortalShell } from '@/components/portal-shell';

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <PortalShell title={`Welcome, ${user.fullName}`}>
      <p className="text-muted-foreground">Your bookings live here — built in Plan #4.</p>
    </PortalShell>
  );
}
```

- [ ] **Step 6: Verify typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(portals): role-gated placeholder pages for manager/driver/admin + customer dashboard"
```

---

## Task 23: Login + Register page UIs

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx`

The `(auth)` route group does NOT create a URL segment (parens are stripped). So:
- `src/app/(auth)/login/page.tsx` → `/login`
- `src/app/(auth)/register/page.tsx` → `/register`

The group exists only to share the centered-card layout via `src/app/(auth)/layout.tsx`.

- [ ] **Step 0: Create the shared auth layout**

`src/app/(auth)/layout.tsx`:
```tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center p-6">{children}</main>;
}
```

- [ ] **Step 1: Create `src/components/auth/login-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_REDIRECT: Record<string, string> = {
  customer: '/dashboard',
  manager: '/manager',
  agent: '/manager',
  driver: '/driver',
  superadmin: '/admin',
};

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.status === 401 ? 'Invalid email or password.' : 'Something went wrong.');
      return;
    }
    const { user } = await res.json();
    router.push(ROLE_REDIRECT[user.role] ?? '/');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '…' : t('loginCta')}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/components/auth/register-form.tsx`**

(same shape, posts to `/api/auth/register`, fields `email + password + fullName + phone`).

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        fullName: fd.get('fullName'),
        phone: fd.get('phone') || undefined,
      }),
    });
    setLoading(false);
    if (res.status === 409) {
      setError('That email is already registered.');
      return;
    }
    if (!res.ok) {
      setError('Please check your inputs.');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t('fullName')}</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '…' : t('registerCta')}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create `src/app/(auth)/login/page.tsx`**

```tsx
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const t = useTranslations('Auth');
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('loginTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `src/app/(auth)/register/page.tsx`**

```tsx
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  const t = useTranslations('Auth');
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('registerTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Smoke test**

```bash
pnpm dev
```

- Visit http://localhost:3000/register → form renders, submit creates a user (verify with `psql -U aa -d aa_dev -c "select email, role from users;"`)
- Visit http://localhost:3000/login → log in works, redirected to /dashboard

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): login + register pages with client forms posting to auth API"
```

---

## Task 24: Health endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function GET(): Promise<NextResponse> {
  const startedAt = process.uptime();
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      uptime_seconds: Math.round(startedAt),
      build: process.env.GIT_SHA ?? 'dev',
      db: dbOk,
    },
    { status: dbOk ? 200 : 503 },
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm dev
curl -s localhost:3000/api/health | jq
```

Expected: `{"status":"ok","uptime_seconds":N,"build":"dev","db":true}`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ops): /api/health with DB ping"
```

---

## Task 25: Bootstrap script — seed Super-Admin

**Files:**
- Create: `scripts/bootstrap.ts`
- Modify: `package.json`

- [ ] **Step 1: Install tsx for running TS scripts**

```bash
pnpm add -D tsx
```

- [ ] **Step 2: Create `scripts/bootstrap.ts`**

```ts
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, settings } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;

if (!email || !password) {
  console.error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set.');
  process.exit(1);
}

async function main() {
  const existing = await db.select().from(users).where(eq(users.email, email!)).limit(1);
  if (existing.length > 0) {
    console.warn(`Super-Admin ${email} already exists — skipping.`);
  } else {
    const passwordHash = await hashPassword(password!);
    await db.insert(users).values({
      email: email!,
      passwordHash,
      fullName: 'Super Admin',
      role: 'superadmin',
      verificationStatus: 'verified',
    });
    console.warn(`Created Super-Admin: ${email}`);
  }

  const seedSettings: Array<{ key: string; value: unknown }> = [
    { key: 'languages_enabled', value: ['en', 'ar'] },
    { key: 'business_hours', value: { sat_thu: '08:00-21:30', fri_morning: '08:30-12:00', fri_evening: '17:00-21:30' } },
    { key: 'advance_book_days', value: { car: 0, limousine: 2 } },
    { key: 'default_deposit_aed', value: { car: 1000, limousine: 3000 } },
  ];
  for (const s of seedSettings) {
    const found = await db.select().from(settings).where(eq(settings.key, s.key)).limit(1);
    if (found.length === 0) {
      await db.insert(settings).values({ key: s.key, value: s.value as object });
      console.warn(`Seeded setting: ${s.key}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add script to `package.json`**

```json
{
  "db:bootstrap": "tsx scripts/bootstrap.ts"
}
```

- [ ] **Step 4: Run it**

```bash
pnpm db:bootstrap
```

Expected: logs "Created Super-Admin" and 4 seeded settings. Re-running prints "already exists".

- [ ] **Step 5: Verify**

```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U aa -d aa_dev -c "select email, role, verification_status from users;"
```

Expected: one row with role `superadmin`, status `verified`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(bootstrap): idempotent seed script for Super-Admin + default settings"
```

---

## Task 26: Playwright setup + e2e tests for login + RTL + subdomain

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/language-toggle.spec.ts`, `tests/e2e/subdomain-routing.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Create `tests/e2e/login.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('a registered user can log in and is redirected to dashboard', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@test.com`;
  await request.post('/api/auth/register', {
    data: { email, password: 'a-strong-password', fullName: 'E2E User' },
  });
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'a-strong-password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'nobody@test.com');
  await page.fill('input[name="password"]', 'whatever12345');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('alert')).toContainText(/Invalid/);
});
```

- [ ] **Step 4: Create `tests/e2e/language-toggle.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('language toggle flips dir attribute to rtl when switching to Arabic', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
```

- [ ] **Step 5: Create `tests/e2e/subdomain-routing.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('dev portal override via ?portal= reaches manager placeholder', async ({ page }) => {
  await page.goto('/?portal=manager');
  await expect(page).toHaveURL(/\/login$/); // unauthenticated → kicked to login
});
```

- [ ] **Step 6: Add Playwright scripts to `package.json`**

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [ ] **Step 7: Run all e2e**

```bash
pnpm test:e2e
```

Expected: all tests pass (Postgres + the dev server must be running; Playwright will start dev itself if needed).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: Playwright e2e for login, language toggle RTL, and subdomain override"
```

---

## Task 27: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: aa
          POSTGRES_PASSWORD: aa
          POSTGRES_DB: aa_dev
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U aa"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=10
    env:
      DATABASE_URL: postgres://aa:aa@localhost:5432/aa_dev
      ENCRYPTION_KEY: ${{ secrets.CI_ENCRYPTION_KEY || 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Q=' }}
      SESSION_COOKIE_DOMAIN: localhost
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm db:migrate
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Add `CI_ENCRYPTION_KEY` repository secret**

In GitHub → Settings → Secrets → Actions, add `CI_ENCRYPTION_KEY` with value:
```bash
openssl rand -base64 32
```
(Run that locally, paste into GitHub.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck + lint + vitest + drizzle migrate + Playwright e2e on push/PR"
```

---

## Task 28: README + deploy ritual + git remote

**Files:**
- Create: `README.md` (replaces any default)

- [ ] **Step 1: Write `README.md`**

```markdown
# AA Rent A Car

Dubai-based car & limousine rental platform. Self-hosted on a Hetzner VPS.
Four role-scoped portals (customer, driver, manager, super-admin) served from
one Next.js 15 monolith.

**Design spec:** `docs/superpowers/specs/2026-06-01-aa-rentacar-design.md`
**Plans index:** `docs/superpowers/plans/README.md`

## Prerequisites

- Node.js 22 LTS
- pnpm 8+
- Docker + Docker Compose
- A `.env.local` file (copy from `.env.example` and fill `ENCRYPTION_KEY` with `openssl rand -base64 32`)

## Local development

```bash
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up -d   # postgres + minio
pnpm install
pnpm db:migrate
pnpm db:bootstrap                                 # creates the first Super-Admin
pnpm dev                                          # http://localhost:3000
```

In dev, use the `?portal=manager|driver|superadmin` query parameter to pretend
to be on a different subdomain (real subdomains kick in once Caddy is wired up
in Plan #13).

## Tests

```bash
pnpm test            # vitest unit + integration
pnpm test:e2e        # playwright e2e
pnpm test:coverage   # vitest with coverage report
```

## Deploy to Hetzner VPS

Once Plan #13 (production deploy) is shipped, deploys are:

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

## Repository layout

```
src/
  app/             # Next.js App Router (route groups by portal)
  components/      # shared UI (incl. shadcn primitives)
  db/              # Drizzle schemas + client
  i18n/            # next-intl config
  lib/             # env, auth utilities
  middleware.ts    # subdomain + locale routing
messages/          # en.json, ar.json
scripts/           # bootstrap + ops scripts
drizzle/           # generated migration SQL
tests/             # unit, integration, e2e
docs/superpowers/  # spec + plans
```

## License

Proprietary — AA Rentals / Auto Assist Service.
```

- [ ] **Step 2: Set git remote (verify URL with user first)**

```bash
git remote add origin https://github.com/vishnumelur/aarentacar.git
git remote -v
```

Expected: shows `origin` for both fetch + push pointing at your repo.

- [ ] **Step 3: Tag the foundation milestone**

```bash
git tag -a v0.1.0-foundation -m "Foundation: scaffold, auth, DB, i18n, subdomain routing, CI"
```

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "docs: README with local dev + deploy ritual + repo layout"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push -u origin main
git push origin v0.1.0-foundation
```

Expected: GitHub repo shows the commits + tag; CI workflow runs and passes (green check).

---

## Acceptance for Plan #1

Run this final smoke battery before declaring Foundation complete:

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` all unit + integration green
- [ ] `pnpm test:e2e` all green
- [ ] `pnpm dev` then visit:
  - [ ] `/` renders the landing page in English
  - [ ] Click language toggle → renders in Arabic with `dir="rtl"`
  - [ ] `/register` creates an account, redirects to `/dashboard`
  - [ ] `/login` logs in, redirects to `/dashboard`
  - [ ] `/api/health` returns `{ "status": "ok", "db": true }`
  - [ ] `/?portal=manager` while logged out → redirected to `/login`
  - [ ] `/?portal=manager` after logging in as the seeded Super-Admin → renders Manager Portal placeholder
- [ ] `pnpm db:bootstrap` is idempotent (re-run prints "already exists" and exits 0)
- [ ] GitHub Actions CI passes on push to `main`

When all of these are checked, Foundation is shipped. Move on to **Plan #2: Inventory**.

---

## What's intentionally NOT in this plan

These belong to later plans — do not implement them here:

- Document upload + Verification Center UI → Plan #3
- Vehicle CRUD + bulk CSV + pricing → Plan #2
- Booking, payments, deposits → Plans #4, #7
- Driver PWA + live tracking → Plans #6, #8
- Provider Credentials UI in Super-Admin → Plan #9
- Email sending (we have env vars but no transactional emails yet) → Plan #12 hooks it up; in the meantime the bootstrap superadmin password is delivered out-of-band
- Real Postfix / OpenDKIM / Caddy containers → Plan #12 + #13
- Production deploy ritual is documented but not executed until Plan #13
- 2FA — Super-Admin 2FA arrives in Plan #11; Manager 2FA in Phase 2

If any of these creep in during Foundation, stop and add them to the right plan instead.
