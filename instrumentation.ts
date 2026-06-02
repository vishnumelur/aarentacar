/**
 * Next.js 15 instrumentation entrypoint (Plan #13, Task 6).
 *
 * `register()` runs once per server runtime at startup; we initialise the
 * Sentry/GlitchTip SDK for whichever runtime is active. `onRequestError` pipes
 * App-Router server errors into Sentry. Both are no-ops when no DSN is set.
 */
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentryServer } = await import('./sentry.server.config');
    await initSentryServer();
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    const { initSentryEdge } = await import('./sentry.edge.config');
    initSentryEdge();
  }
}

export const onRequestError = Sentry.captureRequestError;
