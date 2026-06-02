#!/usr/bin/env bash
# =============================================================================
# Nightly encrypted Postgres backup (Plan #13, Task 4).
#
# pg_dump (custom format) → age-encrypt with the committed PUBLIC recipient →
# upload to the MinIO `backups/postgres/` prefix → prune objects older than 30
# days. The age PRIVATE key is kept OFFLINE on the operator's machine (never on
# the VPS, never committed) — only it can decrypt these dumps.
#
# Schedule via system cron at 02:00 (see docs/hetzner-setup.md):
#   0 2 * * * cd /opt/aarentacar && ./scripts/backup.sh >> /var/log/aa-backup.log 2>&1
#
# verify-on-deploy: requires the running production compose, the `age` binary on
# the host, and .age-recipient present.
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/aarentacar}"
RECIPIENT_FILE="${RECIPIENT_FILE:-${REPO_DIR}/.age-recipient}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE="$(date +%Y%m%d-%H%M%S)"
TMP_DUMP="/tmp/${DATE}.dump"
TMP_ENC="/tmp/${DATE}.dump.age"

cd "${REPO_DIR}"

if [[ ! -f "${RECIPIENT_FILE}" ]]; then
  echo "FATAL: age recipient file not found at ${RECIPIENT_FILE}" >&2
  exit 1
fi
RECIPIENT="$(grep -v '^#' "${RECIPIENT_FILE}" | grep -m1 .)"

cleanup() { rm -f "${TMP_DUMP}" "${TMP_ENC}"; }
trap cleanup EXIT

echo "[backup] dumping aa_db…"
docker compose exec -T postgres pg_dump -U aa -d aa_db --format=custom --no-owner --no-acl > "${TMP_DUMP}"

echo "[backup] encrypting with age recipient ${RECIPIENT:0:16}…"
age -r "${RECIPIENT}" -o "${TMP_ENC}" "${TMP_DUMP}"

echo "[backup] uploading to minio/backups/postgres/${DATE}.dump.age"
# Stream the encrypted file into the minio container and `mc cp` it to the bucket.
docker compose exec -T minio sh -c "cat > /tmp/${DATE}.dump.age" < "${TMP_ENC}"
docker compose exec -T minio mc alias set local http://localhost:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1 || true
docker compose exec -T minio mc cp "/tmp/${DATE}.dump.age" "local/backups/postgres/${DATE}.dump.age"
docker compose exec -T minio rm -f "/tmp/${DATE}.dump.age"

echo "[backup] pruning objects older than ${RETENTION_DAYS}d"
docker compose exec -T minio mc rm --recursive --force --older-than "${RETENTION_DAYS}d" "local/backups/postgres/" || true

echo "[backup] done: ${DATE}.dump.age"
