# Scalable Dungeon Progression and Endgame Roadmap Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Replace Eidolon’s fixed per-dungeon level gates with a scalable dungeon progression system where all base dungeons unlock at level 30, players choose a run level band for normal runs while leveling, and Heroic/Mythic both unlock only at max level, then follow with dungeon-satisfaction features that make repeat runs worth doing.

Architecture: Decouple dungeon theme, run level, and difficulty. Dungeon theme selects layout/art/boss identity, run level selects the target scaling band, and difficulty selects the endgame multiplier set. Store chosen run level and difficulty in instance metadata so server combat/reward systems can scale from instance truth rather than hardcoded dungeon minimums. Layer room-clear, minimap state, event/chest cadence, and end-of-run polish on top of that progression model.

Tech Stack: Browser JS UI (`src/ui`, `src/core`), Go game server (`server/main.go`, `server/internal/game/world.go`), Jest for client tests, Go tests for server logic.

---

## Current-state facts confirmed before planning

- Existing dungeon entry lives in `server/main.go` under `MsgEnterDungeon`.
- Existing difficulty model already includes:
  - `normal`
  - `heroic`
  - `mythic`
- Existing hardcoded dungeon minimums live in `server/internal/game/world.go` inside `MinLevelForDifficulty(...)`.
- Existing dungeon menu UI lives in `src/ui/UIManager.js` in `showDungeonMenu(data)`.
- Existing minimap implementation lives in `src/ui/Minimap.js`.
- Existing reward summary behavior already exists and is covered by `tests/DungeonRewardFeedback.test.js`.
- Existing objective panel behavior already exists and is covered by `tests/QuestUIObjectivesPanel.test.js`.
- Existing entrance hint behavior already exists and is covered by `tests/DungeonEntranceHints.test.js`.
- Existing player max level is already effectively 100 and is enforced in server level-up loops in `server/internal/game/world.go`:
  - around lines ~4297-4304
  - around lines ~6941-6948
  - around lines ~7043-7051
- Existing item upgrade UI also treats 100 as max item level in `src/ui/ForgeUI.js`.

Conclusion: treat max level as canonically 100 and formalize it with a shared constant rather than continuing to rely on scattered literal `100` checks.

---

## Product rules to implement

### Dungeon progression rules

1. All base dungeons unlock at player level 30.
2. Before max level, players may only run Normal difficulty.
3. Players choose a run level band when starting a dungeon.
4. Initial run level bands:
   - 30
   - 40
   - 50
   - 60
   - 70
   - 80
   - 90
   - 100
5. Players may only choose a run level band up to their current level bracket.
   - Example: level 47 can run 30 or 40, not 50 yet.
6. Heroic unlocks only at max level.
7. Mythic unlocks only at max level.
8. At max level, all dungeons remain available and can be run at level 100 in:
   - Normal
   - Heroic
   - Mythic
9. Dungeon theme must remain independent from scaling.
   - Verdant Bastion is not “the level 30 dungeon forever” anymore.
10. Reward scaling must depend on chosen run level plus difficulty, not only dungeon theme.

### Dungeon satisfaction features to implement after progression refactor

1. Room-clear detection and state tracking.
2. Minimap room states:
   - unexplored
   - explored
   - cleared
   - objective
   - boss
   - exit
3. Room-clear rewards and visible reward bursts.
4. Dungeon micro-events:
   - chest rooms
   - shrine rooms
   - elite ambush rooms
5. Stronger end-of-run summary.
6. Endgame hooks for future Mythic+/affix work.

---

## Guiding design decisions

### Separate three concerns

Do not continue tying these together in one concept:
- dungeon theme
- dungeon run level
- difficulty

Represent them separately:
- `dungeonType`: art/layout/boss identity
- `runLevel`: 30/40/50/.../100
- `difficulty`: normal/heroic/mythic

### Canonical constants to introduce

Create shared server-side constants first:
- `MaxPlayerLevel = 100`
- `DungeonUnlockLevel = 30`
- `DungeonRunLevelBands = []int{30,40,50,60,70,80,90,100}`
- `EndgameDifficultyUnlockLevel = MaxPlayerLevel`

Mirror the same rules on the client for UI gating, but keep the server authoritative.

### Scope control

Do not attempt Mythic+ timers, affixes, leaderboards, or seasonal systems in this plan.
Those should be hooks only.

---

## Files expected to change

### Server
- Modify: `server/main.go`
- Modify: `server/internal/game/world.go`
- Create: `server/internal/game/dungeon_progression.go`
- Create: `server/internal/game/dungeon_progression_test.go`
- Modify: `server/internal/game/reward_summary_test.go`
- Modify: `server/internal/game/world_test.go`

### Client
- Modify: `src/ui/UIManager.js`
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/Minimap.js`
- Create: `src/data/dungeonProgression.js`
- Create: `tests/DungeonProgressionMenu.test.js`
- Create: `tests/DungeonProgressionRules.test.js`
- Create: `tests/MinimapDungeonState.test.js`
- Create: `tests/DungeonRoomClearFlow.test.js`
- Modify: `tests/DungeonRewardFeedback.test.js`
- Modify: `tests/DungeonEntranceHints.test.js`
- Modify: `tests/QuestUIObjectivesPanel.test.js`

### Player-facing docs/UI
- Modify: `index.html`
- Modify later when shipped: `tests/VersionPresentation.test.js`

---

## Phase 1: Formalize max level and scalable dungeon progression

### Task 1: Add canonical progression constants

Objective: Stop relying on scattered literals and codify the new progression model in one place.

Files:
- Create: `server/internal/game/dungeon_progression.go`
- Test: `server/internal/game/dungeon_progression_test.go`

Implementation:
- Add constants/functions for:
  - `MaxPlayerLevel`
  - `DungeonUnlockLevel`
  - `EndgameDifficultyUnlockLevel`
  - `DungeonRunLevelBands()`
  - `HighestUnlockedDungeonRunLevel(playerLevel int) int`
  - `IsEndgameDifficultyUnlocked(playerLevel int) bool`
  - `CanAccessDungeon(playerLevel int) bool`
  - `CanSelectDungeonRunLevel(playerLevel int, runLevel int) bool`
- Add tests first for:
  - level 29 cannot access dungeons
  - level 30 can access dungeons and choose run level 30 only
  - level 47 can choose 30 and 40, not 50
  - level 100 can choose 100
  - heroic and mythic unlock only at 100

Verification:
- Run: `go test ./internal/game -run TestDungeonProgression -v`

Commit:
- `git commit -m "feat: add dungeon progression rules"`

### Task 2: Replace hardcoded minimum-per-dungeon logic

Objective: Change server validation from per-dungeon base minimums to unlock-at-30 plus run-level selection.

Files:
- Modify: `server/internal/game/world.go`
- Test: `server/internal/game/dungeon_progression_test.go`

Implementation:
- Deprecate current `MinLevelForDifficulty(difficulty, dungeonType)` behavior.
- Replace with helpers that validate:
  - dungeon access at 30+
  - selected run level band unlocked by player level
  - heroic/mythic only at max level
- Keep dungeon theme-specific metadata for layout/boss identity, not access gates.

Verification:
- Run: `go test ./internal/game -run TestDungeonProgression -v`

Commit:
- `git commit -m "refactor: decouple dungeon unlocks from theme levels"`

### Task 3: Extend dungeon entry request to include run level

Objective: Server entry flow must accept and validate selected run level.

Files:
- Modify: `server/main.go`
- Modify: `server/internal/game/world.go`
- Test: `server/internal/game/world_test.go`

Implementation:
- Extend `MsgEnterDungeon` payload parsing to accept:
  - `dungeonType`
  - `difficulty`
  - `runLevel`
- Validate:
  - player must be in a party
  - player level >= 30
  - selected run level is valid and unlocked
  - heroic/mythic require level 100
- Update error messages to be player-friendly:
  - “All dungeons unlock at level 30.”
  - “You have not unlocked level 50 dungeon runs yet.”
  - “Heroic and Mythic unlock at level 100.”

Verification:
- Run: `go test ./...`

Commit:
- `git commit -m "feat: validate dungeon run levels on entry"`

### Task 4: Store run level in dungeon instance metadata

Objective: Instance truth must know target run level for scaling, summaries, and future systems.

Files:
- Modify: `server/internal/game/world.go`
- Test: `server/internal/game/world_test.go`

Implementation:
- Extend `DungeonInstance` with something like:
  - `RunLevel int`
- Update `CreateDungeon(...)` to accept run level.
- Add helpers:
  - `GetInstanceRunLevel(instanceID string) int`
- Ensure layout creation and instance bookkeeping retain the chosen run level.

Verification:
- Run: `go test ./internal/game -run TestCreateDungeon -v`

Commit:
- `git commit -m "feat: persist dungeon run level on instances"`

### Task 5: Scale rewards and labels from run level + difficulty

Objective: Rewards must reflect chosen run level and not only dungeon theme.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `server/internal/game/reward_summary_test.go`

Implementation:
- Update reward summary subtitle formatting to include run level where useful, for example:
  - `Tempest Spire • Level 80 • Normal`
  - `Abyssal Well • Level 100 • Heroic`
- Use `runLevel` as input into XP/gold/loot scaling.
- Keep current difficulty multipliers, but multiply on top of run-level scaling.

Verification:
- Run: `go test ./internal/game -run TestRewardSummary -v`

Commit:
- `git commit -m "feat: scale dungeon rewards by run level"`

### Task 6: Add client-side dungeon progression data module

Objective: Centralize client rules for menu rendering without scattering literals.

Files:
- Create: `src/data/dungeonProgression.js`
- Create: `tests/DungeonProgressionRules.test.js`

Implementation:
- Export:
  - `MAX_PLAYER_LEVEL = 100`
  - `DUNGEON_UNLOCK_LEVEL = 30`
  - `ENDGAME_DIFFICULTY_UNLOCK_LEVEL = 100`
  - `DUNGEON_RUN_LEVEL_BANDS = [30,40,50,60,70,80,90,100]`
  - helper functions mirroring server unlock logic
- Tests must mirror the same unlock behavior as server helpers.

Verification:
- Run: `npm test -- --runTestsByPath tests/DungeonProgressionRules.test.js`

Commit:
- `git commit -m "feat: add client dungeon progression rules"`

### Task 7: Rebuild dungeon menu UI around run level selection

Objective: Make the progression model understandable in the portal menu.

Files:
- Modify: `src/ui/UIManager.js`
- Create: `tests/DungeonProgressionMenu.test.js`
- Modify: `tests/DungeonEntranceHints.test.js`

Implementation:
- Update `showDungeonMenu(data)` to render:
  - dungeon selector
  - run-level selector
  - difficulty controls
  - clear unlock messaging
- Before level 100:
  - only show/select Normal
  - Heroic/Mythic appear locked with explanatory text
- At level 100:
  - unlock Heroic and Mythic controls
- If player level is 30+, all dungeons appear in selector.
- Disable run level bands above the player’s unlocked bracket.

Suggested copy:
- “All dungeons unlock at level 30.”
- “Heroic and Mythic unlock at level 100.”
- “Choose a dungeon theme, run level, and difficulty.”

Verification:
- Run: `npm test -- --runTestsByPath tests/DungeonProgressionMenu.test.js tests/DungeonEntranceHints.test.js`

Commit:
- `git commit -m "feat: add scalable dungeon progression menu"`

### Task 8: Wire client request payload to include run level

Objective: The browser must send selected run level to the authoritative server.

Files:
- Modify: `src/ui/UIManager.js`
- Modify: `src/core/GameEngine.js`
- Test: `tests/DungeonProgressionMenu.test.js`

Implementation:
- Ensure the enter-dungeon request payload includes `runLevel`.
- Ensure existing party/instance flows are preserved.
- Add targeted test coverage for payload shape.

Verification:
- Run: `npm test -- --runTestsByPath tests/DungeonProgressionMenu.test.js`

Commit:
- `git commit -m "feat: send selected dungeon run level to server"`

---

## Phase 2: Room-clear tracking and minimap state

### Task 9: Add server-side room state tracking

Objective: Track explored and cleared rooms per instance.

Files:
- Modify: `server/internal/game/world.go`
- Create: `server/internal/game/dungeon_room_state_test.go`

Implementation:
- Extend instance layout/runtime metadata with room state:
  - explored
  - cleared
  - objective
  - boss
  - exit
- Define when a room becomes explored.
- Define room clear as “all required hostiles in the room defeated.”

Verification:
- Run: `go test ./internal/game -run TestDungeonRoomState -v`

Commit:
- `git commit -m "feat: track dungeon room exploration and clears"`

### Task 10: Surface room-state payload to the client

Objective: Client needs room state data for minimap/objective rendering.

Files:
- Modify: `server/main.go`
- Modify: `src/core/GameEngine.js`
- Create: `tests/DungeonRoomClearFlow.test.js`

Implementation:
- Add/update a message payload carrying room state deltas or snapshots.
- GameEngine should cache the latest room-state data.

Verification:
- Run: `npm test -- --runTestsByPath tests/DungeonRoomClearFlow.test.js`

Commit:
- `git commit -m "feat: sync dungeon room state to client"`

### Task 11: Add minimap room-state rendering

Objective: Make dungeon navigation readable and satisfying.

Files:
- Modify: `src/ui/Minimap.js`
- Create: `tests/MinimapDungeonState.test.js`

Implementation:
- Draw room rectangles or markers for:
  - unexplored
  - explored
  - cleared
  - objective
  - boss
  - exit
- Keep visuals lightweight and legible.
- Preserve current overworld/party behavior.

Verification:
- Run: `npm test -- --runTestsByPath tests/MinimapDungeonState.test.js`

Commit:
- `git commit -m "feat: render dungeon room states on minimap"`

### Task 12: Improve objective routing from room-state truth

Objective: Tie the objective panel to the dungeon path rather than generic quest text alone.

Files:
- Modify: `src/ui/QuestUI.js`
- Modify: `tests/QuestUIObjectivesPanel.test.js`

Implementation:
- When in a dungeon, objective entries should optionally show state like:
  - “Clear the next room”
  - “Proceed to objective room”
  - “Boss room discovered”
- Keep existing quest rendering intact outside dungeons.

Verification:
- Run: `npm test -- --runTestsByPath tests/QuestUIObjectivesPanel.test.js`

Commit:
- `git commit -m "feat: route dungeon objectives through room state"`

---

## Phase 3: Room-clear reward cadence and dungeon events

### Task 13: Add room-clear reward bursts

Objective: Every cleared room should feel rewarding.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Create: `tests/DungeonRoomClearFlow.test.js`

Implementation:
- On room clear, award a small deterministic reward bundle:
  - gold burst
  - xp burst
  - optional shard/heart chance
- Show UI feedback:
  - banner/floating text/chat summary
- Do not flood the player with giant summaries every room.

Verification:
- Run: `go test ./internal/game -run TestDungeonRoomState -v`
- Run: `npm test -- --runTestsByPath tests/DungeonRoomClearFlow.test.js`

Commit:
- `git commit -m "feat: add room clear reward bursts"`

### Task 14: Add chest/shrine/elite-event room hooks

Objective: Introduce memorable intra-dungeon moments.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `src/core/GameEngine.js`
- Modify: `src/ui/UIManager.js`
- Create: `server/internal/game/dungeon_events_test.go`

Implementation:
- Add a minimal event model per room:
  - chest
  - shrine
  - elite ambush
- Start with deterministic spawn rules or simple seeded probabilities.
- Ensure events are room-based, not random spam.

Verification:
- Run: `go test ./internal/game -run TestDungeonEvents -v`

Commit:
- `git commit -m "feat: add dungeon event room hooks"`

### Task 15: Expand end-of-run summary

Objective: End-of-run feedback should reflect the richer dungeon loop.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `src/ui/UIManager.js`
- Modify: `tests/DungeonRewardFeedback.test.js`

Implementation:
- Extend summary with fields like:
  - rooms cleared
  - events completed
  - elites defeated
  - chosen run level
  - difficulty
  - time taken
- Keep the output concise, not spreadsheet-heavy.

Verification:
- Run: `npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`
- Run: `go test ./internal/game -run TestRewardSummary -v`

Commit:
- `git commit -m "feat: expand dungeon completion summary"`

---

## Phase 4: Endgame-only Heroic and Mythic completion pass

### Task 16: Make endgame difficulties feel meaningfully distinct

Objective: Heroic/Mythic should feel like true capstone modes, not just renamed stat inflation.

Files:
- Modify: `server/internal/game/world.go`
- Modify: `server/internal/game/items.go`
- Modify: `server/internal/game/items_test.go`

Implementation:
- Revisit difficulty multipliers once run-level scaling exists.
- Ensure Heroic/Mythic level-100 runs drop meaningfully better rewards than level-100 Normal.
- Preserve future hooks for affixes or Mythic+ without implementing them yet.

Verification:
- Run: `go test ./internal/game -v`

Commit:
- `git commit -m "balance: tune endgame heroic and mythic rewards"`

### Task 17: Add player-facing release notes when ready to ship

Objective: Surface the new progression model clearly to players.

Files:
- Modify: `index.html`
- Modify: `tests/VersionPresentation.test.js`

Implementation:
- Add patch notes covering:
  - all dungeons unlock at 30
  - selectable run levels
  - Heroic/Mythic at level 100 only
  - room clear rewards
  - minimap room states
  - dungeon events

Verification:
- Run: `npm test -- --runTestsByPath tests/VersionPresentation.test.js`

Commit:
- `git commit -m "release: ship scalable dungeon progression"`

---

## Testing strategy

### Focused client tests
- `npm test -- --runTestsByPath tests/DungeonProgressionRules.test.js`
- `npm test -- --runTestsByPath tests/DungeonProgressionMenu.test.js`
- `npm test -- --runTestsByPath tests/MinimapDungeonState.test.js`
- `npm test -- --runTestsByPath tests/DungeonRoomClearFlow.test.js`
- `npm test -- --runTestsByPath tests/DungeonRewardFeedback.test.js`
- `npm test -- --runTestsByPath tests/QuestUIObjectivesPanel.test.js`
- `npm test -- --runTestsByPath tests/DungeonEntranceHints.test.js`

### Focused server tests
- `go test ./internal/game -run TestDungeonProgression -v`
- `go test ./internal/game -run TestDungeonRoomState -v`
- `go test ./internal/game -run TestDungeonEvents -v`
- `go test ./internal/game -run TestRewardSummary -v`

### Full verification before each release slice
- From repo root: `npm test -- --runInBand`
- From repo root: `npm run lint`
- From `server/`: `go test ./...`

---

## Recommended ship slices

### Slice A: progression foundation
Ship first.
- canonical max-level/dungeon progression constants
- all dungeons unlock at 30
- run-level selector
- normal-only before cap
- heroic/mythic max-level-only gating

### Slice B: room-state navigation
Ship second.
- server room exploration/clear tracking
- client room-state sync
- minimap room states
- objective routing improvements

### Slice C: reward cadence
Ship third.
- room clear rewards
- clearer room completion messaging
- improved end-of-run summary

### Slice D: event pass
Ship fourth.
- chest rooms
- shrine rooms
- elite ambush rooms

### Slice E: endgame tuning
Ship fifth.
- heroic/mythic reward tuning
- future mythic+/affix hooks

---

## Non-goals for this plan

Do not include yet:
- Mythic+
- timed keys
- seasonal modifiers
- leaderboard services
- account-wide reputation system
- full unique-item overhaul
- full party summon/rejoin/ready-check system

Those should follow after scalable dungeons and dungeon satisfaction are live.

---

## Final recommendation

Implement Slice A next and ship it directly to `master` once verified.
That slice alone will:
- make all dungeon art/content evergreen from level 30 onward
- establish level 100 as the clear endgame threshold
- create a clean foundation for the rest of the dungeon loop improvements

After Slice A, immediately begin Slice B so the new scalable dungeon model also feels better to play, not just better on paper.
