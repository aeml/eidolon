#!/usr/bin/env bash
set -euo pipefail

# Local-only visual stages keep real HTTP and native GPU rendering, but their
# browser and static server share a private, stable loopback network. Host
# Docker bridge/veth churn cannot invalidate their in-flight module/CSS loads.
# Backend/login/recovery routes continue to run in their ordinary environment.
if [ "$#" -eq 0 ]; then
    echo 'Usage: run-native-visual-qa.sh COMMAND [ARGUMENT ...]' >&2
    exit 2
fi

qa_root=$(pwd -P)
qa_node=$(readlink -f "$(command -v node)")
qa_node_root=$(dirname "$(dirname "$qa_node")")
qa_chrome=$(readlink -f "${EIDOLON_E2E_BROWSER_PATH:-/usr/bin/google-chrome}")
qa_chrome_root=$(dirname "$qa_chrome")
qa_browser_cache=${PLAYWRIGHT_BROWSERS_PATH:-${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright}
qa_image='ubuntu@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55'

if [ "$(uname -m)" != x86_64 ] || [ ! -x /opt/google/chrome/chrome ] || [ ! -d /dev/dri ]; then
    echo 'Native visual namespace requires this x86_64 System Chrome/GPU runner' >&2
    exit 1
fi

# Resolve the distribution's launcher to the same actual Chrome binary used by
# Playwright. No image-provided browser, Node, GPU driver or application assets.
if [ "$qa_chrome" = /opt/google/chrome/google-chrome ]; then
    qa_chrome=/opt/google/chrome/chrome
fi

qa_network=none
if [[ -n "${EIDOLON_NATIVE_QA_NETWORK_CONTAINER:-}" ]]; then
    # Only the disposable smoke fixture may join its own loopback namespace.
    # It carries fresh synthetic credentials and has no host/external network.
    if ! [[ "${EIDOLON_NATIVE_QA_NETWORK_CONTAINER}" =~ ^eidolon-isolated-qa-mongo-[a-z0-9][a-z0-9_.-]{0,30}$ ]] ||
       ! [[ "${EIDOLON_E2E_USERNAME:-}" =~ ^codexqa[a-f0-9]{12}$ ]] ||
       ! [[ "${EIDOLON_E2E_PASSWORD:-}" =~ ^[a-f0-9]{48}$ ]] ||
       ! [[ "${EIDOLON_E2E_WS_URL:-}" =~ ^ws://127\.0\.0\.1:[0-9]+/ws$ ]] ||
       [[ "${EIDOLON_E2E_REGISTER:-}" != 1 ]] ||
       [[ -n "${EIDOLON_E2E_USERNAME_SECONDARY:-}${EIDOLON_E2E_PASSWORD_SECONDARY:-}${EIDOLON_E2E_BASE_URL:-}" ]] ||
       [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}} {{.State.Running}}' "${EIDOLON_NATIVE_QA_NETWORK_CONTAINER}")" != 'none true' ]]; then
        echo 'Private native smoke requires its running network-none Mongo fixture and fresh synthetic loopback credentials.' >&2
        exit 1
    fi
    qa_network="container:${EIDOLON_NATIVE_QA_NETWORK_CONTAINER}"
fi

qa_args=(run --rm --init --network "$qa_network" --user "$(id -u):$(id -g)"
    --group-add "$(stat -c '%g' /dev/dri/renderD128)" --device /dev/dri
    --workdir "$qa_root"
    --mount "type=bind,src=$qa_root,dst=$qa_root"
    --mount "type=bind,src=$qa_node_root,dst=$qa_node_root,readonly"
    --mount "type=bind,src=$qa_chrome_root,dst=$qa_chrome_root,readonly"
    --mount 'type=bind,src=/usr/lib/x86_64-linux-gnu,dst=/usr/lib/x86_64-linux-gnu,readonly'
    --mount 'type=bind,src=/usr/share/vulkan,dst=/usr/share/vulkan,readonly'
    --mount 'type=bind,src=/usr/share/glvnd,dst=/usr/share/glvnd,readonly'
    --mount 'type=bind,src=/usr/share/fonts,dst=/usr/share/fonts,readonly'
    --mount 'type=bind,src=/etc/fonts,dst=/etc/fonts,readonly'
    --env "PATH=$qa_node_root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    --env HOME=/tmp/eidolon-native-visual
    --env "EIDOLON_E2E_BROWSER_PATH=$qa_chrome"
    --env PLAYWRIGHT_BROWSERS_PATH=/tmp/eidolon-native-browsers
    --env EIDOLON_E2E_REQUIRE_NATIVE_GPU=1
    --env EIDOLON_E2E_REUSE_SERVER=0)

# Detached local worktrees may reuse only these installed dependency trees.
# CI checkouts contain them directly and need no additional host mounts.
for qa_dependency in node_modules vendor; do
    if [ -L "$qa_root/$qa_dependency" ]; then
        qa_target=$(readlink -f "$qa_root/$qa_dependency")
        case "$qa_target" in
            "$qa_root"/*) ;;
            *) qa_args+=(--mount "type=bind,src=$qa_target,dst=$qa_target,readonly") ;;
        esac
    fi
done

# Keep Playwright's existing video recorder without exposing host browser
# profiles or switching the required System Chrome to a downloaded browser.
qa_has_recorder=false
for qa_recorder in "$qa_browser_cache"/ffmpeg-*; do
    if [ -d "$qa_recorder" ]; then
        qa_args+=(--mount "type=bind,src=$qa_recorder,dst=/tmp/eidolon-native-browsers/$(basename "$qa_recorder"),readonly")
        qa_has_recorder=true
    fi
done
if [ "$qa_has_recorder" != true ]; then
    echo 'Native visual evidence requires installed Playwright ffmpeg (playwright install ffmpeg)' >&2
    exit 1
fi

# Visual stages carry only QA configuration. The guarded connected smoke adds
# its fresh synthetic credentials below; neither path exposes Docker access,
# the host network or arbitrary caller environment variables.
for qa_variable in CI EIDOLON_E2E_WEB_PORT EIDOLON_E2E_NATIVE_COVERAGE_PENDING PLAYWRIGHT_HTML_OUTPUT_DIR; do
    if [ "${!qa_variable+x}" = x ]; then qa_args+=(--env "$qa_variable=${!qa_variable}"); fi
done
if [[ "$qa_network" != none ]]; then
    for qa_variable in EIDOLON_E2E_WS_URL EIDOLON_E2E_USERNAME EIDOLON_E2E_PASSWORD EIDOLON_E2E_CLASS EIDOLON_E2E_FULL_GAMEPLAY EIDOLON_E2E_PORTAL_ONLY EIDOLON_E2E_REGISTER EIDOLON_E2E_SOURCE_COMMIT EIDOLON_E2E_SOURCE_DIRTY; do
        if [[ "${!qa_variable+x}" = x ]]; then qa_args+=(--env "$qa_variable"); fi
    done
fi

echo "Local native visual network: private loopback; Node $($qa_node --version); Chrome $($qa_chrome --version)"
exec docker "${qa_args[@]}" "$qa_image" bash -c 'mkdir -p "$HOME"; exec "$@"' native-visual "$@"
