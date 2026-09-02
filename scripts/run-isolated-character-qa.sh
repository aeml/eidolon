#!/usr/bin/env bash
set -euo pipefail

readonly QA_RUN_ID="${EIDOLON_ISOLATED_QA_RUN_ID:-$(openssl rand -hex 5)}"
readonly MONGO_CONTAINER="eidolon-isolated-qa-mongo-${QA_RUN_ID}"
readonly API_CONTAINER="eidolon-isolated-qa-api-${QA_RUN_ID}"
readonly QA_NETWORK="eidolon-isolated-qa-net-${QA_RUN_ID}"
readonly QA_PORT="${EIDOLON_ISOLATED_QA_PORT:-18085}"
readonly SERVER_IMAGE="eidolon-server:isolated-qa-${QA_RUN_ID}"

network_created=false
mongo_created=false
api_created=false
image_created=false

cleanup_isolated_qa() {
  if [ "${api_created}" = true ]; then
    docker container rm --force "${API_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [ "${mongo_created}" = true ]; then
    docker container rm --force --volumes "${MONGO_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [ "${network_created}" = true ]; then
    docker network rm "${QA_NETWORK}" >/dev/null 2>&1 || true
  fi
  if [ "${image_created}" = true ]; then
    docker image rm "${SERVER_IMAGE}" >/dev/null 2>&1 || true
  fi
}

if ! [[ "${QA_PORT}" =~ ^[0-9]+$ ]] || [ "${QA_PORT}" -lt 1024 ] || [ "${QA_PORT}" -gt 65535 ]; then
  echo "EIDOLON_ISOLATED_QA_PORT must be an unprivileged TCP port." >&2
  exit 1
fi
if ! [[ "${QA_RUN_ID}" =~ ^[a-z0-9][a-z0-9_.-]{0,30}$ ]]; then
  echo "EIDOLON_ISOLATED_QA_RUN_ID must be a short lowercase Docker-name suffix." >&2
  exit 1
fi

for container in "${MONGO_CONTAINER}" "${API_CONTAINER}"; do
  if docker container inspect "${container}" >/dev/null 2>&1; then
    echo "Refusing to replace existing container ${container}." >&2
    exit 1
  fi
done
if docker network inspect "${QA_NETWORK}" >/dev/null 2>&1; then
  echo "Refusing to replace existing network ${QA_NETWORK}." >&2
  exit 1
fi
if docker image inspect "${SERVER_IMAGE}" >/dev/null 2>&1; then
  echo "Refusing to replace existing image ${SERVER_IMAGE}." >&2
  exit 1
fi
if ss -ltn | grep -Eq ":${QA_PORT}[[:space:]]"; then
  echo "Port ${QA_PORT} is already in use." >&2
  exit 1
fi
trap cleanup_isolated_qa EXIT INT TERM

export EIDOLON_E2E_WS_URL="ws://127.0.0.1:${QA_PORT}/ws"
export EIDOLON_E2E_USERNAME="codexqa$(openssl rand -hex 6)"
export EIDOLON_E2E_PASSWORD="$(openssl rand -hex 24)"
export EIDOLON_E2E_CLASS="${EIDOLON_E2E_CLASS:-Wizard}"
export EIDOLON_E2E_FULL_GAMEPLAY=1
export EIDOLON_E2E_REGISTER=1
export EIDOLON_E2E_REUSE_SERVER=0

readonly QA_USERNAME_BASE="${EIDOLON_E2E_USERNAME}"
readonly QA_PASSWORD="${EIDOLON_E2E_PASSWORD}"
if [ -n "${EIDOLON_ANIMATION_QA_CLASS:-}" ]; then
  readonly QA_ANIMATION_CLASSES=("${EIDOLON_ANIMATION_QA_CLASS}")
else
  readonly QA_ANIMATION_CLASSES=(Fighter Rogue Wizard Cleric)
fi
qa_animation_usernames=()
for class_name in "${QA_ANIMATION_CLASSES[@]}"; do
  qa_animation_usernames+=("${QA_USERNAME_BASE}-$(printf '%s' "${class_name}" | tr '[:upper:]' '[:lower:]')")
done
qa_allowlist="${QA_USERNAME_BASE},$(IFS=,; printf '%s' "${qa_animation_usernames[*]}")"

mongo_username="qa_root"
mongo_password="$(openssl rand -hex 24)"

docker build \
  --build-arg GO_VERSION=1.24.5 \
  --build-arg BUILD_COMMIT=isolated-qa \
  --build-arg "BUILD_VERSION=Alpha 0.41.0.17" \
  --tag "${SERVER_IMAGE}" server >/dev/null
image_created=true

docker network create "${QA_NETWORK}" >/dev/null
network_created=true
docker run -d --name "${MONGO_CONTAINER}" --network "${QA_NETWORK}" --network-alias mongo \
  -e MONGO_INITDB_ROOT_USERNAME="${mongo_username}" \
  -e MONGO_INITDB_ROOT_PASSWORD="${mongo_password}" \
  mongo:7.0.14 --auth --bind_ip_all >/dev/null
mongo_created=true

for attempt in $(seq 1 60); do
  if docker exec "${MONGO_CONTAINER}" mongosh \
    --username "${mongo_username}" --password "${mongo_password}" \
    --authenticationDatabase admin --quiet \
    --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -Eq '^1$'; then
    break
  fi
  if [ "${attempt}" -eq 60 ]; then
    echo "Isolated Mongo readiness timed out." >&2
    exit 1
  fi
  sleep 1
done

mongo_uri="mongodb://${mongo_username}:${mongo_password}@mongo:27017/eidolon?authSource=admin"
docker run -d --name "${API_CONTAINER}" --network "${QA_NETWORK}" \
  -p "127.0.0.1:${QA_PORT}:8080" "${SERVER_IMAGE}" \
  --addr=:8080 --mongo-uri="${mongo_uri}" \
  --qa-usernames="${qa_allowlist}" \
  --log-file= --log-stdout=false --suspicious-log-file= --suspicious-stdout=false >/dev/null
api_created=true

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${QA_PORT}/healthz" 2>/dev/null | grep -Fq '"database":"ready"'; then
    break
  fi
  if [ "${attempt}" -eq 60 ]; then
    echo "Isolated API readiness timed out." >&2
    exit 1
  fi
  sleep 1
done

echo "Isolated Mongo and API are ready."

run_animation_classes() {
  for class_name in "${QA_ANIMATION_CLASSES[@]}"; do
    class_slug="$(printf '%s' "${class_name}" | tr '[:upper:]' '[:lower:]')"
    echo "Running real-input ${class_name} animation matrix."
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-${class_slug}" \
      EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
      EIDOLON_E2E_CLASS="${class_name}" \
      EIDOLON_E2E_REGISTER=1 \
      npx playwright test tests/e2e/animation-gameplay.spec.js || return $?
  done
}

run_animation_multiplayer() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-cleric" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Cleric" \
    EIDOLON_E2E_USERNAME_SECONDARY="${QA_USERNAME_BASE}-wizard" \
    EIDOLON_E2E_PASSWORD_SECONDARY="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS_SECONDARY="Wizard" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/multiplayer.spec.js
}

set +e
case "${EIDOLON_ISOLATED_QA_ROUTE:-all}" in
  all)
    npm run test:e2e:authenticated && npm run test:e2e:movement && run_animation_classes && run_animation_multiplayer
    ;;
  animations)
    run_animation_classes
    ;;
  multiplayer)
    run_animation_multiplayer
    ;;
  movement)
    npm run test:e2e:movement
    ;;
  smoke)
    npx playwright test tests/e2e/authenticated.spec.js --grep "logs in, enters the world"
    ;;
  extended)
    npx playwright test tests/e2e/authenticated.spec.js --grep "kills and loots"
    ;;
  portal)
    EIDOLON_E2E_PORTAL_ONLY=1 npx playwright test tests/e2e/authenticated.spec.js --grep "allowlisted QA waypoint"
    ;;
  *)
    echo "EIDOLON_ISOLATED_QA_ROUTE must be all, animations, multiplayer, movement, smoke, extended, or portal." >&2
    exit 1
    ;;
esac
qa_status=$?
set -e

node scripts/sanitize-playwright-artifacts.mjs
if [ "${qa_status}" -ne 0 ]; then
  echo "Isolated character QA failed." >&2
  exit "${qa_status}"
fi

echo "Isolated character QA passed; temporary containers and data will be removed."
