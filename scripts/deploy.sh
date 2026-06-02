#!/usr/bin/env bash
# =============================================================================
# One-command production deploy ritual (Plan #13).
#
#   git pull → build images → run DB migrations → restart → health-check.
#
# Run on the VPS:   cd /opt/aarentacar && ./scripts/deploy.sh
# (or driven remotely by .github/workflows/deploy.yml — deferred/optional.)
#
# Idempotent and safe to re-run. Aborts non-zero on any failed step so a
# CI-triggered deploy surfaces failures.
#
# verify-on-deploy: requires the production VPS with the compose stack + a
# populated .env.production.
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/aarentacar}"
HEALTH_URL="${HEALTH_URL:-http://localhost:80/api/health}"
HEALTH_HOST="${HEALTH_HOST:-aa-rentacar.com}"

cd "${REPO_DIR}"

echo "[deploy] pulling latest main…"
git pull --ff-only

export GIT_SHA="$(git rev-parse --short HEAD)"
echo "[deploy] building images at ${GIT_SHA}…"
docker compose build --build-arg "GIT_SHA=${GIT_SHA}"

echo "[deploy] applying DB migrations…"
# Bring postgres up first so migrate can connect, then run drizzle migrate in a
# one-off app container.
docker compose up -d postgres
docker compose run --rm app pnpm db:migrate

echo "[deploy] (re)starting the stack…"
docker compose up -d

echo "[deploy] waiting for /api/health…"
ok=0
for i in $(seq 1 30); do
  # Send the production Host header so Caddy routes to the app vhost.
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${HEALTH_HOST}" "${HEALTH_URL}" || true)"
  if [[ "${code}" == "200" ]]; then ok=1; break; fi
  echo "[deploy]   health=${code} (attempt ${i}/30)…"
  sleep 3
done

if [[ "${ok}" != "1" ]]; then
  echo "FATAL: /api/health did not return 200 after deploy" >&2
  docker compose logs --tail=50 app || true
  exit 1
fi

echo "[deploy] healthy. Deployed ${GIT_SHA}."
