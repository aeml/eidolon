#!/usr/bin/env bash
set -euo pipefail

readonly QA_RUN_ID="${EIDOLON_ISOLATED_QA_RUN_ID:-$(openssl rand -hex 5)}"
readonly MONGO_CONTAINER="eidolon-isolated-qa-mongo-${QA_RUN_ID}"
readonly API_CONTAINER="eidolon-isolated-qa-api-${QA_RUN_ID}"
readonly QA_NETWORK="eidolon-isolated-qa-net-${QA_RUN_ID}"
readonly QA_PORT="${EIDOLON_ISOLATED_QA_PORT:-18085}"
readonly SERVER_IMAGE="eidolon-server:isolated-qa-${QA_RUN_ID}"
readonly QA_NETWORK_MODE="${EIDOLON_ISOLATED_QA_NETWORK_MODE:-bridge}"
readonly QA_SOURCE_COMMIT="$(git rev-parse HEAD)"
export EIDOLON_E2E_SOURCE_COMMIT="${QA_SOURCE_COMMIT}"
export EIDOLON_E2E_SOURCE_DIRTY=0
if [[ -n "$(git status --porcelain)" ]]; then
  export EIDOLON_E2E_SOURCE_DIRTY=1
fi
qa_build_commit="${QA_SOURCE_COMMIT}"
if [[ "${EIDOLON_E2E_SOURCE_DIRTY}" == 1 ]]; then
  qa_build_commit+="-dirty"
fi

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

if [[ "${QA_NETWORK_MODE}" != bridge && "${QA_NETWORK_MODE}" != host ]]; then
  echo "EIDOLON_ISOLATED_QA_NETWORK_MODE must be bridge or host." >&2
  exit 1
fi
mongo_port=27017
mongo_host=mongo
mongo_network_args=(--network "${QA_NETWORK}" --network-alias mongo)
api_network_args=(--network "${QA_NETWORK}" -p "127.0.0.1:${QA_PORT}:8080")
api_addr=:8080
mongo_bind=--bind_ip_all
if [[ "${QA_NETWORK_MODE}" == host ]]; then
  # Linux-only local QA: no bridge/veth changes to disturb other Chrome jobs.
  # Both services still bind only to loopback, with disposable authenticated data.
  mongo_port=$((10#${QA_PORT} + 1))
  if [[ "${mongo_port}" -gt 65535 ]] || ss -ltn | grep -Eq ":${mongo_port}[[:space:]]"; then
    echo "The adjacent isolated Mongo port is invalid or already in use." >&2
    exit 1
  fi
  mongo_host=127.0.0.1
  mongo_network_args=(--network host)
  api_network_args=(--network host)
  api_addr="127.0.0.1:${QA_PORT}"
  mongo_bind=--bind_ip=127.0.0.1
fi

export EIDOLON_E2E_WS_URL="ws://127.0.0.1:${QA_PORT}/ws"
export EIDOLON_E2E_USERNAME="codexqa$(openssl rand -hex 6)"
export EIDOLON_E2E_PASSWORD="$(openssl rand -hex 24)"
export EIDOLON_E2E_CLASS="${EIDOLON_E2E_CLASS:-Wizard}"
export EIDOLON_E2E_FULL_GAMEPLAY=1
export EIDOLON_E2E_PORTAL_ONLY=1
export EIDOLON_E2E_REGISTER=1
export EIDOLON_E2E_REUSE_SERVER=0

readonly QA_USERNAME_BASE="${EIDOLON_E2E_USERNAME}"
readonly QA_PASSWORD="${EIDOLON_E2E_PASSWORD}"
if [ -n "${EIDOLON_ANIMATION_QA_CLASS:-}" ]; then
  readonly QA_ANIMATION_CLASSES=("${EIDOLON_ANIMATION_QA_CLASS}")
else
  readonly QA_ANIMATION_CLASSES=(Fighter Rogue Wizard Cleric)
fi
# Exact disposable actors used by the routes, including multiplayer/direct
# casts when the animation matrix is intentionally restricted to one class.
qa_allowlist="${QA_USERNAME_BASE},${QA_USERNAME_BASE}-recovery,${QA_USERNAME_BASE}-spin,${QA_USERNAME_BASE}-phone,${QA_USERNAME_BASE}-phone-combat,${QA_USERNAME_BASE}-fighter,${QA_USERNAME_BASE}-rogue,${QA_USERNAME_BASE}-wizard,${QA_USERNAME_BASE}-cleric"

mongo_username="qa_root"
mongo_password="$(openssl rand -hex 24)"

docker build \
  --build-arg GO_VERSION=1.24.5 \
  --build-arg "BUILD_COMMIT=${qa_build_commit}" \
  --build-arg "BUILD_VERSION=Alpha 1.0.17" \
  --tag "${SERVER_IMAGE}" server >/dev/null
image_created=true

if [[ "${QA_NETWORK_MODE}" == bridge ]]; then
  docker network create "${QA_NETWORK}" >/dev/null
  network_created=true
fi
docker run -d --name "${MONGO_CONTAINER}" "${mongo_network_args[@]}" \
  -e MONGO_INITDB_ROOT_USERNAME="${mongo_username}" \
  -e MONGO_INITDB_ROOT_PASSWORD="${mongo_password}" \
  mongo:7.0.14 --auth "${mongo_bind}" --port "${mongo_port}" >/dev/null
mongo_created=true

for attempt in $(seq 1 60); do
  if docker exec "${MONGO_CONTAINER}" mongosh \
    --port "${mongo_port}" \
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

mongo_uri="mongodb://${mongo_username}:${mongo_password}@${mongo_host}:${mongo_port}/eidolon?authSource=admin"
docker run -d --name "${API_CONTAINER}" "${api_network_args[@]}" "${SERVER_IMAGE}" \
  --addr="${api_addr}" --mongo-uri="${mongo_uri}" \
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

run_whirlwind() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-spin" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/dungeon-whirlwind-gameplay.spec.js
}

run_phone() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-gameplay.spec.js
}

run_phone_combat() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-combat" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Wizard" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-combat-gameplay.spec.js
}

run_dungeon_recovery() {
  # A separate new actor has no earlier waypoint protection or combat buffs.
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-recovery" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Wizard" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/dungeon-wipe-recovery-gameplay.spec.js
}

run_direct_target_classes() {
  for class_name in Rogue Cleric; do
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-$(printf '%s' "${class_name}" | tr '[:upper:]' '[:lower:]')" \
      EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
      EIDOLON_E2E_CLASS="${class_name}" \
      EIDOLON_E2E_REGISTER=1 \
      npx playwright test tests/e2e/direct-target-gameplay.spec.js || return $?
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
    npm run test:e2e:authenticated && npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js tests/e2e/inventory-quality-of-life.spec.js tests/e2e/dungeon-projectile-wall-gameplay.spec.js tests/e2e/dungeon-movement-wall-gameplay.spec.js tests/e2e/dungeon-ground-area-gameplay.spec.js tests/e2e/dungeon-beam-gameplay.spec.js && run_whirlwind && run_phone && run_phone_combat && run_dungeon_recovery && run_direct_target_classes && npm run test:e2e:movement && run_animation_classes && run_animation_multiplayer
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
  quests)
    npx playwright test tests/e2e/quest-conversation-gameplay.spec.js
    ;;
  inventory)
    npx playwright test tests/e2e/inventory-quality-of-life.spec.js
    ;;
  extended)
    npx playwright test tests/e2e/authenticated.spec.js --grep "kills and loots"
    ;;
  portal)
    EIDOLON_E2E_PORTAL_ONLY=1 npx playwright test tests/e2e/authenticated.spec.js --grep "allowlisted QA waypoint"
    ;;
  dungeons)
    npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  verdant)
    npx playwright test tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  dungeon-full)
    EIDOLON_E2E_FULL_DUNGEON=1 npx playwright test tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  dungeon-recovery)
    run_dungeon_recovery
    ;;
  direct-skills)
    run_direct_target_classes
    ;;
  projectile-walls)
    npx playwright test tests/e2e/dungeon-projectile-wall-gameplay.spec.js
    ;;
  movement-walls)
    npx playwright test tests/e2e/dungeon-movement-wall-gameplay.spec.js
    ;;
  ground-walls)
    npx playwright test tests/e2e/dungeon-ground-area-gameplay.spec.js
    ;;
  beam-walls)
    npx playwright test tests/e2e/dungeon-beam-gameplay.spec.js
    ;;
  whirlwind)
    run_whirlwind
    ;;
  phone)
    run_phone
    ;;
  phone-combat)
    run_phone_combat
    ;;
  *)
    echo "EIDOLON_ISOLATED_QA_ROUTE must be all, animations, multiplayer, movement, smoke, quests, inventory, extended, portal, dungeons, verdant, dungeon-full, dungeon-recovery, direct-skills, projectile-walls, movement-walls, ground-walls, beam-walls, whirlwind, phone, or phone-combat." >&2
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
