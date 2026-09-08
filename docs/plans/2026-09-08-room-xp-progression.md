# Dungeon-room XP — consistent progression before reward tuning

The full balance pass remains open. This corrects when an existing room payout
advances progression; it does not change XP amounts, gold, dungeon levels or
the leveling curve.

`awardRoomExperienceLocked` used to add XP without checking the level threshold.
Only already-capped characters converted it into Resonance. A room could leave
a level-99 character above their threshold until some later combat/quest payout;
new skills, stats and normal level-up healing likewise lagged at lower levels.

The new production-room regression reproduces the issue for all four classes.
**6966 FAIL / 1.239s**, eight failed level-29/99 cases; already-capped controls
pass. A normal room still pays exactly 300 XP / 90 gold. Starting five XP short
leaves level 29 at 16,779 XP or level 99 at 5,751,248,525 XP instead of advancing.
Log `/tmp/eidolon-room-xp-before.log`.

The correction calls the existing `World.awardExperienceLocked` while retaining
the recipient lock and the room's once-only reservation. Remove the duplicate
accumulation-only helper. That shared path already owns class growth, talent and
branch unlocks, ordinary level-up healing, cap overflow and Resonance. No new
world/instance lock is acquired during the actor-locked level transition.

Regression coverage includes all four classes at 29/39/99/100, exact XP/gold,
immediate unlocks/stats/healing, 295 XP cap overflow, no heal for a capped-only
Resonance payout, and duplicate-clear rejection. These are prepared reward
probes, not earned level-29 dungeon entry or a browser playthrough.

First broader run **13099 FAIL / 3.501s** finds one outdated shrine/chest test
fixture: it gives a level-55 character a level-one 100-XP threshold, inadvertently
triggering a level-up while asserting no chest healing. Six old room fixtures
now use the canonical threshold for their stated level; their reward/resource
assertions remain unchanged. New near-threshold cases test healing separately.

Three race-enabled repetitions of the new progression cases, existing room
hooks/loot/expiry, real final-enemy room clearance, class-to-cap progression,
cap overflow and overlapping boss/daily audit pass **24435 / 11.575s**. Log
`/tmp/eidolon-room-xp-final.log`. Full server race **33425 PASS / root 17.500s /
game 286.052s**, other packages pass, on clean runtime **caf08cf**. Log
`/tmp/eidolon-room-xp-full-server.log`. All owned handles are closed. No client
runtime/protocol changes; server reward state is covered through the production
room-clear path, not a new browser playthrough.

This work is verified but unversioned. Integrate with the expanded story/balance
candidate; do not push root or bypass the sequential
release gate. It does not establish a balanced first hour or endgame economy.
