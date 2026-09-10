#!/usr/bin/env bash
set -euo pipefail

# Run under deploy_linux.sh's lock BEFORE build replaces the Compose image tag.
# A running container is not an image-retention reference in every Docker store.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."
previous_api_id="$(docker compose ps -a -q api)"
if [ -z "${previous_api_id}" ]; then
  echo "No previous API image to pin."
  exit 0
fi
if [[ ! "${previous_api_id}" =~ ^[a-f0-9]{12,64}$ ]]; then
  echo "Image retention requires exactly one authoritative API container." >&2
  exit 1
fi
previous_api_image="$(docker inspect --format '{{.Image}}' "${previous_api_id}")"
if [[ ! "${previous_api_image}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "Cannot resolve the previous immutable server image." >&2
  exit 1
fi
if ! docker image inspect "${previous_api_image}" >/dev/null 2>&1; then
  echo "Previous server image is unavailable; recover it before building or stopping the API." >&2
  exit 1
fi
rollback_tag="eidolon-api:rollback-${previous_api_image#sha256:}"
if existing_image="$(docker image inspect --format '{{.Id}}' "${rollback_tag}" 2>/dev/null)"; then
  if [ "${existing_image}" != "${previous_api_image}" ]; then
    echo "Rollback tag belongs to a different image; refusing to overwrite it." >&2
    exit 1
  fi
else
  docker image tag "${previous_api_image}" "${rollback_tag}"
fi
if [ "$(docker image inspect --format '{{.Id}}' "${rollback_tag}")" != "${previous_api_image}" ]; then
  echo "Previous server image pin did not preserve its exact identity." >&2
  exit 1
fi
echo "Retained previous server image: ${rollback_tag} (${previous_api_image})"
