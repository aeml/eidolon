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
