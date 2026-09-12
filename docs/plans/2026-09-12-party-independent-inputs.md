# Independent four-player combat inputs

Receipt-instrumented run17214 (a45a75f6, seed8963121954055646641) failed when
Rogue died after164.191 seconds against the first Rootbound Warden; the last
periodic boss observation was2517/15000HP. All four legal level30/common-gear
roles entered, cleared DemonOrc, recovered naturally in town and resumed the
saved instance. This is not a dungeon clear, reward-credit or Water handoff pass.
Archive: `/tmp/eidolon-party-receipts-failure-nVswij`.

Real receipts show Healing Light delivering180HP to the deliberately selected
Rogue and Wizard, with corresponding caster and recipient events. Guardian
Embrace delivered its ordinary ticks. Cleric delivered5221 effective ally
healing during this boss, ending at23mana when Rogue died. Rogue's last repeated
184damage hits occurred around7.47units from the boss, with some corresponding
quake warnings; this is not evidence of missing healer packets. It also does
not establish that current dungeon balance is acceptable.

The test's round barrier prevented any player's next safety check until every
role's current movement/cast finished. This does not model four independently
reacting players. The candidate gives Cleric/Wizard/Rogue one serial async input
loop each during combat. Fighter remains exclusively owned by the original
leader driver. Each role retains its warning policy, observed hover acquisition,
paid skill checks and tank-hit opener. There is no overlapping input within a
browser, hidden invulnerability, boss adjustment or extra prepared resources.

Workers stop and join before post-encounter snapshots, travel or cleanup. A
worker failure stops the group and is propagated; an already-recorded route
failure is not replaced by a secondary cleanup failure. Tests verify repeated
healer observations while Rogue is delayed, serial input ownership, joining
active operations and pauses, and failures in either step or pause.

Full four-player native replay remains required. The previous failures stay
recorded; scheduling tests alone do not prove a successful clear or balancing.
