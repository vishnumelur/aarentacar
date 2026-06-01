import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, vehicles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const STATUS_TONES: Record<string, string> = {
  draft: 'bg-muted',
  pending_kyc: 'bg-amber-100 text-amber-900',
  pending_payment: 'bg-amber-100 text-amber-900',
  pending_approval: 'bg-blue-100 text-blue-900',
  approved: 'bg-blue-100 text-blue-900',
  dispatched: 'bg-blue-100 text-blue-900',
  in_progress: 'bg-green-100 text-green-900',
  completed: 'bg-green-100 text-green-900',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-muted text-muted-foreground',
};

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'customer') redirect('/');

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      pickupAt: bookings.pickupAt,
      returnAt: bookings.returnAt,
      totalAed: bookings.totalAed,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
    })
    .from(bookings)
    .leftJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(eq(bookings.customerId, user.id))
    .orderBy(desc(bookings.createdAt));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link href="/" className="text-sm text-primary underline">
          Book another
        </Link>
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          You haven&apos;t booked anything yet.{' '}
          <Link href="/" className="text-primary underline">
            Browse vehicles
          </Link>
          .
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/my-bookings/${r.code}`}
            className="block rounded-lg border bg-card p-4 transition hover:border-primary hover:shadow"
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-mono text-sm text-muted-foreground">{r.code}</div>
                <div className="font-semibold">
                  {r.vehicleMake} {r.vehicleModel}
                </div>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONES[r.status] ?? 'bg-muted'}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>Pickup: {new Date(r.pickupAt).toLocaleString()}</div>
              <div>Return: {new Date(r.returnAt).toLocaleString()}</div>
              <div className="text-right font-semibold text-foreground">
                AED {r.totalAed.toLocaleString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
