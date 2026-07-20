# Eidolon Current-State Review

Last refreshed: July 20, 2026

Reviewed against the working `Alpha 0.40.0` release-confidence change set. Verification labels here are deliberate: implemented, unit-tested, locally browser-tested, and live-tested are different claims.

## What the project is

Eidolon is a static Three.js browser action RPG backed by an authoritative Go/WebSocket server and MongoDB persistence. Four classes, four realms, four dungeons, progression, quests, loot, forge/stash/trading, parties, social status, friendships, and reconnect/session resume are present in code.

## Evidence that is currently strong

- Client unit baseline: 92 Jest suites / 1,047 tests pass from a fresh Node 24 install in this environment.
- Server baseline: every Go package tests and builds under Go 1.24.5.
- Dependency baseline: the lockfile audits at zero known npm vulnerabilities; the production protobuf runtime is locked and self-hosted rather than loaded from a CDN.
- Local browser baseline: hardware-accelerated Google Chrome `150.0.7871.124` passes the anonymous surface plus a disposable full-character route for visible graphics selection, movement, menus, combat/ability, kill/loot/inventory, dungeon entry/exit, reconnect, and persisted fresh login.
- Movement baseline: the disposable real-input route passes exact-current, sub-arrival, nearby, and sustained trajectories with no correction frames; a separate Chrome process observes bounded timestamped remote interpolation. Detailed ownership and thresholds are in `docs/MOVEMENT_SMOOTHNESS.md`.
- Security baseline: `/level`, the fixed QA waypoints, and one-kill loot acceleration require an authenticated username on an explicit server allowlist, with allow/deny and consumption regression tests.
- Load-test credentials: tracked credentials are removed; the driver generates cryptographically random, in-memory credentials unless an explicit read-only file is supplied.
- Release observability: client and server expose commit identity; server readiness includes a Mongo ping; deployment checks require the expected SHA and healthy database.
- Live release baseline: production client and server reported SHA `2d8dc3a`; hardware Chrome passed anonymous, persistent-character, measured movement/camera/reconciliation, extended gameplay/persistence, all four class ability/rune and actor-state matrices, and two-client party/presence/action/remote-movement/remote-VFX convergence in GitHub Actions run `29766780968`, without a Playwright retry or product failure.

## Live release evidence and boundary

- The credentialed browser path is proven both locally against an isolated real server/Mongo database and live against the matching production SHA.
- The two-account live path covers presence, party invite/accept, remote movement, jump, combat presentation, position convergence, and the Spirit Guardians refresh, late-join reconstruction, authoritative expiration, and cleanup lifecycle.
- GitHub Actions deploys only after unit/build/anonymous/disposable-character gates, polls client and server for the pushed SHA, and then runs live Playwright.

This is point-in-time evidence for SHA `2d8dc3a`, not a claim that later commits are live-tested before their own workflow and matching-SHA browser gate pass.

## What remains fragile

- The main monoliths remain large: `world.go` 8,578 LOC, `main.go` 5,027, `GameEngine.js` 5,810, and `UIManager.js` 3,634.
- The movement server still accepts bounded absolute client transforms rather than integrating directional input with complete overworld speed/collision authority; ordering, dungeon clamping, movement locks, and discontinuity rejection are enforced, but broader anti-cheat authority remains future protocol work.
- The server still lacks the planned instance-scoped lock hierarchy.
- Mongo migration tooling, broader persistence integration tests, formal per-message rate limiting, and malformed-packet fuzz coverage remain open.
- Browser automation is a release gate, not a substitute for long-duration gameplay, mobile, accessibility, performance, and multi-client soak work.
- The public Cloudflare path emitted intermittent 522 responses during release QA. Bounded browser retries and automatic auth-socket replacement now verify recovery, but recurring 522s remain an origin/edge reliability signal worth monitoring separately.
- The asset/repository footprint is very large and deserves a separate packaging/history strategy.

## Best next work after this release

1. Fix any release-gate regression forward before continuing feature work.
2. Resume narrow `0.40` decomposition slices with measured LOC and module-boundary tests.
3. Add Mongo-backed CI integration coverage and schema migration tooling.
4. Build nightly multi-client soak and performance baselines.
5. Audit asset packaging and repository size without rewriting history casually.

## Claims that should no longer appear in current docs

- “Reconnect does not exist.” It does, with a resume window and tests.
- “Friends/presence do not exist.” They do and persist in Mongo.
- “Protobuf is future work.” Binary full/delta state replication is current.
- “Receiving any HTTP response proves deployment health.” Deployment now checks readiness and commit identity.
- “The `0.40.0` extraction brought `world.go` below 7,500 lines.” Current measured state is 8,578 lines; historical reduction claims must not replace current measurement.
