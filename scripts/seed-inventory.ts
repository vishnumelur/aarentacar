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
  const branchSeed = [
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
    if (!created) throw new Error('category insert failed');
    console.warn(`Seeded category: ${c.slug}`);
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
    if (!created) throw new Error('type insert failed');
    console.warn(`Seeded type: ${t.slug}`);
    return created;
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
