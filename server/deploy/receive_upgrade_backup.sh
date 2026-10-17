#!/usr/bin/env bash
set -euo pipefail
umask 077

# Private SSH receiver for copy_upgrade_backup.sh. stdin is a fixed-file tar
# stream, not arbitrary commands or a database restore. Never prune recovery sets.
if [ "$#" -ne 6 ] || [[ "$1" != /* || "$1" == *$'\n'* || "$1" == *$'\r'* ]] ||
   [[ ! "$2" =~ ^save-upgrade-[A-Za-z0-9_-]+$ ]] ||
   [[ ! "$3" =~ ^[a-f0-9]{64}$ || ! "$4" =~ ^[a-f0-9]{64}$ || ! "$5" =~ ^[a-f0-9]{64}$ ]] ||
   { [ "$6" != image ] && [ "$6" != fresh ]; }; then
  echo 'Invalid backup transfer metadata.' >&2
  exit 1
fi
for tool in realpath stat id mktemp tar sha256sum gzip mv rm sync; do
  command -v "${tool}" >/dev/null || exit 1
done
root="$(realpath --canonicalize-existing --no-symlinks -- "$1")"
if [ ! -d "${root}" ] || [ "${root}" != "$(realpath --canonicalize-existing -- "$1")" ] ||
   [ "$(stat -c '%a:%u' -- "${root}")" != "700:$(id -u)" ]; then
  echo 'Backup destination must be an existing private directory owned by the receiving user, without symlink traversal.' >&2
  exit 1
fi
point="$2"
final="${root}/${point}"
if [ -e "${final}" ] || [ -L "${final}" ]; then
  echo 'This recovery point already exists at the destination; refusing replacement.' >&2
  exit 1
fi
stage="$(mktemp -d -- "${root}/.eidolon-receive-${point}-XXXXXX")"
marker_directory="${stage}"
published=false
finish() {
  if [ "${published}" != true ]; then
    # Only remove our own publication marker; keep partial bytes for inspection.
    rm -f -- "${marker_directory}/COMPLETE"
    echo 'Transfer incomplete; private files retained without a completion receipt.' >&2
  fi
}
trap finish EXIT
artifacts=(mongo.archive.gz logs.tar.gz previous-image-id.txt)
if [ "$6" = image ]; then artifacts+=(previous-api.tar.gz); fi
tar --extract --file=- --directory="${stage}" --no-same-owner --no-same-permissions --keep-old-files -- \
  "${artifacts[@]}" SHA256SUMS COMPLETE.pending verify_upgrade_backup.sh
for name in "${artifacts[@]}" SHA256SUMS COMPLETE.pending verify_upgrade_backup.sh; do
  if [ -L "${stage}/${name}" ] || [ ! -f "${stage}/${name}" ] || [ ! -r "${stage}/${name}" ]; then
    echo 'Transfer contains a missing or unsafe artifact.' >&2
    exit 1
  fi
done
cd -- "${stage}"
printf '%s  SHA256SUMS\n%s  COMPLETE.pending\n%s  verify_upgrade_backup.sh\n' "$3" "$4" "$5" |
  sha256sum --check --strict --quiet -
bash ./verify_upgrade_backup.sh "${stage}" --pending-transfer
rm -- verify_upgrade_backup.sh
# Flush only this point's files/directories, not unrelated services' filesystem.
# All payload bytes must be durable before the completion marker is promoted.
sync -- "${artifacts[@]}" SHA256SUMS COMPLETE.pending "${stage}"
mv -- COMPLETE.pending COMPLETE
sync -- "${stage}"
# Never overwrite a point published by another transfer after our preflight.
mv --no-clobber --no-target-directory -- "${stage}" "${final}"
if [ -e "${stage}" ]; then
  echo 'Another transfer published this recovery point first; refusing replacement.' >&2
  exit 1
fi
marker_directory="${final}"
sync -- "${root}"
published=true
printf 'Remote recovery point verified and published: %s\n' "${point}"
