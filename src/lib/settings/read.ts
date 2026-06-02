import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

/**
 * Read multiple settings by key, returning a `key → value` map. Missing keys
 * are simply absent; callers fall back to their own defaults.
 */
export async function readSettings(keys: string[]): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, keys));
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const map = await readSettings([key]);
  return (map[key] as T) ?? fallback;
}
