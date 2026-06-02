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
  // SELECT MAX(numeric suffix) for codes in this year.
  //
  // The substring start position MUST be emitted as a SQL literal via
  // sql.raw — NOT a bound parameter. When bound (`SUBSTRING(code FROM $1)`)
  // Postgres receives an untyped value and resolves the call to the regex
  // form `substring(string FROM pattern)`, treating "9" as a POSIX pattern.
  // The code never contains that pattern, so it returns NULL — every booking
  // would then get sequence 1 and collide on the 2nd insert (unique code).
  // `startPos` is a derived integer (prefix length), never user input.
  const startPos = prefix.length + 1;
  const result = await tx.execute<{ max_code: string | null }>(sql`
    SELECT MAX(SUBSTRING(code FROM ${sql.raw(String(startPos))})) as max_code
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
