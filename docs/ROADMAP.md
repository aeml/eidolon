# Eidolon Engineering Roadmap

Last refreshed: April 2026

This is the engineering-facing roadmap. It focuses on the slices still worth building after the recent dungeon progression, UI polish, asset caching, and movement/render polish passes already landed on `master`.

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

## Highest-value next slices

### 1. Scene-group instance transitions
Why now:
- Instance entry/exit still relies on broad scene rebuild behavior
- This is one of the largest remaining correctness/perf footguns in the client
- Recent runtime hygiene landed: instance transitions now clear stale transient combat/effect/hazard state before rebuilding, so the remaining work is narrower and safer

Targets:
- `src/core/RenderSystem.js`
- `src/core/GameEngine.js`
- `src/world/WorldGenerator.js`
- tests around instance transitions and cleanup

Definition of done:
- Environment, entities, and transient effects live in explicit scene groups
- Dungeon transitions stop depending on clearing broadly across unrelated scene content

### 2. UI diffing and throttling
Why now:
- A lot of the remaining frame-time waste is DOM churn rather than headline rendering features

Targets:
- `src/core/GameEngine.js`
- `src/ui/UIManager.js`
- extracted UI modules where live updates are frequent

Definition of done:
- HUD, XP, buff tracker, and related panels update on meaningful changes or throttled cadence instead of unnecessary per-frame churn

### 3. Data-driven mesh/content expansion
Why now:
- The codebase is much safer when new content is catalog-driven instead of switch-driven

Targets:
- `src/utils/MeshFactory.js`
- `src/utils/MeshCatalog.js`
- relevant tests under `tests/`

Definition of done:
- High-traffic entity and environment definitions are catalog-backed and easier to extend with lower regression risk

### 4. Dungeon satisfaction pass
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

### 5. Repro/sandbox QA tooling
Why now:
- Fast manual QA makes polish slices much safer and cheaper

Targets:
- `repro.html`
- `src/repro.js`
- supporting docs/checklists under `docs/plans/`

Definition of done:
- There is a tiny deterministic sandbox for testing rendering, movement, VFX, and menu regressions without a full live run

## Recommended next 3 implementation slices
1. `refactor: add scene groups for instance transitions`
2. `perf: throttle and diff high-frequency HUD updates`
3. `feat: add dungeon room-role pacing metadata`
