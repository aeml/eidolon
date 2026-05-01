# Eidolon Engineering Roadmap

Last refreshed: April 2026

This is the engineering-facing roadmap. It focuses on the slices still worth building after the recent dungeon progression, UI polish, asset caching, movement/render polish, `0.31` client-UX closeout, `0.32` audio/accessibility passes, `0.33.4` dungeon room identity work, `0.34.0` social status foundation, and `0.35.0` remote smoothing hardening already landed on `master`.

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
- `0.33.2` repro sandbox QA tooling: `repro.html` now offers deterministic dungeon room previews and a documented smoke workflow for rendering, movement, VFX, menu, and pacing regressions
- `0.33.3` dungeon difficulty pacing and remote jump polish: room summaries now expose endgame difficulty pacing context while remote-player jump visuals use the same animation lifecycle as local jumps
- `0.33.4` dungeon room identity: room summaries now expose named identity tags and route surfaces use clearer labels such as Treasure Cache, Restorative Shrine, Ambush Chamber, Boss Approach, and Boss Lair
- `0.34.0` social status foundation: the Social window now lets players declare Available, Looking for Party, In Run, or Busy status and surfaces that intent in the online roster
- `0.35.0` remote smoothing hardening: remote actor position and rotation interpolation now clamp frame spikes so presentation settles on the latest server target instead of overshooting it

## Highest-value next slices

### 1. Social depth follow-up
Why now:
- Parties, chat, the trading house, and social statuses exist, but the alpha runway still needs deeper social structures before guilds and PvP
- `0.35.0` closed a focused remote smoothing risk, so the next slice can return to the social foundation without reopening multiplayer presentation immediately

Targets:
- server social state and persistence surfaces
- party/chat/trading-adjacent UI entry points
- regression tests around social state transitions

Definition of done:
- The next social feature has a clear data path and player-facing entry point without overloading existing party flows

### 2. Multiplayer smoothness follow-up
Why now:
- Remote movement and action reads are better than before, but multiplayer smoothness remains one of the largest alpha-wide risks

Targets:
- server/client state streaming paths
- `src/core/GameEngine.js`
- multiplayer presentation regression tests

Definition of done:
- Remote actors feel more stable under normal latency without weakening server authority

### 3. Dungeon satisfaction follow-up
Why now:
- Core dungeon progression, boss approach, difficulty pacing, and room identity now read better, but deeper replay variation can still improve later
- The repro sandbox makes future dungeon readability checks faster before full live QA

Targets:
- `server/internal/game/world.go`
- `server/main.go`
- `src/core/GameEngine.js`
- `src/ui/QuestUI.js`
- `src/ui/Minimap.js`

Definition of done:
- Rooms feel more intentionally varied without destabilizing rewards, unlocks, or completion behavior

### 4. Data-driven mesh/content follow-up
Why now:
- `0.33.0` moved procedural enemy definitions, but additional structure/NPC branches can still become catalog-backed later

Targets:
- `src/utils/MeshFactory.js`
- `src/utils/MeshCatalog.js`
- relevant tests under `tests/`

Definition of done:
- More high-traffic entity and environment definitions are catalog-backed and easier to extend with lower regression risk

### 5. Repro/sandbox QA tooling follow-up
Why now:
- The first sandbox route exists, but future slices can expand it with more authored regression fixtures as needed

Targets:
- `repro.html`
- `src/repro.js`
- supporting docs/checklists under `docs/plans/`

Definition of done:
- The deterministic sandbox covers any newly risky visual or UX surfaces without requiring a full live run

## Recommended next 3 implementation slices
1. `feat: deepen social foundations`
2. `feat: harden multiplayer smoothness`
3. `feat: add dungeon replay variety`
