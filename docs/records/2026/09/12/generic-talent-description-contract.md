# Generic talent descriptions — authoritative copy for 1.1

Audited the generic class descriptions against existing server TalentBonus
definitions and their derived-stat application. Twenty-eight descriptions
advertised a different stat, percentage or scope: eight Fighter, eight Rogue,
five Wizard and seven Cleric. Examples include Quickhands promising attack speed
instead of movement speed, Frontliner Routine promising damage reduction instead
of maximum health, and several cooldown talents showing the wrong percentage.

Corrected those descriptions only. No server/runtime bonus, talent name/ID,
rank cap, point cost, saved investment or client effect metadata changed. Damage
stat bonuses are called that explicitly rather than promising a multiplier on
every spell. Flat primary attributes/defense, maximum health, movement, cooldown
reduction, skill damage and area radius use their actual authored values.

The shared `testdata/generic_talent_copy.json` contract records each corrected
description and its exact existing server bonus. Go checks the whole bonus
struct, class counts, uniqueness and five-rank caps; client tests check the same
IDs, caps and displayed description. Initial server contract passed0.008s on
unchanged server runtime while all28 client descriptions failed0.887s. After
copy correction, focused5suites/76tests pass1.618s, including prior healing,
duration, economy and Iron Fortress checks. Changed-file lint and diff whitespace
also pass. Logs use `/tmp/eidolon-generic-talent-copy-` with `server-contract`,
`server-race`, `client-red`, `client-green` and `lint` suffixes plus `-20260912.log`.

This proves description/definition agreement, not every gameplay consumer.
Full160-talent usability, remaining ineffective utility Masteries, offline
generic-stat parity and native build acceptance remain separate requirements.
No missing consumer is declared repaired merely by changing its description.
Full integrated regression/rendered menu checks remain pending. This candidate
also contains the separately prepared Fortress native acceptance route; it has
not been run or declared passed. Bundle into1.1.0, not another1.0.x release.
