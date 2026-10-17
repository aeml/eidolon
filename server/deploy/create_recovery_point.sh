#!/usr/bin/env bash
set -euo pipefail
umask 077

# Explicit standalone snapshot: briefly stop only the same API if it was
# running, verify the new coordinated recovery set, then restore that state.
if [ "$#" -ne 0 ]; then
  echo "Usage: $0" >&2
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SERVER_DIR}"
if [ ! -f .env ] || [ -L .env ]; then
  echo 'A regular operator-owned Compose environment is required.' >&2
  exit 1
fi
source "${SCRIPT_DIR}/operation_lock.sh"
acquire_eidolon_operation_lock "${SERVER_DIR}"
if [ -L backups ]; then
  echo 'Refusing a symlinked backup directory.' >&2
  exit 1
fi
api_id="$(docker compose ps -a -q api)"
if [ -n "${api_id}" ] && [[ ! "${api_id}" =~ ^[a-f0-9]{12,64}$ ]]; then
  echo 'Standalone recovery requires at most one authoritative API container.' >&2
  exit 1
fi
api_was_running=false
previous_image=''
if [ -n "${api_id}" ]; then
  original_state="$(docker inspect --format '{{.State.Status}} {{.State.Running}}' "${api_id}")"
  case "${original_state}" in
    'running true') api_was_running=true ;;
    'exited false'|'created false') api_was_running=false ;;
    *) echo 'Standalone recovery requires an ordinary running or stopped API; refusing a paused, transitional or unknown state.' >&2; exit 1 ;;
  esac
  previous_image="$(docker inspect --format '{{.Image}}' "${api_id}")"
  if [[ ! "${previous_image}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo 'Cannot establish the original immutable API image.' >&2
    exit 1
  fi
fi
restore_attempted=false
restore_succeeded=false
restore_previous_api() {
  local current_image current_state
  if [ "${api_was_running}" != true ]; then return 0; fi
  if [ "${restore_attempted}" = true ]; then [ "${restore_succeeded}" = true ]; return; fi
  restore_attempted=true
  current_image="$(docker inspect --format '{{.Image}}' "${api_id}")" || return 1
  if [ "${current_image}" != "${previous_image}" ]; then return 1; fi
  current_state="$(docker inspect --format '{{.State.Status}} {{.State.Running}}' "${api_id}")" || return 1
  case "${current_state}" in
    'running true') ;;
    'exited false'|'created false')
      docker start "${api_id}" >/dev/null || return 1
      current_state="$(docker inspect --format '{{.State.Status}} {{.State.Running}}' "${api_id}")" || return 1 ;;
    *) return 1 ;;
  esac
  if [ "${current_state}" != 'running true' ]; then return 1; fi
  restore_succeeded=true
}
finish_recovery_creation() {
  local status=$?
  trap - EXIT
  set +e
  if ! restore_previous_api; then
    echo 'Original API restart failed; retain recovery files and restore its availability explicitly.' >&2
    status=1
  fi
  exit "${status}"
}
trap finish_recovery_creation EXIT

# Identify only the point created by this invocation while holding the lock;
# never choose an old point by date, filesystem order or newest-name guessing.
shopt -s nullglob
before=("${SERVER_DIR}"/backups/save-upgrade-*)
bash "${SCRIPT_DIR}/backup_before_upgrade.sh"
created=()
for candidate in "${SERVER_DIR}"/backups/save-upgrade-*; do
  existed=false
  for previous in "${before[@]}"; do
    if [ "${candidate}" = "${previous}" ]; then existed=true; break; fi
  done
  if [ "${existed}" = false ]; then created+=("${candidate}"); fi
done
if [ "${#created[@]}" -ne 1 ] || [ -L "${created[0]}" ] || [ ! -d "${created[0]}" ]; then
  echo 'Cannot identify exactly one newly created recovery point; files retained without a success receipt.' >&2
  exit 1
fi
if ! bash "${SCRIPT_DIR}/verify_upgrade_backup.sh" "${created[0]}"; then
  rm -f -- "${created[0]}/COMPLETE"
  echo 'New recovery point failed verification; partial files retained.' >&2
  exit 1
fi
restore_previous_api || exit 1
trap - EXIT
printf 'Verified standalone recovery point: %s\n' "${created[0]}"
echo 'Original API container running state is preserved; check service readiness separately.'
