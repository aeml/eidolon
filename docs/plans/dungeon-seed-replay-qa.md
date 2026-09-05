# Dungeon generation and traversal regression checks

The next dungeon hotfix adds generator version 1. A seed describes geometry,
not combat RNG or a complete replay of a party's gameplay. Saved geometry stays
authoritative when reconnecting; old saves without a seed remain supported.

## Capture a report

Record the client/server release SHAs, dungeon, difficulty, class/skill, room,
position, and visible symptom. While in the dungeon, the browser console can
inspect `window.game.getDungeonDebugOverlayData()`. Preserve `generationSeed`
as a string, plus `generatorVersion`, `generationAttempt`, `generationFallback`,
and the full layout. Seeds are signed 64-bit values and must not be converted
to JavaScript numbers. A fallback is not the seeded layout and must be reported
as such. Do not include account credentials or session tokens.

## Replay the current generator

Run from `server/`, using the recorded values:

```sh
EIDOLON_REPLAY_DUNGEON=abyssal_well \
EIDOLON_REPLAY_GENERATOR=1 \
EIDOLON_REPLAY_SEED=2026090501 \
go test ./internal/game -run TestReportedDungeonSeed -count=1 -v
```

This emits and validates the reproduced geometry. Use the matching source
version for older generators; the command rejects a version mismatch. Difficulty
currently changes encounters, not geometry. Verify reported combat separately
at its actual difficulty/run level instead of treating this command as proof.

## Automated coverage

- `TestProductionDungeonSeedSweep`: 100 explicit seeds × five dungeons × three
  difficulties (1,500 layouts), validated connectivity and required boss-room
  counts. It does not use global `rand.Seed`, which is a no-op in Go 1.24 by default.
- `TestProductionDungeonSurfaceFixtures`: compares current production generation
  with the checked-in client fixtures: three seeds per dungeon, plus one layout
  for each elemental raid and the Dark King raid (20 fixtures).
- `ProductionDungeonTraversal.test.js`: constructs actual client floors/walls
  and samples capsule collision through every fixture's room/corridor opening.
  Each sampled point must have exactly one floor and no movement correction.
- `production-dungeon-layouts.spec.js`: repeats the geometry check in a real
  browser at the production coordinates, with High/Low screenshots of each
  dungeon/raid family. This runs in the hardware-Chrome predeploy gallery gate;
  hosted software-rendered screenshot capture exceeded its five-minute timeout.
  These are rendered fixtures, not player-controlled runs.
- `regional-dungeon-gameplay.spec.js`: uses the town guide and ordinary mouse
  movement to enter Water, cross the former scene boundary, reconnect, recall
  through the Escape menu, and continue the identical instance/seed. Run it
  against disposable services with `EIDOLON_ISOLATED_QA_ROUTE=dungeons npm run
  test:e2e:isolated` from the repository root. This is a short real-player route,
  not a complete dungeon or boss encounter.
- `verdant-dungeon-gameplay.spec.js`: a fresh normal-level-30 run with a level-100
  QA character, ordinary walking, basic attacks and abilities through the first
  two bosses, room-clear checks, then recall. No forced kill or inside-instance
  waypoint is used. The overworld entrance waypoint provides temporary incoming
  damage protection; this tests functionality, not level-30 balance or survivability.
  Fighter QA selects Shield & Mitigation through the normal skill UI and uses
  Whirlwind/Shield Slam alongside basic attacks and gap-closing Charge; a bare
  starter weapon alone is too slow for the two-minute boss-check deadline.
  Use `EIDOLON_ISOLATED_QA_ROUTE=verdant npm run test:e2e:isolated`.

On Linux, `EIDOLON_ISOLATED_QA_NETWORK_MODE=host` avoids bridge/veth creation
while another browser job is running on the same machine. Both disposable
services bind only to loopback; Mongo uses the API port plus one and keeps
authentication enabled. The default remains an isolated Docker bridge.

Regenerate fixtures only after reviewing a deliberate generator change:

```sh
cd server
EIDOLON_UPDATE_DUNGEON_FIXTURES=1 go test ./internal/game -run TestProductionDungeonSurfaceFixtures -count=1
```

Ordinary test runs compare fixtures without writing them. A change to geometry
rules or random draw order requires an explicit generator-version decision.

## Still required for the 1.1 gate

Play real-server routes through ordinary encounters and boss kills, verify
rewards/quest credit and return/re-entry, and cover all classes, party departures,
death/recovery, and reconnect. Check movement skills and wall restrictions.
Fixture success does not close these gates or prove that every generated route
is fun, that a full raid works, or that the fallback run is progression-safe.
