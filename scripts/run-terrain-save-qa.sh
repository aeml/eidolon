#!/usr/bin/env bash
set -euo pipefail

# A focused compatibility check, never the production Compose/database/env.
readonly terrain_mongo_port="${EIDOLON_TERRAIN_SAVE_QA_PORT:-18189}"
readonly terrain_scenario="${EIDOLON_TERRAIN_SAVE_QA_SCENARIO:-world}"
case "${terrain_scenario}" in
  world) terrain_test='^TestTerrainActualSavedSessionsAcrossProfileChanges$'; terrain_timeout=120s ;;
  connected-party) terrain_test='^TestTerrainActualEquippedBrowserParty$'; terrain_timeout=300s ;;
  connected-party-observer) terrain_test='^TestTerrainActualEquippedBrowserParty$'; terrain_timeout=300s ;;
  *) echo "Terrain save QA scenario must be world, connected-party or connected-party-observer." >&2; exit 1 ;;
esac
readonly terrain_test terrain_timeout
if [[ "${terrain_scenario}" == connected-party* ]]; then
  if ! [[ "${EIDOLON_TERRAIN_BROWSER_NODE:-}" == /* ]] || ! [[ -x "${EIDOLON_TERRAIN_BROWSER_NODE:-}" ]]; then
    echo "Connected party QA requires an explicit absolute executable Node path." >&2
    exit 1
  fi
  if ! [[ "${EIDOLON_TERRAIN_PARTY_QUALITY:-}" == high || "${EIDOLON_TERRAIN_PARTY_QUALITY:-}" == low ]]; then
    echo "Connected party QA requires explicit high or low quality." >&2
    exit 1
  fi
  if ss -ltn | grep -Eq ':4190[[:space:]]'; then
    echo "Connected party QA web port4190 is occupied; refusing reuse." >&2
    exit 1
  fi
fi
if ! [[ "${terrain_mongo_port}" =~ ^[0-9]+$ ]] || (( terrain_mongo_port < 1024 || terrain_mongo_port > 65535 )); then
  echo "Terrain save QA requires an unprivileged loopback port." >&2
  exit 1
fi
if ss -ltn | grep -Eq ":${terrain_mongo_port}[[:space:]]"; then
  echo "Terrain save QA port is already occupied; refusing to reuse it." >&2
  exit 1
fi
readonly terrain_run_id="$(openssl rand -hex 6)"
readonly terrain_container="eidolon-terrain-save-qa-${terrain_run_id}"
readonly terrain_evidence_base="${EIDOLON_TERRAIN_SAVE_EVIDENCE_ROOT:-${XDG_DATA_HOME:-${HOME}/.local/share}}"
mkdir -p "${terrain_evidence_base}"
readonly terrain_evidence="$(mktemp -d "${terrain_evidence_base}/eidolon-terrain-save-evidence-XXXXXXXX")"
readonly terrain_binary_name="terrain-save-${terrain_run_id}"
readonly terrain_binary="${terrain_evidence}/${terrain_binary_name}"
terrain_created=false
cleanup_terrain_save_qa() {
  if [[ "${terrain_created}" == true ]]; then
    docker container rm --force --volumes "${terrain_container}" >/dev/null
  fi
}
trap cleanup_terrain_save_qa EXIT
if docker container inspect "${terrain_container}" >/dev/null 2>&1; then
  echo "Refusing to reuse an existing fixture container." >&2
  exit 1
fi
echo "Terrain save evidence: ${terrain_evidence}"
echo "Terrain save source: $(git rev-parse HEAD) (current working tree)"
echo "Terrain save scenario: ${terrain_scenario}"
GOTOOLCHAIN=go1.27.2 GOMAXPROCS=2 go -C server build -race \
  -ldflags="-X main.buildCommit=${terrain_binary_name}" -o "${terrain_binary}" .
# No authentication-bearing production URI is read. Only synthetic saves exist
# in this disposable database; Docker publishes its port on loopback only.
docker run -d --name "${terrain_container}" -p "127.0.0.1:${terrain_mongo_port}:27017" \
  mongo:7.0.14 --bind_ip_all >/dev/null
terrain_created=true
for attempt in $(seq 1 60); do
  if docker exec "${terrain_container}" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -qx 1; then
    break
  fi
  if [[ "${attempt}" == 60 ]]; then
    echo "Owned disposable Mongo did not become ready." >&2
    exit 1
  fi
  sleep 1
done
EIDOLON_RESOURCE_DISPOSABLE_DATABASE=1 \
EIDOLON_RESOURCE_MONGO_URI="mongodb://127.0.0.1:${terrain_mongo_port}" \
EIDOLON_RESOURCE_BINARY="${terrain_binary}" \
EIDOLON_TERRAIN_BROWSER_EVIDENCE="${terrain_evidence}" \
EIDOLON_TERRAIN_PARTY_RENDER_MODE="$([[ "${terrain_scenario}" == connected-party-observer ]] && echo single-renderer || echo four-browser)" \
GOTOOLCHAIN=go1.27.2 GOMAXPROCS=2 \
  go -C server test -race -p 2 -count=1 -timeout="${terrain_timeout}" -v \
    -run "${terrain_test}" . \
    2>&1 | tee "${terrain_evidence}/terrain-save.log"
echo "Terrain profile save check passed; only its disposable database is removed."
