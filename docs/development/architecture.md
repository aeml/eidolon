# Eidolon architecture

Source map reviewed November 15, 2026 against master fe4fff6f28926e48537a207ca52b3467f63e2e56 (Alpha 1.80.2). This describes repository structure, not a fresh gameplay, capacity or deployment acceptance. Start with the [contributor map](contributor-map.md) for edit/test pairs.

## Runtime topology

~~~text
index.html -> src/main.js (login and lazy game boot)
                      -> GameEngine
                         | InputManager / AbilityController
                         | RenderSystem / world / entities
                         | UIManager and feature UIs
                         + NetworkManager <-> Go /ws
                                              | handlers / sessions
                                              | internal/game
                                              + internal/database -> MongoDB
~~~

The browser sends intent and renders authoritative results. Go owns combat, inventory, rewards, account/session policy and persistence. JSON carries commands and control messages; binary EDPB/protobuf StateEnvelope messages carry full/delta state. See [protocol](protocol.md) and [movement ownership](movement-smoothness.md) for the exact behavior and limits, rather than assuming all client prediction is server integration.

## Ownership map

| Concern | Source |
| --- | --- |
| Browser boot, login and lazy engine admission | [index.html](../../index.html), [src/main.js](../../src/main.js), [EngineModuleLoader.js](../../src/core/EngineModuleLoader.js) |
| Lifecycle and authoritative state application | [GameEngine.js](../../src/core/GameEngine.js) and collaborating modules in [src/core/](../../src/core/) |
| WebSocket decode/send, buffering and reconnect | [NetworkManager.js](../../src/core/network/NetworkManager.js), [src/proto/](../../src/proto/), [proto/](../../proto/) |
| Input, rendering and targeting | [InputManager.js](../../src/core/input/InputManager.js), [RenderSystem.js](../../src/core/rendering/RenderSystem.js), [AbilityController.js](../../src/core/gameplay/combat/AbilityController.js) |
| Feature interfaces and style modules | [src/ui/](../../src/ui/), [src/styles/](../../src/styles/) |
| Scenes, actor presentation and asset loading | [src/world/](../../src/world/), [src/entities/](../../src/entities/), [src/art/](../../src/art/), [src/assets/](../../src/assets/) |
| HTTP readiness, WebSocket/session orchestration | [server/internal/server/startup.go](../../server/internal/server/startup.go) and server-level handler files |
| Authoritative simulation and rules | [server/internal/game/](../../server/internal/game/) |
| MongoDB and durable persistence operations | [server/internal/database/](../../server/internal/database/) and server-level journal/recovery code |
| Packaging and deployment | [scripts/](../../scripts/), [server/deploy/](../../server/deploy/), [CI](../../.github/workflows/ci.yml) |

Keep feature-level behavior beside its existing owner rather than adding every change to GameEngine, UIManager, main.go or world.go. Earlier LOC tables are historical, not current measurements.

## Source and published client

**Development is editable ES modules; the published game is partially bundled.** The earlier claim that there is no application bundle is obsolete.

1. [prepare-client.mjs](../../scripts/build/prepare-client.mjs), run by npm ci, copies locked Three.js/protobuf runtimes into ignored vendor/ with their licenses and builds the local gameplay geometry worker. It does not regenerate tracked canonical content.
2. The Pages job copies index.html, assets/, src/, vendor/, sw.js and release.json into public/. It invokes [bundle-game-engine.mjs](../../scripts/build/bundle-game-engine.mjs) **only on that copied tree**.
3. That builder writes src/core/GameEngine.bundle.js and rewrites the normal and bounded-retry lazy imports in the copied src/main.js. It preserves constructor names, keeps modules shared with login external to avoid duplicate session singletons, and bundles copied Three.js add-ons while retaining their notice. Login stays separate from the lazy game entry.
4. [version-pages-runtime.mjs](../../scripts/build/version-pages-runtime.mjs) runs analytics bundling, flattens the copied stylesheet manifest, versions runtime references and writes the exact release SHA into the copied release.json. [Worker preparation](../../scripts/build/build-gameplay-geometry-worker.mjs) maintains the geometry worker's separate content-hash identity.
5. Editable source modules remain available in the copied publication. Generated bundle files and the publication tree are outputs, not the place to author gameplay changes.

The standalone [marketing website](../../website/README.md) builds independently. Its build output is not the game publication.

## Content and asset ownership

Canonical geography, quests and economy content lives in [server/internal/game/content/](../../server/internal/game/content/), with explicitly documented sources in [src/data/](../../src/data/) and dated story documents. The [contributor canonical-input table](../../CONTRIBUTING.md#content-sources-and-checks) names those exceptions. The [content check](../../scripts/content/check-content.mjs) verifies 17 generated groups without rewriting them.

Asset manifests record original/derived hashes, mappings and runtime selection. Use the [equipment binding contract](../art/EQUIPMENT_ASSETS.md), [character notes](../art/UNEQUIPPED_CLASS_BASES.md) and [provenance inventory](../art/CONTENT_PROVENANCE.md) for editable-source locations and integration rules. Preserve IDs, supplied notices and originals; a matching hash does not establish rights, animation fit or visual acceptance.

## Persistence, readiness and sessions

MongoDB stores account and character/social/economy data; server journals and recovery paths protect pending durable work. Session resume, saved state and authentication boundaries must be tested together when changed. QA allowlists and durable administrator roles are separate capabilities; see [server guide](../../server/README.md) and [administration](../operations/administration.md).

The client publishes /release.json; the server exposes /healthz with commit/version and readiness. In [main.go](../../server/internal/server/startup.go), readiness can fail on an unhealthy durable session-activity journal, shutdown, absent DB initialization or Mongo ping failure. An unavailable database label does not uniquely identify the root cause. Process uptime and a frontend HTTP 200 do not prove a usable game.

## Release and QA boundaries

The current [CI workflow](../../.github/workflows/ci.yml) runs hosted client/server/browser checks for PRs. Production-branch pushes have additional guarded native QA, release inputs, Pages and SSH deployments, matching-identity checks and live QA. Review the actual event conditions; a successful PR or source-only check is not evidence of a live release.

[Playwright](../../playwright.config.js) distinguishes anonymous from credentialed evidence, keeps TLS verification enabled and configures the local static server. [Native network QA](browser-network-qa.md) and [copied-client fixtures](copied-client-qa-fixtures.md) retain their own isolation and ownership constraints. Do not replace native-GPU evidence with software rendering or use production storage for disposable recovery tests.

For current acceptance and remaining gates use the [release register](../plans/release-readiness.md), not the [archived architecture snapshot](../history/architecture-before-navigation-refresh-2026-11-15.md). Historical capacity, decomposition and timing statements remain preserved there and in their original dated receipts. The full [documentation index](../README.md) separates working guides from those records.
