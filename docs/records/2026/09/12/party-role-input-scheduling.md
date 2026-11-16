# Independent party-role reactions — 1.1 QA

The four-browser dungeon driver first awaited every role's warning/escape input,
then started healer and damage inputs. Thus an already-safe Cleric could not
heal while a Fighter or Rogue was still executing a dodge. This is a controller
barrier, not proof of a game cooldown, movement or balance defect. The retained
native warning trace already showed individual escape inputs taking roughly
1.6–1.8 seconds; those timings are not measurements of this new scheduler.

Extracted the existing two-stage scheduling into a pure helper. Two deferred
input regressions failed against that ordering (2 failed / 2 passed, 0.902s):
safe Cleric/Wizard actions did not start until the other role's escape resolved.
Log `/tmp/eidolon-party-role-scheduling-red-20260912.log`.

The helper now sequences safety -> allowed action independently for each role.
No role starts combat before its own safety decision and inputs never overlap
within a role. The caller joins all outstanding actions before inspecting the
round, including failure paths; the original error still propagates. Fighter
combat remains with the ordinary leader driver. Existing policies continue to
forbid unsafe casts and approaching a telegraph. Heals, targeting, hotbar input,
damage controls, roster selection, movement, death assertions, resources and
expedition deadlines are unchanged.

Focused checks pass 4 suites / 131 tests in 2.161s, including deferred slow-tank
and slow-Rogue controls, pending safety/action joins, original failure delivery,
existing party navigation, healing and damage controls. Log:
`/tmp/eidolon-party-role-scheduling-green-20260912.log`.

Native timing and four-role full-clear/manual-turn-in/reconnect proof remain
required. This fix cannot retroactively pass any retained failed party attempt.
Build separately on eb20789a while its hosted regression runs; do not mutate the
frozen primary or compete with production65 native GPU jobs. No release bump,
boss nerf, free resources or weakened survival requirement.
