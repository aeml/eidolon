# Alpha 1.57 world event discovery and cohort checks

The four existing elemental event families now have server-published upcoming
windows, clearer atlas guidance and explicit reward instructions. This is local,
unpublished preparation after 1.56, not a deployed release. The preceding 1.55
CI is still active; the 1.56 calendar/operator decision remains open. Preserve
ordered publication, current saves and the existing event economy.

## Event behavior and discovery

The existing ten-minute Earth → Water → Fire → Air rotation is unchanged. Each
window announces at the start of its slot, activates after one minute if living,
connected overworld players are within 65 units, and expires at minute eight.
An empty event waits without spawning enemies. Three defended waves lead to a
Fracturekeeper; expiry and rotation remove only that event's temporary enemies.

| Realm | Ward objective | Existing recommended level |
| --- | --- | --- |
| Earth | Hold the central ward clear of attackers | 35 |
| Water | Follow the rune alternating between two river stones | 55 |
| Fire | Hold the outer annulus rather than the center | 72 |
| Air | Keep moving within the ward | 72 |

The server publishes the next three occurrences, with their actual identities,
sites and UTC start/end dates. This does not spawn future enemies, reserve an
event or change the calendar. Snapshots detach the schedule from shared state.
The atlas shows current and scheduled events under Events, with objectives,
lore, recommended levels and personal waypoints. An upcoming occurrence keeps
the same identity and coordinates when the server announces it. Local clock
expiry never promotes a scheduled event to active, and private instance maps do
not expose overworld event destinations.

The nearby objective remains optional and collapsible. It explains normal enemy
loot and nearby party XP, five-minute suppression of hazards within 400 units,
and the absence of a repeatable completion purse or reward claim. Additional
adventurers do not accelerate ward charge. A next-event line links discovery to
the atlas without adding another quest-tracker entry or mandatory daily chore.
Once the displayed calm deadline passes, the panel no longer calls the hazards
calmed; it says that the calm window ended without changing encounter authority.

Wave size remains `4 + 2 × min(nearby adventurers, 4)`, bounded at 12 enemies.
The champion retains its existing health multiplier, bounded at seven times
the base encounter monster's health. No new payout, loot, XP, damage or health
tuning was made. Presence near the event is not itself a personal loot claim;
normal combat ownership and party-credit rules continue to apply.

## Focused evidence

All public-event game checks passed under the race detector in 1.128 seconds.
The added prepared cohorts cover all four realms with 0, 1, 4 and 16 players:
inactive/other-instance actors do not inflate attendance, empty events spawn
nothing and expire, waves remain bounded, kills alone do not advance the ward,
each physical objective charges at the same rate, three waves reach the
champion, and completion affects only nearby hazards without adding Gold.
Schedule checks match the next actual occurrences and reject shared-state
mutation. These fixtures prepare deaths to isolate mechanics; they are not
earned combat clears, server capacity tests or all-realm balance acceptance.

The existing ordinary death-pipeline test now also runs with an event-tagged
enemy. It passed under the race detector in 1.504 seconds: party members at the
110-unit overworld boundary receive XP, Gold and unclaimed quest credit; members
just outside that radius or in another instance do not. It exercises real reward
delivery, not the full event encounter or all-party loot distribution.

Eleven event-controller and atlas unit checks passed in 0.730 seconds. Native
browser checks passed the new discovery route plus both existing nearby-ward
routes in 13.9 seconds. The final discovery fixtures explicitly initialize
desktop and mobile mode separately; both passed in 8.8 seconds, including
reachable waypoint controls, bounded text width, useful map height, occurrence
transition and instance cleanup. Both final atlas screenshots were reviewed.
Artifacts: `/tmp/eidolon-1-57-event-discovery-1001b`.

Mandatory browser discovery assigns all 258 cases exactly once. The existing
public-event presentation file now belongs to the interface stage; no new
parallel matrix or authenticated route was added. Forty-three browser-plan
checks passed in 4.487 seconds. Scoped lint and diff checks passed. No new soak,
campaign replay, production account write or infrastructure change was made.
The focused main-package socket probe also passed under the race detector in
1.168 seconds, retaining initial movement context through normal JSON/protobuf
messages. It is compatibility evidence, not a newly connected full encounter.

Retain the naturally scheduled earned Root clear in
[the earned continuation record](2026-09-20-earned-continuation.md): three waves,
champion and exact relogin rewards passed with an earned max-level Wizard.
That remains one Root encounter, not proof of Water, Fire or Air combat balance.
Real cohort pacing, overcrowded combat enjoyment and physical-phone checks
remain human playtest observations; do not manufacture those results from the
prepared mechanical cohorts.

## Remaining release work

Keep this branch unpublished until 1.55 is accepted and the necessary 1.56 policy
decision and release are complete. Review any event issues reported by players
without adding speculative queue splits or personal reward systems. Align the
1.57 version and cumulative patch notes, fresh-fetch and merge master, then push
normally. Luna monitors CI; independent exact public frontend/backend identity,
database readiness and changed-asset verification remain required. Source
documentation was reviewed; rendered documentation preview was unavailable.
