#!/usr/bin/env bash
set -euo pipefail

# A new worktree may share node_modules without running npm's postinstall.
# Fail before creating disposable services if the browser imports would be 404s.
for runtime_file in vendor/manifest.json vendor/three/build/three.module.js vendor/protobuf/protobuf.min.js; do
  if [[ ! -f "${runtime_file}" ]]; then
    echo "Missing browser runtime ${runtime_file}; run npm run prepare:client first." >&2
    exit 1
  fi
done

readonly QA_RUN_ID="${EIDOLON_ISOLATED_QA_RUN_ID:-$(openssl rand -hex 5)}"
readonly MONGO_CONTAINER="eidolon-isolated-qa-mongo-${QA_RUN_ID}"
readonly API_CONTAINER="eidolon-isolated-qa-api-${QA_RUN_ID}"
readonly QA_NETWORK="eidolon-isolated-qa-net-${QA_RUN_ID}"
readonly QA_PORT="${EIDOLON_ISOLATED_QA_PORT:-18185}"
readonly SERVER_IMAGE="eidolon-server:isolated-qa-${QA_RUN_ID}"
qa_default_network_mode=bridge
if [[ "$(uname -s)" == Linux ]]; then
  qa_default_network_mode=host
fi
readonly QA_NETWORK_MODE="${EIDOLON_ISOLATED_QA_NETWORK_MODE:-${qa_default_network_mode}}"
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
qa_allowlist="${QA_USERNAME_BASE},${QA_USERNAME_BASE}-healing,${QA_USERNAME_BASE}-economy,${QA_USERNAME_BASE}-legacy,${QA_USERNAME_BASE}-recovery,${QA_USERNAME_BASE}-spin,${QA_USERNAME_BASE}-phone,${QA_USERNAME_BASE}-phone-combat,${QA_USERNAME_BASE}-phone-bag,${QA_USERNAME_BASE}-phone-quests,${QA_USERNAME_BASE}-phone-build,${QA_USERNAME_BASE}-phone-settings,${QA_USERNAME_BASE}-phone-adventure,${QA_USERNAME_BASE}-fighter,${QA_USERNAME_BASE}-rogue,${QA_USERNAME_BASE}-wizard,${QA_USERNAME_BASE}-cleric"

qa_allowlist+=",${QA_USERNAME_BASE}-death-resources"
qa_allowlist+=",${QA_USERNAME_BASE}-socket-owner,${QA_USERNAME_BASE}-socket-observer"
qa_allowlist+=",${QA_USERNAME_BASE}-rest-transitions-death,${QA_USERNAME_BASE}-rest-transitions-dungeon"
qa_allowlist+=",${QA_USERNAME_BASE}-duration,${QA_USERNAME_BASE}-forge,${QA_USERNAME_BASE}-whip,${QA_USERNAME_BASE}-ground"
qa_allowlist+=",${QA_USERNAME_BASE}-ground-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-cleanse"
qa_allowlist+=",${QA_USERNAME_BASE}-cleanse-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-roar-area"
qa_allowlist+=",${QA_USERNAME_BASE}-spin-area"
qa_allowlist+=",${QA_USERNAME_BASE}-economy-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-guardian"
qa_allowlist+=",${QA_USERNAME_BASE}-holy"
qa_allowlist+=",${QA_USERNAME_BASE}-support-area"
qa_allowlist+=",${QA_USERNAME_BASE}-spirit-area"
qa_allowlist+=",${QA_USERNAME_BASE}-phone-party,${QA_USERNAME_BASE}-phone-party-ally"
qa_allowlist+=",${QA_USERNAME_BASE}-desktop-support,${QA_USERNAME_BASE}-desktop-support-ally"
qa_allowlist+=",${QA_USERNAME_BASE}-critical-rogue,${QA_USERNAME_BASE}-critical-wizard,${QA_USERNAME_BASE}-critical-fighter"
qa_allowlist+=",${QA_USERNAME_BASE}-healing-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-status-lunge,${QA_USERNAME_BASE}-status-serrated,${QA_USERNAME_BASE}-status-poison"
qa_allowlist+=",${QA_USERNAME_BASE}-seraph,${QA_USERNAME_BASE}-seraph-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-shield,${QA_USERNAME_BASE}-shield-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-sight,${QA_USERNAME_BASE}-sight-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-retry1,${QA_USERNAME_BASE}-first-grove,${QA_USERNAME_BASE}-first-grove-retry1"
qa_allowlist+=",${QA_USERNAME_BASE}-baseline-fighter,${QA_USERNAME_BASE}-baseline-rogue,${QA_USERNAME_BASE}-baseline-wizard,${QA_USERNAME_BASE}-baseline-cleric"

mongo_username="qa_root"
mongo_password="$(openssl rand -hex 24)"

docker build \
  --build-arg GO_VERSION=1.24.5 \
  --build-arg "BUILD_COMMIT=${qa_build_commit}" \
  --build-arg "BUILD_VERSION=Alpha 1.0.62" \
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

run_phone_party() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-party" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Cleric" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/phone-party-gameplay.spec.js
}

run_phone_inventory() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-bag" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-inventory-gameplay.spec.js tests/e2e/phone-stash-entry.spec.js
}

run_desktop_support() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-desktop-support" EIDOLON_E2E_CLASS=Cleric \
    EIDOLON_E2E_REGISTER=1 EIDOLON_E2E_DESKTOP_SUPPORT=1 \
    npx playwright test --retries=0 --output=test-results/desktop-support tests/e2e/desktop-party-support.spec.js
}

run_party_support() {
  run_phone_party && run_desktop_support
}

run_equipment_recovery() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-legacy" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_LEGACY_MONGO_CONTAINER="${MONGO_CONTAINER}" EIDOLON_E2E_LEGACY_MONGO_PORT="${mongo_port}" \
    npx playwright test tests/e2e/equipment-recovery-gameplay.spec.js
}

run_forge_guide() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-forge" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_FORGE_MONGO_CONTAINER="${MONGO_CONTAINER}" EIDOLON_E2E_FORGE_MONGO_PORT="${mongo_port}" \
    npx playwright test tests/e2e/forge-guide-gameplay.spec.js "$@"
}

run_forge_socket_appearance() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-socket-owner" \
    EIDOLON_E2E_USERNAME_SECONDARY="${QA_USERNAME_BASE}-socket-observer" EIDOLON_E2E_PASSWORD_SECONDARY="${QA_PASSWORD}" \
    EIDOLON_E2E_SOCKET_MONGO_CONTAINER="${MONGO_CONTAINER}" EIDOLON_E2E_SOCKET_MONGO_PORT="${mongo_port}" \
    npx playwright test --retries=0 --output=test-results/forge-socket-appearance tests/e2e/forge-socket-appearance.spec.js
}

run_talent_economy() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-economy" EIDOLON_E2E_CLASS=Wizard \
    npx playwright test tests/e2e/talent-economy-gameplay.spec.js "$@"
}

run_talent_healing() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-healing" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/talent-healing-gameplay.spec.js "$@"
}

run_talent_critical() {
  local class_name
  for class_name in ${EIDOLON_CRITICAL_QA_CLASS:-Rogue Wizard Fighter}; do
    case "${class_name}" in Rogue|Wizard|Fighter) ;; *) echo "Unsupported critical QA class" >&2; return 1 ;; esac
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-critical-$(printf '%s' "${class_name}" | tr '[:upper:]' '[:lower:]')" \
      EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" EIDOLON_E2E_CLASS="${class_name}" \
      npx playwright test tests/e2e/talent-critical-gameplay.spec.js || return $?
  done
}

run_talent_status() {
  local status_skill
  for status_skill in ${EIDOLON_STATUS_QA_SKILL:-lunge serrated poison}; do
    case "${status_skill}" in lunge|serrated|poison) ;; *) echo "Unsupported status QA skill" >&2; return 1 ;; esac
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-status-${status_skill}" EIDOLON_E2E_CLASS=Rogue \
      EIDOLON_STATUS_QA_SKILL="${status_skill}" npx playwright test tests/e2e/talent-status-gameplay.spec.js || return $?
  done
}

run_seraph() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-seraph" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/seraph-gameplay.spec.js
}

run_shield_training() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-shield" EIDOLON_E2E_CLASS=Wizard \
    npx playwright test tests/e2e/shield-training-gameplay.spec.js
}

run_fresh_collection() {
  local fresh_class="${EIDOLON_E2E_FRESH_CLASS:-Wizard}"
  case "${fresh_class}" in
    Wizard|Fighter|Rogue|Cleric) ;;
    *) echo "EIDOLON_E2E_FRESH_CLASS must be Wizard, Fighter, Rogue or Cleric." >&2; return 1 ;;
  esac
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-first-grove" EIDOLON_E2E_CLASS="${fresh_class}" \
    EIDOLON_E2E_FRESH_COLLECTION=1 npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
}

run_entrance_visibility() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-sight" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_SCENERY_VISIBILITY=1 npx playwright test tests/e2e/shield-training-gameplay.spec.js
}

run_purifying_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-cleanse" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/purifying-area-gameplay.spec.js "$@"
}

run_guardian_roar_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-roar-area" EIDOLON_E2E_CLASS=Fighter \
    npx playwright test tests/e2e/guardian-roar-area-gameplay.spec.js
}

run_executioner_spin_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-spin-area" EIDOLON_E2E_CLASS=Fighter \
    npx playwright test tests/e2e/executioner-spin-area-gameplay.spec.js
}

run_guardian_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-guardian" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/guardian-area-gameplay.spec.js
}

run_consecrated_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-holy" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/consecrated-area-gameplay.spec.js
}

run_cleric_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-support-area" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/cleric-immediate-area-gameplay.spec.js
}

run_cleric_final_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-support-area" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/cleric-final-area-gameplay.spec.js
}

run_spirit_area() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-spirit-area" EIDOLON_E2E_CLASS=Cleric \
    npx playwright test tests/e2e/spirit-area-gameplay.spec.js
}

run_talent_duration() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-duration" EIDOLON_E2E_CLASS=Wizard \
    npx playwright test tests/e2e/talent-duration-gameplay.spec.js
}

run_whip_shape() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-whip" EIDOLON_E2E_CLASS=Wizard \
    npx playwright test tests/e2e/flame-whip-gameplay.spec.js
}

run_ground_shape() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-ground" EIDOLON_E2E_CLASS=Wizard EIDOLON_E2E_GROUND_TALENTS=1 \
    npx playwright test tests/e2e/dungeon-ground-area-gameplay.spec.js
}

run_phone_quests() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-quests" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-quest-gameplay.spec.js
}

run_phone_build() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-build" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-skills-gameplay.spec.js
}

run_phone_settings() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-settings" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-settings-gameplay.spec.js
}

run_phone_adventure() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-phone-adventure" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="Fighter" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/mobile-adventure-gameplay.spec.js
}

run_dungeon_recovery() {
  # A separate new actor has no earlier waypoint protection or combat buffs.
  local recovery_class="${EIDOLON_RECOVERY_QA_CLASS:-Wizard}"
  case "$recovery_class" in Wizard|Rogue|Fighter|Cleric) ;; *) echo "Unsupported recovery QA class" >&2; return 1 ;; esac
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-recovery" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="$recovery_class" \
    EIDOLON_E2E_REGISTER=1 \
    npx playwright test tests/e2e/dungeon-wipe-recovery-gameplay.spec.js
}

run_death_resource_recovery() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-death-resources" EIDOLON_E2E_CLASS=Wizard \
    npx playwright test tests/e2e/death-resource-recovery-gameplay.spec.js
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

run_pvp_cadence() {
  npx playwright test tests/e2e/pvp-cadence-gameplay.spec.js
}

run_initial_stats() {
  EIDOLON_E2E_INITIAL_STAT_PARITY=1 npx playwright test --retries=0 --output=test-results/initial-stat-parity tests/e2e/initial-stat-parity.spec.js
}

run_well_rested_transitions() {
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-rest-transitions" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_REGISTER=1 npx playwright test --output=test-results/well-rested-transitions \
      tests/e2e/well-rested-transitions-gameplay.spec.js --retries=0
}

run_well_rested() {
  # Separate ordinary registrations: never reuse a progressed gate character.
  # The expiry test appends its own -expiry suffix to the first base name.
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-rest" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_REGISTER=1 npx playwright test --output=test-results/well-rested-journey tests/e2e/well-rested-gameplay.spec.js \
      tests/e2e/well-rested-expiry-gameplay.spec.js || return $?
  EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-rest-party" EIDOLON_E2E_CLASS=Wizard \
    EIDOLON_E2E_REGISTER=1 npx playwright test --output=test-results/well-rested-party tests/e2e/well-rested-party-gameplay.spec.js || return $?
  run_well_rested_transitions
}

set +e
case "${EIDOLON_ISOLATED_QA_ROUTE:-all}" in
  initial-stats)
    run_initial_stats
    ;;
  desktop-support)
    run_desktop_support
    ;;
  phone-stash-entry)
    npx playwright test tests/e2e/phone-stash-entry.spec.js
    ;;
  all)
    run_initial_stats && npm run test:e2e:authenticated && npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js tests/e2e/inventory-quality-of-life.spec.js tests/e2e/dungeon-projectile-wall-gameplay.spec.js tests/e2e/dungeon-movement-wall-gameplay.spec.js tests/e2e/dungeon-ground-area-gameplay.spec.js tests/e2e/dungeon-beam-gameplay.spec.js && run_whip_shape && run_ground_shape && run_purifying_area && run_guardian_roar_area && run_executioner_spin_area && run_guardian_area && run_consecrated_area && run_cleric_area && run_spirit_area && run_whirlwind && run_phone && run_phone_combat && run_party_support && run_phone_inventory && run_equipment_recovery && run_forge_guide && run_fresh_collection && run_talent_economy && run_talent_healing && run_talent_duration && run_seraph && run_shield_training && run_entrance_visibility && run_phone_quests && run_phone_build && run_phone_settings && run_phone_adventure && run_dungeon_recovery && run_death_resource_recovery && run_direct_target_classes && npm run test:e2e:movement && run_pvp_cadence && run_animation_classes && run_animation_multiplayer && npx playwright test tests/e2e/nameplate-world.spec.js && run_well_rested && run_forge_socket_appearance
    ;;
  animations)
    run_animation_classes
    ;;
  multiplayer)
    run_animation_multiplayer
    ;;
  forge-socket-appearance)
    run_forge_socket_appearance
    ;;
  pvp-cadence)
    run_pvp_cadence
    ;;
  recovery-tail)
    # Focused rehearsal of the unchanged full gate's remaining suffix. This
    # does not replace a complete all-route acceptance run.
    run_pvp_cadence && run_animation_classes && run_animation_multiplayer && npx playwright test tests/e2e/nameplate-world.spec.js && run_well_rested && run_forge_socket_appearance
    ;;
  movement-fast)
    EIDOLON_E2E_MOVEMENT_MAX_LEVEL=1 npx playwright test tests/e2e/movement-smoothness.spec.js
    ;;
  movement)
    npm run test:e2e:movement
    ;;
  death-resources)
    run_death_resource_recovery
    ;;
  well-rested-transitions)
    run_well_rested_transitions
    ;;
  smoke)
    npx playwright test tests/e2e/authenticated.spec.js --grep "logs in, enters the world"
    ;;
  quests)
    npx playwright test tests/e2e/quest-conversation-gameplay.spec.js
    ;;
  equipment-recovery)
    run_equipment_recovery
    ;;
  equipment-upgrades)
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-upgrades" EIDOLON_E2E_CLASS=Wizard \
      EIDOLON_E2E_UPGRADES_MONGO_CONTAINER="${MONGO_CONTAINER}" EIDOLON_E2E_UPGRADES_MONGO_PORT="${mongo_port}" \
      npx playwright test tests/e2e/earned-equipment-upgrades.spec.js --retries=0 --repeat-each=3
    ;;
  equipment-refresh)
    EIDOLON_E2E_USERNAME="${QA_USERNAME_BASE}-upgrades" EIDOLON_E2E_CLASS=Wizard \
      EIDOLON_E2E_UPGRADES_MONGO_CONTAINER="${MONGO_CONTAINER}" EIDOLON_E2E_UPGRADES_MONGO_PORT="${mongo_port}" \
      npx playwright test tests/e2e/earned-equipment-upgrades.spec.js --retries=0 --repeat-each=3 --output=test-results/equipment-upgrades &&
      run_forge_guide --output=test-results/forge-guide
    ;;
  forge-guide)
    run_forge_guide
    ;;
  talent-economy)
    run_talent_economy
    ;;
  talent-economy-retry)
    EIDOLON_E2E_ECONOMY_RETRY_PROBE=1 run_talent_economy --retries=1
    ;;
  talent-healing)
    run_talent_healing
    ;;
  talent-critical)
    run_talent_critical
    ;;
  talent-status)
    run_talent_status
    ;;
  seraph)
    run_seraph
    ;;
  shield-training)
    run_shield_training
    ;;
  entrance-visibility)
    run_entrance_visibility
    ;;
  talent-healing-retry)
    EIDOLON_E2E_HEALING_RETRY_PROBE=1 run_talent_healing --retries=1
    ;;
  purifying-area)
    run_purifying_area
    ;;
  guardian-roar-area)
    run_guardian_roar_area
    ;;
  executioner-spin-area)
    run_executioner_spin_area
    ;;
  purifying-area-retry)
    EIDOLON_E2E_PURIFYING_RETRY_PROBE=1 run_purifying_area --retries=1
    ;;
  guardian-area)
    run_guardian_area
    ;;
  consecrated-area)
    run_consecrated_area
    ;;
  cleric-area)
    run_cleric_area
    ;;
  cleric-final-area)
    run_cleric_final_area
    ;;
  spirit-area)
    run_spirit_area
    ;;
  talent-duration)
    run_talent_duration
    ;;
  time-warp-area)
    EIDOLON_E2E_CLASS=Wizard npx playwright test --retries=0 tests/e2e/time-warp-area-gameplay.spec.js
    ;;
  inventory)
    npx playwright test tests/e2e/inventory-quality-of-life.spec.js
    ;;
  extended)
    npx playwright test tests/e2e/authenticated.spec.js --grep "kills and loots"
    ;;
  loot-acquisition-repeat)
    npx playwright test tests/e2e/authenticated.spec.js --grep "kills and loots" --repeat-each=3
    ;;
  portal)
    EIDOLON_E2E_PORTAL_ONLY=1 npx playwright test tests/e2e/authenticated.spec.js --grep "allowlisted QA waypoint"
    ;;
  dungeons)
    npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  dungeon-inputs)
    # Exact opening dungeon batch from all; diagnostic only, never a substitute.
    npx playwright test tests/e2e/regional-dungeon-gameplay.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js tests/e2e/inventory-quality-of-life.spec.js tests/e2e/dungeon-projectile-wall-gameplay.spec.js tests/e2e/dungeon-movement-wall-gameplay.spec.js tests/e2e/dungeon-ground-area-gameplay.spec.js tests/e2e/dungeon-beam-gameplay.spec.js
    ;;
  verdant)
    npx playwright test tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  party-guide-reentry)
    EIDOLON_E2E_PARTY_GUIDE=1 EIDOLON_E2E_CLASS=Fighter \
      npx playwright test --retries=0 tests/e2e/party-guide-reentry.spec.js
    ;;
  prepared-dungeon-fixture)
    npx playwright test tests/e2e/prepared-dungeon-fixture.spec.js tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  dungeon-full)
    EIDOLON_E2E_FULL_DUNGEON=1 npx playwright test tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  chronicle-earth)
    EIDOLON_E2E_CHRONICLE_EARTH=1 EIDOLON_E2E_FULL_DUNGEON=1 EIDOLON_E2E_DUNGEON=verdant_bastion_catacombs \
      npx playwright test tests/e2e/verdant-dungeon-gameplay.spec.js
    ;;
  chronicle-collection)
    npx playwright test tests/e2e/chronicle-collection-gameplay.spec.js
    ;;
  fresh-opening)
    npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
    ;;
  nameplate-world)
    npx playwright test tests/e2e/nameplate-world.spec.js
    ;;
  fresh-collection)
    run_fresh_collection
    ;;
  fresh-collection-no-rest)
    EIDOLON_E2E_REST_RECOVERY=0 run_fresh_collection
    ;;
  fresh-collection-prepared)
    EIDOLON_E2E_PREPARED_COLLECTION=1 run_fresh_collection
    ;;
  fresh-hunt)
    EIDOLON_E2E_FRESH_COLLECTION=1 EIDOLON_E2E_FRESH_HUNT=1 npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
    ;;
  well-rested)
    npx playwright test tests/e2e/well-rested-gameplay.spec.js
    ;;
  well-rested-all)
    run_well_rested
    ;;
  live-recovery-rehearsal)
    EIDOLON_E2E_BASE_URL="http://127.0.0.1:${EIDOLON_E2E_WEB_PORT:-4173}" \
      EIDOLON_EXPECTED_COMMIT="${QA_SOURCE_COMMIT}" bash scripts/run-live-recovery-qa.sh
    ;;
  well-rested-expiry)
    npx playwright test tests/e2e/well-rested-expiry-gameplay.spec.js
    ;;
  fresh-rested-collection)
    EIDOLON_E2E_FRESH_COLLECTION=1 EIDOLON_E2E_REST_RECOVERY=1 npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
    ;;
  well-rested-party)
    npx playwright test tests/e2e/well-rested-party-gameplay.spec.js
    ;;
  fresh-hunt-npc)
    npx playwright test tests/e2e/fresh-hunt-npc.spec.js
    ;;
  fresh-ready)
    EIDOLON_E2E_FRESH_COLLECTION=1 EIDOLON_E2E_FRESH_HUNT=1 EIDOLON_E2E_FRESH_READY=1 \
      npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
    ;;
  fresh-dungeon)
    EIDOLON_E2E_FRESH_COLLECTION=1 EIDOLON_E2E_FRESH_HUNT=1 EIDOLON_E2E_FRESH_READY=1 \
      EIDOLON_E2E_FRESH_DUNGEON=1 npx playwright test tests/e2e/fresh-opening-gameplay.spec.js
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
  movement-walls-sequence)
    npm run test:e2e:authenticated && npx playwright test tests/e2e/dungeon-beam-gameplay.spec.js tests/e2e/dungeon-ground-area-gameplay.spec.js tests/e2e/dungeon-movement-wall-gameplay.spec.js
    ;;
  waypoint-chat-focus)
    npx playwright test tests/e2e/waypoint-chat-focus.spec.js
    ;;
  ground-walls)
    npx playwright test tests/e2e/dungeon-ground-area-gameplay.spec.js
    ;;
  beam-walls)
    npx playwright test tests/e2e/dungeon-beam-gameplay.spec.js
    ;;
  whip-shape)
    run_whip_shape
    ;;
  ground-shape)
    run_ground_shape
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
  phone-party)
    run_phone_party
    ;;
  phone-inventory)
    run_phone_inventory
    ;;
  phone-quests)
    run_phone_quests
    ;;
  phone-build)
    run_phone_build
    ;;
  phone-settings)
    run_phone_settings
    ;;
  phone-adventure)
    run_phone_adventure
    ;;
  *)
    echo "Earned rest, real travel/combat and reconnect verification: EIDOLON_ISOLATED_QA_ROUTE=well-rested" >&2
    echo "Earned rest through prepared hostile death and dungeon transitions: EIDOLON_ISOLATED_QA_ROUTE=well-rested-transitions" >&2
    echo "Trained ground-spell geometry verification: EIDOLON_ISOLATED_QA_ROUTE=ground-shape" >&2
    echo "Trained cleanse-area verification: EIDOLON_ISOLATED_QA_ROUTE=purifying-area" >&2
    echo "Trained Guardian Roar verification: EIDOLON_ISOLATED_QA_ROUTE=guardian-roar-area" >&2
    echo "Trained Executioner Spin verification: EIDOLON_ISOLATED_QA_ROUTE=executioner-spin-area" >&2
    echo "Trained persistent support-area verification: EIDOLON_ISOLATED_QA_ROUTE=guardian-area" >&2
    echo "Trained holy-zone verification: EIDOLON_ISOLATED_QA_ROUTE=consecrated-area" >&2
    echo "Critical training/persistence verification: EIDOLON_ISOLATED_QA_ROUTE=talent-critical" >&2
    echo "Status Mastery tick/persistence verification: EIDOLON_ISOLATED_QA_ROUTE=talent-status" >&2
    echo "Seraph training, lifetime and transition verification: EIDOLON_ISOLATED_QA_ROUTE=seraph" >&2
    echo "Shield mastery, expiry and actual absorption verification: EIDOLON_ISOLATED_QA_ROUTE=shield-training" >&2
    echo "Entrance cutaway and normal combat verification: EIDOLON_ISOLATED_QA_ROUTE=entrance-visibility" >&2
    echo "Trained Blessing/Trumpet verification: EIDOLON_ISOLATED_QA_ROUTE=cleric-area" >&2
    echo "Trained cone/Beacon/Mass Revival verification: EIDOLON_ISOLATED_QA_ROUTE=cleric-final-area" >&2
    echo "Trained Spirit Guardians verification: EIDOLON_ISOLATED_QA_ROUTE=spirit-area" >&2
    echo "Forge/material refresh and guide verification: EIDOLON_ISOLATED_QA_ROUTE=forge-guide" >&2
    echo "EIDOLON_ISOLATED_QA_ROUTE must be all, animations, multiplayer, movement, smoke, quests, inventory, equipment-recovery, talent-economy, talent-healing, talent-duration, extended, portal, dungeons, verdant, dungeon-full, chronicle-earth, chronicle-collection, fresh-opening, fresh-collection, fresh-hunt, fresh-hunt-npc, fresh-ready, fresh-dungeon, dungeon-recovery, direct-skills, projectile-walls, movement-walls, ground-walls, beam-walls, whip-shape, whirlwind, phone, phone-combat, phone-party, phone-inventory, phone-quests, phone-build, phone-settings, or phone-adventure." >&2
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
