#!/usr/bin/env bash
set -euo pipefail

: "${EIDOLON_E2E_USERNAME:?Set the dedicated production QA username base}"
: "${EIDOLON_E2E_PASSWORD:?Set the dedicated production QA password}"
: "${EIDOLON_E2E_BASE_URL:?Set the deployed client URL}"
: "${EIDOLON_E2E_WS_URL:?Set the deployed WebSocket URL}"

readonly QA_USERNAME_BASE="${EIDOLON_E2E_USERNAME}"
readonly QA_PASSWORD="${EIDOLON_E2E_PASSWORD}"
readonly QA_CLASSES=(Fighter Rogue Wizard Cleric)

if ! [[ "${QA_USERNAME_BASE}" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "The production QA username base contains unsupported characters." >&2
  exit 1
fi
if [ "${#QA_USERNAME_BASE}" -gt 30 ]; then
  echo "The production QA username base must be at most 30 characters for class suffixes." >&2
  exit 1
fi

export EIDOLON_E2E_REGISTER=1
export EIDOLON_E2E_FULL_GAMEPLAY=1

animation_username() {
  local class_name="$1"
  local class_suffix
  class_suffix="$(printf '%s' "${class_name:0:1}" | tr '[:upper:]' '[:lower:]')"
  printf '%s-%s' "${QA_USERNAME_BASE}" "${class_suffix}"
}

for class_name in "${QA_CLASSES[@]}"; do
  echo "Running live real-input ${class_name} animation matrix."
  EIDOLON_E2E_USERNAME="$(animation_username "${class_name}")" \
    EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
    EIDOLON_E2E_CLASS="${class_name}" \
    npx playwright test tests/e2e/animation-gameplay.spec.js
done

echo "Running live Cleric/Wizard remote-animation matrix."
EIDOLON_E2E_USERNAME="$(animation_username Cleric)" \
  EIDOLON_E2E_PASSWORD="${QA_PASSWORD}" \
  EIDOLON_E2E_CLASS="Cleric" \
  EIDOLON_E2E_USERNAME_SECONDARY="$(animation_username Wizard)" \
  EIDOLON_E2E_PASSWORD_SECONDARY="${QA_PASSWORD}" \
  EIDOLON_E2E_CLASS_SECONDARY="Wizard" \
  npx playwright test tests/e2e/multiplayer.spec.js

echo "Live four-class and remote-animation QA passed."
