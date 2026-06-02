import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { userCanAgent } from '@/lib/auth/agent-guard';
import { revenueByPeriod, topTypesByRevenue, type Granularity } from '@/lib/reports/revenue';
import { occupancyPerVehicle } from '@/lib/reports/occupancy';
import { paymentMix } from '@/lib/reports/payment-mix';
import { toCsv } from '@/lib/reports/csv';

export const dynamic = 'force-dynamic';

function parseRange(url: URL): { from: Date; to: Date; granularity: Granularity } {
  const now = new Date();
  const toRaw = url.searchParams.get('to');
  const fromRaw = url.searchParams.get('from');
  const to = toRaw ? new Date(toRaw) : now;
  const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 86_400_000);
  const g = url.searchParams.get('granularity');
  const granularity: Granularity = g === 'week' || g === 'month' ? g : 'day';
  return { from, to, granularity };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ report: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  // Revenue/payment reports gated by view_revenue; others by portal access.
  if (!user) return new Response('unauthorized', { status: 401 });

  const { report } = await ctx.params;
  const { from, to, granularity } = parseRange(new URL(req.url));

  let csv: string;
  let filename: string;

  switch (report) {
    case 'revenue': {
      if (!(await userCanAgent(user, 'view_revenue'))) {
        return new Response('forbidden', { status: 403 });
      }
      const rows = await revenueByPeriod(db, { granularity, from, to });
      csv = toCsv(['period', 'bookings', 'revenueAed'], rows);
      filename = 'revenue.csv';
      break;
    }
    case 'top-types': {
      if (!(await userCanAgent(user, 'view_revenue'))) {
        return new Response('forbidden', { status: 403 });
      }
      const rows = await topTypesByRevenue(db, { from, to });
      csv = toCsv(['typeId', 'nameEn', 'bookings', 'revenueAed'], rows);
      filename = 'top-types.csv';
      break;
    }
    case 'occupancy': {
      if (!(await userCanAgent(user, 'view_revenue'))) {
        return new Response('forbidden', { status: 403 });
      }
      const rows = await occupancyPerVehicle(db, { from, to });
      csv = toCsv(['vehicleId', 'make', 'model', 'plate', 'rentedDays'], rows);
      filename = 'occupancy.csv';
      break;
    }
    case 'payment-mix': {
      if (!(await userCanAgent(user, 'view_revenue'))) {
        return new Response('forbidden', { status: 403 });
      }
      const rows = await paymentMix(db, { from, to });
      csv = toCsv(['method', 'count', 'amountAed'], rows);
      filename = 'payment-mix.csv';
      break;
    }
    default:
      return new Response('not_found', { status: 404 });
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
