/**
 * Sentry/GlitchTip server-side init (Plan #13, Task 6).
 *
 * Imported from `instrumentation.ts` for the Node.js runtime. The DSN is
 * resolved from the Plan #9 credential store first, then env. When NO DSN is
 * found, `Sentry.init({ dsn: undefined })` makes the SDK a no-op — build, dev,
 * and tests never require a DSN.
 */
import * as Sentry from '@sentry/nextjs';
import { tracesSampleRate } from '@/lib/observability/dsn';
import { resolveServerDsn } from '@/lib/observability/server-dsn';

export async function initSentryServer(): Promise<void> {
  const dsn = await resolveServerDsn();
  Sentry.init({
    dsn, // undefined → SDK no-op
    enabled: Boolean(dsn),
    tracesSampleRate: tracesSampleRate(),
    environment: process.env.NODE_ENV,
    release: process.env.GIT_SHA,
  });
}
