import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveDriverMap } from '@/components/manager/live-driver-map';

export const dynamic = 'force-dynamic';

interface Counts {
  activeRentals: number;
  pendingApprovals: number;
  pendingKyc: number;
  availableCars: number;
  returnsDueToday: number;
  overdueReturns: number;
}

async function dashboardCounts(): Promise<Counts> {
  const [row] = await db.execute<{
    active_rentals: string;
    pending_approvals: string;
    pending_kyc: string;
    available_cars: string;
    returns_due_today: string;
    overdue_returns: string;
  }>(sql`
    SELECT
      (SELECT count(*) FROM bookings WHERE status IN ('approved','dispatched','in_progress')) AS active_rentals,
      (SELECT count(*) FROM bookings WHERE status = 'pending_approval') AS pending_approvals,
      (SELECT count(DISTINCT customer_id) FROM customer_documents WHERE status = 'pending') AS pending_kyc,
      (SELECT count(*) FROM vehicles WHERE status = 'active' AND deleted_at IS NULL
        AND id NOT IN (SELECT vehicle_id FROM bookings WHERE status IN ('approved','dispatched','in_progress'))
      ) AS available_cars,
      (SELECT count(*) FROM bookings WHERE status = 'in_progress'
        AND return_at::date = now()::date) AS returns_due_today,
      (SELECT count(*) FROM bookings WHERE status = 'in_progress'
        AND return_at < now()) AS overdue_returns
  `);
  return {
    activeRentals: Number(row?.active_rentals ?? 0),
    pendingApprovals: Number(row?.pending_approvals ?? 0),
    pendingKyc: Number(row?.pending_kyc ?? 0),
    availableCars: Number(row?.available_cars ?? 0),
    returnsDueToday: Number(row?.returns_due_today ?? 0),
    overdueReturns: Number(row?.overdue_returns ?? 0),
  };
}

interface ScheduleRow {
  code: string;
  status: string;
  pickupAt: string;
  returnAt: string;
  make: string;
  model: string;
  kind: 'pickup' | 'return';
}

async function todaySchedule(): Promise<ScheduleRow[]> {
  const rows = await db.execute<{
    code: string;
    status: string;
    pickup_at: string;
    return_at: string;
    make: string;
    model: string;
    kind: 'pickup' | 'return';
  }>(sql`
    SELECT b.code, b.status, b.pickup_at, b.return_at, v.make, v.model,
           CASE WHEN b.pickup_at::date = now()::date THEN 'pickup' ELSE 'return' END AS kind
    FROM bookings b
    JOIN vehicles v ON v.id = b.vehicle_id
    WHERE (b.pickup_at::date = now()::date OR b.return_at::date = now()::date)
      AND b.status NOT IN ('draft','cancelled','refunded','completed')
    ORDER BY LEAST(b.pickup_at, b.return_at) ASC
    LIMIT 50
  `);
  return rows.map((r) => ({
    code: r.code,
    status: r.status,
    pickupAt: r.pickup_at,
    returnAt: r.return_at,
    make: r.make,
    model: r.model,
    kind: r.kind,
  }));
}

interface DriverPin {
  userId: string;
  fullName: string;
  lat: number;
  lng: number;
}

async function onDutyDrivers(): Promise<DriverPin[]> {
  const rows = await db.execute<{
    user_id: string;
    full_name: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT dp.user_id, u.full_name, dp.current_lat AS lat, dp.current_lng AS lng
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    WHERE dp.status IN ('on_duty','available')
      AND dp.current_lat IS NOT NULL AND dp.current_lng IS NOT NULL
  `);
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    lat: Number(r.lat),
    lng: Number(r.lng),
  }));
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-blue-100 text-blue-800',
  dispatched: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-green-100 text-green-800',
  pending_approval: 'bg-purple-100 text-purple-800',
  pending_payment: 'bg-gray-100 text-gray-800',
};

export default async function ManagerDashboard() {
  const [counts, schedule, drivers] = await Promise.all([
    dashboardCounts(),
    todaySchedule(),
    onDutyDrivers(),
  ]);

  const kpis = [
    { label: 'Active rentals', value: counts.activeRentals, href: '/manager/bookings?status=in_progress' },
    { label: 'Pending approvals', value: counts.pendingApprovals, href: '/manager/bookings?status=pending_approval' },
    { label: 'Pending KYC', value: counts.pendingKyc, href: '/manager/customers?status=pending' },
    { label: 'Available cars', value: counts.availableCars, href: '/manager/fleet' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live KPIs and today&apos;s schedule.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm font-normal text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{k.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Today&apos;s schedule</h2>
          {schedule.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing picking up or returning today.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {schedule.map((s) => (
                <li key={`${s.code}-${s.kind}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium capitalize">{s.kind}</span>
                    <Link href={`/manager/bookings/${s.code}`} className="font-mono text-primary underline">
                      {s.code}
                    </Link>
                    <span className="text-muted-foreground">
                      {s.make} {s.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.kind === 'pickup' ? s.pickupAt : s.returnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[s.status] ?? 'bg-muted'}`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6 space-y-3">
          <h2 className="font-semibold">Needs attention</h2>
          <AttentionRow label="Returns due today" value={counts.returnsDueToday} href="/manager/bookings?status=in_progress" />
          <AttentionRow label="Overdue returns" value={counts.overdueReturns} href="/manager/bookings?status=in_progress" urgent />
          <AttentionRow label="Pending approvals" value={counts.pendingApprovals} href="/manager/bookings?status=pending_approval" />
          <AttentionRow label="Pending KYC" value={counts.pendingKyc} href="/manager/customers?status=pending" />
        </section>
      </div>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold">On-duty drivers</h2>
        <LiveDriverMap drivers={drivers} />
      </section>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  href,
  urgent,
}: {
  label: string;
  value: number;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${urgent && value > 0 ? 'bg-red-100 text-red-800' : 'bg-muted'}`}>
        {value}
      </span>
    </Link>
  );
}
