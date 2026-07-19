# Eidolon Current-State Review

Last refreshed: July 19, 2026

Reviewed against the working `Alpha 0.40.0` release-confidence change set. Verification labels here are deliberate: implemented, unit-tested, locally browser-tested, and live-tested are different claims.

## What the project is

Eidolon is a static Three.js browser action RPG backed by an authoritative Go/WebSocket server and MongoDB persistence. Four classes, four realms, four dungeons, progression, quests, loot, forge/stash/trading, parties, social status, friendships, and reconnect/session resume are present in code.

## Evidence that is currently strong

- Client unit baseline: 82 Jest suites / 951 tests pass in this environment.
- Server baseline: every Go package tests and builds under Go 1.24.5.
- Dependency baseline: the lockfile audits at zero known npm vulnerabilities; the production protobuf runtime is locked and self-hosted rather than loaded from a CDN.
- Local browser baseline: a real system-Chrome Playwright smoke passes start/version, Patch Notes, Escape, vendored runtime load, first-party failures, console/page errors, and production WebSocket connectivity.
- Security baseline: `/level` now requires an authenticated username on an explicit server allowlist, with allow/deny regression tests.
- Load-test credentials: tracked credentials are removed; the driver generates cryptographically random, in-memory credentials unless an explicit read-only file is supplied.
- Release observability: client and server expose commit identity; server readiness includes a Mongo ping; deployment checks require the expected SHA and healthy database.

## Implemented but not yet proven live

- The committed credentialed browser path logs into a persistent character and uses real keyboard/mouse/DOM input for movement, menus, abilities, overworld kills, loot/inventory, dungeon entry/exit, persistence, and reconnect.
- The optional two-account path covers presence, party invite/accept, remote movement, jump, combat presentation, and position convergence.
- GitHub Actions is configured to deploy only after unit/build/anonymous-browser gates, poll client and server for the pushed SHA, and then run live Playwright.

These are not called live-tested until dedicated production credentials are supplied, the release is pushed, Actions completes, and the production route passes.

## What remains fragile

- The main monoliths remain large: `world.go` 8,408 LOC, `main.go` 4,632, `GameEngine.js` 5,548, and `UIManager.js` 3,622.
- The server still lacks the planned instance-scoped lock hierarchy.
- Mongo migration tooling, broader persistence integration tests, formal per-message rate limiting, and malformed-packet fuzz coverage remain open.
- Browser automation is a release gate, not a substitute for long-duration gameplay, mobile, accessibility, performance, and multi-client soak work.
- The asset/repository footprint is very large and deserves a separate packaging/history strategy.

## Best next work after this release

1. Finish the production credentialed browser run and retain failure/pass evidence.
2. Fix any live regression forward before continuing feature work.
3. Resume narrow `0.40` decomposition slices with measured LOC and module-boundary tests.
4. Add Mongo-backed CI integration coverage and schema migration tooling.
5. Build nightly multi-client soak and performance baselines.
6. Audit asset packaging and repository size without rewriting history casually.

## Claims that should no longer appear in current docs

- “Reconnect does not exist.” It does, with a resume window and tests.
- “Friends/presence do not exist.” They do and persist in Mongo.
- “Protobuf is future work.” Binary full/delta state replication is current.
- “Receiving any HTTP response proves deployment health.” Deployment now checks readiness and commit identity.
- “The `0.40.0` extraction brought `world.go` below 7,500 lines.” Current measured state is 8,408 lines; historical reduction claims must not replace current measurement.
