/**
 * Sentry/GlitchTip browser init (Plan #13, Task 6).
 *
 * Loaded via `instrumentation-client.ts`. The browser bundle cannot read the
 * encrypted credential store (server-only DB), so the client DSN must be a
 * build-time `NEXT_PUBLIC_SENTRY_DSN`. No DSN → SDK no-op, so the browser
 * bundle ships clean without observability configured.
 */
import * as Sentry from '@sentry/nextjs';
import { clientEnvDsn, tracesSampleRate } from '@/lib/observability/dsn';

const dsn = clientEnvDsn();

Sentry.init({
  dsn, // undefined → SDK no-op
  enabled: Boolean(dsn),
  tracesSampleRate: tracesSampleRate(),
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
