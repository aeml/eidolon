# Dungeon Manual QA Checklist

Goal: Validate dungeon reliability after canonical geometry and containment changes, while keeping the server authoritative.

Scope:
- verdant_bastion_catacombs
- abyssal_well
- molten_core
- tempest_spire
- crypt fallback behavior where applicable

Core principles to verify:
- client visuals match server-authoritative walkable space
- players cannot locally drift into inaccessible outside-dungeon space
- server still authoritatively rejects/corrects illegal teleport/forced movement
- room and corridor joins are traversable without invisible blockers or gaps

## Pre-check
- Pull latest master
- Start server and client normally
- Confirm test baseline is green:
  - go test ./internal/game
  - npm test -- --runInBand
  - npm run lint
- Use a character/build that can exercise movement edge cases:
  - Wizard teleport/blink
  - Fighter charge
  - Rogue shadowstep/backstab-shadowstep if available
- If possible, have one second player/client for multiplayer desync checks

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

### 1. Instance entry / spawn
- Enter dungeon from overworld
- Verify spawn lands in the intended start room
- Verify player is not embedded in wall/collider
- Verify camera, entity visibility, and controls are normal
- Verify minimap / objective context does not point outside the playable footprint

Pass criteria:
- start position is valid and stable
- no immediate correction jitter or snap loop

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

### 7. Multiplayer authority / correction sanity
If two clients are available:
- Have one player stand near a boundary while the other observes
- Use teleport/dash near edges
- Verify remote player does not appear outside legal footprint
- Verify server corrections resolve consistently for both clients

Pass criteria:
- no persistent desync where one client sees out-of-bounds and the other does not
- corrections converge quickly

### 8. Boss room transitions
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

### 9. Failure/recovery behavior
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

## Recommended immediate follow-up if any bug is found
1. Capture the exact repro path and ability used
2. Identify whether canonical walkRects are wrong, client geometry is wrong, or movement validation path is incomplete
3. Add a regression test before fixing
4. Preserve server authority — fix legality at the server path first, then align client prediction
