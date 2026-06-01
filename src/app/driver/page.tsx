import { desc, eq, inArray, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import {
  driverProfiles,
  bookingAssignments,
  bookings,
  vehicles,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { SelfStatusToggle } from '@/components/driver/self-status-toggle';
import { JobCard } from '@/components/driver/job-card';
import { PushSubscribe } from '@/components/push-subscribe';
import { InstallPrompt } from '@/components/driver/install-prompt';
import { vapidPublicKey } from '@/lib/push/vapid';

export default async function DriverTodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'driver' && user.role !== 'superadmin') redirect('/');

  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, user.id))
    .limit(1);

  if (!profile) {
    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="text-xl font-semibold">Driver setup incomplete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn&apos;t have a driver profile yet. Ask the manager to add you in the
          Drivers section of the manager portal.
        </p>
      </main>
    );
  }

  // Pull this driver's accepted + offered assignments (active set), join booking + vehicle + customer
  const assignments = await db
    .select({
      assignmentId: bookingAssignments.id,
      assignmentStatus: bookingAssignments.status,
      bookingId: bookings.id,
      bookingCode: bookings.code,
      bookingStatus: bookings.status,
      pickupAt: bookings.pickupAt,
      pickupAddress: bookings.pickupAddress,
      rentalKind: bookings.rentalKind,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      customerName: users.fullName,
      customerPhone: users.phone,
    })
    .from(bookingAssignments)
    .innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId))
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .where(
      and(
        eq(bookingAssignments.driverId, user.id),
        inArray(bookingAssignments.status, ['offered', 'accepted']),
      ),
    )
    .orderBy(desc(bookings.pickupAt));

  const current = assignments.find((a) => a.assignmentStatus === 'accepted');
  const offers = assignments.filter((a) => a.assignmentStatus === 'offered');

  return (
    <main className="mx-auto max-w-md space-y-6 p-4">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Hi, {user.fullName.split(' ')[0]}</h1>
          <PushSubscribe vapidPublicKey={vapidPublicKey()} />
        </div>
        <InstallPrompt />
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
        <SelfStatusToggle initialStatus={profile.status} />
      </section>

      {current && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Current job</h2>
          <JobCard
            assignmentId={current.assignmentId}
            bookingCode={current.bookingCode}
            status="accepted"
            pickupAt={current.pickupAt}
            pickupAddress={current.pickupAddress}
            customerName={current.customerName}
            customerPhone={current.customerPhone}
            vehicleMake={current.vehicleMake}
            vehicleModel={current.vehicleModel}
            rentalKind={current.rentalKind}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Pending offers {offers.length > 0 && `(${offers.length})`}
        </h2>
        {offers.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            No new offers yet. You&apos;ll get a notification the moment the manager dispatches you.
          </p>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <JobCard
                key={o.assignmentId}
                assignmentId={o.assignmentId}
                bookingCode={o.bookingCode}
                status="offered"
                pickupAt={o.pickupAt}
                pickupAddress={o.pickupAddress}
                customerName={o.customerName}
                customerPhone={o.customerPhone}
                vehicleMake={o.vehicleMake}
                vehicleModel={o.vehicleModel}
                rentalKind={o.rentalKind}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
