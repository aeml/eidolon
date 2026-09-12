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

Native System Chrome verified the baseline Rogue ability/rune matrix twice on
1931575a (59.9 seconds and 1.0 minute; 2.1 minutes total, zero retries).
Artifacts: `/tmp/eidolon-smoke-area-native-pass-Ewt8KH`. This is baseline
compatibility, not the still-required trained purchase/persistence route.

Hosted run34692398507 exposed an existing shared-test fixture assumption:
JuggernautTraining enumerates all self-centered skills, but classified every
non-Fighter/non-Time-Warp skill as Cleric. Adding Smoke Bomb therefore tried
to render a nonexistent Cleric spell. The fixture now resolves the owning
class from the actual presentation manifest (including aliases), asserts
exactly one owner, and keeps all boundary/elevation assertions. The original
CI failure is retained; three focused suites/44 tests passed in1.409 seconds
after correction, as did lint/diff. Full CI must run on the corrected source.

The follow-up native candidate adds `smoke-area` to both the isolated route
selector and complete timed acceptance gate. A disposable level-prepared Rogue
selects Utility, buys Fine Motor ranks through normal phone controls, spends
real points, and casts at ranks0/1/5 in high/low quality. It checks paid mana,
accepted server radius, independently measured attached mesh radius and cast
origin; a fresh login must retain rank/points and produce the trained shape in
landscape. No synthetic talent assignments or earned-progression claim.
Observer tests retain rejected/missing-mesh evidence and single delivery across
reinstallation. This route is authored, not native-passing evidence yet.
