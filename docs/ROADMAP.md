# Eidolon Engineering Roadmap

Last refreshed: April 2026

This is the engineering-facing roadmap. It focuses on the slices still worth building after the recent dungeon progression, UI polish, asset caching, movement/render polish, `0.31` client-UX closeout, and `0.32.1` audio foundation/control passes already landed on `master`.

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

## Highest-value next slices

### 1. Audio asset readiness
Why now:
- `0.32.0` shipped the first generated cue layer through one shared AudioManager
- `0.32.1` added the first accessibility-facing detail control for players who want less routine UI sound
- The next quality step is making that layer replaceable with authored `.mp3`/`.ogg` assets later

Targets:
- `src/audio/` or the smallest existing client location for a new audio manager
- `src/core/GameEngine.js`
- `src/ui/UIManager.js`
- `src/ui/InventoryUI.js`
- tests around audio asset metadata, generated fallback behavior, and replacement-ready cue routing

Definition of done:
- UI, loot, combat, and jump cues keep routing through one client-owned audio manager
- Settings keep the audio layer optional, understandable, and safe by default
- Generated cues remain replaceable without scattering direct playback calls across gameplay code

### 2. Broader accessibility baseline
Why now:
- Audio should land with user control, and the following roadmap phase needs UI scale, keybind, and clarity settings

Targets:
- `src/ui/UIManager.js`
- settings and input-management surfaces
- relevant CSS modules and menu regression tests

Definition of done:
- Players can control key clarity options from settings without external docs
- UI scale/keybind work has regression coverage for persistence and presentation

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
1. `feat: prepare audio asset cue loading`
2. `feat: add ui scale control baseline`
3. `feat: add keybind clarity settings`
