import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  vehicles,
  vehicleTypes,
  vehicleCategories,
  vehicleRates,
  addons as addonsTable,
} from '@/db/schema';
import { BookingPanel } from '@/components/public/booking-panel';

interface SP {
  pickup?: string;
  return?: string;
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!v) notFound();
  const [type] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, v.typeId)).limit(1);
  if (!type) notFound();
  const [cat] = await db
    .select()
    .from(vehicleCategories)
    .where(eq(vehicleCategories.id, type.categoryId))
    .limit(1);
  if (!cat) notFound();

  const rates = await db
    .select()
    .from(vehicleRates)
    .where(eq(vehicleRates.vehicleId, v.id));

  const addons = await db
    .select()
    .from(addonsTable)
    .where(eq(addonsTable.active, true))
    .orderBy(asc(addonsTable.sortOrder));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/" className="text-sm text-primary underline">
        ← Back to search
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[2fr_1fr]">
        <article className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {type.nameEn} · {cat.nameEn}
            </div>
            <h1 className="mt-1 text-3xl font-bold">
              {v.make} {v.model}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {v.year} · {v.seats} seats · {v.transmission} · {v.fuelType}
            </div>
          </div>

          <div className="aspect-[16/10] rounded-lg bg-muted">
            {/* Photo from presigned URL — defer to Plan #4 polish; placeholder for now */}
            <div className="flex size-full items-center justify-center text-muted-foreground">
              {v.primaryPhotoUrl ? 'Photo coming soon' : 'No photo uploaded'}
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Rate card</h2>
            <div className="overflow-hidden rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        Pricing being finalized. Contact us.
                      </td>
                    </tr>
                  )}
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 capitalize">{r.rateKind}</td>
                      <td className="px-4 py-2">AED {r.priceAed.toLocaleString()}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.packageName
                          ? `${r.packageName}${r.packageHours ? ` · up to ${r.packageHours}h` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {v.notes && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">About this vehicle</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{v.notes}</p>
            </section>
          )}

          <section className="text-xs text-muted-foreground">
            <p>
              Refundable deposit hold: AED {cat.defaultDepositAed.toLocaleString()}. Min driver age:{' '}
              {cat.minDriverAge}.
              {cat.advanceBookMinDays > 0 &&
                ` ${cat.nameEn} bookings require ${cat.advanceBookMinDays}-day(s) notice.`}
            </p>
          </section>
        </article>

        {sp.pickup && sp.return && (
          <BookingPanel
            vehicleId={v.id}
            pickupAt={sp.pickup}
            returnAt={sp.return}
            addons={addons}
          />
        )}
      </div>
    </main>
  );
}
