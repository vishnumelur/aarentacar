import { sql } from 'drizzle-orm';
import type { Database } from '@/db';

export type Granularity = 'day' | 'week' | 'month';

export interface RevenueRow {
  period: string;
  revenueAed: number;
  bookings: number;
}

export interface RevenueRange {
  granularity: Granularity;
  from: Date;
  to: Date;
}

/** Statuses that count toward realized revenue (excludes draft/cancelled). */
const REVENUE_STATUSES = sql`('approved','dispatched','in_progress','completed')`;

/**
 * Revenue grouped by day/week/month over the booking creation date. Pure SQL
 * builder; takes the drizzle client so it can run against the fixture DB in
 * tests. Bookings are bucketed by `created_at`.
 */
export async function revenueByPeriod(db: Database, range: RevenueRange): Promise<RevenueRow[]> {
  const trunc =
    range.granularity === 'week' ? 'week' : range.granularity === 'month' ? 'month' : 'day';
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const rows = await db.execute<{ period: string; revenue_aed: string; bookings: string }>(sql`
    SELECT date_trunc(${trunc}, created_at)::text AS period,
           COALESCE(SUM(total_aed), 0) AS revenue_aed,
           COUNT(*) AS bookings
    FROM bookings
    WHERE created_at >= ${from}::timestamptz
      AND created_at < ${to}::timestamptz
      AND status IN ${REVENUE_STATUSES}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return rows.map((r) => ({
    period: r.period,
    revenueAed: Number(r.revenue_aed),
    bookings: Number(r.bookings),
  }));
}

export interface TopTypeRow {
  typeId: string;
  nameEn: string;
  bookings: number;
  revenueAed: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Revenue grouped by vehicle type, sorted by total revenue descending. */
export async function topTypesByRevenue(db: Database, range: DateRange): Promise<TopTypeRow[]> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const rows = await db.execute<{
    type_id: string;
    name_en: string;
    bookings: string;
    revenue_aed: string;
  }>(sql`
    SELECT vt.id AS type_id,
           vt.name_en AS name_en,
           COUNT(b.id) AS bookings,
           COALESCE(SUM(b.total_aed), 0) AS revenue_aed
    FROM bookings b
    JOIN vehicles v ON v.id = b.vehicle_id
    JOIN vehicle_types vt ON vt.id = v.type_id
    WHERE b.created_at >= ${from}::timestamptz
      AND b.created_at < ${to}::timestamptz
      AND b.status IN ${REVENUE_STATUSES}
    GROUP BY vt.id, vt.name_en
    ORDER BY revenue_aed DESC, vt.name_en ASC
  `);
  return rows.map((r) => ({
    typeId: r.type_id,
    nameEn: r.name_en,
    bookings: Number(r.bookings),
    revenueAed: Number(r.revenue_aed),
  }));
}
