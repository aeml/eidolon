#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${SERVER_DIR}"

# This is an operator-approved, destructive Mongo-only recovery, not rollback.
# Never choose an archive based on its filename or silently stop a live writer.
if [ "$#" -ne 2 ] || [ "$2" != "--confirm-data-loss" ]; then
  echo "Usage: $0 /exact/archive.gz --confirm-data-loss" >&2
  echo "Requires approval for lost progress, stopped writers and a matching journal/server recovery plan." >&2
  exit 1
fi
archive_file="$1"
if [ ! -f "${archive_file}" ] || [ ! -r "${archive_file}" ]; then
  echo "Explicit restore archive is missing or unreadable." >&2
  exit 1
fi
gzip -t -- "${archive_file}"

if [ ! -f ".env" ]; then
  echo "Missing .env in ${SERVER_DIR}" >&2
  exit 1
fi

# Compose reads its own env file. Do not execute it as a host shell script or
# put database credentials into host-side command arguments.
mongo_id="$(docker compose ps --status running -q mongo)"
if [[ ! "${mongo_id}" =~ ^[a-f0-9]{12,64}$ ]]; then
  echo "Restore requires exactly one running Compose Mongo container." >&2
  exit 1
fi

api_id="$(docker compose ps -a -q api)"
if [ -n "${api_id}" ]; then
  if [[ ! "${api_id}" =~ ^[a-f0-9]{12,64}$ ]]; then
    echo "Cannot identify one authoritative Compose API; refusing restore." >&2
    exit 1
  fi
  api_status="$(docker inspect --format '{{.State.Status}}' "${api_id}")"
  case "${api_status}" in
    exited|created) ;;
    *) echo "API is not stopped (${api_status}); refusing restore. Stop all writers explicitly." >&2; exit 1 ;;
  esac
fi

echo "Using archive: ${archive_file}"
echo "Keep all writers stopped, including any outside this Compose project. Restoring eidolon only."
# Stream bytes instead of interpolating an archive name into a container shell.
# No temporary archive is left behind and no other database may be restored.
set +e
docker compose exec -T mongo sh -c 'exec mongorestore --drop --gzip --archive --nsInclude="eidolon.*" --stopOnError --username "${MONGO_INITDB_ROOT_USERNAME:?Missing Mongo username}" --password "${MONGO_INITDB_ROOT_PASSWORD:?Missing Mongo password}" --authenticationDatabase admin' < "${archive_file}"
restore_exit=$?
set -e

if [ ${restore_exit} -ne 0 ]; then
  echo "mongorestore failed. This can happen if Mongo root credentials mismatch an existing mongo_data volume." >&2
  echo "The restore uses --drop and may already have replaced or removed data before failing." >&2
  echo "Keep all game writers stopped; preserve the original backup and pending-save journal while investigating." >&2
  echo "Do not delete Docker volumes or migration markers to bypass this failure." >&2
  exit ${restore_exit}
fi

echo "Restore succeeded. Verifying collections and DB stats..."
docker compose exec -T mongo sh -c 'exec mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval '\''const d = db.getSiblingDB("eidolon"); printjson(d.getCollectionNames()); const s = d.stats(); printjson(s); if (s.ok !== 1) quit(1);'\'''

echo "Mongo-only restore and verification complete. Writers remain stopped; verify matching journals and server before reopening."
