#!/usr/bin/env bash

# Source from the isolated QA runner. Labels are public, fixed identifiers;
# never print command arguments or environment values (they can contain secrets).
# As with the existing && chain, wrapped shell functions must propagate failures
# explicitly. External commands retain their exact exit status.
run_qa_stage() {
  if [[ "$#" -lt 2 || ! "$1" =~ ^[a-z0-9][a-z0-9_-]{0,63}$ ]]; then
    echo 'QA timing requires a safe stage identifier and a command.' >&2
    return 2
  fi
  local qa_stage_label="$1"
  shift
  local qa_stage_started="$SECONDS"
  local qa_stage_status=0
  printf '[qa-stage] {"stage":"%s","event":"start"}\n' "$qa_stage_label"
  if "$@"; then
    qa_stage_status=0
  else
    qa_stage_status=$?
  fi
  printf '\n[qa-stage] {"stage":"%s","event":"end","status":%s,"seconds":%s}\n' \
    "$qa_stage_label" "$qa_stage_status" "$((SECONDS - qa_stage_started))"
  return "$qa_stage_status"
}
