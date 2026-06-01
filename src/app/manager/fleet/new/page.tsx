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
