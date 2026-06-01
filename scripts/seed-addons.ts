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

const seedAddons = [
  {
    slug: 'child-seat',
    nameEn: 'Child seat',
    nameAr: 'مقعد أطفال',
    descriptionEn: 'Front-facing child safety seat suitable for ages 1-4.',
    descriptionAr: 'مقعد أمان للأطفال (1-4 سنوات).',
    priceAed: 50,
    maxQty: 2,
    sortOrder: 0,
  },
  {
    slug: 'extra-driver',
    nameEn: 'Extra driver',
    nameAr: 'سائق إضافي',
    descriptionEn: 'Add a second authorised driver to the rental agreement.',
    descriptionAr: 'إضافة سائق إضافي معتمد.',
    priceAed: 75,
    maxQty: 2,
    sortOrder: 1,
  },
  {
    slug: 'gps',
    nameEn: 'GPS navigation unit',
    nameAr: 'جهاز ملاحة GPS',
    descriptionEn: 'Dedicated GPS device with Dubai map preloaded.',
    descriptionAr: 'جهاز GPS مع خريطة دبي.',
    priceAed: 30,
    maxQty: 1,
    sortOrder: 2,
  },
  {
    slug: 'full-cover-insurance',
    nameEn: 'Full-cover insurance upgrade',
    nameAr: 'ترقية تأمين شامل',
    descriptionEn: 'Zero-excess collision damage waiver + theft protection.',
    descriptionAr: 'إعفاء كامل من رسوم الحوادث والسرقة.',
    priceAed: 120,
    maxQty: 1,
    sortOrder: 3,
  },
  {
    slug: 'fuel-prepay',
    nameEn: 'Pre-paid fuel tank',
    nameAr: 'وقود مدفوع مسبقًا',
    descriptionEn: 'Skip the refuel stop — return the car empty.',
    descriptionAr: 'إعادة السيارة فارغة بدون رسوم إضافية.',
    priceAed: 200,
    maxQty: 1,
    sortOrder: 4,
  },
  {
    slug: 'meet-and-greet',
    nameEn: 'Airport meet-and-greet (with name sign)',
    nameAr: 'استقبال في المطار (مع لوحة بالاسم)',
    descriptionEn: 'Driver waits inside arrivals with your name on a sign.',
    descriptionAr: 'انتظار السائق في الصالة مع لوحة باسمك.',
    priceAed: 90,
    maxQty: 1,
    sortOrder: 5,
  },
];

async function main() {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const { addons } = await import('@/db/schema');

  for (const a of seedAddons) {
    const found = await db.select().from(addons).where(eq(addons.slug, a.slug)).limit(1);
    if (found.length === 0) {
      await db.insert(addons).values(a);
      console.warn(`Seeded addon: ${a.slug}`);
    }
  }
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
