#!/usr/bin/env bash
set -euo pipefail
umask 077

# Called after target preflight, before its migrations can run. This script never
# restores data or removes a backup. The caller must serialize deployments.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SERVER_DIR}"

for required_command in docker gzip sha256sum mktemp sync; do
  command -v "${required_command}" >/dev/null || exit 1
done

backup_root="${SERVER_DIR}/backups"
if [ -L "${backup_root}" ]; then
  echo "Refusing a symlinked upgrade-backup directory." >&2
  exit 1
fi
mkdir -p "${backup_root}"
chmod 700 "${backup_root}"
backup_dir="$(mktemp -d "${backup_root}/save-upgrade-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"

api_id="$(docker compose ps -a -q api)"
if [[ "${api_id}" == *$'\n'* ]] || { [ -n "${api_id}" ] && [[ ! "${api_id}" =~ ^[a-f0-9]{12,64}$ ]]; }; then
  echo "Upgrade backup requires at most one authoritative API container." >&2
  exit 1
fi
api_was_running=false
backup_complete=false
recover_previous_api() {
  local backup_exit=$?
  if [ "${backup_exit}" -ne 0 ] && [ "${api_was_running}" = true ] && [ "${backup_complete}" = false ]; then
    echo "Backup failed before migration; restarting the unchanged previous API." >&2
    docker start "${api_id}" >/dev/null || echo "Previous API restart failed; operator recovery is required." >&2
  fi
  if [ "${backup_exit}" -ne 0 ]; then
    echo "Incomplete backup retained at ${backup_dir}; it is not a restore point." >&2
  fi
}
trap recover_previous_api EXIT

if [ -n "${api_id}" ]; then
  api_was_running="$(docker inspect --format '{{.State.Running}}' "${api_id}")"
  if [ "${api_was_running}" != true ] && [ "${api_was_running}" != false ]; then
    echo "Cannot determine whether the previous API is running." >&2
    exit 1
  fi
  previous_image="$(docker inspect --format '{{.Image}}' "${api_id}")"
  if [[ ! "${previous_image}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo "Cannot resolve the previous immutable server image." >&2
    exit 1
  fi
  printf '%s\n' "${previous_image}" > "${backup_dir}/previous-image-id.txt"
  docker compose stop --timeout 60 api
  if [ "$(docker inspect --format '{{.State.Running}}' "${api_id}")" != false ]; then
    echo "Previous API did not stop; refusing an inconsistent backup." >&2
    exit 1
  fi
  docker image save "${previous_image}" | gzip > "${backup_dir}/previous-api.tar.gz"
else
  printf '%s\n' 'No prior API container; no previous server image is available.' > "${backup_dir}/previous-image-id.txt"
fi

# Mongo remains running but no game writer may be active. Credentials expand only
# within the existing Mongo container; do not echo them or store its full config.
docker compose exec -T mongo sh -c 'exec mongodump --archive --gzip --db=eidolon --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > "${backup_dir}/mongo.archive.gz"

if [ -L "${SERVER_DIR}/logs" ]; then
  echo "Refusing a symlinked journal/log directory." >&2
  exit 1
fi
mkdir -p "${SERVER_DIR}/logs"
# The runtime journal is private to the container UID. Read it through a narrowly
# scoped read-only mount; host-user permissions must not silently omit it.
docker run --rm --network none --read-only --user 0 \
  --mount "type=bind,source=${SERVER_DIR}/logs,target=/source,readonly" \
  --entrypoint tar mongo:7.0.14 -C /source -czf - . > "${backup_dir}/logs.tar.gz"

gzip -t "${backup_dir}/mongo.archive.gz" "${backup_dir}/logs.tar.gz"
if [ -f "${backup_dir}/previous-api.tar.gz" ]; then
  gzip -t "${backup_dir}/previous-api.tar.gz"
fi
(
  cd "${backup_dir}"
  sha256sum mongo.archive.gz logs.tar.gz previous-image-id.txt > SHA256SUMS
  if [ -f previous-api.tar.gz ]; then sha256sum previous-api.tar.gz >> SHA256SUMS; fi
  sha256sum --check SHA256SUMS
)
sync -f "${backup_dir}"
printf 'target_commit=%s\ncreated_utc=%s\n' "${EIDOLON_BUILD_COMMIT:-unknown}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${backup_dir}/COMPLETE"
sync -f "${backup_dir}/COMPLETE"
backup_complete=true
echo "Consistent pre-upgrade backup: ${backup_dir}"
echo "Previous API remains stopped; the caller may now start the compatible target."
