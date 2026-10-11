#!/usr/bin/env bash
set -euo pipefail

# Read-only integrity check, not a restore, authenticity proof or permission to
# reopen a writer. Only inspect the exact completed point selected by an operator.
if [ "$#" -ne 1 ] || [ ! -d "$1" ] || [ -L "$1" ]; then
  echo "Usage: $0 /exact/completed-upgrade-backup-directory" >&2
  exit 1
fi
for tool in sha256sum gzip; do
  command -v "${tool}" >/dev/null || exit 1
done
cd -- "$1"
for name in COMPLETE SHA256SUMS mongo.archive.gz logs.tar.gz previous-image-id.txt; do
  if [ -L "${name}" ] || [ ! -f "${name}" ] || [ ! -r "${name}" ] || [ ! -s "${name}" ]; then
    echo "Incomplete or unsafe backup artifact: ${name}" >&2
    exit 1
  fi
done

# Never pass arbitrary checksum-manifest paths to sha256sum. Reject absolute,
# traversal, escaped, duplicate or extra filenames before reading archive bytes.
declare -A listed=()
while IFS= read -r line || [ -n "${line}" ]; do
  if [[ ! "${line}" =~ ^[a-f0-9]{64}\ \ (mongo\.archive\.gz|logs\.tar\.gz|previous-image-id\.txt|previous-api\.tar\.gz)$ ]]; then
    echo "Invalid or unexpected backup checksum entry." >&2
    exit 1
  fi
  name="${BASH_REMATCH[1]}"
  if [ -n "${listed[${name}]:-}" ] || [ -L "${name}" ] || [ ! -f "${name}" ] || [ ! -r "${name}" ]; then
    echo "Duplicate, missing or unsafe checksum artifact: ${name}" >&2
    exit 1
  fi
  listed["${name}"]=1
done < SHA256SUMS
for name in mongo.archive.gz logs.tar.gz previous-image-id.txt; do
  if [ -z "${listed[${name}]:-}" ]; then
    echo "Missing required backup checksum: ${name}" >&2
    exit 1
  fi
done
image_id="$(< previous-image-id.txt)"
if [[ "${image_id}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  if [ -z "${listed[previous-api.tar.gz]:-}" ]; then
    echo "Recorded previous server image archive is missing." >&2
    exit 1
  fi
elif [ "${image_id}" = 'No prior API container; no previous server image is available.' ]; then
  if [ -n "${listed[previous-api.tar.gz]:-}" ]; then
    echo "Unexpected server image in a fresh-install backup." >&2
    exit 1
  fi
else
  echo "Invalid previous server image identity." >&2
  exit 1
fi
if [ -e previous-api.tar.gz ] || [ -L previous-api.tar.gz ]; then
  if [ -z "${listed[previous-api.tar.gz]:-}" ]; then
    echo "Previous server image is not covered by the checksum manifest." >&2
    exit 1
  fi
fi
sha256sum --check --strict --quiet SHA256SUMS
gzip -t -- mongo.archive.gz logs.tar.gz
if [ -n "${listed[previous-api.tar.gz]:-}" ]; then
  gzip -t -- previous-api.tar.gz
fi
echo "Completed backup archive integrity verified (read-only)."
echo "Checksums detect corruption, not authenticity. Review the matching schema, server image, journals and privacy scope before separately approved recovery."
