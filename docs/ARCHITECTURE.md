# Eidolon Architecture

Last refreshed: July 19, 2026

This document describes the current runtime and release architecture. Per-patch history belongs in the in-game Patch Notes; roadmap intentions belong in `ROADMAP.md` and `docs/plans/`.

## Runtime topology

```text
Browser (static ES modules)
  index.html
    -> src/main.js
       -> GameEngine
          -> InputManager -> real mouse/keyboard intent
          -> RenderSystem -> Three.js scene/camera/WebGL
          -> NetworkManager -> WebSocket lifecycle/resume
          -> AbilityController
          -> UIManager facade and feature UIs
          -> ChunkManager / WorldGenerator / entities

                     JSON commands
Browser ------------------------------------> Go server /ws
Browser <------------------------------------ Go server
       JSON control + EDPB/protobuf state

Go server
  main.go -> authentication, sessions, message routing, state encoding
  handler files -> friends, party, social, trading
  internal/game -> authoritative simulation and rules
  internal/database -> MongoDB persistence

Release path
  push to master -> Jest/lint/audit + Go test/build + Playwright smoke
                 -> GitHub Pages client + SSH/Docker server deploy
                 -> matching release SHA poll
                 -> live Playwright QA
```

## Authority and protocol

The browser sends intent such as movement, jump, attack, ability, inventory, party, dungeon, and reconnect messages. The Go server validates and applies that intent; the client does not own canonical combat, position, progression, party, or inventory state.

The wire format is intentionally mixed:

- JSON carries authentication, commands, control messages, errors, and session-resume traffic.
- Binary state replication uses an `EDPB` header, a wire-version byte, and protobuf `StateEnvelope` full/delta payloads.
- `NetworkManager` decodes state and manages reconnect with a server-issued resume token.

## Browser dependency delivery

The client is not bundled. `npm ci` runs `scripts/prepare-client.mjs`, which copies the exact locked Three.js and protobuf browser runtimes into ignored `vendor/`. `index.html` imports those local files. The Pages job repeats that deterministic preparation before publishing.

Current locked runtime versions:

- Three.js `0.181.2`
- protobufjs `8.7.1`
- Playwright test harness `1.61.1`

This removes runtime reliance on the former protobuf CDN script and makes the deployed dependency derive from `package-lock.json`.

## Client ownership

- `GameEngine`: lifecycle, authoritative state application, interaction coordination, instance transitions, and the main update loop.
- `NetworkManager`: WebSocket send/decode, reconnection, buffered state, and resume-session behavior.
- `RenderSystem`: renderer, camera, lighting, scene groups, quality settings, and effect/environment ownership.
- `InputManager`: DOM input listeners and translation into gameplay intent.
- `AbilityController`: ability targeting and orchestration.
- `UIManager`: cross-surface coordinator. Inventory, skills, forge, trading, quests, and social behavior already have feature modules, but the facade remains oversized.
- `SocialPresenceController`: party/social/friend message routing and local party-highlight state.

## Server ownership

- `main.go`: process startup, HTTP `/healthz`, WebSocket lifecycle, session/auth orchestration, JSON dispatch, protobuf snapshot/delta production, and persistence mapping.
- `internal/game/world.go`: authoritative tick, combat, movement, AI, loot, dungeons, rewards, and progression. It remains the largest server risk.
- `internal/game/entity.go`: entity model, stats, status effects, copy/snapshot helpers, runes, and set-bonus helpers.
- `internal/game/party.go`, `social.go`, and dungeon-focused files: partially extracted domain behavior.
- `internal/database`: Mongo collections and persistence operations.

`/level`, the fixed `/qa-waypoint <combat|verdant>` destinations, `/qa-loot-next`, and `/qa-disconnect` are not normal gameplay capabilities. The server accepts them only when the authenticated username is in the explicit `EIDOLON_QA_USERNAMES` allowlist. The waypoint helper cannot accept arbitrary coordinates or operate inside a dungeon, its protection expires after five minutes, and a one-second authoritative handoff rejects movement packets queued at the pre-waypoint position. The loot flag is server-only and consumed synchronously by the next eligible enemy kill. The disconnect command schedules a server-originated WebSocket close so the browser can exercise session resume without proxying the production state stream or mutating page code.

## Persistence and reconnect

MongoDB stores accounts, password hashes, characters, auctions, and friendships. Character state includes progression, inventory/stash/equipment, quests, skills/runes/talents, position, and party identity.

On a transient disconnect, the server retains the entity for a five-minute resume window. The client reconnects with exponential backoff and presents its stored resume token. A successful resume rebinds the same server entity and refreshes the token. This path has unit coverage and is exercised by the credentialed browser suite; a claim of live verification requires the production test evidence.

## Release identity and readiness

- The client publishes `/release.json` with `commit` and `version`.
- The server publishes `/healthz` with status, database readiness, commit, and version.
- Docker injects the server commit/version through linker variables.
- The server Docker context excludes `.env`, logs, reports, credential files, and database archives.
- The Pages job generates the client manifest from `GITHUB_SHA`.
- Deployment fails unless local server health is `200`, Mongo reports ready, and the server reports the expected commit.
- Post-deploy automation polls both public endpoints until they report the same pushed SHA.

No secrets are returned by either endpoint.

## Browser QA boundary

Playwright runs hardware-accelerated system Chrome at `/usr/bin/google-chrome` in the Codex environment and for both character gates on the repository-scoped `eidolon-live-browser` self-hosted production runner; the runner starts under the host `render` group and fails early if Chrome reports SwiftShader or another software renderer. GitHub-hosted predeploy smoke uses pinned Playwright Chromium for the anonymous surface. Gameplay is driven through real DOM, keyboard, and mouse input. `page.evaluate()` is limited to read-only state inspection and Three.js projection used to position real mouse clicks. Reconnect faults are requested through the visible chat UI and performed by the allowlisted server-side `/qa-disconnect` command, outside page code. Live checks allow bounded recovery from transient edge 5xx responses, but require a complete client-module boot marker and retain the final failure when recovery never succeeds. Post-deploy Chrome can resolve only `eserver.mendola.tech` directly to a validated live-origin IP secret, retaining the production hostname/TLS identity while avoiding Cloudflare starvation of the gameplay WebSocket; public release/health polling and frontend navigation still use their normal URLs.

`npm run test:e2e:isolated` builds the server, starts disposable Mongo/API containers on a private Docker network, registers a random allowlisted character through visible browser controls, and removes all temporary containers and data on exit. The route covers authoritative movement, menu hotkeys, combat and ability cooldown, kill/loot/inventory, dungeon entry/exit, reconnect/session resume, and fresh-login persistence without invoking gameplay methods from test code.

Credentialed traces, screenshots, video, and Playwright's input-valued failure snapshot are disabled because recordings can expose account identifiers or form inputs. CI redacts and scans all supplied QA values before any report upload. The anonymous route retains screenshots, traces, and video on failure.

## Measured hotspots

Physical lines measured with `wc -l` on July 19, 2026:

| File | LOC |
|---|---:|
| `server/internal/game/world.go` | 8,473 |
| `server/main.go` | 4,716 |
| `src/core/GameEngine.js` | 5,548 |
| `src/ui/UIManager.js` | 3,622 |
| `src/core/NetworkManager.js` | 329 |
| `src/core/SocialPresenceController.js` | 108 |
| `src/ui/SocialUI.js` | 678 |

Totals: 40,673 JavaScript LOC under `src/`, 31,712 Go LOC under `server/`, 26,169 JavaScript test LOC under `tests/`, and 8,336 Go test LOC. Generated protobuf code and assets are included where those directory totals naturally include them; the hotspot table is the useful refactor baseline.

The `0.40`–`0.43` decomposition gates are therefore still open. Release-confidence work should not be confused with completion of the monolith decomposition.

## Known architectural risks

- `world.go`, `main.go`, `GameEngine`, and `UIManager` remain well above roadmap size targets.
- `World.Mu` still concentrates simulation-lock risk; instance-scoped locking is not implemented.
- Mongo migration tooling and broader integration coverage remain roadmap work.
- The committed browser harness provides real multi-client paths, but nightly soak and 100-client durability gates do not yet exist.
- The static asset tree and repository remain unusually large; asset packaging and repository-size work should be handled as a focused follow-up.
