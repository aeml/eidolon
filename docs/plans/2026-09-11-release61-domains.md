# Alpha 1.0.61 — a new home for Eidolon

Candidate only; not a production acceptance claim. Based on remote3671aab4,
preserving the separate Cloudflare Pages website and all existing1.0.60 game
content. The full1.1–1.10 roadmap remains active.

Scope: new game/backend domains and exact WebSocket Origins, preserved explicit
QA endpoint overrides, old-host connection compatibility, live QA new-domain
defaults with optional repository-variable overrides, and exact-tested-commit
SSH checkout after a real queued-release mismatch. Includes an additive Nginx
bootstrap and operator migration instructions; does not change game mechanics,
database/save format or the SSH hostname.

Login, package/lock, manifest, server/container/deploy/isolated QA/CI version
defaults identify1.0.61. New player-facing notes retain every prior release.
The operator has installed new TLS; backendhealth200 remainsoldAlpha1.0.60.
Frontend still requires the installed Nginx Host correction after the operator
changed GitHub Pages' custom domain. Do not publish or call migration complete
until the new route and actual WSS login are verified.

Local focused versioned run82729 passed268tests/6suites3.169s, including prior
patch-note history, all version defaults, actual disposable-Git checkout cases,
main boot/local overrides, Pages runtime rewriting and QA DNS mapping. The
previous origin-specific race check passed1.043s. Full current-source client,
lint and server race are required next; no reuse of an unrelated root/slow or
stun-branch pass as proof of this application's full regression.

Release gates: full local regression; normal predeploy gameplay; client and
server publication; matching public identities; actual native login/gameplay,
four-class/remote animation and town-rest QA against the new domains. A healthy
backend alone or old-domain redirect does not satisfy this gate.

See [domain migration details](2026-09-11-domain-migration.md) for DNS/TLS setup,
scope, retained failure evidence and operator commands. That document's initial
legacy-default phase is superseded: this version defaults all live QA endpoints
to the new domains because the old frontend now redirects to the website.

## Final local acceptance on10957648

49482 completed0: full client259suites/3634tests146.186s, full lint pass,
full server race allpackages pass (root16.143s, game330.737s, loadtest1.022s,
database1.106s, lifecycle1.033s; remaining packages no tests). Logs
`/tmp/eidolon-domain61-full-{client,lint,server}.log`. The candidate stayed
unchanged throughout this sequential run; only generated ignored vendor assets
were prepared afterward from locked dependencies.

90771 completed0: two anonymous system-Chrome cases8.0s on disposablelocal
web41961. Login project credit remained keyboard-accessible at desktop/phone
sizes; local release/versioned notes and runtime dependencies pass. Inspected
the actual1280x720 screenshot:1.0.61 notes readable and1.0.60 history retained.
This was anonymous local-surface coverage, NOT authenticated live login or the
required full native character gate. Web41961 cleared after completion.

Operator's final Host update is now observed: new public frontendHTTP200 and
installed upstreamHostplay.eidolonrealms.com. New-domain public manifests report
client62dc2d1e and backenddf91bb66, bothAlpha1.0.60; database ready. This proves
DNS/TLS/proxy routing, not1.0.61 migration acceptance. Agent made no Nginx edits.

Exact diff againstremote3671 reviewed: no internal/game or website changes,
only migration/runtime endpoint initialization, Origin allowlist, workflow,
versioning/tests/docs. Normal CI publication and new-domain live acceptance
remain required. Pending permission question concerns cancelling only the
superseded3671 CI run; the separate24hourNightly must stay running.
