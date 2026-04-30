# Eidolon Engineering Roadmap

Last refreshed: April 2026

This is the engineering-facing roadmap. It focuses on the slices still worth building after the recent dungeon progression, UI polish, asset caching, movement/render polish, `0.31` client-UX closeout, `0.32` audio/accessibility passes, and `0.33.1` dungeon pacing work already landed on `master`.

For the broader release-status tracker that covers remaining `0.22` work and the roadmap through `alpha 1.0`, see `docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md`.

## Recently completed

### Core loop clarity
- Combat intent HUD and target clarity
- Loot feedback improvements and optional auto-loot
- Objective tracker and dungeon entrance context hints
- Dungeon room-state, room-clear, and reward-summary feedback

### Architecture and tooling progress
- Runtime/test Three.js alignment at 0.181.2
- `InputManager.dispose()` lifecycle cleanup
- `NetworkManager` extraction
- `AbilityController` extraction
- UI module extraction across inventory, forge, skill tree, quest, social, and trading surfaces
- Protobuf state streaming already live in production code
- ESLint and smoke-test script in place

### Recent polish slices
- Death/respawn feedback improvements
- Grouped buff/debuff tracker
- Modal close interaction fixes for menus
- Sharper/stabler shadows
- Exaggerated ctrl-click jump visuals with landing dust and camera punch
- `0.31` client UX closeout: shared menu chrome, viewport-safe windows, UI diffing, and class-based death overlay presentation
- `0.32.0` audio foundation: shared AudioManager, generated placeholder UI/loot/combat/jump cues, and persisted audio settings controls
- `0.32.1` audio detail control: reduced UI cue mode quiets routine menu sounds while preserving gameplay feedback cues
- `0.32.2` audio asset readiness: cue asset metadata and optional authored-media playback now preserve generated fallbacks through the shared AudioManager
- `0.32.3` UI scale baseline: Settings now persists an 85%-125% UI Scale control through the shared UI layer without breaking viewport-safe windows
- `0.32.4` keybind clarity settings: Settings can expand Help with a detailed keyboard reference without changing input mappings
- `0.33.0` mesh catalog expansion: procedural realm and dungeon enemy silhouettes now live in MeshCatalog while MeshFactory keeps equivalent runtime output and fallback behavior
- `0.33.1` dungeon boss approach pacing: server room summaries now expose boss-approach metadata and route surfaces call out the final pre-boss commit beat without changing rewards or progression

## Highest-value next slices

### 1. Repro/sandbox QA tooling
Why now:
- Fast manual QA makes polish slices much safer and cheaper
- The latest dungeon pacing pass widened route-surface coverage, so a deterministic sandbox would reduce future regression cost

Targets:
- `repro.html`
- `src/repro.js`
- supporting docs/checklists under `docs/plans/`

Definition of done:
- There is a tiny deterministic sandbox for testing rendering, movement, VFX, and menu regressions without a full live run

### 2. Dungeon satisfaction follow-up
Why now:
- Core dungeon progression is in, and boss approach beats now read better, but replayability and room identity can still improve

Targets:
- `server/internal/game/world.go`
- `server/main.go`
- `src/core/GameEngine.js`
- `src/ui/QuestUI.js`
- `src/ui/Minimap.js`

Definition of done:
- Rooms feel more intentionally paced and endgame difficulties feel distinct beyond number inflation

### 3. Social depth foundation
Why now:
- Parties, chat, and trading house exist, but the alpha runway still needs deeper social structures before guilds and PvP

Targets:
- server social state and persistence surfaces
- party/chat/trading-adjacent UI entry points
- regression tests around social state transitions

Definition of done:
- The next social feature has a clear data path and player-facing entry point without overloading existing party flows

### 4. Multiplayer smoothness hardening
Why now:
- Remote movement and action reads are better than before, but multiplayer smoothness remains one of the largest alpha-wide risks

Targets:
- server/client state streaming paths
- `src/core/GameEngine.js`
- multiplayer presentation regression tests

Definition of done:
- Remote actors feel more stable under normal latency without weakening server authority

### 5. Data-driven mesh/content follow-up
Why now:
- `0.33.0` moved procedural enemy definitions, but additional structure/NPC branches can still become catalog-backed later

Targets:
- `src/utils/MeshFactory.js`
- `src/utils/MeshCatalog.js`
- relevant tests under `tests/`

Definition of done:
- More high-traffic entity and environment definitions are catalog-backed and easier to extend with lower regression risk

## Recommended next 3 implementation slices
1. `feat: add repro sandbox route`
2. `feat: improve dungeon room pacing`
3. `feat: deepen social foundations`
