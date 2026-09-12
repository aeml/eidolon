# Shared paid-cast cooldowns — 1.1 development

The base Actor already pays mana and commits the authored skill cooldown with
equipment reduction, named Technique training and general class training.
Thirty offline class handlers then overwrote that result: Fighter (10), Rogue
(12), Wizard (7) and Cleric (1). Several also used obsolete base times, including
Whirlwind, Fan of Knives, Smoke Bomb, Flame Tornado and Mark of Weakness.

Removed only those duplicate writes. The shared Actor calculation, authoritative
multiplayer path, damage/effects, unlock gates and Teleport charge/recharge logic
remain unchanged. This restores the authored economy; it is not a new balance
curve or another 1.0.x release.

`OfflineCooldownConsumers.test.js` exercises real paid class casts for all 52
skills, at Technique rank 0/5 with and without generic class economy training:
208 cases. Equipment mana/cooldown reductions compose with training. Expected
values come independently from the shared server training catalog and authored
ability configuration. Immediate retries cannot spend mana or reset cooldowns.
Last Stand uses its actual low-HP precondition.

Initial RED: 91 failures / 117 passes, 7.424s. Of those, 87 were cooldown
assertions; four Time Warp failures came from the fixture's artificial 10,000
mana being correctly clamped during stat recalculation. The fixture now starts
at 500 mana, below that recalculated maximum; no clamp was removed from runtime.
After the fix, all 208 pass in 5.686s. Logs:
`/tmp/eidolon-offline-cooldown-consumers-{red,green}-20260912.log`.

Focused regression passes 7 suites / 349 tests in 7.063s, including ability
economy, real Teleport spare charges and trained recharge, Time Warp expiry,
Charge/Shattering Charge and Rogue damage. Log:
`/tmp/eidolon-offline-cooldown-consumers-focused-20260912.log`.
Full lint and diff whitespace checks also pass; lint log:
`/tmp/eidolon-offline-cooldown-consumers-lint-20260912.log`.

Full integrated regression remains required after merging. These offline checks
do not establish native party viability, earned progression, dungeon clear,
or completion of every talent. They cannot reclassify the retained four-player
native dungeon failure as a pass. Bundle this and ground-input QA batching into
1.1.0; retain the separate release 65 production gate.
