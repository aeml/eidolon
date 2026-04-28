# Eidolon Engineering Roadmap

Last refreshed: April 2026

This is the engineering-facing roadmap. It focuses on the slices still worth building after the recent dungeon progression, UI polish, asset caching, movement/render polish, `0.31` client-UX closeout, and `0.32.3` audio/accessibility passes already landed on `master`.

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

## Highest-value next slices

### 1. Keybind clarity baseline
Why now:
- Audio now has basic enablement, volume, detail, and authored-asset readiness
- UI scale now has the first persisted accessibility control, so the next client-quality gap is making control/key clarity easier to tune in-client

Targets:
- `src/ui/UIManager.js`
- settings and input-management surfaces
- relevant CSS modules and menu regression tests

Definition of done:
- Players can control key clarity options from settings without external docs
- keybind clarity work has regression coverage for persistence and presentation

### 2. Data-driven mesh/content expansion
Why now:
- The codebase is much safer when new content is catalog-driven instead of switch-driven

Targets:
- `src/utils/MeshFactory.js`
- `src/utils/MeshCatalog.js`
- relevant tests under `tests/`

Definition of done:
- High-traffic entity and environment definitions are catalog-backed and easier to extend with lower regression risk

### 3. Dungeon satisfaction pass
Why now:
- Core dungeon progression is in, but replayability and room identity can still improve a lot

Targets:
- `server/internal/game/world.go`
- `server/main.go`
- `src/core/GameEngine.js`
- `src/ui/QuestUI.js`
- `src/ui/Minimap.js`

Definition of done:
- Rooms feel more intentionally paced and endgame difficulties feel distinct beyond number inflation

### 4. Repro/sandbox QA tooling
Why now:
- Fast manual QA makes polish slices much safer and cheaper

Targets:
- `repro.html`
- `src/repro.js`
- supporting docs/checklists under `docs/plans/`

Definition of done:
- There is a tiny deterministic sandbox for testing rendering, movement, VFX, and menu regressions without a full live run

### 5. Social depth foundation
Why now:
- Parties, chat, and trading house exist, but the alpha runway still needs deeper social structures before guilds and PvP

Targets:
- server social state and persistence surfaces
- party/chat/trading-adjacent UI entry points
- regression tests around social state transitions

Definition of done:
- The next social feature has a clear data path and player-facing entry point without overloading existing party flows

## Recommended next 3 implementation slices
1. `feat: add keybind clarity settings`
2. `feat: catalog more mesh definitions`
3. `feat: improve dungeon room pacing`
