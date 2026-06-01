import { redirect, notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db';
import { bookingAssignments, bookings, damageInspections } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { presignInspectionGet } from '@/lib/storage/inspections';
import { ReturnForm } from '@/components/driver/return-form';

const SLOTS = ['front', 'back', 'left', 'right', 'odometer', 'fuel'] as const;

export default async function ReturnPage({
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
  if (!booking || booking.status !== 'in_progress') notFound();

  const [handover] = await db
    .select()
    .from(damageInspections)
    .where(
      and(
        eq(damageInspections.bookingId, booking.id),
        eq(damageInspections.stage, 'handover'),
      ),
    )
    .limit(1);
  if (!handover) notFound();

  // Match each handover photo to its slot by filename prefix
  const handoverPhotos: string[] = Array.isArray(handover.photos) ? handover.photos : [];
  const handoverByslot: Record<string, string> = {};
  for (const slot of SLOTS) {
    const match = handoverPhotos.find((k) => k.includes(`/handover/${slot}-`));
    if (match) handoverByslot[slot] = match;
  }
  const signedUrls: Record<string, string> = {};
  await Promise.all(
    Object.entries(handoverByslot).map(async ([slot, key]) => {
      signedUrls[slot] = await presignInspectionGet(key);
    }),
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <Link href={`/driver/jobs/${id}`} className="text-sm text-primary underline">
        ← Back to job
      </Link>
      <div>
        <div className="font-mono text-xs text-muted-foreground">{booking.code}</div>
        <h1 className="mt-1 text-xl font-semibold">Vehicle return</h1>
        <p className="text-sm text-muted-foreground">
          Capture each side, compare against handover, flag any new damage.
        </p>
      </div>
      <ReturnForm
        bookingId={booking.id}
        assignmentId={assignment.id}
        handover={{
          photos: handoverPhotos,
          odometer: handover.odometer,
          fuelLevel: handover.fuelLevel,
        }}
        handoverSignedUrls={signedUrls}
      />
    </main>
  );
}
