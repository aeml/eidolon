#!/usr/bin/env bash
set -euo pipefail

# Run only after the workflow has verified matching client/runtime/server SHAs.
# These are ordinary fresh registrations, never administrator/QA-granted actors.
: "${EIDOLON_E2E_USERNAME:?Set the dedicated production QA username base}"
: "${EIDOLON_E2E_PASSWORD:?Set the dedicated production QA password}"
: "${EIDOLON_E2E_BASE_URL:?Set the deployed client URL}"
: "${EIDOLON_E2E_WS_URL:?Set the deployed WebSocket URL}"
: "${EIDOLON_EXPECTED_COMMIT:?Set the verified deployed commit}"
if ! [[ "${EIDOLON_E2E_USERNAME}" =~ ^[A-Za-z0-9_.-]+$ ]] ||
   ! [[ "${EIDOLON_EXPECTED_COMMIT}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Recovery QA requires a safe dedicated username base and exact release SHA." >&2
  exit 2
fi

# A new invocation must not inherit an earlier character's levels or two-hour
# rest bank. Six base characters + marker + 48 random bits leaves room for the
# longest '-party-ally' suffix within 32 characters. No existing account deletion.
recovery_token="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(6).toString("hex"))')"
export EIDOLON_E2E_USERNAME="${EIDOLON_E2E_USERNAME:0:6}-r-${recovery_token}"
readonly recovery_username="${EIDOLON_E2E_USERNAME}"
export EIDOLON_E2E_REGISTER=1
export EIDOLON_E2E_CLASS=Wizard

finish_recovery_qa() {
  local recovery_status=$?
  trap - EXIT
  # The root username redacts every generated suffix; password stays in env.
  if ! node scripts/sanitize-playwright-artifacts.mjs \
      test-results/live-rest-journey test-results/live-rest-party; then
    exit 1
  fi
  if [ "${recovery_status}" -eq 0 ]; then
    echo "Live town recovery and Well Rested QA passed."
  fi
  exit "${recovery_status}"
}
trap finish_recovery_qa EXIT

echo "Checking live town recovery, earned rest, natural expiry and reconnect."
# Explicit screenshots survive in separate roots; line reporting preserves the
# preceding live animation HTML report. Do not retry a no-longer-fresh character.
npx --no-install playwright test tests/e2e/well-rested-gameplay.spec.js \
  tests/e2e/well-rested-expiry-gameplay.spec.js \
  --retries=0 --reporter=line --output=test-results/live-rest-journey

echo "Checking live two-player rested auras and phone status at High/Low quality."
EIDOLON_E2E_USERNAME="${recovery_username}-party" \
  npx --no-install playwright test tests/e2e/well-rested-party-gameplay.spec.js \
  --retries=0 --reporter=line --output=test-results/live-rest-party
