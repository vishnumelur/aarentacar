import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Standalone output keeps the production Docker image small (Plan #13). The
  // `app` + `worker` containers run the standalone server / the worker script.
  output: 'standalone',
};

const base = withNextIntl(nextConfig);

/**
 * Source-map upload to GlitchTip/Sentry is opt-in (Plan #13, Task 6). It only
 * runs when SENTRY_UPLOAD_SOURCE_MAPS is set AND a Sentry auth token + org/project
 * are configured at build time — so local `pnpm build` and CI (no token) stay a
 * pure Next build with no upload and no DSN required.
 */
const uploadSourceMaps =
  process.env.SENTRY_UPLOAD_SOURCE_MAPS === '1' && Boolean(process.env.SENTRY_AUTH_TOKEN);

export default uploadSourceMaps
  ? withSentryConfig(base, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Self-hosted GlitchTip endpoint (Sentry-compatible API).
      sentryUrl: process.env.SENTRY_URL,
      silent: true,
      // Strip uploaded source maps from the client bundle.
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // We init manually in instrumentation*.ts; don't let the plugin inject.
      disableLogger: true,
    })
  : base;
