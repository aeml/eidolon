#!/usr/bin/env bash
set -euo pipefail

runner_dir="${EIDOLON_ACTIONS_RUNNER_DIR:-/home/aeml/.local/share/eidolon-actions-runner}"
session_name="eidolon-actions-runner"

if [[ ! -x "${runner_dir}/run.sh" || ! -f "${runner_dir}/.runner" ]]; then
    echo "The repository runner is not configured at ${runner_dir}." >&2
    exit 1
fi

if tmux has-session -t "${session_name}" 2>/dev/null; then
    echo "GitHub Actions runner session is already active."
    exit 0
fi

tmux new-session -d -s "${session_name}" -c "${runner_dir}" ./run.sh
echo "Started repository runner in tmux session ${session_name}."
