import Link from 'next/link';
import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, vehicles, users } from '@/db/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SP {
  q?: string;
  status?: string;
}

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

export default async function ManagerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const where: SQL[] = [];
  if (sp.q) where.push(ilike(bookings.code, `%${sp.q.toUpperCase()}%`));
  if (sp.status) {
    where.push(sql`${bookings.status}::text = ${sp.status}`);
  }

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
      customerName: users.fullName,
      customerEmail: users.email,
    })
    .from(bookings)
    .leftJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .leftJoin(users, eq(users.id, bookings.customerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bookings</h1>

      <form className="flex flex-wrap items-center gap-2" action="/manager/bookings">
        <Input
          name="q"
          placeholder="Search by code (AA-…)"
          defaultValue={sp.q ?? ''}
          className="w-56"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending_payment">Pending payment</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="dispatched">Dispatched</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
        <Link href="/manager/bookings" className="text-sm text-muted-foreground underline">
          Reset
        </Link>
      </form>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No bookings match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-mono">{r.code}</td>
                <td className="px-4 py-3">
                  <div>{r.customerName}</div>
                  <div className="text-xs text-muted-foreground">{r.customerEmail}</div>
                </td>
                <td className="px-4 py-3">
                  {r.vehicleMake} {r.vehicleModel}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(r.pickupAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">AED {r.totalAed.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      STATUS_TONES[r.status] ?? 'bg-muted'
                    }`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manager/bookings/${r.code}`} className="text-primary underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
