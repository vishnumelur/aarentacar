/**
 * Sentry/GlitchTip DSN resolution (Plan #13, Task 6).
 *
 * GlitchTip is Sentry-API-compatible, so the official `@sentry/nextjs` SDK
 * points at the self-hosted GlitchTip instance. The DSN is sourced (in order):
 *
 *   1. The Plan #9 encrypted credential store (`getCredential('glitchtip'|'sentry', 'dsn')`)
 *      — read lazily at server init from `instrumentation.ts`.
 *   2. `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env fallback.
 *
 * CRITICAL no-op guarantee: when NO DSN is configured, `Sentry.init` is called
 * with `dsn: undefined`, which makes the SDK a no-op. Build, dev, and the test
 * suite therefore never require a DSN — exactly per the Definition of Done.
 *
 * This module must stay dependency-light (no DB import at module scope) so it is
 * safe to import from the Edge runtime and the browser bundle.
 */

/** Server-side env DSN (never shipped to the browser). */
export function serverEnvDsn(): string | undefined {
  const v = process.env.SENTRY_DSN ?? process.env.GLITCHTIP_DSN;
  return v && v !== '' ? v : undefined;
}

/** Client-side DSN — must be a NEXT_PUBLIC_* var to reach the browser bundle. */
export function clientEnvDsn(): string | undefined {
  const v = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.NEXT_PUBLIC_GLITCHTIP_DSN;
  return v && v !== '' ? v : undefined;
}

/** Shared tracing sample rate, overridable via env; conservative default. */
export function tracesSampleRate(): number {
  const v = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.1;
}
