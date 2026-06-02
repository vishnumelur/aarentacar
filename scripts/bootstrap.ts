import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load env BEFORE any module that touches `@/lib/env` (e.g. @/db). ESM
// hoists static imports above all other statements, so we use dynamic
// imports below to ensure load order.
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
    break;
  }
}

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;

if (!email || !password) {
  console.error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set.');
  process.exit(1);
}

async function main() {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const { users, settings, featureFlags } = await import('@/db/schema');
  const { hashPassword } = await import('@/lib/auth/password');
  const { FEATURE_FLAG_KEYS, FEATURE_FLAG_DESCRIPTIONS } = await import('@/lib/feature-flags');

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
    {
      key: 'business_hours',
      value: {
        sat_thu: '08:00-21:30',
        fri_morning: '08:30-12:00',
        fri_evening: '17:00-21:30',
      },
    },
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

  // Phase-1 feature flags, all disabled by default (Plan #11).
  for (const key of FEATURE_FLAG_KEYS) {
    const found = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    if (found.length === 0) {
      await db.insert(featureFlags).values({
        key,
        enabled: false,
        description: FEATURE_FLAG_DESCRIPTIONS[key],
      });
      console.warn(`Seeded feature flag: ${key}`);
    }
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
