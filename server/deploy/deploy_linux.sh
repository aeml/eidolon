#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${SERVER_DIR}"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
  echo "Repo root: ${REPO_ROOT}"
  echo "Server dir: ${SERVER_DIR}"
  echo "Current repo HEAD: $(git -C "${REPO_ROOT}" rev-parse HEAD)"
  echo "Current server tree from HEAD"
fi

if [ -z "${EIDOLON_BUILD_COMMIT:-}" ] && [ -n "${REPO_ROOT:-}" ]; then
  EIDOLON_BUILD_COMMIT="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
fi
EIDOLON_BUILD_VERSION="${EIDOLON_BUILD_VERSION:-Alpha 1.79.22}"
export EIDOLON_BUILD_COMMIT EIDOLON_BUILD_VERSION

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin not found" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Missing .env in ${SERVER_DIR}. Copy .env.example to .env and set credentials." >&2
  exit 1
fi

set -a
source .env
set +a

case "${EIDOLON_MONITOR_ENABLED:-false}" in
  true|false) ;;
  *) echo "EIDOLON_MONITOR_ENABLED must be true or false." >&2; exit 1 ;;
esac

required_vars=(
  MONGO_INITDB_ROOT_USERNAME
  MONGO_INITDB_ROOT_PASSWORD
  MONGO_URI
)

for key in "${required_vars[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Missing required env var: ${key}" >&2
    exit 1
  fi
done

if [[ ! "${MONGO_URI}" =~ ^mongodb://([^/@]*@)?mongo:27017(/[^?]*)?(\?.*)?$ ]]; then
  echo "Deployment requires the API's database URI to target this stack's mongo:27017." >&2
  echo "A remote database needs its own verified backup workflow; refusing to back up a different database." >&2
  exit 1
fi

deploy_min_free_mib="${EIDOLON_DEPLOY_MIN_FREE_MIB:-2048}"
if [[ ! "${deploy_min_free_mib}" =~ ^[1-9][0-9]{0,5}$ ]]; then
  echo "EIDOLON_DEPLOY_MIN_FREE_MIB must be a positive decimal integer from 1 to 999999." >&2
  exit 1
fi

mkdir -p logs

if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required to serialize deployments" >&2
  exit 1
fi
exec 9>logs/deploy.lock
flock -n 9 || { echo "Another deployment is active; refusing overlap." >&2; exit 1; }

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not reachable for the current user" >&2
  exit 1
fi

# Check both actual filesystems before tree cleanup, image tagging/building,
# database preparation or service replacement. This is a minimum headroom
# guard, not a prediction of image/backup peak space or automatic cleanup.
if ! docker_storage_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null)" ||
   [[ "${docker_storage_root}" != /* || ! -d "${docker_storage_root}" ]]; then
  echo "Cannot resolve the Docker storage filesystem; previous services remain unchanged." >&2
  exit 1
fi
for storage_kind in source docker; do
  storage_path="${SERVER_DIR}"
  if [ "${storage_kind}" = docker ]; then storage_path="${docker_storage_root}"; fi
  if ! storage_report="$(LC_ALL=C df --output=avail --block-size=1024 -- "${storage_path}" 2>/dev/null)"; then
    echo "Cannot measure ${storage_kind} storage; previous services remain unchanged." >&2
    exit 1
  fi
  available_kib="$(printf '%s\n' "${storage_report}" | awk 'NR == 2 && NF == 1 { value = $1 } END { if (NR == 2) print value }')"
  if [[ ! "${available_kib}" =~ ^(0|[1-9][0-9]{0,17})$ ]]; then
    echo "Invalid ${storage_kind} storage measurement; previous services remain unchanged." >&2
    exit 1
  fi
  if (( available_kib < deploy_min_free_mib * 1024 )); then
    echo "Insufficient ${storage_kind} storage: $((available_kib / 1024)) MiB available; ${deploy_min_free_mib} MiB minimum. No build or service replacement performed." >&2
    exit 1
  fi
done

if [ "${CLEAN_SERVER_TREE:-false}" = "true" ] && git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Cleaning untracked files under server/ before build..."
  # Preserve the durable activity/character outboxes even if ignore rules change.
  git -C "${SERVER_DIR}" clean -fd -e logs/ -e .env
fi

bash ./deploy/pin_previous_image.sh

echo "Building api image..."
docker compose build api

if [ "${EIDOLON_MONITOR_ENABLED:-false}" = true ]; then
  echo "Building and locally validating the approved independent monitor..."
  docker compose --profile operations build monitor
  docker compose --profile operations run --rm --no-deps -T \
    -e EIDOLON_MONITOR_CHECK_CONFIG=true monitor
fi

# Leave an existing database container and the live API untouched during preflight.
# On a fresh installation this starts only Mongo and waits for its health check.
echo "Preparing database for read-only compatibility check..."
docker compose up -d --no-recreate --wait mongo
echo "Checking target server compatibility before replacing the live API..."
schema_preflight="$(docker compose run --rm --no-deps -T api --check-schema --mongo-uri="${MONGO_URI}")"
printf '%s\n' "${schema_preflight}"
# Only the target binary's complete single-line receipt may authorize stopping
# the old writer. Reject a stale/wrong image, surrounding noise or unsafe numeric
# values before backup or replacement; startup's fence remains independently required.
schema_contract='^Schema preflight passed: database=(0|[1-9][0-9]{0,5}) supported=([1-9][0-9]{0,5}) commit=([A-Za-z0-9._-]{7,80})$'
if [[ ! "${schema_preflight}" =~ ${schema_contract} ]]; then
  echo "Target preflight did not report a valid schema contract." >&2
  exit 1
fi
database_schema="${BASH_REMATCH[1]}"
target_schema="${BASH_REMATCH[2]}"
preflight_commit="${BASH_REMATCH[3]}"
if [ "${preflight_commit}" != "${EIDOLON_BUILD_COMMIT}" ]; then
  echo "Target preflight release identity does not match the requested build; leaving the previous API unchanged." >&2
  exit 1
fi
if (( database_schema > target_schema )); then
  echo "Target preflight cannot support the current database schema; leaving the previous API unchanged." >&2
  exit 1
fi
if (( database_schema < target_schema )); then
  # Schema23 requires account-bound pending saves. Keep the exact old container
  # available until its drained, read-only journal check succeeds. Never infer
  # ownership from today's username lookup or delete a rejected legacy record.
  journal_previous_api=""
  journal_previous_running=false
  if (( target_schema >= 23 )); then
    journal_previous_api="$(docker compose ps -a -q api)"
    if [ -n "${journal_previous_api}" ]; then
      if [[ ! "${journal_previous_api}" =~ ^[a-f0-9]{12,64}$ ]]; then
        echo "Cannot resolve one previous API for the journal transition; leaving it unchanged." >&2
        exit 1
      fi
      journal_previous_running="$(docker inspect --format '{{.State.Running}}' "${journal_previous_api}")"
      if [ "${journal_previous_running}" != true ] && [ "${journal_previous_running}" != false ]; then
        echo "Cannot determine previous API state; leaving it unchanged." >&2
        exit 1
      fi
    fi
  fi
  echo "Save-format upgrade ${database_schema} -> ${target_schema}: preserving a consistent recovery point..."
  bash ./deploy/backup_before_upgrade.sh
  if (( target_schema >= 23 )); then
    echo "Checking drained account-bound character journals before target startup..."
    if ! journal_preflight="$(docker compose run --rm --no-deps -T -v "${SERVER_DIR}/logs:/app/logs:ro" api --check-save-journal --save-journal-dir=/app/logs/character-saves)" || \
       [ "${journal_preflight}" != "Character journal preflight passed: supported=2 commit=${EIDOLON_BUILD_COMMIT}" ]; then
      echo "Journal transition refused before migration; backup and pending files preserved." >&2
      if [ "${journal_previous_running}" = true ]; then
        docker start "${journal_previous_api}" >/dev/null || echo "Previous API restart failed; operator recovery is required." >&2
      fi
      exit 1
    fi
    printf '%s\n' "${journal_preflight}"
  fi
fi

echo "Starting stack..."
docker compose up -d

echo "Current compose status:"
docker compose ps

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Deployed repo HEAD: $(git -C "${REPO_ROOT}" rev-parse HEAD)"
fi

echo "Recent api logs:"
docker compose logs --tail=100 api

if docker compose logs --tail=200 api | grep -Ei "mongo|auth|connect|failed" >/dev/null 2>&1; then
  echo "Warning: detected possible Mongo-related messages in api logs. Review output above."
fi

HOST_PORT="${APP_HOST_PORT:-18082}"
HEALTH_URL="http://127.0.0.1:${HOST_PORT}/healthz"
echo "Waiting for healthy release ${EIDOLON_BUILD_COMMIT} at ${HEALTH_URL} ..."
health_json=""
for attempt in $(seq 1 30); do
  if health_json="$(curl --connect-timeout 2 --max-time 5 -fsS "${HEALTH_URL}" 2>/dev/null)" && \
     printf '%s' "${health_json}" | grep -Fq "\"commit\":\"${EIDOLON_BUILD_COMMIT}\"" && \
     printf '%s' "${health_json}" | grep -Fq '"database":"ready"'; then
    break
  fi
  if [ "${attempt}" -eq 30 ]; then
    echo "Server health/release verification failed: ${health_json}" >&2
    exit 1
  fi
  sleep 2
done
echo "Verified server health: ${health_json}"

if [ "${EIDOLON_MONITOR_ENABLED:-false}" = true ]; then
  echo "Starting the approved independent monitor..."
  docker compose --profile operations up -d --no-deps monitor
fi

echo "Deployment complete. Server release identity and database readiness verified."
