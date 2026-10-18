# Connected System Chrome QA

On the Linux GPU runner, set `EIDOLON_E2E_ISOLATE_CHROME=1` with
`EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome`. The common Playwright config
and `verify:browser-gpu` then launch the installed Chrome in an ordinary
UID/GID-matched Docker container with a private network namespace. The native
and live release jobs enable this option; hosted browser jobs keep their
existing launch policy. Local visual stages already using
`run-native-visual-qa.sh` keep that runner's private loopback environment.

Independent Chrome peers and per-file `test.use` launch overrides use
`qaChromeLaunchOptions` from `tests/e2e/browserLaunchPolicy.js`. Explicit
launches do not inherit the common config's executable, so they must opt into
the same wrapper. Each peer remains a separate browser process and owns its
own profile/download directory. Without isolation enabled, the helper returns
the original options unchanged. Firefox-specific probes retain their separate
launch policy.

The container borrows the installed Chrome, Node runtime, libraries, fonts,
certificate files and Vulkan drivers read-only. It receives only its owned
profile, browser home and download directory as writable mounts, plus the
render device and its group. It has no host network, Docker socket, privileged
mode, application checkout or account environment. The pinned Mongo fixture
image supplies the base filesystem; its Mongo entrypoint is never run.

Node, HTTP servers, Go and Mongo test fixtures stay in their existing host
environment. Chrome uses a loopback SOCKS5 forwarder connected through a
private Unix socket. The host forwarder allows the configured game origins,
the existing production backend names, and loopback fixture ports. Only the
owned container mounts the socket; its parent directory is mode 0700 and the
socket is mode 0600. HTTP, HTTP/2, HTTPS and WebSocket bytes pass through without
rewriting URLs, intercepting TLS or recording payloads. The configured backend
IP mapping remains limited to the two existing backend hostnames.

DevTools messages use separate binary pipes with backpressure. Neither relay
parses or logs them, and Docker logging is disabled so the daemon does not
retain the stdout channel. The launch preserves the caller's CPU affinity, priority and the
existing Chrome flags, request deadlines, browser failure collection and test
retry policy. Interface changes inside the browser's namespace still produce
normal Chrome network errors.

Normal exit and SIGTERM remove the launch's labeled container and network.
Both self-hosted jobs also run `node scripts/cleanup-browser-network.mjs` with
`always()`, covering a controller killed before its cleanup can finish. Cleanup
requires `GITHUB_RUN_ID`, validates ownership labels and removes only that
run's browser resources. Cleanup failure fails the job. Do not use global
Docker pruning to clean these fixtures.
