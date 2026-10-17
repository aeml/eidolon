#!/usr/bin/env bash

# Shared with deploy_linux.sh's existing fd9/ logs/deploy.lock protocol.
# A nested backup reuses the inherited open file description, not a second lock.
acquire_eidolon_operation_lock() {
  local server_root="$1" lock_path inherited old_mask tool
  for tool in flock realpath readlink; do
    command -v "${tool}" >/dev/null || return 1
  done
  if [ -L "${server_root}/logs" ] || [ -L "${server_root}/logs/deploy.lock" ] ||
     { [ -e "${server_root}/logs/deploy.lock" ] && [ ! -f "${server_root}/logs/deploy.lock" ]; }; then
    echo 'Operation lock requires a regular log directory and lock file, without symlinks.' >&2
    return 1
  fi
  old_mask="$(umask)"
  umask 077
  mkdir -p -- "${server_root}/logs"
  lock_path="$(realpath --canonicalize-missing -- "${server_root}/logs/deploy.lock")"
  inherited="$(readlink "/proc/$$/fd/9" 2>/dev/null || true)"
  if [ "${inherited}" != "${lock_path}" ]; then
    exec 9>>"${lock_path}"
  fi
  umask "${old_mask}"
  flock -n 9 || { echo 'Another deployment or recovery operation is active; refusing overlap.' >&2; return 1; }
}
