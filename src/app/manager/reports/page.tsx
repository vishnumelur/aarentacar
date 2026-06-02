import { db } from '@/db';
import { revenueByPeriod, topTypesByRevenue, type Granularity } from '@/lib/reports/revenue';
import { occupancyPerVehicle } from '@/lib/reports/occupancy';
import { paymentMix } from '@/lib/reports/payment-mix';
import { buttonVariants } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

function parseGranularity(v: string | undefined): Granularity {
  return v === 'week' || v === 'month' ? v : 'day';
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const granularity = parseGranularity(sp.granularity);
  const days = Number(sp.days) || 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const [revenue, topTypes, occupancy, mix] = await Promise.all([
    revenueByPeriod(db, { granularity, from, to }),
    topTypesByRevenue(db, { from, to }),
    occupancyPerVehicle(db, { from, to }),
    paymentMix(db, { from, to }),
  ]);

  const totalRevenue = revenue.reduce((s, r) => s + r.revenueAed, 0);
  const maxRev = Math.max(1, ...revenue.map((r) => r.revenueAed));
  const qs = `from=${from.toISOString()}&to=${to.toISOString()}&granularity=${granularity}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Last {days} days.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {(['day', 'week', 'month'] as const).map((g) => (
          <a
            key={g}
            href={`/manager/reports?granularity=${g}&days=${days}`}
            className={`rounded-md border px-3 py-1.5 capitalize ${g === granularity ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {g}
          </a>
        ))}
        {[30, 90, 365].map((d) => (
          <a
            key={d}
            href={`/manager/reports?granularity=${granularity}&days=${d}`}
            className={`rounded-md border px-3 py-1.5 ${d === days ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {d}d
          </a>
        ))}
      </div>

      {/* Revenue */}
      <ReportSection
        title={`Revenue by ${granularity}`}
        total={`AED ${totalRevenue.toLocaleString()}`}
        csvHref={`/api/manager/reports/revenue/csv?${qs}`}
      >
        <div className="flex h-24 items-end gap-1">
          {revenue.map((r) => (
            <div
              key={r.period}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${(r.revenueAed / maxRev) * 100}%` }}
              title={`${r.period}: AED ${r.revenueAed}`}
            />
          ))}
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2">Period</th>
              <th className="py-2">Bookings</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {revenue.map((r) => (
              <tr key={r.period} className="border-b last:border-0">
                <td className="py-2">{r.period.slice(0, 10)}</td>
                <td className="py-2">{r.bookings}</td>
                <td className="py-2 text-right">AED {r.revenueAed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      {/* Top types */}
      <ReportSection title="Top vehicle types" csvHref={`/api/manager/reports/top-types/csv?${qs}`}>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2">Type</th>
              <th className="py-2">Bookings</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topTypes.map((t) => (
              <tr key={t.typeId} className="border-b last:border-0">
                <td className="py-2">{t.nameEn}</td>
                <td className="py-2">{t.bookings}</td>
                <td className="py-2 text-right">AED {t.revenueAed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      {/* Occupancy */}
      <ReportSection title="Occupancy per vehicle" csvHref={`/api/manager/reports/occupancy/csv?${qs}`}>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2">Vehicle</th>
              <th className="py-2">Plate</th>
              <th className="py-2 text-right">Rented days</th>
            </tr>
          </thead>
          <tbody>
            {occupancy.map((o) => (
              <tr key={o.vehicleId} className="border-b last:border-0">
                <td className="py-2">
                  {o.make} {o.model}
                </td>
                <td className="py-2 font-mono text-xs">{o.plate}</td>
                <td className="py-2 text-right">{o.rentedDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      {/* Payment mix */}
      <ReportSection title="Payment method mix" csvHref={`/api/manager/reports/payment-mix/csv?${qs}`}>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2">Method</th>
              <th className="py-2">Count</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {mix.map((m) => (
              <tr key={m.method} className="border-b last:border-0">
                <td className="py-2 capitalize">{m.method.replace(/_/g, ' ')}</td>
                <td className="py-2">{m.count}</td>
                <td className="py-2 text-right">AED {m.amountAed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>
    </div>
  );
}

function ReportSection({
  title,
  total,
  csvHref,
  children,
}: {
  title: string;
  total?: string;
  csvHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {total && <p className="text-sm text-muted-foreground">{total}</p>}
        </div>
        <a href={csvHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Export CSV
        </a>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
