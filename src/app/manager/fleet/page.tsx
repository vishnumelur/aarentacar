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
  const categories = await db
    .select()
    .from(vehicleCategories)
    .orderBy(asc(vehicleCategories.sortOrder));
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));

  const where: SQL[] = [isNull(vehicles.deletedAt)];
  if (sp.q) {
    const term = `%${sp.q}%`;
    const cond = or(
      ilike(vehicles.make, term),
      ilike(vehicles.model, term),
      ilike(vehicles.plate, term),
    );
    if (cond) where.push(cond);
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
