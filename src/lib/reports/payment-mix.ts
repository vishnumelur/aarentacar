import { sql } from 'drizzle-orm';
import type { Database } from '@/db';
import type { DateRange } from './revenue';

export interface PaymentMixRow {
  method: string;
  count: number;
  amountAed: number;
}

/**
 * Count + summed amount of succeeded payments per method within [from, to).
 * Bucketed by payment creation date. Pure SQL builder.
 */
export async function paymentMix(db: Database, range: DateRange): Promise<PaymentMixRow[]> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const rows = await db.execute<{ method: string; cnt: string; amount_aed: string }>(sql`
    SELECT method,
           COUNT(*) AS cnt,
           COALESCE(SUM(amount_aed), 0) AS amount_aed
    FROM payments
    WHERE status = 'succeeded'
      AND created_at >= ${from}::timestamptz
      AND created_at < ${to}::timestamptz
    GROUP BY method
    ORDER BY amount_aed DESC, method ASC
  `);
  return rows.map((r) => ({
    method: r.method,
    count: Number(r.cnt),
    amountAed: Number(r.amount_aed),
  }));
}
