# Teleport Warp rune — training and dungeon-wall repair, unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

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

## Offline Warp and landing follow-up

29851 reproduced six missing-damage failures with eight controls passing1.773s.
Offline Warp now snapshots the same damage/radius training for both endpoints,
uses actual recipient damage/shields, excludes nonhostile/dead/remote/inactive/
other-instance actors and respects each burst's canonical dungeon geometry.
It preserves Focus and has no multiplayer prediction damage. Four suites76tests
passed1.381s plus full lint (46901). This does not implement the Phase rune.

Landing probes2979 then reproduced two further failures0.709s: Teleport could
jump between disjoint room floors, and a12unit horizontal destination40units
below the actor incorrectly shortened movement to4.31units while changing height.
The offline movement now uses the existing server-matching canonical-floor
endpoint resolver, horizontal range and preserved actor height. Arrival burst
uses the actual clipped destination; real doorways still allow travel/damage.
Four suites79tests passed1.305s plus full lint (40912), with14original controls
and new movement/height cases retained. No runtime state bypass in native QA.

Logs `/tmp/eidolon-offline-warp-{red,green,landing-red,landing-green,lint}-20260911.log`.
Full integration remains required. Phase invulnerability/set charges, visual
burst boundary/remote parity, native gameplay/save and versioned publication are
still open. These local passes do not establish completeTeleport or1.1acceptance.
