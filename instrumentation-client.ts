/**
 * Next.js 15 client instrumentation (Plan #13, Task 6).
 *
 * Runs in the browser before hydration. Delegates to sentry.client.config.ts,
 * which is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset.
 */
export { onRouterTransitionStart } from './sentry.client.config';
