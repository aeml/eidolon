#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${SERVER_DIR}"

if [ ! -f ".env" ]; then
  echo "Missing .env in ${SERVER_DIR}" >&2
  exit 1
fi

set -a
source .env
set +a

required_vars=(MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD)
for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing required env var: ${key}" >&2
    exit 1
  fi
done

if ! docker compose ps mongo >/dev/null 2>&1; then
  echo "Mongo service not available via docker compose." >&2
  exit 1
fi

archive_file="${1:-}"
if [ -z "${archive_file}" ]; then
  archive_file="$(find . -maxdepth 1 -type f \( -name "*.archive" -o -name "*.archive.gz" -o -name "*.dump.gz" -o -name "*mongo*.gz" \) | sort | tail -n1)"
fi

if [ -z "${archive_file}" ] || [ ! -f "${archive_file}" ]; then
  echo "No archive found in ${SERVER_DIR}. Pass archive path as first argument." >&2
  exit 1
fi

archive_base="$(basename "${archive_file}")"

echo "Using archive: ${archive_file}"
echo "Copying archive into mongo container..."
docker compose cp "${archive_file}" "mongo:/tmp/${archive_base}"

echo "Running mongorestore (drop+gzip+archive) ..."
set +e
docker compose exec -T mongo sh -lc "mongorestore --drop --gzip --archive=/tmp/${archive_base} --username \"\$MONGO_INITDB_ROOT_USERNAME\" --password \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin"
restore_exit=$?
set -e

if [ ${restore_exit} -ne 0 ]; then
  echo "mongorestore failed. This can happen if Mongo root credentials mismatch an existing mongo_data volume." >&2
  echo "No destructive action was taken." >&2
  echo "If you want to reset data volume, confirm explicitly before running any 'docker compose down -v'." >&2
  exit ${restore_exit}
fi

echo "Restore succeeded. Verifying collections and DB stats..."
docker compose exec -T mongo mongosh "mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@localhost:27017/admin?authSource=admin" --quiet --eval 'db.getSiblingDB("eidolon").getCollectionNames()'
docker compose exec -T mongo mongosh "mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@localhost:27017/admin?authSource=admin" --quiet --eval 'db.getSiblingDB("eidolon").stats()'

echo "Mongo restore and verification complete."