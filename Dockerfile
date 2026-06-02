# Production image for AA Rent A Car (Plan #13).
#
# Multi-stage: pnpm install (frozen) → next build (standalone) → slim runtime.
# The SAME image serves both the `app` service (Next standalone server) and the
# `worker` service (pg-boss runner). The worker also needs postgresql-client +
# gzip for the daily-pg-dump job, so those are installed in the runtime stage.
#
# Build with a GIT_SHA arg so /api/health and Sentry releases report the commit:
#   docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t aa-app .

# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
# Build without requiring a Sentry DSN (SDK no-ops); source-map upload is opt-in
# via SENTRY_UPLOAD_SOURCE_MAPS at build time (see next.config.ts).
RUN pnpm build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# postgresql-client + gzip: required by the worker's daily-pg-dump job.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client gzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Standalone server bundle (next.config: output: 'standalone').
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Full node_modules + sources for the worker (tsx) and drizzle migrations,
# which the standalone trace alone does not include.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
EXPOSE 3000

# Default command runs the Next standalone server. The `worker` service in
# docker-compose overrides this with `pnpm worker:start`.
CMD ["node", "server.js"]
