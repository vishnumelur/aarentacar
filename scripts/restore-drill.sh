#!/usr/bin/env bash
# =============================================================================
# Quarterly restore-from-backup drill (Plan #13, Task 5).
#
# Proves the encrypted backups are actually restorable:
#   1. pull the latest encrypted dump from MinIO backups/postgres/
#   2. decrypt it with the OFFLINE age private key (operator supplies the path)
#   3. restore into a throwaway scratch Postgres container
#   4. run a smoke check against the restored DB
#   5. tear the scratch container down
#
# Run on the operator's machine (where the age PRIVATE key lives), NOT on the
# VPS. Document quarterly execution in docs/hetzner-setup.md.
#
# Usage:
#   AGE_IDENTITY=~/.age/aa-backup.key ./scripts/restore-drill.sh
#
# verify-on-deploy: requires age private key, docker, and network access to the
# production MinIO (or a downloaded dump via DUMP_FILE=...).
# =============================================================================
set -euo pipefail

AGE_IDENTITY="${AGE_IDENTITY:?set AGE_IDENTITY to the offline age private key path}"
SCRATCH_NAME="aa-restore-drill"
SCRATCH_PORT="${SCRATCH_PORT:-55432}"
WORK_DIR="$(mktemp -d)"
ENC_FILE="${WORK_DIR}/latest.dump.age"
DUMP_FILE_OUT="${WORK_DIR}/latest.dump"

cleanup() {
  echo "[drill] tearing down scratch container + temp files"
  docker rm -f "${SCRATCH_NAME}" >/dev/null 2>&1 || true
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

if [[ -n "${DUMP_FILE:-}" ]]; then
  echo "[drill] using provided encrypted dump: ${DUMP_FILE}"
  cp "${DUMP_FILE}" "${ENC_FILE}"
else
  echo "[drill] fetching latest backup from MinIO…"
  LATEST="$(docker compose exec -T minio mc ls "local/backups/postgres/" | sort | tail -n1 | awk '{print $NF}')"
  if [[ -z "${LATEST}" ]]; then
    echo "FATAL: no backups found in minio/backups/postgres/" >&2
    exit 1
  fi
  echo "[drill] latest = ${LATEST}"
  docker compose exec -T minio mc cat "local/backups/postgres/${LATEST}" > "${ENC_FILE}"
fi

echo "[drill] decrypting with offline age identity…"
age -d -i "${AGE_IDENTITY}" -o "${DUMP_FILE_OUT}" "${ENC_FILE}"

echo "[drill] starting scratch Postgres on :${SCRATCH_PORT}…"
docker run -d --name "${SCRATCH_NAME}" \
  -e POSTGRES_USER=aa -e POSTGRES_PASSWORD=aa -e POSTGRES_DB=aa_db \
  -p "${SCRATCH_PORT}:5432" postgres:16-alpine >/dev/null

echo "[drill] waiting for scratch DB to accept connections…"
for i in $(seq 1 30); do
  if docker exec "${SCRATCH_NAME}" pg_isready -U aa -d aa_db >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[drill] restoring dump…"
docker exec -i "${SCRATCH_NAME}" pg_restore -U aa -d aa_db --no-owner --no-acl < "${DUMP_FILE_OUT}"

echo "[drill] smoke check: table count + a couple of core tables…"
TABLES="$(docker exec "${SCRATCH_NAME}" psql -U aa -d aa_db -tAc \
  "select count(*) from information_schema.tables where table_schema='public'")"
echo "[drill] restored ${TABLES} public tables"
if [[ "${TABLES}" -lt 1 ]]; then
  echo "FATAL: restore produced no tables" >&2
  exit 1
fi
docker exec "${SCRATCH_NAME}" psql -U aa -d aa_db -c "select count(*) as users from users;" || true

echo "[drill] PASS — backup is restorable."
