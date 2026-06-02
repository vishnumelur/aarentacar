import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { db } from '@/db';
import {
  bookings,
  bookingAssignments,
  driverProfiles,
  users,
  vehicles,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { LiveMap } from '@/components/tracking/live-map';
import type { DriverInfo } from '@/components/tracking/eta-card';
import type { LatLng } from '@/lib/tracking/interpolation';

export default async function TrackBookingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  if (!booking) notFound();

  const isOwner = booking.customerId === user.id;
  const isStaff = user.role === 'manager' || user.role === 'superadmin';
  if (!isOwner && !isStaff) notFound();

  const pickup: LatLng | null =
    booking.pickupLat !== null && booking.pickupLng !== null
      ? { lat: booking.pickupLat, lng: booking.pickupLng }
      : null;

  // Active driver assignment → driver info.
  const [assignment] = await db
    .select({ driverId: bookingAssignments.driverId })
    .from(bookingAssignments)
    .where(
      and(
        eq(bookingAssignments.bookingId, booking.id),
        inArray(bookingAssignments.status, ['accepted', 'offered']),
      ),
    )
    .orderBy(desc(bookingAssignments.assignedAt))
    .limit(1);

  let driver: DriverInfo | null = null;
  if (assignment) {
    const [driverUser] = await db
      .select({ fullName: users.fullName, phone: users.phone })
      .from(users)
      .where(eq(users.id, assignment.driverId))
      .limit(1);
    const [profile] = await db
      .select({ photoUrl: driverProfiles.photoUrl })
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, assignment.driverId))
      .limit(1);
    const [vehicle] = await db
      .select({ make: vehicles.make, model: vehicles.model, plate: vehicles.plate })
      .from(vehicles)
      .where(eq(vehicles.id, booking.vehicleId))
      .limit(1);

    driver = {
      name: driverUser?.fullName ?? 'Driver',
      photoUrl: profile?.photoUrl ?? null,
      carModel: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
      plate: vehicle?.plate ?? null,
      phone: driverUser?.phone ?? null,
    };
  }

  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';

  return (
    <main className="fixed inset-0 h-[100dvh] w-full">
      <LiveMap code={booking.code} pickup={pickup} driver={driver} locale={locale} />
    </main>
  );
}
