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
touch bug_reports.json

if [ "${CLEAN_SERVER_TREE:-false}" = "true" ] && git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Cleaning untracked files under server/ before build..."
  git -C "${SERVER_DIR}" clean -fd
fi

if command -v systemctl >/dev/null 2>&1; then
  echo "Ensuring docker starts on reboot..."
  sudo systemctl enable docker
  sudo systemctl restart docker
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
echo "Checking local upstream endpoint on http://127.0.0.1:${HOST_PORT}/ ..."
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:${HOST_PORT}/"

echo "Deployment baseline complete. Continue with nginx + certbot setup next."
