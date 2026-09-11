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
