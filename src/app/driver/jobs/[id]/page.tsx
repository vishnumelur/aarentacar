import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { Phone, MessageSquare, MapPin, Navigation } from 'lucide-react';
import { db } from '@/db';
import {
  bookingAssignments,
  bookings,
  vehicles,
  users,
  vehicleTypes,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { JobActions } from '@/components/driver/job-actions';

export default async function DriverJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'driver' && me.role !== 'superadmin') redirect('/');

  const [row] = await db
    .select({
      assignmentId: bookingAssignments.id,
      assignmentStatus: bookingAssignments.status,
      driverId: bookingAssignments.driverId,
      bookingId: bookings.id,
      bookingCode: bookings.code,
      bookingStatus: bookings.status,
      pickupAt: bookings.pickupAt,
      returnAt: bookings.returnAt,
      pickupAddress: bookings.pickupAddress,
      pickupLat: bookings.pickupLat,
      pickupLng: bookings.pickupLng,
      rentalKind: bookings.rentalKind,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      vehiclePlate: vehicles.plate,
      typeName: vehicleTypes.nameEn,
      customerName: users.fullName,
      customerPhone: users.phone,
    })
    .from(bookingAssignments)
    .innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId))
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .innerJoin(vehicleTypes, eq(vehicleTypes.id, vehicles.typeId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .where(eq(bookingAssignments.id, id))
    .limit(1);

  if (!row) notFound();
  if (me.role === 'driver' && row.driverId !== me.id) notFound();

  const navUrl =
    row.pickupLat !== null && row.pickupLng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${row.pickupLat},${row.pickupLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.pickupAddress)}`;

  const whatsappLink = row.customerPhone
    ? `https://wa.me/${row.customerPhone.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <main className="mx-auto max-w-md space-y-6 p-4">
      <Link href="/driver" className="text-sm text-primary underline">
        ← Today
      </Link>

      <header>
        <div className="font-mono text-xs text-muted-foreground">{row.bookingCode}</div>
        <h1 className="mt-1 text-xl font-semibold">
          {row.vehicleMake} {row.vehicleModel}
        </h1>
        <div className="text-xs text-muted-foreground">
          {row.typeName} · {row.vehiclePlate} ·{' '}
          {row.rentalKind === 'self_drive' ? 'Self-drive' : 'With chauffeur'}
        </div>
      </header>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Pickup</div>
          <div className="mt-1 font-medium">{new Date(row.pickupAt).toLocaleString()}</div>
          <div className="mt-1 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{row.pickupAddress}</span>
          </div>
        </div>

        <a
          href={navUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          <Navigation className="size-4" />
          Navigate to pickup
        </a>

        <div className="text-xs text-muted-foreground">
          Return: {new Date(row.returnAt).toLocaleString()}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
        <div className="font-medium">{row.customerName}</div>
        {row.customerPhone && (
          <div className="flex gap-3 text-sm">
            <a
              href={`tel:${row.customerPhone}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
            >
              <Phone className="size-3" /> Call
            </a>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <MessageSquare className="size-3" /> WhatsApp
              </a>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        {row.assignmentStatus === 'offered' && (
          <>
            <h2 className="text-sm font-medium text-muted-foreground">Your decision</h2>
            <JobActions assignmentId={row.assignmentId} />
          </>
        )}

        {row.assignmentStatus === 'accepted' && (
          <div className="rounded-md bg-green-100 p-3 text-sm text-green-900">
            You&apos;ve accepted this job. Handover capture lands in the next milestone (Plan #6
            Task 7).
          </div>
        )}

        {row.assignmentStatus === 'declined' && (
          <div className="rounded-md bg-muted p-3 text-sm">
            You declined this job. The manager has been notified.
          </div>
        )}

        {row.assignmentStatus === 'reassigned' && (
          <div className="rounded-md bg-muted p-3 text-sm">
            This job has been reassigned to another driver.
          </div>
        )}
      </section>
    </main>
  );
}
