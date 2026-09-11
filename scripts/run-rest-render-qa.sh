#!/usr/bin/env bash
set -euo pipefail

# A sibling root survives later Playwright invocations clearing test-results/.
# JSON retains attached measurements; line reporting leaves the gallery HTML intact.
export PLAYWRIGHT_JSON_OUTPUT_FILE="${PWD}/rest-render-results/results.json"
finish_rest_render_qa() {
  local render_status=$?
  trap - EXIT
  if ! node scripts/sanitize-playwright-artifacts.mjs rest-render-results; then
    exit 1
  fi
  exit "${render_status}"
}
trap finish_rest_render_qa EXIT

npx --no-install playwright test \
  tests/e2e/well-rested-batching.spec.js \
  tests/e2e/well-rested-populated-render.spec.js \
  tests/e2e/well-rested-gpu-lifecycle.spec.js \
  --retries=0 --reporter=line,json --output=rest-render-results
