# Eidolon Gameplay + Dungeon Reliability Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Improve moment-to-moment gameplay feel and progression clarity while fixing dungeon-instance generation bugs that allow broken room connectivity and out-of-bounds traversal.

Architecture: Treat this as two linked tracks. Track A improves player-facing gameplay feedback, combat pacing, dungeon motivation, and reward cadence. Track B hardens dungeon generation by unifying server layout semantics, client geometry generation, and movement-boundary enforcement so the playable space is defined once and validated everywhere.

Tech Stack: Vanilla JavaScript client, Three.js rendering/collision helpers, Go authoritative server, Jest for client tests, Go tests for server validation.

Status update as of `master` @ `cc0c5e9` (`feat: add dungeon entrance context hints (#18)`)
- Done: canonical dungeon geometry, layout validation, client containment, most server-side ability/displacement clamping, combat intent, objective tracker, loot feedback/auto-loot, boss reward summaries, dungeon entrance hints.
- Partial: dungeon objective guidance is missing clear evidence of minimap room markers/cleared-room tracking; dungeon reward feedback is stronger for bosses than for generic room-clear moments; canonical coverage appears strongest for `verdant_bastion_catacombs` and `abyssal_well` on the client wiring.
- Still open: authoritative handling of raw `move` packets in `server/main.go`, scene-group instance transition cleanup, pacing/encounter-role work, balancing/telemetry instrumentation, and likely dynamic enemy scaling.

---

## Why this plan exists

Current strengths
- Strong class/skill foundation, multiplayer combat, loot, dungeon roster, map/minimap, and boss content already exist.
- A useful roadmap already identifies core gameplay loop improvements like combat intent, quest hints, loot feedback, and objective visibility.

Current gameplay gaps
- Players likely have enough systems, but not enough immediate feedback and guidance in the core loop.
- Dungeon content exists, but reliability issues undermine trust in exploration and combat spaces.
- The game needs more “clarity per second,” not just more content.

Current dungeon-generation risks found in code review
- Server layout validity is represented only as rooms plus implied corridors; there is no explicit corridor list in `server/internal/game/world.go`.
- Client dungeon geometry is reconstructed independently in `src/world/WorldGenerator.js`, meaning the client and server can disagree on what is actually traversable.
- Server bounds checks in `IsLocationInDungeon()` reconstruct corridor geometry again, separately from the client, which is a third representation of the same dungeon.
- Client collision still uses global overworld bounds in `src/core/CollisionManager.js`, so dungeon containment is not authoritative on the client side.
- `src/core/GameEngine.js` clears and rebuilds the whole scene on instance entry, which adds fragility around transition state.

Likely root cause of “rooms don’t fully connect” and “player can walk outside dungeon onto inaccessible ground”
1. Layout semantics are duplicated in multiple places instead of defined once.
2. Corridors are inferred from room order instead of stored as canonical geometry.
3. Client-generated walls/openings/corners can diverge from server-reconstructed walkable space.
4. Client collision enforces scene bounds and placed colliders, but not an explicit dungeon walkable mask/polygon.
5. Teleport and movement rules are partially protected server-side, but ordinary client movement feel can still visually leak into non-playable areas if collision geometry has gaps.

---

## Track A: Gameplay improvements

Priority themes
1. Combat readability and intent
2. Dungeon objective clarity
3. Loot/reward responsiveness
4. Better progression pacing inside dungeons
5. Safer instrumentation for balancing

### Epic A1: Combat intent and target clarity

Objective: Make combat decisions obvious before the player clicks or casts.

Files:
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Modify: `src/core/AbilityController.js`
- Test: `tests/AbilityRangeInteraction.test.js`
- Test: `tests/GameSimulation.test.js`
- Create: `tests/CombatIntentUI.test.js`

Tasks:
1. Add hovered-target highlight state in the engine.
2. Surface target name/type/range state to UI.
3. Add “in range / move into range / blocked” target feedback.
4. Show soft damage-preview text for basic attacks and selected skills.
5. Add tests for hover-selection and range-state transitions.

Definition of done:
- Hovered enemies clearly indicate whether they are attackable.
- Skill targeting gives immediate feedback when the target is invalid or out of range.
- No frame-by-frame UI spam or flicker.

### Epic A2: Dungeon objective and navigation guidance

Objective: Make dungeon progression understandable without opening menus or guessing pathing.

Files:
- Modify: `src/ui/UIManager.js`
- Modify: `src/ui/WorldMap.js`
- Modify: `src/core/GameEngine.js`
- Modify: `server/internal/game/world.go`
- Create: `tests/DungeonObjectivesUI.test.js`

Tasks:
1. Add a lightweight dungeon objective panel with current wing/room/boss progress.
2. Add entrance/interact hints for dungeon entry objects.
3. Add minimap markers for current objective room and cleared rooms.
4. Add server payload support for dungeon progress state if not already present.
5. Add tests for objective panel rendering and state updates.

Definition of done:
- Players always know the next dungeon goal.
- Boss progression feels legible room to room.
- Minimap/HUD helps orientation without overwhelming the player.

### Epic A3: Loot feedback and reward cadence

Objective: Make rewards feel immediate, understandable, and worth chasing.

Files:
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Modify: `server/internal/game/world.go`
- Create: `tests/LootFeedback.test.js`

Tasks:
1. Add pickup radius feedback and clearer error throttling when loot is out of range.
2. Add rarity-forward flyout text and optional auto-loot rules for low-rarity items.
3. Add room-clear reward moments for dungeon rooms (gold burst, XP text, chest marker, or elite-clear notice).
4. Add basic drop-summary feedback after boss kills.
5. Add tests for client loot feedback behavior.

Definition of done:
- Loot pickup feels consistent and responsive.
- Players can tell when a room/boss rewarded them and why.
- No noisy repeated chat/errors from failed pickup spam.

### Epic A4: Dungeon pacing, encounter variety, and gameplay feel

Objective: Improve the actual feel of dungeon runs once reliability is fixed.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Create: `docs/plans/dungeon-encounter-matrix.md`

Tasks:
1. Define room roles: entry, travel, elite, event, boss, recovery.
2. Add per-room encounter tags in the server layout model.
3. Add short “breather” rooms or reward pockets between high-intensity segments.
4. Add elite-room modifiers and clearer telegraph expectations by room type.
5. Tune trash density and boss ramp so runs feel intentional, not samey.

Definition of done:
- Dungeons alternate intensity instead of feeling like flat repetition.
- Elite and boss rooms feel authored even when procedurally arranged.
- Reward cadence matches encounter intensity.

### Epic A5: Instrumentation for balancing and feel

Objective: Measure where dungeon runs feel too long, confusing, or unrewarding.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `src/core/GameEngine.js`
- Create: `docs/plans/gameplay-metrics-checklist.md`

Tasks:
1. Log room-entry, room-clear, boss-start, boss-clear timestamps.
2. Track deaths, recalls, and abandoned runs by dungeon type/difficulty.
3. Track loot count/value by room and boss.
4. Add temporary developer overlay output for current room metadata.
5. Use the metrics to inform a later balancing pass.

Definition of done:
- We can answer where players get stuck or leave.
- Balance decisions are based on run data rather than guesswork.

---

## Track B: Dungeon reliability and bug investigation/fix plan

This track must happen before deeper dungeon gameplay work.

### Epic B1: Canonical dungeon geometry model

Objective: Replace implicit room-order corridor inference with one canonical server-authored dungeon geometry model.

Files:
- Modify: `server/internal/game/world.go`
- Create: `server/internal/game/dungeon_layout_test.go`

Required model changes:
- Extend `DungeonLayout` to include canonical corridor records, not just rooms.
- Introduce typed structs such as:
  - `DungeonCorridor { FromRoomIndex, ToRoomIndex, SegmentType, Points, Width }`
  - or explicit rect segments like `DungeonWalkRect { X, Z, Width, Height, Kind }`
- Prefer a representation that can be consumed by both the server bounds validator and the client geometry builder without reinterpretation.

Tasks:
1. Add corridor or walk-rect types to the server model.
2. Update each dungeon layout generator to populate explicit connectors when rooms are created.
3. Remove hidden assumptions that corridor shape can be recomputed later from room ordering.
4. Write tests that validate every room has at least one valid graph connection except intended terminal boss rooms.
5. Write tests that the resulting walkable geometry is contiguous from the start room to every boss room.

Definition of done:
- The server owns one authoritative dungeon geometry description.
- Connectivity is testable without the client.

### Epic B2: Server-side layout validation and property tests

Objective: Catch bad dungeons before any player enters them.

Files:
- Create: `server/internal/game/dungeon_layout_validation.go`
- Create: `server/internal/game/dungeon_layout_validation_test.go`
- Modify: `server/internal/game/world.go`

Validation rules:
- Every room must be reachable from the start room.
- Every corridor segment must intersect/attach to its source/target room or neighboring segment with overlap, not just touch by a rounding accident.
- No room may be isolated.
- No segment may have invalid width/length.
- Optional: room spacing must avoid creating wall overlaps that seal openings.

Tasks:
1. Add a `ValidateDungeonLayout(layout)` function.
2. Add graph reachability validation.
3. Add geometric overlap/attachment validation for room-corridor joins.
4. Add repeated randomized-generation tests per dungeon type and difficulty.
5. Reject and regenerate layouts if validation fails.

Definition of done:
- Generated layouts are automatically retried until they pass validation.
- The bug “rooms don’t fully connect” becomes reproducible in tests if it reappears.

### Epic B3: Unify client generation with server geometry

Objective: Stop the client from inventing a different dungeon than the server thinks exists.

Files:
- Modify: `src/world/WorldGenerator.js`
- Modify: `src/core/GameEngine.js`
- Create: `tests/DungeonGeometryBuild.test.js`

Tasks:
1. Update the client instance builders to consume the new canonical corridor/walk-rect data.
2. Replace ad hoc reconstruction using `midX`, `midZ`, and room-order assumptions where possible.
3. Build floors, walls, corners, and openings directly from canonical geometry.
4. Ensure room openings are derived from actual attached corridor segments, not heuristics based on relative room centers.
5. Add client tests that a supplied layout produces the expected number of floors/corridors/openings.

Definition of done:
- Client-generated dungeon geometry is a direct rendering of the server-authored layout.
- Connectivity mismatches between client visuals and server traversal rules are eliminated.

### Epic B4: Explicit dungeon containment on the client

Objective: Prevent local traversal into visually or mechanically invalid space even if individual wall colliders have gaps.

Files:
- Modify: `src/core/CollisionManager.js`
- Modify: `src/core/GameEngine.js`
- Modify: `src/world/WorldGenerator.js`
- Create: `tests/DungeonContainment.test.js`

Key finding from inspection:
- `CollisionManager.checkCollision()` always clamps to global `CONSTANTS.SCENE.BOUNDS`, which are overworld-centric and not a dungeon-specific playable mask.
- Current dungeon containment appears to depend on placed wall/corner colliders only.

Required change:
- Add an explicit instance-local walkable area representation on the client, ideally matching the server’s canonical walk rectangles.
- During dungeon play, movement should be rejected or corrected if the candidate position is outside the walkable area, even if no collider was hit.

Tasks:
1. Add dungeon walkable area state to `CollisionManager` or a dedicated `DungeonCollisionModel`.
2. Set/clear that state when entering/leaving instances.
3. Add `isInsideDungeonWalkableArea(position)` and use it during movement resolution.
4. Keep colliders for walls/props, but make walkable-area checks the primary containment rule.
5. Add tests for attempting to move through a corridor gap or beyond room edges.

Definition of done:
- Players cannot walk onto inaccessible “outside ground” inside dungeons.
- Containment does not depend solely on perfect decorative wall placement.

### Epic B5: Harden server movement and teleport bounds enforcement

Objective: Make the server consistently reject invalid dungeon coordinates, not just some teleport cases.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `server/internal/game/ability_wizard.go`
- Create: `server/internal/game/dungeon_movement_test.go`

Findings:
- `IsLocationInDungeon()` exists and is used for at least Wizard teleport bounds checks.
- We need to verify normal movement/path updates also respect dungeon containment, not just teleport abilities.

Tasks:
1. Identify every code path that changes player position in a dungeon.
2. Ensure movement target updates are clamped/rejected using canonical dungeon geometry.
3. Ensure teleports, dashes, knockbacks, and forced movement all use the same validator.
4. Add tests for normal movement, teleport movement, and ability displacement near edges.
5. Define the fail behavior clearly: clamp, reject, or recall only for severe invalid states.

Definition of done:
- No movement system can place a player outside playable dungeon space.
- Server and client agree on legal positions.

### Epic B6: Instance transition and scene-group cleanup

Objective: Reduce instance-entry fragility and prevent scene rebuild side effects.

Files:
- Modify: `src/core/GameEngine.js`
- Modify: `src/core/RenderSystem.js`
- Modify: `src/world/WorldGenerator.js`
- Create: `tests/InstanceTransition.test.js`

Findings:
- `GameEngine.enterInstance()` currently clears the entire scene and rebuilds it.
- This was already flagged in `docs/REVIEW.md` as a major fragility point.

Tasks:
1. Introduce scene groups for persistent environment, instance geometry, entities, and effects.
2. Replace full-scene clearing with targeted instance-group replacement.
3. Ensure collision state is similarly scoped and rebuilt only for the instance layer.
4. Verify player mesh/camera/state reattachment is stable after transition.
5. Add tests around repeated instance enter/exit cycles.

Definition of done:
- Instance transitions are cheaper, less error-prone, and easier to reason about.
- Debugging dungeon bugs is simpler because scene state is no longer globally reset.

---

## Recommended execution order

Phase 1: Investigation and safety rails
1. B1 Canonical dungeon geometry model
2. B2 Server-side validation and property tests
3. B5 Server movement audit and bounds enforcement

Phase 2: Client alignment
4. B3 Unify client generation with server geometry
5. B4 Explicit dungeon containment on client
6. B6 Instance transition cleanup

Phase 3: Player-facing dungeon/gameplay upgrades
7. A1 Combat intent and target clarity
8. A2 Dungeon objective guidance
9. A3 Loot/reward responsiveness
10. A4 Dungeon pacing and encounter roles
11. A5 Instrumentation and balancing metrics

---

## Concrete bug hypotheses to verify first

Hypothesis 1
- Room connectivity bugs come from client corridor reconstruction logic in `src/world/WorldGenerator.js` not always matching the server’s implied corridors in `IsLocationInDungeon()`.

How to test
- Generate fixed layouts from the server.
- Serialize canonical room/corridor geometry.
- Build a debug overlay on the client showing room bounds, corridor rects, and wall openings.
- Compare server walkable rects against client geometry for the same seed/layout.

Hypothesis 2
- Out-of-bounds walking occurs because wall/corner collider gaps exist and there is no explicit dungeon walkable-area containment on the client.

How to test
- Add a debug mode that visualizes all dungeon colliders and walkable rects.
- Move along room and corridor edges and inspect any gap between colliders.
- Temporarily disable prop/wall collision and rely only on walkable-area containment to confirm the issue disappears.

Hypothesis 3
- Openings are being inferred from neighbor position heuristics in `createVerdantBastionCatacombs()` / similar builders, which can create mismatched walls when Manhattan corridor routing turns.

How to test
- Snapshot openings chosen for each room and compare them to actual attached corridor segments.
- Write a test that asserts every opening corresponds to at least one corridor attachment on that side.

---

## Test plan

Server tests
- `go test ./...` from `server/`
- New deterministic layout-generation tests for each dungeon type.
- New repeated randomized-generation tests (100-1000 seeds per dungeon type).
- New movement/bounds tests for normal movement and teleports.

Client tests
- `npm test`
- Tests for geometry build from canonical layout.
- Tests for client containment behavior.
- Tests for instance enter/exit cleanup.
- Tests for objective panel and combat intent UI.

Manual verification checklist
1. Enter each dungeon type 10+ times.
2. Try edge-hugging every room and corridor.
3. Try teleports/dashes/knockbacks at borders.
4. Verify no visible floor exists outside the playable area, or if it does, it is unreachable.
5. Verify minimap/objective panel tracks room progression correctly.
6. Verify reward cadence feels better after room-clear and boss-clear feedback changes.

---

## Deliverables

Minimum acceptable deliverables
- Canonical server-authored dungeon geometry
- Layout validation with regeneration on failure
- Explicit client walkable-area containment
- Server movement/teleport bounds hardening
- Regression tests covering connectivity and escape bugs

High-value follow-up deliverables
- Dungeon objective HUD
- Combat intent feedback
- Improved loot/reward feel
- Room-role encounter pacing
- Run metrics for balance

---

## Recommended first implementation slice

If we want the highest leverage first, do this exact slice:
1. Add explicit corridor/walk-rect geometry to `DungeonLayout` on the server.
2. Add `ValidateDungeonLayout()` with reachability plus geometric attachment checks.
3. Update `IsLocationInDungeon()` to use canonical walk rects rather than reconstructing corridors from room order.
4. Update client `WorldGenerator` to render the same canonical geometry.
5. Add client-side dungeon walkable-area containment.

That slice should directly address both reported dungeon bugs while creating a clean foundation for the broader gameplay improvements.
