import { serverEnvDsn } from './dsn';

/**
 * Server-only DSN resolution (Plan #13, Task 6). Kept separate from `dsn.ts` so
 * the browser/edge bundles never trace the DB-backed credential store import.
 *
 * Resolves: credential store (`getCredential('glitchtip'|'sentry','dsn')`) →
 * `SENTRY_DSN` env. Any failure (no DB, not configured) falls back to env.
 */
export async function resolveServerDsn(): Promise<string | undefined> {
  try {
    const { getCredential } = await import('@/lib/credentials/store');
    const fromStore =
      (await getCredential('glitchtip', 'dsn')) ?? (await getCredential('sentry', 'dsn'));
    if (fromStore) return fromStore;
  } catch {
    // No DB / not configured — fall through to env.
  }
  return serverEnvDsn();
}
