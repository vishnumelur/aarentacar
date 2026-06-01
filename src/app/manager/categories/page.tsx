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
