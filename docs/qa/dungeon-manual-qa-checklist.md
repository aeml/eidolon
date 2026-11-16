# Dungeon and 0.21 Closeout Manual QA Checklist

Goal: validate the 0.21 closeout build across dungeon reliability, menu polish, HUD sanity, loot/combat readability, and basic release readiness without depending entirely on ad hoc memory.

Scope:
- login/start flow basics
- verdant_bastion_catacombs
- abyssal_well
- molten_core
- tempest_spire
- crypt fallback behavior where applicable
- menu/modal/window flows touched in 0.21
- auto-loot/inventory behavior
- combat readability surfaces changed in 0.21

Core principles to verify:
- client visuals match server-authoritative walkable space
- players cannot locally drift into inaccessible outside-dungeon space
- server still authoritatively rejects/corrects illegal teleport/forced movement
- room and corridor joins are traversable without invisible blockers or gaps
- menu close behavior stays consistent and non-brittle
- HUD updates feel responsive without obviously wasting work or flickering

## Pre-check
- Pull latest master
- Start server and client normally
- Confirm test baseline is green:
  - go test ./internal/game
  - npm test -- --runInBand
  - npm run lint
- Open `repro.html` first for quick smoke checks before full live QA
- Use a character/build that can exercise movement edge cases:
  - Wizard teleport/blink
  - Fighter charge
  - Rogue shadowstep/backstab-shadowstep if available
- If possible, have one second player/client for multiplayer desync checks

## Repro-first smoke pass
Before full live login, use `repro.html` to sanity-check:
- telegraph preview readability
- loot burst readability
- jump landing impact preview
- menu/window close chrome preview
- Esc close on preview window
- perf overlay toggle if needed

Pass criteria:
- repro controls work without console errors
- preview window opens/closes cleanly
- preview text is non-selectable where intended
- quick visual checks can be done in under 2 minutes

## Login/start flow basics
- Load the main game start screen
- Verify current alpha version text matches intended release state
- Open patch notes from login screen
- Verify latest patch notes entry appears first and older entries remain intact
- Close patch notes using header close, backdrop click, and Escape
- Log in and enter world normally

Pass criteria:
- start screen is usable and version presentation is coherent
- patch notes history is preserved and latest entry is visible
- close interactions all behave consistently

## Test matrix
For each dungeon type and at least 3 generated instances per type:
- Normal path traversal
- Edge hugging of every room and corridor wall
- Corner traversal at every corridor turn
- Teleport/blink toward borders
- Charge/dash/forced movement toward borders
- Spawn/entry position correctness
- Recall/exit correctness
- Boss room transition correctness

## Checklist

### 1. Dungeon enter/exit
- Enter dungeon from overworld
- Verify spawn lands in the intended start room
- Verify player is not embedded in wall/collider
- Verify camera, entity visibility, and controls are normal
- Verify objective/minimap/room-state behavior does not point outside the playable footprint
- Exit/recall back to overworld
- Re-enter and confirm state is still sane

Pass criteria:
- start position is valid and stable
- no immediate correction jitter or snap loop
- no broken transition cleanup artifacts

### 2. Room-to-corridor connectivity
For every room transition in the run:
- Walk the center line through the opening
- Walk the left edge of the opening
- Walk the right edge of the opening
- Strafe back and forth across the threshold
- Repeat at corridor-to-room entry from the opposite direction

Pass criteria:
- no dead zones at doorway thresholds
- no invisible blocking where an opening is visibly present
- no visible gap that allows stepping outside the intended play area

### 3. Corridor corners and turns
At every L-turn / corner:
- Hug the inside corner
- Hug the outside corner
- Stop directly on the turn point
- Move diagonally through the turn
- Attempt to wedge into wall seams near pillars/corner geometry

Pass criteria:
- corner remains traversable
- no snagging that traps the player
- no seam allows stepping into non-playable floor/outside terrain

### 4. Edge hugging / outside-ground escape attempts
In every room and corridor:
- Follow all four room walls closely
- Follow both corridor walls closely
- Attempt diagonal movement into every wall junction
- Attempt repeated clicks at visible exterior-looking floor or terrain
- If any outside floor is visible, attempt to reach it from multiple approach angles

Pass criteria:
- local movement remains constrained to canonical walkable space
- player cannot end up on inaccessible outside ground
- server does not accept illegal positions

### 5. Teleport / blink boundary tests
Using Wizard teleport/blink:
- Target clearly inside current room center
- Target exactly near each room edge
- Target just beyond each room edge
- Target at corridor center
- Target at corridor corner
- Target just outside corridor width
- Target across an outer wall toward visible outside floor

Expected behavior:
- legal targets land correctly
- illegal targets do not leave the dungeon footprint
- server remains authoritative; client should not visually permit nonsense travel
- no recall should occur for legal in-bounds teleports
- any out-of-bounds handling should be deterministic and understandable

### 6. Charge / dash / shadowstep / displacement tests
Using movement abilities and enemy-targeted relocation skills:
- Charge along corridor center
- Charge at a wall at shallow angle
- Charge toward corridor corner
- Charge toward room exterior wall
- Shadowstep/backstab target near room edge
- Shadowstep/backstab target near corridor edge
- Any knockback/pull interactions near boundaries

Pass criteria:
- resulting position always remains in legal dungeon space
- no clipping through wall seams
- no server/client disagreement that leaves player stranded or rubber-banding excessively

### 7. Objective/minimap/room-state behavior
- Enter a dungeon and confirm objective panel reflects current goal
- Clear a room and verify room-state messaging/feedback updates
- Check minimap room markers if applicable
- Verify objective context stays aligned after movement and transitions

Pass criteria:
- dungeon progression is legible room to room
- UI guidance does not drift or show stale state

### 8. Menu close interactions
Exercise:
- ESC menu
- settings
- help
- patch notes
- report window
- inventory
- character
- social
- quests/journal
- skills
- world map

Checks:
- close buttons work
- Escape closes the topmost expected thing first
- opening one primary HUD window does not leave unrelated peer windows piled open
- non-input text does not behave like accidental selectable junk

Pass criteria:
- all close paths work
- no modal layering/input traps
- window chrome feels consistent

### 9. Auto-loot/inventory behavior
- Enable auto-loot
- Kill enemies and verify nearby loot pickup behaves consistently
- Continue playing long enough to cross normal runtime sync/update activity
- Open inventory and confirm bag state still looks sane
- Verify sort / gold display / inventory update behavior after loot changes

Pass criteria:
- auto-loot continues working after runtime sync
- inventory state remains coherent
- no repeated failure spam or stale UI state

### 10. Combat readability surfaces changed in 0.21
- Trigger major enemy telegraphs
- Check combat-intent / target feedback
- Observe buff/debuff tracker behavior during combat
- Trigger loot burst / room-clear / death-respawn feedback where possible
- Watch for HUD flicker or obviously redundant updates

Pass criteria:
- dangerous attacks are readable before impact
- target/intent feedback remains understandable
- feedback surfaces feel responsive but not noisy

### 11. Multiplayer authority / correction sanity
If two clients are available:
- Have one player stand near a boundary while the other observes
- Use teleport/dash near edges
- Verify remote player does not appear outside legal footprint
- Verify server corrections resolve consistently for both clients

Pass criteria:
- no persistent desync where one client sees out-of-bounds and the other does not
- corrections converge quickly

### 12. Boss room transitions
For each boss room:
- Enter boss room hugging left side
- Enter boss room hugging right side
- Fight near walls and corners
- Use movement abilities near the boss room perimeter
- After clear, attempt to traverse back through previous transition points

Pass criteria:
- boss rooms remain fully connected
- perimeter does not leak into outside space
- post-fight traversal still works

### 13. Failure/recovery behavior
- Attempt obviously invalid teleport target outside the dungeon
- Attempt movement spam against boundary seams
- If a correction occurs, verify player remains in valid reachable space
- Use recall/exit and re-enter dungeon

Pass criteria:
- no softlock
- no spawn into invalid area after recovery
- no permanent rubber-band loop

## Evidence to capture for any failure
- dungeon type
- approximate room/corridor location
- exact movement ability used, if any
- whether issue was local-only visual, server-authoritative, or both
- screenshot/video if available
- whether repro is 100%, intermittent, or seed-dependent

## Issue categories
- Connectivity gap
- Outside-ground escape
- Invisible blocker
- Bad spawn / recovery
- Teleport authority mismatch
- Dash/charge displacement bug
- Multiplayer desync near boundary
- Menu/modal close regression
- HUD churn / flicker / stale state
- Loot/inventory regression

## Recommended immediate follow-up if any bug is found
1. Capture the exact repro path and ability used
2. Identify whether canonical walkRects are wrong, client geometry is wrong, movement validation path is incomplete, or UI state/update logic is wrong
3. Add a regression test before fixing
4. Preserve server authority — fix legality at the server path first, then align client prediction
