# Eidolon Current State and Next Steps Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: bring Eidolon's documentation, engineering priorities, and next implementation slices in line with the current shipped game state on `master`, then continue with the highest-value gameplay/performance/polish work.

Architecture: Treat the next work as three linked tracks. Track A finishes structural cleanup that still creates risk during polish work. Track B improves dungeon replayability and pacing now that scalable progression is shipped. Track C keeps sharpening player-facing feel in menus, combat feedback, traversal, and onboarding.

Tech Stack: Vanilla JavaScript client, Three.js rendering, Go authoritative server, MongoDB persistence, Jest, ESLint, Go test.

---

## Current state summary

What is already shipped on `master`:
- four classes with skills, talents, runes, and combos
- four realms plus town
- four dungeons with scalable run-level progression
- all base dungeons unlock at level 30
- Heroic/Mythic unlock at level 100 only
- combat intent HUD, objective tracker, loot feedback/auto-loot, dungeon entrance hints, room-state rewards, buff tracker grouping, and death/respawn polish
- extracted `NetworkManager`, `AbilityController`, and multiple UI modules
- stronger jump/shadow/menu polish in the latest slices

What remains high-value:
- scene-group based instance transitions
- UI diffing/throttling
- data-driven content cleanup in MeshFactory/catalogs
- dungeon room-role pacing and replay-value work
- better repro/manual QA tooling
- audio/accessibility/onboarding follow-through

---

### Task 1: Add scene groups for environment, entities, and transient effects

Objective: remove broad scene teardown behavior from instance transitions.

Files:
- Modify: `src/core/RenderSystem.js`
- Modify: `src/core/GameEngine.js`
- Modify: `src/world/WorldGenerator.js`
- Test: `tests/GameEngineDungeonContainment.test.js`
- Test: `tests/GameEngineDungeonRoomState.test.js`

Steps:
1. Write/extend tests that prove instance entry/exit only clears dynamic content and keeps intended persistent scene structures intact.
2. Add explicit scene groups in `RenderSystem`.
3. Route world generation, entities, and transient effects into the appropriate group.
4. Update instance-transition cleanup to clear only the right groups.
5. Run targeted tests, then full JS/Go validation.

Commit:
- `git commit -m "refactor: add scene groups for dungeon transitions"`

### Task 2: Throttle and diff high-frequency HUD updates

Objective: reduce DOM churn without losing responsiveness.

Files:
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Modify: extracted UI modules that update every frame
- Test: relevant HUD-focused tests under `tests/`

Steps:
1. Identify HUD paths still updating every frame even when values do not change.
2. Add minimal state caching/diffing for those paths.
3. Introduce safe throttling where per-frame updates are unnecessary.
4. Verify no regressions in buff tracker, XP, objective, and combat-intent surfaces.
5. Run targeted tests and then the full JS suite.

Commit:
- `git commit -m "perf: throttle and diff frequent hud updates"`

### Task 3: Continue MeshFactory/catalog cleanup

Objective: make content additions safer and less switch-driven.

Files:
- Modify: `src/utils/MeshFactory.js`
- Modify: `src/utils/MeshCatalog.js`
- Test: `tests/MeshCatalog.test.js`
- Test: `tests/MeshFactoryLoader.test.js`

Steps:
1. Choose one more high-value cluster of hard-coded mesh/entity definitions.
2. Add or extend catalog-driven metadata for that cluster.
3. Replace hand-wired branches with catalog lookups.
4. Add regression tests for loading/fallback behavior.
5. Run targeted tests and then the full JS suite.

Commit:
- `git commit -m "refactor: expand data-driven mesh catalog coverage"`

### Task 4: Add dungeon room-role pacing metadata

Objective: make runs feel intentionally paced rather than uniformly procedural.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `server/main.go`
- Modify: `src/ui/QuestUI.js`
- Modify: `src/ui/Minimap.js`
- Test: server dungeon tests and relevant client dungeon tests

Steps:
1. Define a minimal room-role model (`travel`, `elite`, `event`, `reward`, `boss`).
2. Thread that role through authoritative dungeon state.
3. Surface the role where it improves guidance or reward presentation.
4. Add tests for room-role persistence and room-clear messaging.
5. Run targeted JS/Go tests and then full validation.

Commit:
- `git commit -m "feat: add dungeon room role metadata"`

### Task 5: Distinguish Heroic and Mythic more clearly

Objective: make endgame difficulty feel like more than just bigger numbers.

Files:
- Modify: `server/internal/game/world.go`
- Modify: reward-summary paths in server/client
- Modify: `src/ui/UIManager.js`
- Test: dungeon reward/progression tests

Steps:
1. Audit current difficulty multipliers and reward messaging.
2. Add one or two concrete distinctions that are player-visible.
3. Reflect the distinction in dungeon menu copy and reward summaries.
4. Add regression coverage.
5. Run targeted and full validation.

Commit:
- `git commit -m "balance: strengthen endgame difficulty identity"`

### Task 6: Build a tiny reproducible gameplay sandbox

Objective: make future polish passes cheaper and safer.

Files:
- Modify: `repro.html`
- Modify: `src/repro.js`
- Create or update: docs/checklist for how to use it

Steps:
1. Add a tiny deterministic scene that can spawn a player, sample enemies, and representative VFX.
2. Add toggles for jump, telegraph, loot/reward, and menu QA where practical.
3. Document how to run and use it.
4. Sanity-check perf overlay and basic manual workflows.
5. Commit once the path is useful for future QA, not just stubbed out.

Commit:
- `git commit -m "tooling: expand repro sandbox for gameplay qa"`

---

## Recommended execution order
1. Task 1 — scene groups
2. Task 2 — HUD throttling/diffing
3. Task 3 — MeshFactory/catalog cleanup
4. Task 4 — dungeon room-role pacing metadata
5. Task 5 — Heroic/Mythic identity pass
6. Task 6 — repro sandbox expansion

## Verification standard for every slice
From repo root:

```bash
npm test
npm run lint
```

From `server/`:

```bash
go test ./...
```

For UI/polish slices, add targeted manual checks for:
- dungeon portal menu
- respec modal
- patch notes/history screen
- ctrl-click jump and landing feel
- dungeon room-state/reward feedback

## Planning note
Older dated plan docs should be treated as historical snapshots. This file is the current handoff document for what to improve next.
