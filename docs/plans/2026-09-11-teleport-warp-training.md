# Teleport Warp rune — training and dungeon-wall repair, unreleased

Separate worktree based on4f5d0439; neither the frozen four-role native source
nor the1.0.63release candidate is changed by this work.

Paid-cast regression89985 failed1.940s on the unchanged runtime. At both the
departure and arrival points, five Teleport Mastery ranks still dealt25rather
than30damage, and the trained5unit radius missed the target5.75units away despite
its1.25body padding. A target across the solid gap between dungeon rooms also
took25damage. Untrained, rune-absent, outside-radius and open-door controls
passed. Log `/tmp/eidolon-teleport-warp-red-20260911.log`.

The server now snapshots canonical training for both bursts, applies the
existing Mastery damage benefit and generic area bonuses, and checks each burst
against canonical dungeon floors. It retains the base25damage/4unit radius,
40mana cast cost, existing landing/range/cooldown rules, and one impact per
endpoint. Threat follows actual dealt damage. Teleport remains a utility cast:
its rune neither consumes nor borrows Spell Focus's damage boost. No saved IDs
or ranks, new currency, dungeon difficulty or class-balance rate is redefined.

Initial corrected run22538 passed2.270s. Expanded checks cover active Spell Focus,
both ends of a wall, overlapping bursts, dead/friendly/other-instance targets,
and repeated existing Teleport, dungeon movement, Focus and impact regressions.
Expanded run27101 passed three repetitions with the race detector in43.896s.
Logs `/tmp/eidolon-teleport-warp-{green,focused}-20260911.log`.

This is not a complete Teleport or160-talent acceptance. Offline Teleport still
needs its missing rune behaviors; both-client visual presentation and trained
burst boundaries, broader receiving-defense/death/credit coverage, full
regression, native purchase/save/gameplay and versioned deployment remain due.
Non-damaging utility Masteries need an explicit coherent benefit review; this
damage-rune repair does not make base Teleport a damaging spell or repair
Spell Focus/Time Warp Masteries.
