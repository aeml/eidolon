#!/usr/bin/env bash

# Called before generated fixture credentials leave the wrapper's environment.
# Exact JSON files remain files: never scan their unrelated parent directory.
sanitize_isolated_qa_evidence() {
    local roots=(playwright-report test-results)
    local argument output= awaiting_output=false
    if [[ -n "${PLAYWRIGHT_HTML_OUTPUT_DIR:-}" ]]; then roots+=("${PLAYWRIGHT_HTML_OUTPUT_DIR}"); fi
    if [[ -n "${PLAYWRIGHT_JSON_OUTPUT_FILE:-}" ]]; then roots+=("${PLAYWRIGHT_JSON_OUTPUT_FILE}"); fi
    for argument in "$@"; do
        if [[ "$awaiting_output" == true ]]; then
            output=$argument
            awaiting_output=false
        elif [[ "$argument" == --output ]]; then
            awaiting_output=true
        elif [[ "$argument" == --output=* ]]; then
            output=${argument#--output=}
        fi
    done
    if [[ "$awaiting_output" == true ]]; then
        echo 'Missing isolated QA output directory.' >&2
        return 2
    fi
    # Playwright uses the last repeated output option.
    if [[ -n "$output" ]]; then roots+=("$output"); fi
    node "${BASH_SOURCE[0]%/*}/sanitize-playwright-artifacts.mjs" "${roots[@]}"
}
