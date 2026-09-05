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
EIDOLON_BUILD_VERSION="${EIDOLON_BUILD_VERSION:-Alpha 1.0.1}"
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

mkdir -p logs

if [ "${CLEAN_SERVER_TREE:-false}" = "true" ] && git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Cleaning untracked files under server/ before build..."
  git -C "${SERVER_DIR}" clean -fd
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not reachable for the current user" >&2
  exit 1
fi

echo "Building api image..."
docker compose build api

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
  if health_json="$(curl -fsS "${HEALTH_URL}" 2>/dev/null)" && \
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

echo "Deployment complete. Server release identity and database readiness verified."
