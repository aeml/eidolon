#!/usr/bin/env bash
set -euo pipefail
umask 077

# Explicit operator-selected transfer only. No scheduling, automatic backup
# selection, retention changes, remote restore or production service operation.
if { [ "$#" -ne 4 ] && [ "$#" -ne 5 ]; } ||
   [[ ! "$2" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*@([A-Za-z0-9][A-Za-z0-9.-]*|\[[A-Fa-f0-9:]+\])$ ]] ||
   [[ "$3" != /* || "$3" == *$'\n'* || "$3" == *$'\r'* ]]; then
  echo "Usage: $0 /exact/completed-point user@host /private/destination-root /pinned/known_hosts [port]" >&2
  exit 1
fi
port="${5:-22}"
if [[ ! "${port}" =~ ^[0-9]{1,5}$ ]] || [ "$((10#${port}))" -lt 1 ] || [ "$((10#${port}))" -gt 65535 ]; then
  echo 'Invalid SSH port.' >&2
  exit 1
fi
for tool in ssh tar sha256sum realpath bash; do
  command -v "${tool}" >/dev/null || exit 1
done
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/verify_upgrade_backup.sh" "$1"
source_dir="$(realpath --canonicalize-existing -- "$1")"
point="$(basename -- "${source_dir}")"
if [[ ! "${point}" =~ ^save-upgrade-[A-Za-z0-9_-]+$ ]]; then
  echo 'Transfer requires a named save-upgrade recovery point.' >&2
  exit 1
fi
known_hosts="$(realpath --canonicalize-existing --no-symlinks -- "$4")"
if [ -L "$4" ] || [ ! -f "${known_hosts}" ] || [ ! -s "${known_hosts}" ] || [ ! -r "${known_hosts}" ] ||
   [ "${known_hosts}" != "$(realpath --canonicalize-existing -- "$4")" ]; then
  echo 'An explicit regular pinned known-hosts file is required, without symlink traversal.' >&2
  exit 1
fi
# Hash stdin so escaped filenames cannot become part of the digest protocol.
manifest_sha="$(sha256sum < "${source_dir}/SHA256SUMS")"; manifest_sha="${manifest_sha%% *}"
marker_sha="$(sha256sum < "${source_dir}/COMPLETE")"; marker_sha="${marker_sha%% *}"
verifier_sha="$(sha256sum < "${SCRIPT_DIR}/verify_upgrade_backup.sh")"; verifier_sha="${verifier_sha%% *}"
kind=fresh
artifacts=(mongo.archive.gz logs.tar.gz previous-image-id.txt)
if [ -f "${source_dir}/previous-api.tar.gz" ]; then kind=image; artifacts+=(previous-api.tar.gz); fi
# OpenSSH joins remote argv into a shell command. Quote each value for that
# shell; local array quoting alone would not preserve spaces or literal '$()'.
quote_remote() { printf "'%s'" "${1//\'/\'\\\'\'}"; }
remote="bash -c $(quote_remote "$(< "${SCRIPT_DIR}/receive_upgrade_backup.sh")") --"
for value in "$3" "${point}" "${manifest_sha}" "${marker_sha}" "${verifier_sha}" "${kind}"; do
  remote+=" $(quote_remote "${value}")"
done
ssh_options=(-F /dev/null -T -p "${port}" -o BatchMode=yes -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=${known_hosts}" -o GlobalKnownHostsFile=/dev/null
  -o UpdateHostKeys=no -o ClearAllForwardings=yes -o ControlMaster=no -o ControlPath=none
  -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o LogLevel=ERROR)
tar --create --file=- --transform='s,^COMPLETE$,COMPLETE.pending,' \
  --directory="${source_dir}" "${artifacts[@]}" SHA256SUMS COMPLETE \
  --directory="${SCRIPT_DIR}" verify_upgrade_backup.sh |
  ssh "${ssh_options[@]}" -- "$2" "${remote}"
