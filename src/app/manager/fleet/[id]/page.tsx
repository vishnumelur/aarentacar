import { asc, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { vehicles, vehicleTypes, vehicleRates, branches } from '@/db/schema';
import { VehicleForm } from '@/components/manager/vehicle-form';
import { RateCardsEditor } from '@/components/manager/rate-cards-editor';
import { PhotoUpload } from '@/components/manager/photo-upload';
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
  const rates = await db
    .select()
    .from(vehicleRates)
    .where(eq(vehicleRates.vehicleId, v.id))
    .orderBy(desc(vehicleRates.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {v.make} {v.model}{' '}
          <span className="font-mono text-base text-muted-foreground">({v.plate})</span>
        </h1>
        <form action={softDeleteVehicle}>
          <input type="hidden" name="id" value={v.id} />
          <Button type="submit" variant="destructive" size="sm">
            Retire vehicle
          </Button>
        </form>
      </div>
      <VehicleForm vehicle={v} types={types} branches={bs} />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Photos</h2>
        {v.primaryPhotoUrl && (
          <p className="text-xs text-muted-foreground">
            Current primary photo key: <code className="rounded bg-muted px-1">{v.primaryPhotoUrl}</code>
          </p>
        )}
        <PhotoUpload vehicleId={v.id} hasPrimary={!!v.primaryPhotoUrl} />
        <p className="text-xs text-muted-foreground">
          {v.primaryPhotoUrl
            ? 'New uploads do NOT replace the existing primary photo — paste the new key into "Primary photo URL" above to swap.'
            : 'First upload will be set as the primary photo automatically.'}
        </p>
      </section>
      <RateCardsEditor vehicleId={v.id} rates={rates} />
    </div>
  );
}
