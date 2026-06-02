/**
 * Sentry/GlitchTip edge-runtime init (Plan #13, Task 6).
 *
 * The Edge runtime cannot import the DB-backed credential store, so the DSN
 * comes from env only (`SENTRY_DSN`). No DSN → SDK no-op.
 */
import * as Sentry from '@sentry/nextjs';
import { serverEnvDsn, tracesSampleRate } from '@/lib/observability/dsn';

export function initSentryEdge(): void {
  const dsn = serverEnvDsn();
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: tracesSampleRate(),
    environment: process.env.NODE_ENV,
    release: process.env.GIT_SHA,
  });
}
