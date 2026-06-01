import { sql } from 'drizzle-orm';
import type { db } from '@/db';

type Tx = Parameters<Parameters<(typeof db)['transaction']>[0]>[0];

/**
 * Generate a monotonically increasing human-readable booking code
 * formatted `AA-YYYY-NNNNN` for the current year.
 *
 * Must be called inside a transaction so the SELECT MAX + INSERT is
 * race-free (two concurrent callers would otherwise both pick the same
 * next number).
 */
export async function nextBookingCode(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AA-${year}-`;
  // SELECT MAX(numeric suffix) for codes in this year
  const result = await tx.execute<{ max_code: string | null }>(sql`
    SELECT MAX(SUBSTRING(code FROM ${prefix.length + 1})) as max_code
    FROM bookings
    WHERE code LIKE ${prefix + '%'}
  `);
  const rows = (result as { max_code: string | null }[]) ?? [];
  const maxCode = rows[0]?.max_code;
  const next = maxCode ? parseInt(maxCode, 10) + 1 : 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

/**
 * Format a code from a known year + sequence. Useful for tests + display.
 */
export function formatBookingCode(year: number, seq: number): string {
  return `AA-${year}-${String(seq).padStart(5, '0')}`;
}
