# Eidolon Roadmap (2–6 weeks)

## Phase 0: Stabilize & instrument (1–2 days)
- Tasks
  - Add a minimal perf overlay toggled by query param (`?perf=1`) showing FPS, frame time, draw calls, triangle count. Done in `src/core/RenderSystem.js`, `src/main.js`, `index.html`.
  - Add `InputManager.dispose()` and call from `GameEngine.destroy()` to prevent listener leaks.
  - Align Three.js versions between runtime and tests (update `index.html` importmap to 0.181 or downgrade `package.json`).
  - Add a `npm run test:smoke` that runs a fast subset of tests. Done in `package.json`.
- Expected payoff
  - Faster issue triage and reliable local profiling; fewer intermittent input bugs.
- Estimated complexity
  - Low.
- Dependencies
  - None.
- Definition of done
  - Perf overlay visible with `?perf=1`, smoke tests pass, and Three.js versions are consistent.

## Phase 1: Core gameplay loop improvements (3–7 days)
- Tasks
  - Add "combat intent" feedback: highlight hovered target and show damage preview (`src/core/GameEngine.js`, `src/ui/UIManager.js`).
  - Add quest markers and context hints for dungeon entrance (`src/world/WorldGenerator.js`, `src/ui/UIManager.js`).
  - Improve loot pickup feedback: range indicators + error throttling + optional auto-loot toggle (`src/core/GameEngine.js`, `src/ui/UIManager.js`).
  - Introduce a basic objectives panel (current quest + daily progress) (`src/ui/UIManager.js`).
- Expected payoff
  - Clearer moment-to-moment goals, reduced click friction, and better player feedback.
- Estimated complexity
  - Medium.
- Dependencies
  - Phase 0 instrumentation to validate changes.
- Definition of done
  - Players can identify targets and objectives without opening menus, and loot pickup is reliable and responsive.

## Phase 2: Architecture & scalability (1–2 weeks)
- Tasks
  - Extract networking into `NetworkClient` (`src/core/NetworkClient.js`) with clean event hooks; remove direct socket use from UI callbacks in `GameEngine`.
  - Split `UIManager` into feature modules with shared UI bus (InventoryUI, QuestUI, SocialUI, TradeUI).
  - Convert `MeshFactory` to data-driven definitions (`src/utils/meshCatalog.js`) with shared animation loader helper.
  - Replace hard-coded skill visuals with a registry (`src/skills/skillVisuals.js`) and small `SkillStrategy` subclasses.
- Expected payoff
  - Smaller, testable units and faster iteration on content without touching core engine code.
- Estimated complexity
  - Medium-high.
- Dependencies
  - Phase 0 instrumentation and Phase 1 feedback improvements.
- Definition of done
  - New NPC/skill added by updating catalogs only; GameEngine no longer owns UI/network wiring.

## Phase 3: Content/tools/polish (ongoing)
- Tasks
  - Expand repro scene into a tiny sandbox level with toggleable enemies/loot (`repro.html`, `src/repro.js`).
  - Add optional art-free VFX library (mesh-based trails, simple decals) with pooled resources.
  - Add dev convenience: a small local dev server script with cache-busting disabled.
  - Create lightweight linting (ESLint + basic rules) and formatting presets.
- Expected payoff
  - Faster debugging and smoother dev loops with small, safe tooling.
- Estimated complexity
  - Low-medium.
- Dependencies
  - Phase 2 module splits.
- Definition of done
  - Repro scene runs deterministically; lint runs in CI; simple VFX are reusable.

## Prioritized backlog
1) Align Three.js runtime/test versions (`index.html`, `package.json`). Done.
2) Add InputManager teardown + lifecycle guardrails (`src/core/InputManager.js`, `src/core/GameEngine.js`). Done.
3) Extract skill visuals to registry (`src/skills/skillVisuals.js`, `src/core/GameEngine.js`).
4) Data-drive MeshFactory asset definitions (`src/utils/meshCatalog.js`, `src/utils/MeshFactory.js`).
5) Reduce UI update frequency and add diffing to avoid DOM churn (`src/core/GameEngine.js`, `src/ui/UIManager.js`).
6) Scene grouping for instances (`src/core/RenderSystem.js`, `src/world/WorldGenerator.js`).
7) Add quest/dungeon hints in HUD (`src/ui/UIManager.js`).
8) Add dynamic enemy scaling on server (`server/internal/game/world.go`).

## Next 3 commits (suggested)
1) Add minimal repro scene + document how to run it.
2) Extract skill visuals to registry and remove switch chains.
3) Data-drive MeshFactory asset definitions with shared loader.
