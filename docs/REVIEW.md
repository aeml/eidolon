# Eidolon Review

## What the project is today
- Browser client served as static files (no bundler); entry point is `index.html` with ES modules loading `src/main.js` and Three.js from a CDN.
- Client runtime is orchestrated by `GameEngine` with an isometric `RenderSystem`, `InputManager`, `ChunkManager`, `CollisionManager`, UI, and entity classes.
- Asset loading is GLTF-based via `MeshFactory` with caching and pooling; environment is generated procedurally in `WorldGenerator`.
- Multiplayer is authoritative Go WebSocket server with delta/protobuf state updates and MongoDB persistence.
- Jest tests exist for core systems (collision, items, skills).

## What is working
- Chunk-based entity loading with cached active entity lists reduces per-frame iteration cost.
- Render pipeline is stable (orthographic isometric camera, basic lighting, shadow tuning).
- World generation uses instancing for trees and cached textures.
- Server architecture handles parties, trading, and instanced dungeons with spatial partitioning.
- Jest tests cover core gameplay utilities and provide a minimal safety net.

## What is fragile
- Large, highly coupled classes (`GameEngine`, `UIManager`, `Actor`, `MeshFactory`) make changes risky.
- Hard-coded behavior for skills, meshes, and visuals increases regression risk when adding content.
- Global event listeners and scene-wide resets make lifecycle management error-prone.
- Client/server dependency version mismatch can cause subtle runtime breakage.

## What is missing
- Basic dev tooling consistency (lint/format, client build/run scripts).
- Consistent instrumentation for network queue health.

## Safe improvements added in this review
- Perf overlay toggled by `?perf=1` with FPS/frame time/draw calls (`src/core/RenderSystem.js`, `index.html`).
- Debug toggle and perf overlay wiring (`src/main.js`).
- Smoke test script (`package.json` → `npm run test:smoke`).
- Minimal repro scene for perf/input debugging (`repro.html`, `src/repro.js`).

## Top 10 issues (ranked)
1) Three.js version mismatch between runtime and tests
- Evidence: `index.html:1101`, `package.json:10`
- User impact: rendering/animation bugs differ between runtime and tests; harder to debug issues seen in production.
- Technical cause: runtime loads Three.js 0.160 from CDN while tests use 0.181 from npm.
- Proposed fix: align versions (either update importmap to 0.181 or use local node_modules via a simple dev server).

2) GameEngine is a monolith handling UI, networking, input, and simulation
- Evidence: `src/core/GameEngine.js:43`, `src/core/GameEngine.js:63`
- User impact: changes to any subsystem risk regressions across input, UI, and networking.
- Technical cause: constructor wires UI callbacks, networking, entity creation, and game state in one class.
- Proposed fix: extract `NetworkClient`, `UIBindings`, and `EntityFactory` modules; keep `GameEngine` as coordinator.

3) Skill visual effects are hard-coded with large if/switch chains
- Evidence: `src/core/GameEngine.js:912`
- User impact: new skills require touching engine logic, increasing regression risk.
- Technical cause: per-class skill routing is inside `GameEngine.triggerRemoteAbilityVisuals`.
- Proposed fix: introduce a registry of skill visual strategies keyed by class + skill; leverage `SkillStrategy`.

4) MeshFactory is a large, duplicated switch tree
- Evidence: `src/utils/MeshFactory.js:252`
- User impact: slow iteration when adding enemies or NPCs; easy to miss animations or setup steps.
- Technical cause: per-entity hard-coded mesh loading/animation setup blocks.
- Proposed fix: data-drive mesh definitions (model path + animation list + scale) and reuse a shared loader helper.

5) UIManager is a single class that owns every UI panel and event listener
- Evidence: `src/ui/UIManager.js:4`
- User impact: UI changes are hard to isolate; UI bugs can affect unrelated systems.
- Technical cause: one class handles inventory, quests, trading, chat, skills, and HUD.
- Proposed fix: split into feature modules (InventoryUI, SocialUI, QuestUI, HUD) with a small shared event API.

6) InputManager registers global listeners without teardown
- Evidence: `src/core/InputManager.js:12`, `src/core/GameEngine.js:2795`
- User impact: reloading the game can stack listeners and cause duplicate input or memory leaks.
- Technical cause: no `dispose()` to remove event listeners; `GameEngine.destroy()` only cancels RAF.
- Proposed fix: add `InputManager.dispose()` and call it from `GameEngine.destroy()`.

7) Instance transitions clear the entire scene
- Evidence: `src/core/GameEngine.js:1062`
- User impact: heavy GC spikes during dungeon transitions and risk of losing persistent environment state.
- Technical cause: `enterInstance()` removes all `scene.children` rather than separating static/dynamic groups.
- Proposed fix: introduce scene groups (environment, dynamic, UI effects) and only clear the dynamic group.

8) UI updates run every frame without throttling
- Evidence: `src/core/GameEngine.js:3577`
- User impact: DOM churn and jank, especially on mobile and low-end devices.
- Technical cause: `render()` updates HUD, XP, hotbar cooldowns, enemy bars every frame.
- Proposed fix: throttle to 5-10 Hz and only update when values change.

9) Actor.update is a large, multi-responsibility method
- Evidence: `src/entities/Actor.js:85`
- User impact: hard to reason about combat state bugs; new effects increase risk of regressions.
- Technical cause: status effects, movement, animation, and networking are interleaved in one method.
- Proposed fix: introduce a small effect system that iterates effect timers and applies results separately.

10) Server spawns large fixed enemy counts without dynamic scaling
- Evidence: `server/internal/game/world.go:1197`
- User impact: high CPU load and large state broadcasts even at low player counts.
- Technical cause: fixed spawn counts (300 per sector) and no population scaling.
- Proposed fix: move spawn density to config and scale by active player count; add caps per instance.
