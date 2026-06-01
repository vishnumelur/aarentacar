import { asc } from 'drizzle-orm';
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
