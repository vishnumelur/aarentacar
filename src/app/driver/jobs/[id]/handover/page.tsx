import { redirect, notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db';
import { bookingAssignments, bookings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { HandoverForm } from '@/components/driver/handover-form';

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'driver') redirect('/');

  const [assignment] = await db
    .select()
    .from(bookingAssignments)
    .where(eq(bookingAssignments.id, id))
    .limit(1);
  if (!assignment) notFound();
  if (assignment.driverId !== me.id) notFound();
  if (assignment.status !== 'accepted') notFound();

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, assignment.bookingId))
    .limit(1);
  if (!booking || booking.status !== 'dispatched') notFound();

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <Link href={`/driver/jobs/${id}`} className="text-sm text-primary underline">
        ← Back to job
      </Link>
      <div>
        <div className="font-mono text-xs text-muted-foreground">{booking.code}</div>
        <h1 className="mt-1 text-xl font-semibold">Vehicle handover</h1>
        <p className="text-sm text-muted-foreground">
          Capture 6 photos, odometer + fuel level, and get the customer&apos;s signature.
        </p>
      </div>
      <HandoverForm bookingId={booking.id} assignmentId={assignment.id} />
    </main>
  );
}
