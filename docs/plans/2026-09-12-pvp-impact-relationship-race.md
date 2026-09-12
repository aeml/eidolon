# Delayed attack relationship snapshot — 1.1.0 candidate

## Component acceptance — September 12

Full hosted CI34724352226 completed SUCCESS on exact
03aef5b228e0a6a8356e227743a2c96c10ac7a17. Client420 suites/6489 tests pass;
server game coverage102.974s/87.0%, race360.608s; all three browser shards pass.
Complete log `/tmp/eidolon-pvp-full-ci-34724352226.log`.
Native/predeploy/deployment/live stages skipped, not passed. Together with the
reproduced race and repeated corrected real two-round attack tests below, this
accepts the concurrency component for integration. Fresh merged CI and broader
native ranked-party acceptance remain required; this is not milestone approval.

The focused1.1 PvP audit on802d216a exposed a real data race in the normal
two-round2v2 attack pipeline. Match completion restores InstanceID/X/Y/Z under
World/Entity locks while delayed applyAttackImpact calls CanDamage on unlocked
live actors; CombatRelationship/inSafeZone reads the same mutable fields.
Original log `/tmp/eidolon-1-1-pvp-gate-audit-20260912.log` retains the failure.
Practice reward/database and direct elimination cases passed; the race is not
an assertion that team scoring or practice rewards were wrong.

A dedicated concurrent scene/party transition regression also reproduces the
race before the fix (0.074s). Delayed relationship checks now copy only the
required identity/type/instance/party/ground-position fields under World→Entity
ownership, holding one actor lock at a time and releasing actors before PvP
lookup. Instance/dead/stun validation and actual damage remain on the existing
locked impact path. No match rewards, timing, damage, restoration or PvP consent
rules were changed. Ordinary admission still uses its existing World lock.

The first corrected set passes three repetitions41.585s including actual
two-round2v2 attacks. An allocation review identified two avoidable heap objects;
the final helper uses nonescaping local snapshots. Expanded relationship tests
cover PvE, town safety, mismatched scenes, NPCs, flagged/unflagged players, party
allies, absent targets and self, alongside existing actual arena tests.
Final selected race suite passes three repetitions41.223s. Microbenchmark on
this machine:194.1ns/op,0B/op,0allocs/op (not a full-server performance verdict).
Logs `/tmp/eidolon-pvp-impact-snapshot-{red,green,final-race,bench}-20260912.log`.

Integration, broader native ranked-party evidence and
production delivery remain required. This does not close1.1 or later milestones.

## Draft 1.1.0 patch note

- Fixed a concurrency issue when delayed attacks overlap players returning from
  a completed arena match.
