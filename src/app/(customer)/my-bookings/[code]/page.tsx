import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  bookingEvents,
  vehicles,
  vehicleTypes,
  vehicleCategories,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function CustomerBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'customer') redirect('/');

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  if (!booking) notFound();
  if (booking.customerId !== user.id) notFound();

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, booking.vehicleId)).limit(1);
  const [type] = vehicle
    ? await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicle.typeId)).limit(1)
    : [];
  const [cat] = type
    ? await db.select().from(vehicleCategories).where(eq(vehicleCategories.id, type.categoryId)).limit(1)
    : [];

  const events = await db
    .select()
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, booking.id))
    .orderBy(asc(bookingEvents.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <Link href="/my-bookings" className="text-sm text-primary underline">
        ← All bookings
      </Link>

      <div>
        <div className="font-mono text-sm text-muted-foreground">{booking.code}</div>
        <h1 className="mt-1 text-2xl font-semibold">
          {vehicle?.make} {vehicle?.model}
        </h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {cat?.nameEn} · {type?.nameEn} · {vehicle?.year}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-2 text-sm">
        <Row label="Status" value={booking.status.replace(/_/g, ' ')} />
        <Row label="Rental type" value={booking.rentalKind === 'self_drive' ? 'Self-drive' : 'With chauffeur'} />
        <Row label="Pickup" value={new Date(booking.pickupAt).toLocaleString()} />
        <Row label="Return" value={new Date(booking.returnAt).toLocaleString()} />
        <Row label="Pickup address" value={booking.pickupAddress} />
        <Row label="Subtotal" value={`AED ${booking.subtotalAed.toLocaleString()}`} />
        {booking.addonsAed > 0 && (
          <Row label="Add-ons" value={`+ AED ${booking.addonsAed.toLocaleString()}`} />
        )}
        <Row label="Refundable deposit" value={`AED ${booking.depositAed.toLocaleString()}`} />
        <div className="border-t pt-2">
          <Row label="Total" value={`AED ${booking.totalAed.toLocaleString()}`} bold />
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Activity</h2>
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium capitalize">{e.kind.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-lg font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
