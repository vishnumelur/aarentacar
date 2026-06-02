/**
 * Minimal RFC-4180-ish CSV serializer. Fields containing a comma, double
 * quote, or newline are wrapped in double quotes with embedded quotes doubled.
 */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T extends object>(columns: (keyof T & string)[], rows: T[]): string {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) =>
    columns.map((c) => csvCell((row as Record<string, unknown>)[c])).join(','),
  );
  return [header, ...body].join('\n');
}
