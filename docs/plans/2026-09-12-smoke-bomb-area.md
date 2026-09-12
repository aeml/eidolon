# Smoke Bomb consumes Fine Motor training

The accepted source's diagnostic talent overlay passed (seven probe functions,
7.062 seconds), but it does not enumerate all 160 talent consumers. Independent
inspection found Smoke Bomb still used a fixed five-unit radius on both server
and offline client despite Fine Motor (`ROG_34`) promising +3% AoE per rank.
The cast also omitted its accepted radius and published the cursor position
instead of the self-centered detonation position.

The candidate applies existing area training to real server casts and offline
target checks: rank0/1/5 radii are 5/5.15/5.75. The server publishes accepted
center/radius/full-circle arc; local and remote visuals use that footprint.
Offline targeting now matches planar body-padded reach, wall and friendly/dead/
other-instance exclusions, and crowd-control immunity. Immunity still blocks
the slow, not the existing accuracy reduction. Area training changes neither
the 50% slow nor the 30% accuracy penalty, mana cost, cooldown or duration.
Dirty Tricks duration remains independent. No multiplayer damage or debuffs
are predicted by the offline helper.

Server regressions buy Fine Motor through the actual unlock operation and
check spent points, paid casts, both edges of the radius, normal/large bodies,
CC immunity and accepted shape, plus wall/relationship exclusions. The initial
test fixture incorrectly assumed ten points at level100; it was corrected to
use the character's recomputed entitlement before recording the meaningful
red run. Client regressions initially failed8/9 cases. After the implementation,
eight client suites/194 tests passed in2.222 seconds; targeted Go race tests
passed in5.592 seconds. Lint/assets/diff checks passed.

Logs: `/tmp/eidolon-smoke-area-{server-red,server-green,client-red,client-green,expanded,lint,assets}-20260912.log`.
This is one area consumer, not sign-off for all Rogue talents: nondamaging
utility Mastery/critical bonuses and other area skills still need individual
review. Full hosted CI and native trained purchase/cast/persistence verification
remain required. No deployment or version bump is claimed.
