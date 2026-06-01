# AA Rent A Car — Plan #2: Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the manager (and super-admin) to fully manage the rental fleet via the Manager Portal. **After this plan ships:** the manager can sign in, configure the two top-level categories (Car / Limousine) with their advance-book day rules, manage vehicle types within each category, add cars individually or via CSV bulk import, upload car photos to MinIO, set per-vehicle rate cards (hourly / daily / weekly / monthly / package), and update prices across selected cars — all via a real UI. The public site doesn't render any of this yet (that's Plan #4); this plan is staff-facing only.

**Architecture:** Adds to the Next.js monolith. New manager-portal routes under `src/app/manager/*` (already role-gated by Plan #1's `manager/layout.tsx`). New Drizzle schemas for `branches`, `vehicle_categories`, `vehicle_types`, `vehicles`, `vehicle_rates`. Photos go to MinIO via direct-to-S3 presigned PUT URLs (server issues the URL, client uploads directly, server records the resulting object key). CSV bulk import is a two-step flow: upload → server validates + returns a per-row report → user confirms → server inserts. A shared `<ManagerShell>` component wraps every manager page with a left sidebar nav (Dashboard / Fleet / Categories / Types / Drivers / Promos / Reports / Settings — most are stubs until later plans).

**Tech Stack additions:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (MinIO is S3-compatible) · `papaparse` (CSV parsing).

**Spec reference:** §6.3 (inventory schemas), §7.2 Manager Portal Fleet section, §11.5 storage layout (`vehicles/` bucket).

---

## File Structure

This plan creates / modifies the following files. Each has one clear responsibility.

**New: data layer**
- `src/db/schema/branches.ts`
- `src/db/schema/vehicle-categories.ts`
- `src/db/schema/vehicle-types.ts`
- `src/db/schema/vehicles.ts`
- `src/db/schema/vehicle-rates.ts`
- Modify: `src/db/schema/index.ts` (barrel exports)

**New: storage**
- `src/lib/storage/minio.ts` — S3 client configured for MinIO
- `src/lib/storage/presign.ts` — `presignVehiclePhotoUpload()`, `presignVehiclePhotoGet()`
- `scripts/minio-bootstrap.ts` — creates `vehicles/` and `documents/` buckets if missing

**New: server actions + API**
- `src/lib/actions/vehicles.ts` — server actions: createVehicle, updateVehicle, softDeleteVehicle, setVehicleRates, bulkPriceUpdate
- `src/lib/actions/categories.ts` — server actions: updateCategory, createType, updateType
- `src/lib/actions/csv-import.ts` — server actions: validateCsv, commitCsvImport
- `src/app/api/upload/presign/route.ts` — POST returns presigned PUT URL for a photo
- `src/app/api/manager/vehicles/csv-template/route.ts` — GET returns the CSV template

**New: manager portal pages**
- `src/components/manager/shell.tsx` — sidebar + topbar layout
- `src/components/manager/nav.tsx` — sidebar nav (Dashboard, Fleet, Categories, Types, Drivers, Promos, Reports, Settings)
- `src/app/manager/layout.tsx` (modify — wrap in `<ManagerShell>`)
- `src/app/manager/page.tsx` (rewrite as Dashboard skeleton with KPI placeholders)
- `src/app/manager/categories/page.tsx` — categories list with inline edit
- `src/app/manager/types/page.tsx` — vehicle types list + create/edit dialog
- `src/app/manager/fleet/page.tsx` — vehicles list with search + filter (status, category, type, branch)
- `src/app/manager/fleet/new/page.tsx` — create vehicle form
- `src/app/manager/fleet/[id]/page.tsx` — edit vehicle form + rate cards
- `src/app/manager/fleet/bulk/page.tsx` — CSV upload + dry-run + commit

**New: components**
- `src/components/manager/vehicle-form.tsx` — shared create/edit form
- `src/components/manager/rate-cards-editor.tsx` — per-vehicle rate cards
- `src/components/manager/photo-upload.tsx` — client component, presigns + uploads to MinIO
- `src/components/manager/bulk-price-dialog.tsx` — apply % or fixed delta across selection
- `src/components/manager/csv-import-uploader.tsx` — file picker + dry-run report viewer

**New: scripts**
- `scripts/seed-inventory.ts` — seeds 2 categories + 9 types + 2 branches (idempotent)

**New: tests**
- `tests/unit/lib/storage/presign.test.ts`
- `tests/unit/lib/actions/csv-import.test.ts`
- `tests/integration/api/vehicles.test.ts`
- `tests/integration/api/csv-import.test.ts`
- `tests/e2e/manager-fleet.spec.ts`

**Conventions**
- All new manager-side server actions: `'use server'` at top; protect with `getCurrentUser()` + `canAccessPortal(user.role, 'manager')`; return `{ ok: true, data }` or `{ ok: false, error: 'reason' }` (no exceptions across the action boundary).
- All zod validation lives next to the action that uses it.
- One commit per task. Every code-bearing task is TDD where applicable (test → fail → impl → pass → commit).

---

## Task 1: Add inventory schemas (branches + categories + types)

**Files:**
- Create: `src/db/schema/branches.ts`, `src/db/schema/vehicle-categories.ts`, `src/db/schema/vehicle-types.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Create `src/db/schema/branches.ts`**

```ts
import { pgTable, uuid, text, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: text('phone'),
  active: text('active').notNull().default('true'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
```

- [ ] **Step 2: Create `src/db/schema/vehicle-categories.ts`**

```ts
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const vehicleCategories = pgTable('vehicle_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  advanceBookMinDays: integer('advance_book_min_days').notNull().default(0),
  minDriverAge: integer('min_driver_age').notNull().default(21),
  defaultDepositAed: integer('default_deposit_aed').notNull().default(1000),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VehicleCategory = typeof vehicleCategories.$inferSelect;
export type NewVehicleCategory = typeof vehicleCategories.$inferInsert;
```

- [ ] **Step 3: Create `src/db/schema/vehicle-types.ts`**

```ts
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { vehicleCategories } from './vehicle-categories';

export const vehicleTypes = pgTable(
  'vehicle_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => vehicleCategories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('vehicle_types_category_idx').on(table.categoryId)],
);

export type VehicleType = typeof vehicleTypes.$inferSelect;
export type NewVehicleType = typeof vehicleTypes.$inferInsert;
```

- [ ] **Step 4: Update `src/db/schema/index.ts`**

```ts
export * from './users';
export * from './sessions';
export * from './settings';
export * from './audit-logs';
export * from './branches';
export * from './vehicle-categories';
export * from './vehicle-types';
```

- [ ] **Step 5: Generate migration**

```bash
pnpm db:generate
```

Expected: a new `drizzle/0001_*.sql` is written with the 3 new tables + indexes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): branches, vehicle_categories, vehicle_types schemas"
```

---

## Task 2: Add inventory schemas (vehicles + rates)

**Files:**
- Create: `src/db/schema/vehicles.ts`, `src/db/schema/vehicle-rates.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Create `src/db/schema/vehicles.ts`**

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { vehicleTypes } from './vehicle-types';
import { branches } from './branches';

export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'active',
  'maintenance',
  'retired',
]);

export const transmissionEnum = pgEnum('transmission', ['automatic', 'manual']);

export const fuelTypeEnum = pgEnum('fuel_type', ['petrol', 'diesel', 'hybrid', 'electric']);

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => vehicleTypes.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    plate: text('plate').notNull().unique(),
    color: text('color'),
    transmission: transmissionEnum('transmission').notNull().default('automatic'),
    seats: integer('seats').notNull().default(5),
    doors: integer('doors').notNull().default(4),
    fuelType: fuelTypeEnum('fuel_type').notNull().default('petrol'),
    features: jsonb('features').$type<string[]>().default([]).notNull(),
    status: vehicleStatusEnum('status').notNull().default('active'),
    primaryPhotoUrl: text('primary_photo_url'),
    photos: jsonb('photos').$type<string[]>().default([]).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('vehicles_type_idx').on(table.typeId),
    index('vehicles_status_idx').on(table.status),
    index('vehicles_branch_idx').on(table.branchId),
  ],
);

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
```

- [ ] **Step 2: Create `src/db/schema/vehicle-rates.ts`**

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { vehicles } from './vehicles';

export const rateKindEnum = pgEnum('rate_kind', [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'package',
]);

export const vehicleRates = pgTable(
  'vehicle_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    rateKind: rateKindEnum('rate_kind').notNull(),
    priceAed: integer('price_aed').notNull(),
    packageName: text('package_name'),
    packageHours: integer('package_hours'),
    packageDescription: text('package_description'),
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('vehicle_rates_vehicle_idx').on(table.vehicleId)],
);

export type VehicleRate = typeof vehicleRates.$inferSelect;
export type NewVehicleRate = typeof vehicleRates.$inferInsert;
```

- [ ] **Step 3: Update barrel**

Append to `src/db/schema/index.ts`:
```ts
export * from './vehicles';
export * from './vehicle-rates';
```

- [ ] **Step 4: Generate + apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: `0002_*.sql` created and applied; `\dt` lists all 9 tables.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): vehicles + vehicle_rates schemas with status/transmission/fuel/rate_kind enums"
```

---

## Task 3: Seed defaults (categories, types, branches)

**Files:**
- Create: `scripts/seed-inventory.ts`
- Modify: `package.json` (add `db:seed-inventory` script)

- [ ] **Step 1: Create `scripts/seed-inventory.ts`**

```ts
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

async function main() {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const { vehicleCategories, vehicleTypes, branches } = await import('@/db/schema');

  // Branches
  const branchSeed: Array<{ name: string; address: string; phone: string }> = [
    {
      name: 'Al Karama HQ',
      address: 'Khalifa bin Zayed Street, Al Karama, Dubai (near ADCB Metro Station)',
      phone: '+971 4 3377877',
    },
    {
      name: 'Dubai Media City',
      address: 'Dubai Media City, Dubai',
      phone: '+971 50 6943808',
    },
  ];
  for (const b of branchSeed) {
    const found = await db.select().from(branches).where(eq(branches.name, b.name)).limit(1);
    if (found.length === 0) {
      await db.insert(branches).values(b);
      console.warn(`Seeded branch: ${b.name}`);
    }
  }

  // Categories
  const carCat = await ensureCategory({
    slug: 'car',
    nameEn: 'Car',
    nameAr: 'سيارة',
    advanceBookMinDays: 0,
    defaultDepositAed: 1000,
    sortOrder: 0,
  });
  const limoCat = await ensureCategory({
    slug: 'limousine',
    nameEn: 'Limousine',
    nameAr: 'ليموزين',
    advanceBookMinDays: 2,
    defaultDepositAed: 3000,
    sortOrder: 1,
  });

  // Types
  const carTypes = [
    { slug: 'economy', nameEn: 'Economy', nameAr: 'اقتصادية', sortOrder: 0 },
    { slug: 'compact', nameEn: 'Compact', nameAr: 'مدمجة', sortOrder: 1 },
    { slug: 'medium', nameEn: 'Medium', nameAr: 'متوسطة', sortOrder: 2 },
    { slug: 'family', nameEn: 'Family', nameAr: 'عائلية', sortOrder: 3 },
    { slug: 'luxury', nameEn: 'Luxury', nameAr: 'فاخرة', sortOrder: 4 },
    { slug: 'sports', nameEn: 'Sports', nameAr: 'رياضية', sortOrder: 5 },
  ];
  const limoTypes = [
    { slug: 'limo-sedan', nameEn: 'Limo Sedan', nameAr: 'ليموزين سيدان', sortOrder: 0 },
    { slug: 'limo-suv', nameEn: 'Limo SUV', nameAr: 'ليموزين دفع رباعي', sortOrder: 1 },
    { slug: 'limo-stretch', nameEn: 'Limo Stretch', nameAr: 'ليموزين ممدد', sortOrder: 2 },
  ];

  for (const t of carTypes) await ensureType(carCat.id, t);
  for (const t of limoTypes) await ensureType(limoCat.id, t);

  process.exit(0);

  async function ensureCategory(c: {
    slug: string;
    nameEn: string;
    nameAr: string;
    advanceBookMinDays: number;
    defaultDepositAed: number;
    sortOrder: number;
  }) {
    const found = await db
      .select()
      .from(vehicleCategories)
      .where(eq(vehicleCategories.slug, c.slug))
      .limit(1);
    if (found[0]) return found[0];
    const [created] = await db.insert(vehicleCategories).values(c).returning();
    console.warn(`Seeded category: ${c.slug}`);
    if (!created) throw new Error('category insert failed');
    return created;
  }

  async function ensureType(
    categoryId: string,
    t: { slug: string; nameEn: string; nameAr: string; sortOrder: number },
  ) {
    const found = await db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.slug, t.slug))
      .limit(1);
    if (found[0]) return found[0];
    const [created] = await db.insert(vehicleTypes).values({ ...t, categoryId }).returning();
    console.warn(`Seeded type: ${t.slug}`);
    return created;
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add `db:seed-inventory` script to `package.json`**

```json
{
  "db:seed-inventory": "tsx scripts/seed-inventory.ts"
}
```

- [ ] **Step 3: Run + verify**

```bash
pnpm db:seed-inventory
docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U aa -d aa_dev -c "select slug, name_en from vehicle_categories"
```

Expected: 2 categories (`car`, `limousine`). Re-running prints nothing (idempotent).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seed): idempotent inventory seeder (2 categories, 9 types, 2 branches)"
```

---

## Task 4: MinIO bootstrap script + S3 client

**Files:**
- Create: `src/lib/storage/minio.ts`, `scripts/minio-bootstrap.ts`
- Modify: `package.json`

- [ ] **Step 1: Install AWS SDK v3**

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Create `src/lib/storage/minio.ts`**

```ts
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let _client: S3Client | null = null;

export function s3(): S3Client {
  if (_client) return _client;
  const e = env();
  _client = new S3Client({
    region: 'us-east-1', // MinIO default; not used for routing
    endpoint: `${e.MINIO_USE_SSL ? 'https' : 'http'}://${e.MINIO_ENDPOINT}:${e.MINIO_PORT}`,
    credentials: {
      accessKeyId: e.MINIO_ACCESS_KEY,
      secretAccessKey: e.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  return _client;
}

export const BUCKETS = {
  vehicles: 'vehicles',
  documents: 'documents',
  inspections: 'inspections',
  agreements: 'agreements',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
```

- [ ] **Step 3: Create `scripts/minio-bootstrap.ts`**

```ts
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

async function main() {
  const { CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const { s3, BUCKETS } = await import('@/lib/storage/minio');
  const client = s3();

  for (const name of Object.values(BUCKETS)) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: name }));
      console.warn(`Bucket exists: ${name}`);
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: name }));
      console.warn(`Created bucket: ${name}`);
    }
  }
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Add script**

```json
{
  "minio:bootstrap": "tsx scripts/minio-bootstrap.ts"
}
```

- [ ] **Step 5: Run + verify**

```bash
pnpm minio:bootstrap
# Visit http://localhost:9001 (user minio-dev / pass minio-dev-secret),
# verify 4 buckets exist
```

Expected: "Created bucket: vehicles | documents | inspections | agreements" on first run; "Bucket exists" thereafter.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(storage): MinIO S3 client + idempotent bucket bootstrap (vehicles, documents, inspections, agreements)"
```

---

## Task 5: Presigned URL service (TDD)

**Files:**
- Create: `src/lib/storage/presign.ts`, `tests/unit/lib/storage/presign.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/lib/storage/presign.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildVehiclePhotoKey,
  isAllowedPhotoContentType,
} from '@/lib/storage/presign';

describe('buildVehiclePhotoKey', () => {
  it('includes the vehicle id, date prefix, and a 12-char nonce', () => {
    const key = buildVehiclePhotoKey({ vehicleId: 'abc-123', mimeType: 'image/jpeg' });
    expect(key).toMatch(/^vehicles\/abc-123\/\d{4}\/\d{2}\/[a-z0-9]{12}\.jpg$/);
  });
  it('maps mime types to extensions', () => {
    expect(buildVehiclePhotoKey({ vehicleId: 'x', mimeType: 'image/png' })).toMatch(/\.png$/);
    expect(buildVehiclePhotoKey({ vehicleId: 'x', mimeType: 'image/webp' })).toMatch(/\.webp$/);
  });
});

describe('isAllowedPhotoContentType', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])('allows %s', (m) => {
    expect(isAllowedPhotoContentType(m)).toBe(true);
  });
  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'])(
    'rejects %s',
    (m) => {
      expect(isAllowedPhotoContentType(m)).toBe(false);
    },
  );
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm test tests/unit/lib/storage/presign.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/lib/storage/presign.ts
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { s3, BUCKETS } from './minio';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function isAllowedPhotoContentType(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function buildVehiclePhotoKey(opts: {
  vehicleId: string;
  mimeType: string;
}): string {
  const ext = MIME_TO_EXT[opts.mimeType] ?? 'bin';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const nonce = randomBytes(6).toString('hex').slice(0, 12);
  return `vehicles/${opts.vehicleId}/${yyyy}/${mm}/${nonce}.${ext}`;
}

export async function presignVehiclePhotoUpload(opts: {
  vehicleId: string;
  mimeType: string;
}): Promise<{ url: string; key: string; expiresInSec: number }> {
  if (!isAllowedPhotoContentType(opts.mimeType)) {
    throw new Error(`Unsupported content type: ${opts.mimeType}`);
  }
  const key = buildVehiclePhotoKey(opts);
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKETS.vehicles,
      Key: key,
      ContentType: opts.mimeType,
    }),
    { expiresIn: 600 },
  );
  return { url, key, expiresInSec: 600 };
}

export async function presignVehiclePhotoGet(key: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: BUCKETS.vehicles, Key: key }),
    { expiresIn: 3600 },
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(storage): presigned URL helpers for vehicle photos (10-min PUT, 1-hr GET)"
```

---

## Task 6: Presign API endpoint (integration test)

**Files:**
- Create: `src/app/api/upload/presign/route.ts`, `tests/integration/api/presign.test.ts`

- [ ] **Step 1: Implement endpoint**

```ts
// src/app/api/upload/presign/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import {
  presignVehiclePhotoUpload,
  isAllowedPhotoContentType,
} from '@/lib/storage/presign';

const bodySchema = z.object({
  kind: z.literal('vehicle_photo'),
  vehicleId: z.uuid(),
  mimeType: z.string(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (!isAllowedPhotoContentType(parsed.mimeType)) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 415 });
  }

  const { url, key, expiresInSec } = await presignVehiclePhotoUpload({
    vehicleId: parsed.vehicleId,
    mimeType: parsed.mimeType,
  });
  return NextResponse.json({ url, key, expiresInSec });
}
```

- [ ] **Step 2: Write integration test**

```ts
// tests/integration/api/presign.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/upload/presign/route';
import { clearAllTables, testDb } from '../../helpers/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

async function makeUser(role: 'customer' | 'manager') {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `${role}-${Date.now()}@t.com`,
      passwordHash: await hashPassword('x'),
      fullName: 'T',
      role,
    })
    .returning();
  if (!u) throw new Error('insert failed');
  const { token } = await createSession(testDb, { userId: u.id });
  return { user: u, token };
}

function req(body: unknown, cookie?: string) {
  const h = new Headers({ 'content-type': 'application/json' });
  if (cookie) h.set('cookie', `aa_session=${cookie}`);
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload/presign', () => {
  beforeEach(() => clearAllTables());

  it('rejects unauthenticated requests with 403', async () => {
    const res = await POST(req({ kind: 'vehicle_photo', vehicleId: crypto.randomUUID(), mimeType: 'image/jpeg' }));
    expect(res.status).toBe(403);
  });

  it('rejects customer role with 403', async () => {
    const { token } = await makeUser('customer');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: crypto.randomUUID(), mimeType: 'image/jpeg' }, token),
    );
    expect(res.status).toBe(403);
  });

  it('rejects unsupported mime with 415', async () => {
    const { token } = await makeUser('manager');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: crypto.randomUUID(), mimeType: 'image/gif' }, token),
    );
    expect(res.status).toBe(415);
  });

  it('returns a presigned URL for a manager', async () => {
    const { token } = await makeUser('manager');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: crypto.randomUUID(), mimeType: 'image/jpeg' }, token),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; key: string };
    expect(body.url).toMatch(/^http:\/\//);
    expect(body.key).toMatch(/^vehicles\//);
  });
});
```

- [ ] **Step 3: Run — expect pass**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): POST /api/upload/presign for vehicle photos (manager-only, mime-gated)"
```

---

## Task 7: Manager portal shell + sidebar nav

**Files:**
- Create: `src/components/manager/nav.tsx`, `src/components/manager/shell.tsx`
- Modify: `src/app/manager/layout.tsx`, `src/app/manager/page.tsx`

- [ ] **Step 1: Create `src/components/manager/nav.tsx`**

```tsx
import Link from 'next/link';
import {
  LayoutDashboard,
  CarFront,
  Tags,
  Layers,
  UserCog,
  Tag,
  BarChart3,
  Settings,
} from 'lucide-react';

const items = [
  { href: '/manager', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/manager/fleet', label: 'Fleet', Icon: CarFront },
  { href: '/manager/types', label: 'Vehicle Types', Icon: Layers },
  { href: '/manager/categories', label: 'Categories', Icon: Tags },
  { href: '/manager/drivers', label: 'Drivers', Icon: UserCog },
  { href: '/manager/promos', label: 'Promotions', Icon: Tag },
  { href: '/manager/reports', label: 'Reports', Icon: BarChart3 },
  { href: '/manager/settings', label: 'Settings', Icon: Settings },
] as const;

export function ManagerNav() {
  return (
    <nav className="space-y-1 p-3">
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/components/manager/shell.tsx`**

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ManagerNav } from './nav';

export function ManagerShell({
  user,
  children,
}: {
  user: { fullName: string };
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-card">
        <div className="border-b px-4 py-4">
          <Link href="/manager" className="text-lg font-semibold text-primary">
            AA Manager
          </Link>
        </div>
        <ManagerNav />
      </aside>
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm text-muted-foreground">Manager Portal</div>
          <div className="text-sm">{user.fullName}</div>
        </header>
        <section className="flex-1 p-6">{children}</section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `src/app/manager/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { ManagerShell } from '@/components/manager/shell';

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'manager')) redirect('/');
  return <ManagerShell user={user}>{children}</ManagerShell>;
}
```

- [ ] **Step 4: Rewrite `src/app/manager/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const KPIS = [
  { label: 'Active rentals', value: '—' },
  { label: 'Pending approvals', value: '—' },
  { label: 'Pending KYC', value: '—' },
  { label: 'Available cars', value: '—' },
] as const;

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Live data lands here in Plan #10 (Manager Portal completion).
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
pnpm dev
# Log in as admin@aa-rentacar.com, visit /?portal=manager
# Sidebar + dashboard KPIs should render
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(manager): sidebar shell + dashboard skeleton with KPI placeholders"
```

---

## Task 8: Categories management page

**Files:**
- Create: `src/lib/actions/categories.ts`, `src/app/manager/categories/page.tsx`, `src/components/manager/category-row.tsx`

- [ ] **Step 1: Server action**

```ts
// src/lib/actions/categories.ts
'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { vehicleCategories } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

const updateSchema = z.object({
  id: z.uuid(),
  advanceBookMinDays: z.coerce.number().int().min(0).max(365),
  minDriverAge: z.coerce.number().int().min(18).max(80),
  defaultDepositAed: z.coerce.number().int().min(0).max(100000),
});

export async function updateCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_input' };
  }
  await db
    .update(vehicleCategories)
    .set({
      advanceBookMinDays: parsed.data.advanceBookMinDays,
      minDriverAge: parsed.data.minDriverAge,
      defaultDepositAed: parsed.data.defaultDepositAed,
      updatedAt: new Date(),
    })
    .where(eq(vehicleCategories.id, parsed.data.id));
  revalidatePath('/manager/categories');
  return { ok: true as const };
}
```

- [ ] **Step 2: Page**

```tsx
// src/app/manager/categories/page.tsx
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { vehicleCategories } from '@/db/schema';
import { CategoryRow } from '@/components/manager/category-row';

export default async function CategoriesPage() {
  const rows = await db
    .select()
    .from(vehicleCategories)
    .orderBy(asc(vehicleCategories.sortOrder));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Configure advance-booking days, minimum driver age, and default deposit per category.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Advance days</th>
              <th className="px-4 py-3">Min driver age</th>
              <th className="px-4 py-3">Default deposit (AED)</th>
              <th className="px-4 py-3 text-right">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CategoryRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Row component**

```tsx
// src/components/manager/category-row.tsx
'use client';

import { useState, useTransition } from 'react';
import type { VehicleCategory } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCategory } from '@/lib/actions/categories';

export function CategoryRow({ row }: { row: VehicleCategory }) {
  const [isPending, startTransition] = useTransition();
  const [advanceDays, setAdvanceDays] = useState(row.advanceBookMinDays);
  const [minAge, setMinAge] = useState(row.minDriverAge);
  const [deposit, setDeposit] = useState(row.defaultDepositAed);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCategory(fd);
      setMsg(res.ok ? 'Saved.' : `Error: ${res.error}`);
    });
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">
        {row.nameEn} <span className="text-muted-foreground">/ {row.nameAr}</span>
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="advanceBookMinDays"
          form={`f-${row.id}`}
          value={advanceDays}
          onChange={(e) => setAdvanceDays(Number(e.target.value))}
          className="w-24"
          min={0}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="minDriverAge"
          form={`f-${row.id}`}
          value={minAge}
          onChange={(e) => setMinAge(Number(e.target.value))}
          className="w-24"
          min={18}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="defaultDepositAed"
          form={`f-${row.id}`}
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
          className="w-32"
          min={0}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <form id={`f-${row.id}`} onSubmit={onSave} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? '…' : 'Save'}
          </Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </form>
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(manager): categories page (advance days / min age / default deposit per category)"
```

---

## Task 9: Vehicle types management

**Files:**
- Modify: `src/lib/actions/categories.ts` (add createType/updateType)
- Create: `src/app/manager/types/page.tsx`, `src/components/manager/type-form.tsx`

- [ ] **Step 1: Add server actions**

Append to `src/lib/actions/categories.ts`:

```ts
import { vehicleTypes } from '@/db/schema';

const createTypeSchema = z.object({
  categoryId: z.uuid(),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  nameEn: z.string().min(1).max(80),
  nameAr: z.string().min(1).max(80),
});

export async function createType(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = createTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  await db.insert(vehicleTypes).values(parsed.data);
  revalidatePath('/manager/types');
  return { ok: true as const };
}

export async function updateType(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const schema = createTypeSchema.extend({ id: z.uuid() });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  await db
    .update(vehicleTypes)
    .set({
      slug: parsed.data.slug,
      nameEn: parsed.data.nameEn,
      nameAr: parsed.data.nameAr,
    })
    .where(eq(vehicleTypes.id, parsed.data.id));
  revalidatePath('/manager/types');
  return { ok: true as const };
}
```

- [ ] **Step 2: Page**

```tsx
// src/app/manager/types/page.tsx
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { vehicleCategories, vehicleTypes } from '@/db/schema';
import { TypeForm } from '@/components/manager/type-form';

export default async function TypesPage() {
  const cats = await db
    .select()
    .from(vehicleCategories)
    .orderBy(asc(vehicleCategories.sortOrder));
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Vehicle Types</h1>
        <p className="text-sm text-muted-foreground">
          Sub-types under each category (e.g. Economy, Luxury, Stretch Limo).
        </p>
      </div>

      {cats.map((cat) => (
        <section key={cat.id} className="space-y-3">
          <h2 className="text-lg font-medium">{cat.nameEn}</h2>
          <div className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">English</th>
                  <th className="px-4 py-2">Arabic</th>
                </tr>
              </thead>
              <tbody>
                {types
                  .filter((t) => t.categoryId === cat.id)
                  .map((t) => (
                    <tr key={t.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-mono text-xs">{t.slug}</td>
                      <td className="px-4 py-2">{t.nameEn}</td>
                      <td className="px-4 py-2">{t.nameAr}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <TypeForm categoryId={cat.id} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: TypeForm component**

```tsx
// src/components/manager/type-form.tsx
'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createType } from '@/lib/actions/categories';

export function TypeForm({ categoryId }: { categoryId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createType(fd);
      if (!res.ok) setErr(res.error);
      else (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <Input
        name="slug"
        placeholder="slug (lowercase, dashes)"
        pattern="[a-z0-9-]+"
        required
        className="w-48"
      />
      <Input name="nameEn" placeholder="English name" required className="w-48" />
      <Input name="nameAr" placeholder="الاسم العربي" required className="w-48" />
      <Button type="submit" disabled={pending} size="sm">
        Add type
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(manager): vehicle types page with per-category add form"
```

---

## Task 10: Vehicles list page with search + filter

**Files:**
- Create: `src/app/manager/fleet/page.tsx`, `src/components/manager/fleet-filters.tsx`, `src/components/manager/fleet-table.tsx`

- [ ] **Step 1: Filters component**

```tsx
// src/components/manager/fleet-filters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function FleetFilters({
  categories,
  types,
}: {
  categories: Array<{ id: string; nameEn: string }>;
  types: Array<{ id: string; nameEn: string; categoryId: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(name: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/manager/fleet?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        defaultValue={sp.get('q') ?? ''}
        onChange={(e) => update('q', e.target.value)}
        placeholder="Search make / model / plate…"
        className="w-64"
      />
      <select
        defaultValue={sp.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="maintenance">Maintenance</option>
        <option value="retired">Retired</option>
      </select>
      <select
        defaultValue={sp.get('categoryId') ?? ''}
        onChange={(e) => update('categoryId', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nameEn}
          </option>
        ))}
      </select>
      <select
        defaultValue={sp.get('typeId') ?? ''}
        onChange={(e) => update('typeId', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nameEn}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={() => router.replace('/manager/fleet')}>
        Reset
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Fleet table**

```tsx
// src/components/manager/fleet-table.tsx
import Link from 'next/link';
import type { Vehicle, VehicleType } from '@/db/schema';

type Row = Vehicle & { type?: VehicleType };

export function FleetTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        No vehicles match. <Link href="/manager/fleet/new" className="text-primary underline">Add one</Link>.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3">Plate</th>
            <th className="px-4 py-3">Make / Model</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-mono">{v.plate}</td>
              <td className="px-4 py-3">
                {v.make} {v.model}
              </td>
              <td className="px-4 py-3">{v.type?.nameEn ?? '—'}</td>
              <td className="px-4 py-3">{v.year}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{v.status}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/manager/fleet/${v.id}`} className="text-primary underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/manager/fleet/page.tsx
import Link from 'next/link';
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles, vehicleTypes, vehicleCategories } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { FleetFilters } from '@/components/manager/fleet-filters';
import { FleetTable } from '@/components/manager/fleet-table';

interface SearchParams {
  q?: string;
  status?: string;
  categoryId?: string;
  typeId?: string;
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const categories = await db.select().from(vehicleCategories).orderBy(asc(vehicleCategories.sortOrder));
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));

  const where: SQL[] = [isNull(vehicles.deletedAt)];
  if (sp.q) {
    where.push(
      or(
        ilike(vehicles.make, `%${sp.q}%`),
        ilike(vehicles.model, `%${sp.q}%`),
        ilike(vehicles.plate, `%${sp.q}%`),
      )!,
    );
  }
  if (sp.status === 'active' || sp.status === 'maintenance' || sp.status === 'retired') {
    where.push(eq(vehicles.status, sp.status));
  }
  if (sp.typeId) {
    where.push(eq(vehicles.typeId, sp.typeId));
  } else if (sp.categoryId) {
    const typeIds = types.filter((t) => t.categoryId === sp.categoryId).map((t) => t.id);
    if (typeIds.length === 0) {
      where.push(sql`false`);
    } else {
      where.push(sql`${vehicles.typeId} = ANY(${typeIds})`);
    }
  }

  const rows = await db
    .select()
    .from(vehicles)
    .where(and(...where))
    .orderBy(asc(vehicles.make), asc(vehicles.model));

  const enriched = rows.map((v) => ({
    ...v,
    type: types.find((t) => t.id === v.typeId),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fleet</h1>
        <div className="flex gap-2">
          <Link href="/manager/fleet/bulk">
            <Button variant="outline">Bulk import (CSV)</Button>
          </Link>
          <Link href="/manager/fleet/new">
            <Button>Add vehicle</Button>
          </Link>
        </div>
      </div>
      <FleetFilters
        categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn }))}
        types={types.map((t) => ({ id: t.id, nameEn: t.nameEn, categoryId: t.categoryId }))}
      />
      <FleetTable rows={enriched} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(manager): fleet list page with search, status/category/type filters, link to new + bulk"
```

---

## Task 11: Vehicle create page + server action

**Files:**
- Create: `src/lib/actions/vehicles.ts`, `src/components/manager/vehicle-form.tsx`, `src/app/manager/fleet/new/page.tsx`

- [ ] **Step 1: Vehicle action**

```ts
// src/lib/actions/vehicles.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

const vehicleSchema = z.object({
  typeId: z.uuid(),
  branchId: z.string().optional().transform((v) => (v ? v : null)),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  plate: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  color: z.string().max(40).optional(),
  transmission: z.enum(['automatic', 'manual']),
  seats: z.coerce.number().int().min(1).max(60),
  doors: z.coerce.number().int().min(1).max(8),
  fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
  primaryPhotoUrl: z.string().optional().transform((v) => (v ? v : null)),
  notes: z.string().max(2000).optional(),
});

export async function createVehicle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_input' };
  }
  const existing = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.plate, parsed.data.plate), isNull(vehicles.deletedAt)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false as const, error: 'plate_taken' };
  }
  const [created] = await db
    .insert(vehicles)
    .values({
      ...parsed.data,
      branchId: parsed.data.branchId ?? null,
      color: parsed.data.color ?? null,
      primaryPhotoUrl: parsed.data.primaryPhotoUrl ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: vehicles.id });
  if (!created) return { ok: false as const, error: 'insert_failed' };
  revalidatePath('/manager/fleet');
  redirect(`/manager/fleet/${created.id}`);
}

export async function updateVehicle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const schema = vehicleSchema.extend({ id: z.uuid() });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_input' };
  }
  await db
    .update(vehicles)
    .set({
      typeId: parsed.data.typeId,
      branchId: parsed.data.branchId,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      plate: parsed.data.plate,
      color: parsed.data.color ?? null,
      transmission: parsed.data.transmission,
      seats: parsed.data.seats,
      doors: parsed.data.doors,
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      primaryPhotoUrl: parsed.data.primaryPhotoUrl ?? null,
      notes: parsed.data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, parsed.data.id));
  revalidatePath('/manager/fleet');
  revalidatePath(`/manager/fleet/${parsed.data.id}`);
  return { ok: true as const };
}

export async function softDeleteVehicle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const id = formData.get('id');
  if (typeof id !== 'string') return { ok: false as const, error: 'invalid_input' };
  await db
    .update(vehicles)
    .set({ deletedAt: new Date(), status: 'retired' })
    .where(eq(vehicles.id, id));
  revalidatePath('/manager/fleet');
  redirect('/manager/fleet');
}
```

- [ ] **Step 2: Vehicle form component**

```tsx
// src/components/manager/vehicle-form.tsx
'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Vehicle, VehicleType, Branch } from '@/db/schema';
import { createVehicle, updateVehicle } from '@/lib/actions/vehicles';

export function VehicleForm({
  vehicle,
  types,
  branches,
}: {
  vehicle?: Vehicle;
  types: VehicleType[];
  branches: Branch[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    if (vehicle) fd.set('id', vehicle.id);
    start(async () => {
      const res = vehicle ? await updateVehicle(fd) : await createVehicle(fd);
      if (res && !res.ok) setErr(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 max-w-3xl">
      <Field label="Type" name="typeId">
        <select
          name="typeId"
          required
          defaultValue={vehicle?.typeId ?? ''}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Pick a type…
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Branch" name="branchId">
        <select
          name="branchId"
          defaultValue={vehicle?.branchId ?? ''}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">— Unassigned —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Make" name="make">
        <Input name="make" defaultValue={vehicle?.make ?? ''} required />
      </Field>
      <Field label="Model" name="model">
        <Input name="model" defaultValue={vehicle?.model ?? ''} required />
      </Field>
      <Field label="Year" name="year">
        <Input
          type="number"
          name="year"
          defaultValue={vehicle?.year ?? new Date().getFullYear()}
          required
        />
      </Field>
      <Field label="Plate" name="plate">
        <Input name="plate" defaultValue={vehicle?.plate ?? ''} required />
      </Field>
      <Field label="Color" name="color">
        <Input name="color" defaultValue={vehicle?.color ?? ''} />
      </Field>
      <Field label="Transmission" name="transmission">
        <select
          name="transmission"
          defaultValue={vehicle?.transmission ?? 'automatic'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </Field>
      <Field label="Seats" name="seats">
        <Input type="number" name="seats" defaultValue={vehicle?.seats ?? 5} required />
      </Field>
      <Field label="Doors" name="doors">
        <Input type="number" name="doors" defaultValue={vehicle?.doors ?? 4} required />
      </Field>
      <Field label="Fuel type" name="fuelType">
        <select
          name="fuelType"
          defaultValue={vehicle?.fuelType ?? 'petrol'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="hybrid">Hybrid</option>
          <option value="electric">Electric</option>
        </select>
      </Field>
      <Field label="Status" name="status">
        <select
          name="status"
          defaultValue={vehicle?.status ?? 'active'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </Field>
      <Field label="Primary photo URL" name="primaryPhotoUrl" className="md:col-span-2">
        <Input name="primaryPhotoUrl" defaultValue={vehicle?.primaryPhotoUrl ?? ''} />
        <p className="mt-1 text-xs text-muted-foreground">
          Use the photo uploader on the detail page after creating.
        </p>
      </Field>
      <Field label="Notes" name="notes" className="md:col-span-2">
        <textarea
          name="notes"
          defaultValue={vehicle?.notes ?? ''}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      {err && <p className="md:col-span-2 text-sm text-destructive">{err}</p>}
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : vehicle ? 'Save changes' : 'Create vehicle'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  children,
  className,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: New page**

```tsx
// src/app/manager/fleet/new/page.tsx
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { vehicleTypes, branches } from '@/db/schema';
import { VehicleForm } from '@/components/manager/vehicle-form';

export default async function NewVehiclePage() {
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));
  const bs = await db.select().from(branches).orderBy(asc(branches.name));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add vehicle</h1>
      <VehicleForm types={types} branches={bs} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(manager): vehicle create form + createVehicle/updateVehicle/softDeleteVehicle actions"
```

---

## Task 12: Vehicle edit page

**Files:**
- Create: `src/app/manager/fleet/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/manager/fleet/[id]/page.tsx
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { vehicles, vehicleTypes, branches } from '@/db/schema';
import { VehicleForm } from '@/components/manager/vehicle-form';
import { Button } from '@/components/ui/button';
import { softDeleteVehicle } from '@/lib/actions/vehicles';

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!v) notFound();
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));
  const bs = await db.select().from(branches).orderBy(asc(branches.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {v.make} {v.model} <span className="font-mono text-base text-muted-foreground">({v.plate})</span>
        </h1>
        <form action={softDeleteVehicle}>
          <input type="hidden" name="id" value={v.id} />
          <Button type="submit" variant="destructive" size="sm">
            Retire vehicle
          </Button>
        </form>
      </div>
      <VehicleForm vehicle={v} types={types} branches={bs} />
      {/* Rate cards editor lands here in Task 14 */}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(manager): vehicle edit page with soft-delete (Retire) action"
```

---

## Task 13: Per-vehicle rate cards

**Files:**
- Modify: `src/lib/actions/vehicles.ts` (add createRate, deleteRate)
- Create: `src/components/manager/rate-cards-editor.tsx`
- Modify: `src/app/manager/fleet/[id]/page.tsx` (mount editor)

- [ ] **Step 1: Add rate actions**

Append to `src/lib/actions/vehicles.ts`:

```ts
import { vehicleRates } from '@/db/schema';

const rateSchema = z.object({
  vehicleId: z.uuid(),
  rateKind: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'package']),
  priceAed: z.coerce.number().int().min(1).max(1_000_000),
  packageName: z.string().max(120).optional(),
  packageHours: z.coerce.number().int().min(1).max(744).optional(),
  packageDescription: z.string().max(500).optional(),
});

export async function createRate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  if (parsed.data.rateKind === 'package' && !parsed.data.packageName) {
    return { ok: false as const, error: 'package_name_required' };
  }
  await db.insert(vehicleRates).values({
    vehicleId: parsed.data.vehicleId,
    rateKind: parsed.data.rateKind,
    priceAed: parsed.data.priceAed,
    packageName: parsed.data.packageName ?? null,
    packageHours: parsed.data.packageHours ?? null,
    packageDescription: parsed.data.packageDescription ?? null,
  });
  revalidatePath(`/manager/fleet/${parsed.data.vehicleId}`);
  return { ok: true as const };
}

export async function deleteRate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const id = formData.get('id');
  const vehicleId = formData.get('vehicleId');
  if (typeof id !== 'string' || typeof vehicleId !== 'string') {
    return { ok: false as const, error: 'invalid_input' };
  }
  await db.delete(vehicleRates).where(eq(vehicleRates.id, id));
  revalidatePath(`/manager/fleet/${vehicleId}`);
  return { ok: true as const };
}
```

- [ ] **Step 2: Editor component**

```tsx
// src/components/manager/rate-cards-editor.tsx
'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VehicleRate } from '@/db/schema';
import { createRate, deleteRate } from '@/lib/actions/vehicles';

export function RateCardsEditor({
  vehicleId,
  rates,
}: {
  vehicleId: string;
  rates: VehicleRate[];
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'package'>('daily');
  const [err, setErr] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    fd.set('vehicleId', vehicleId);
    start(async () => {
      const res = await createRate(fd);
      if (!res.ok) setErr(res.error);
      else (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Rate cards</h2>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Price (AED)</th>
              <th className="px-4 py-2">Package name</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No rates yet. Add one below.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 capitalize">{r.rateKind}</td>
                <td className="px-4 py-2">{r.priceAed.toLocaleString()}</td>
                <td className="px-4 py-2">{r.packageName ?? '—'}</td>
                <td className="px-4 py-2">{r.packageHours ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteRate} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="vehicleId" value={vehicleId} />
                    <Button type="submit" size="sm" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs">Kind</label>
          <select
            name="rateKind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="package">Package</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs">Price (AED)</label>
          <Input type="number" name="priceAed" required className="w-32" />
        </div>
        {kind === 'package' && (
          <>
            <div className="space-y-1">
              <label className="text-xs">Package name</label>
              <Input name="packageName" required className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Hours</label>
              <Input type="number" name="packageHours" className="w-24" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs">Description</label>
              <Input name="packageDescription" />
            </div>
          </>
        )}
        <Button type="submit" disabled={pending} size="sm">
          Add rate
        </Button>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Mount in edit page**

Update `src/app/manager/fleet/[id]/page.tsx`:

```tsx
import { vehicleRates } from '@/db/schema';
import { RateCardsEditor } from '@/components/manager/rate-cards-editor';

// inside the page, after fetching the vehicle:
const rates = await db
  .select()
  .from(vehicleRates)
  .where(eq(vehicleRates.vehicleId, v.id));

// and in JSX, after <VehicleForm>:
<RateCardsEditor vehicleId={v.id} rates={rates} />
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(manager): per-vehicle rate cards editor (hourly/daily/weekly/monthly/package)"
```

---

## Task 14: Bulk price update across selected vehicles

**Files:**
- Modify: `src/lib/actions/vehicles.ts` (add bulkPriceUpdate)
- Create: `src/components/manager/bulk-price-dialog.tsx`
- Modify: `src/components/manager/fleet-table.tsx` (add checkboxes + dialog mount)

- [ ] **Step 1: Action**

Append to `src/lib/actions/vehicles.ts`:

```ts
const bulkPriceSchema = z.object({
  vehicleIds: z.array(z.uuid()).min(1).max(500),
  rateKind: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  mode: z.enum(['percent', 'fixed']),
  delta: z.coerce.number(),
});

export async function bulkPriceUpdate(input: z.infer<typeof bulkPriceSchema>) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = bulkPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };

  const updated: string[] = [];
  await db.transaction(async (tx) => {
    for (const id of parsed.data.vehicleIds) {
      const existing = await tx
        .select()
        .from(vehicleRates)
        .where(and(eq(vehicleRates.vehicleId, id), eq(vehicleRates.rateKind, parsed.data.rateKind)));
      for (const r of existing) {
        const next =
          parsed.data.mode === 'percent'
            ? Math.max(1, Math.round(r.priceAed * (1 + parsed.data.delta / 100)))
            : Math.max(1, r.priceAed + Math.round(parsed.data.delta));
        await tx.update(vehicleRates).set({ priceAed: next }).where(eq(vehicleRates.id, r.id));
        updated.push(r.id);
      }
    }
  });
  revalidatePath('/manager/fleet');
  return { ok: true as const, updated: updated.length };
}
```

- [ ] **Step 2: Dialog + selection UI**

Wrap fleet-table content with checkboxes; show "Bulk update" button when ≥1 selected. The dialog accepts kind/mode/delta and calls `bulkPriceUpdate`. (Implementation: client component holding selected IDs in state, action via fetch to a `'use server'` wrapper or by passing a Server Action prop.)

Full component code is omitted here for brevity — follow the same shape as `<TypeForm>`: form posts via Server Action, transition tracks pending, error string on failure, refresh on success.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(manager): bulk price update across selected vehicles (% or fixed AED delta per rate kind)"
```

---

## Task 15: CSV bulk import — template + validate (TDD)

**Files:**
- Install: `papaparse`, `@types/papaparse`
- Create: `src/app/api/manager/vehicles/csv-template/route.ts`, `src/lib/actions/csv-import.ts`, `tests/unit/lib/actions/csv-import.test.ts`

- [ ] **Step 1: Install**

```bash
pnpm add papaparse
pnpm add -D @types/papaparse
```

- [ ] **Step 2: Template endpoint**

```ts
// src/app/api/manager/vehicles/csv-template/route.ts
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

const HEADER = [
  'type_slug',
  'branch_name',
  'make',
  'model',
  'year',
  'plate',
  'color',
  'transmission',
  'seats',
  'doors',
  'fuel_type',
  'status',
  'primary_photo_url',
  'notes',
];

const SAMPLE = [
  'economy,Al Karama HQ,Toyota,Yaris,2024,DXB-A-12345,White,automatic,5,4,petrol,active,,',
  'luxury,Dubai Media City,Mercedes,S-Class,2025,DXB-X-77777,Black,automatic,5,4,petrol,active,,',
  'limo-stretch,Al Karama HQ,Cadillac,Stretch,2023,DXB-L-00001,White,automatic,10,4,petrol,active,,Wedding edition',
];

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return new Response('forbidden', { status: 403 });
  }
  const body = [HEADER.join(','), ...SAMPLE].join('\n') + '\n';
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="vehicles-template.csv"',
    },
  });
}
```

- [ ] **Step 3: Validation tests (TDD)**

```ts
// tests/unit/lib/actions/csv-import.test.ts
import { describe, it, expect } from 'vitest';
import { validateCsvRows, type CsvRow } from '@/lib/actions/csv-import';

const lookups = {
  typeSlugToId: new Map([
    ['economy', 't-economy'],
    ['luxury', 't-luxury'],
  ]),
  branchNameToId: new Map([['Al Karama HQ', 'b-karama']]),
  existingPlates: new Set(['DXB-EXISTING']),
};

const valid: CsvRow = {
  type_slug: 'economy',
  branch_name: 'Al Karama HQ',
  make: 'Toyota',
  model: 'Yaris',
  year: '2024',
  plate: 'DXB-NEW',
  color: 'White',
  transmission: 'automatic',
  seats: '5',
  doors: '4',
  fuel_type: 'petrol',
  status: 'active',
  primary_photo_url: '',
  notes: '',
};

describe('validateCsvRows', () => {
  it('accepts a fully valid row', () => {
    const report = validateCsvRows([valid], lookups);
    expect(report.ok).toBe(true);
    expect(report.rows[0]!.error).toBeNull();
    expect(report.rows[0]!.parsed?.plate).toBe('DXB-NEW');
  });

  it('rejects unknown type slug', () => {
    const report = validateCsvRows([{ ...valid, type_slug: 'flying-car' }], lookups);
    expect(report.ok).toBe(false);
    expect(report.rows[0]!.error).toMatch(/type_slug/);
  });

  it('rejects duplicate plate vs DB', () => {
    const report = validateCsvRows([{ ...valid, plate: 'DXB-EXISTING' }], lookups);
    expect(report.rows[0]!.error).toMatch(/plate_taken/);
  });

  it('rejects duplicate plate within the same upload', () => {
    const report = validateCsvRows(
      [{ ...valid, plate: 'DXB-DUP' }, { ...valid, plate: 'DXB-DUP' }],
      lookups,
    );
    expect(report.rows[1]!.error).toMatch(/plate_duplicate_in_csv/);
  });

  it('allows unassigned branch (empty string)', () => {
    const report = validateCsvRows([{ ...valid, branch_name: '' }], lookups);
    expect(report.rows[0]!.error).toBeNull();
    expect(report.rows[0]!.parsed?.branchId).toBeNull();
  });
});
```

- [ ] **Step 4: Implementation**

```ts
// src/lib/actions/csv-import.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, isNull, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles, vehicleTypes, branches } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export interface CsvRow {
  type_slug: string;
  branch_name: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  transmission: string;
  seats: string;
  doors: string;
  fuel_type: string;
  status: string;
  primary_photo_url: string;
  notes: string;
}

interface Lookups {
  typeSlugToId: Map<string, string>;
  branchNameToId: Map<string, string>;
  existingPlates: Set<string>;
}

const rowSchema = z.object({
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  plate: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
  color: z.string().max(40).optional(),
  transmission: z.enum(['automatic', 'manual']),
  seats: z.coerce.number().int().min(1).max(60),
  doors: z.coerce.number().int().min(1).max(8),
  fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
  status: z.enum(['active', 'maintenance', 'retired']),
});

export interface ValidatedRow {
  index: number;
  raw: CsvRow;
  parsed: {
    typeId: string;
    branchId: string | null;
    make: string;
    model: string;
    year: number;
    plate: string;
    color: string | null;
    transmission: 'automatic' | 'manual';
    seats: number;
    doors: number;
    fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
    status: 'active' | 'maintenance' | 'retired';
    primaryPhotoUrl: string | null;
    notes: string | null;
  } | null;
  error: string | null;
}

export interface ValidationReport {
  ok: boolean;
  totalRows: number;
  errors: number;
  rows: ValidatedRow[];
}

export function validateCsvRows(rows: CsvRow[], lookups: Lookups): ValidationReport {
  const result: ValidatedRow[] = [];
  const seenPlates = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const r: ValidatedRow = { index: i, raw, parsed: null, error: null };

    const typeId = lookups.typeSlugToId.get(raw.type_slug.trim());
    if (!typeId) {
      r.error = `unknown type_slug: ${raw.type_slug}`;
      result.push(r);
      continue;
    }
    const branchId = raw.branch_name.trim()
      ? lookups.branchNameToId.get(raw.branch_name.trim())
      : null;
    if (raw.branch_name.trim() && branchId === undefined) {
      r.error = `unknown branch_name: ${raw.branch_name}`;
      result.push(r);
      continue;
    }

    const parsed = rowSchema.safeParse({
      make: raw.make,
      model: raw.model,
      year: raw.year,
      plate: raw.plate,
      color: raw.color || undefined,
      transmission: raw.transmission,
      seats: raw.seats,
      doors: raw.doors,
      fuelType: raw.fuel_type,
      status: raw.status,
    });
    if (!parsed.success) {
      r.error = parsed.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ');
      result.push(r);
      continue;
    }

    const plate = parsed.data.plate;
    if (seenPlates.has(plate)) {
      r.error = `plate_duplicate_in_csv: ${plate}`;
      result.push(r);
      continue;
    }
    if (lookups.existingPlates.has(plate)) {
      r.error = `plate_taken: ${plate}`;
      result.push(r);
      continue;
    }
    seenPlates.add(plate);

    r.parsed = {
      typeId,
      branchId: branchId ?? null,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      plate,
      color: parsed.data.color ?? null,
      transmission: parsed.data.transmission,
      seats: parsed.data.seats,
      doors: parsed.data.doors,
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      primaryPhotoUrl: raw.primary_photo_url.trim() || null,
      notes: raw.notes.trim() || null,
    };
    result.push(r);
  }
  return {
    ok: result.every((r) => r.error === null),
    totalRows: result.length,
    errors: result.filter((r) => r.error !== null).length,
    rows: result,
  };
}

export async function buildLookups(): Promise<Lookups> {
  const types = await db.select().from(vehicleTypes);
  const bs = await db.select().from(branches);
  const existing = await db
    .select({ plate: vehicles.plate })
    .from(vehicles)
    .where(isNull(vehicles.deletedAt));
  return {
    typeSlugToId: new Map(types.map((t) => [t.slug, t.id])),
    branchNameToId: new Map(bs.map((b) => [b.name, b.id])),
    existingPlates: new Set(existing.map((e) => e.plate.toUpperCase())),
  };
}

export async function commitCsvImport(rows: NonNullable<ValidatedRow['parsed']>[]) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  if (rows.length === 0) return { ok: false as const, error: 'empty' };
  await db.insert(vehicles).values(rows);
  revalidatePath('/manager/fleet');
  return { ok: true as const, inserted: rows.length };
}
```

- [ ] **Step 5: Run unit tests**

```bash
pnpm test tests/unit/lib/actions/csv-import.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(manager): CSV template download + validateCsvRows (pure, TDD'd) + commitCsvImport server action"
```

---

## Task 16: CSV bulk upload UI

**Files:**
- Create: `src/app/manager/fleet/bulk/page.tsx`, `src/components/manager/csv-import-uploader.tsx`

- [ ] **Step 1: Uploader client component**

```tsx
// src/components/manager/csv-import-uploader.tsx
'use client';

import { useState, useTransition } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import type { CsvRow, ValidatedRow, ValidationReport } from '@/lib/actions/csv-import';
import { commitCsvImport } from '@/lib/actions/csv-import';

interface Props {
  validateAction: (rows: CsvRow[]) => Promise<ValidationReport>;
}

export function CsvImportUploader({ validateAction }: Props) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        start(async () => {
          const r = await validateAction(results.data);
          setReport(r);
          setMsg(null);
        });
      },
    });
  }

  async function onCommit() {
    if (!report) return;
    const validRows = report.rows
      .filter((r) => r.error === null && r.parsed !== null)
      .map((r) => r.parsed!);
    start(async () => {
      const res = await commitCsvImport(validRows);
      setMsg(res.ok ? `Inserted ${res.inserted} vehicles.` : `Error: ${res.error}`);
      if (res.ok) setReport(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={pending} />
        <a
          href="/api/manager/vehicles/csv-template"
          className="text-sm text-primary underline"
          download
        >
          Download template
        </a>
      </div>

      {report && (
        <div className="space-y-3">
          <div className="rounded-md border bg-card p-4 text-sm">
            <div>Total rows: {report.totalRows}</div>
            <div>Errors: {report.errors}</div>
            <div>Valid: {report.totalRows - report.errors}</div>
          </div>

          <div className="rounded-md border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Plate</th>
                  <th className="px-3 py-2">Make</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.index} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2 font-mono">{r.raw.plate}</td>
                    <td className="px-3 py-2">{r.raw.make}</td>
                    <td className="px-3 py-2">{r.raw.model}</td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-destructive">{r.error}</span>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={onCommit}
            disabled={pending || report.errors === report.totalRows}
          >
            Insert {report.totalRows - report.errors} valid rows
          </Button>
        </div>
      )}

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Bulk page (server) with action wrapper**

```tsx
// src/app/manager/fleet/bulk/page.tsx
import { CsvImportUploader } from '@/components/manager/csv-import-uploader';
import { validateCsvRows, buildLookups, type CsvRow } from '@/lib/actions/csv-import';

async function validateAction(rows: CsvRow[]) {
  'use server';
  const lookups = await buildLookups();
  return validateCsvRows(rows, lookups);
}

export default function BulkUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk import vehicles</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV matching the template. Dry-run validates each row before any data is
          written; only valid rows are inserted on commit.
        </p>
      </div>
      <CsvImportUploader validateAction={validateAction} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(manager): CSV bulk upload UI with dry-run report + commit-valid-only flow"
```

---

## Task 17: Vehicle photo upload component

**Files:**
- Create: `src/components/manager/photo-upload.tsx`
- Modify: `src/app/manager/fleet/[id]/page.tsx` (mount uploader)

- [ ] **Step 1: Uploader**

```tsx
// src/components/manager/photo-upload.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function PhotoUpload({
  vehicleId,
  onUploaded,
}: {
  vehicleId: string;
  onUploaded: (key: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const presign = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'vehicle_photo',
          vehicleId,
          mimeType: file.type,
        }),
      });
      if (!presign.ok) throw new Error(`presign_failed_${presign.status}`);
      const { url, key } = (await presign.json()) as { url: string; key: string };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload_failed_${put.status}`);
      onUploaded(key);
      setMsg('Uploaded.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onPick} disabled={busy} />
      <Button type="button" variant="ghost" size="sm" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload photo'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the edit page**

In `src/app/manager/fleet/[id]/page.tsx`, mount `<PhotoUpload>` near the form. On `onUploaded(key)`, write the key back into `primaryPhotoUrl` via the existing `updateVehicle` action (passing a hidden input or calling action directly).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(manager): vehicle photo upload via presigned MinIO PUT URLs"
```

---

## Task 18: E2E — manager fleet flow

**Files:**
- Create: `tests/e2e/manager-fleet.spec.ts`

- [ ] **Step 1: Test**

```ts
// tests/e2e/manager-fleet.spec.ts
import { test, expect } from '@playwright/test';

test('manager logs in, creates a vehicle, sees it in the list', async ({ page, request }) => {
  // Use the seeded super-admin
  await page.goto('/login');
  await page.fill('input[name="email"]', 'admin@aa-rentacar.com');
  await page.fill('input[name="password"]', 'change-me-on-first-login');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/?portal=manager');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: 'Fleet' }).click();
  await expect(page).toHaveURL(/\/manager\/fleet/);

  await page.getByRole('link', { name: 'Add vehicle' }).click();
  await page.locator('select[name="typeId"]').selectOption({ index: 1 });
  await page.fill('input[name="make"]', 'Toyota');
  await page.fill('input[name="model"]', 'E2E Camry');
  await page.fill('input[name="year"]', '2024');
  await page.fill('input[name="plate"]', `DXB-E2E-${Date.now()}`);
  await page.fill('input[name="seats"]', '5');
  await page.fill('input[name="doors"]', '4');
  await page.click('button[type="submit"]');

  await page.goto('/manager/fleet');
  await expect(page.getByText('E2E Camry')).toBeVisible();
});
```

- [ ] **Step 2: Run**

```bash
pnpm test:e2e
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(e2e): manager fleet flow — login, create vehicle, see it in list"
```

---

## Acceptance for Plan #2

Run before declaring Inventory complete:

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` all unit + integration green
- [ ] `pnpm test:e2e` all green
- [ ] Logged in as `admin@aa-rentacar.com`, browse to `/?portal=manager`:
  - [ ] Sidebar shows Dashboard / Fleet / Vehicle Types / Categories / etc.
  - [ ] `/manager/categories` lists Car + Limousine; can change advance days, min age, deposit and save
  - [ ] `/manager/types` lists 6 Car sub-types and 3 Limousine sub-types; can add a new one
  - [ ] `/manager/fleet` shows filters (search, status, category, type); empty list initially
  - [ ] `/manager/fleet/new` form creates a vehicle and redirects to its detail page
  - [ ] On the detail page: edit fields + save works; "Retire vehicle" soft-deletes (removed from list)
  - [ ] Add hourly + daily + package rate cards; delete one — UI updates
  - [ ] Select 2+ vehicles on the list, "Bulk price" raises daily rates by 10%
  - [ ] `/manager/fleet/bulk`: download template, upload a CSV with 3 rows (1 valid, 1 with bad slug, 1 with duplicate plate); report shows ✓/× per row; commit inserts only the valid row
  - [ ] Photo upload on a vehicle's detail page completes and the key is set as the primary photo
- [ ] MinIO dashboard at http://localhost:9001 shows uploaded photos under the `vehicles` bucket
- [ ] GitHub Actions CI passes on push to `main`

Move on to **Plan #3: Customer KYC** when all green.

---

## What's intentionally NOT in this plan

- Public-facing vehicle browse / detail pages → Plan #4
- Customer document upload (Verification Center) → Plan #3
- Booking creation, availability → Plan #4
- Bookings + payments + dispatch → Plans #5-#8
- Driver portal → Plan #6
- Manager dashboard with real KPIs → Plan #10
- Addons admin + maintenance log → deferred (later plans or Phase 2)
- Multi-language UI for the manager portal — staff-facing, English only per spec §12

If any of these slip in during Inventory, stop and add to the right plan instead.
