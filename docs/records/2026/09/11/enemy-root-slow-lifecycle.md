# Enemy root/slow lifecycle — confirmed follow-up

58148 exited1 (game2.457s) with the new ordinary-cast diagnostic; the prior six
targeted talent groups still pass. On the repair branch, actual paid Gravity Well
with Black Hole damages, slows and marks an enemy rooted, but its next normal
tick moves it1unit instead of0. After both captured deadlines are advanced into
the past, root/slow remain active and speed remains4 instead of authored8.
Paid Juggernaut Charge correctly moves at its60% slowed speed3.2 before expiry,
but keeps that speed and slow flag after expiry (0.8units/tick instead of2).

Log `/tmp/eidolon-enemy-root-slow-red.log`. Fixtures use a living distant enemy
in a separate nonsafe instance, authored BaseSpeed8, ordinary paid damaging
casts, real updateEntity and a simulated deadline crossing. This is not native
browser or earned character evidence. No runtime change in this reproduction.

Root/slow expiry is currently player-only, and enemy chase/roam ignores Rooted.
Repair must preserve root allowing attacks in range, slow applying once to
authored speed, DOT and summon owner/lifetime cleanup, CC immunity and dungeon
walls. The independent frozen next-stun candidate475c6d27 remains unchanged.
This follow-up is required gameplay work, not a reason to relabel earlier
stun-specific acceptance as a complete crowd-control audit.

## Repair and focused acceptance

Common enemy/NPC ticks now expire root and slow; slow expiry clears its factor
and recalculates stats to restore authored BaseSpeed. Root stops chase/roaming
without blocking attacks in range. Seraph following preserves its authored6
speed, applies slow once, and stops for root while retaining owner/lifetime
cleanup and dungeon-wall movement. No changes to damage/rewards/quest progress.

The first standard contract run reproduced a separate Juggernaut Charge bug:
it slowed CC-immune targets. Its slow assignment now checks CCImmune while
ordinary damage/threat/death handling remains unchanged.

54507 focused race PASS22.560s covers root/slow overlaps, roaming, in-range
attacks, Seraph follow/lifetime, paid immunity, existing stun/impact, poison,
Seraph, dungeon enemy movement/walls and authored slow recalculation. Log
`/tmp/eidolon-root-slow-contract-green.log`; preceding immunity failure preserved
in `/tmp/eidolon-root-slow-contract-first.log`.

The original paid Gravity Well/Black Hole and Juggernaut diagnostic is promoted
unchanged into the normal suite as TestPaidEnemyRootAndSlowLifecycle.53763
three consecutive focused race passes7.482s including all new root/slow cases,
`/tmp/eidolon-root-slow-paid-repeat.log`. Original overlay also passed2.980s in
`/tmp/eidolon-enemy-root-slow-green.log`. No native/earned-party/completeCC audit
claim; full integration suite and deployment remain required.
