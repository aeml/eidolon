# Starter pursuit candidate — September 8

Actual5909 on ba5b7ae failed the opening after2kills/zero deaths in2.7minutes.
The120-second encounter ended at(261,-26),37HP/22mana,53retreats. Receipts show
attacks spread across several Skeletons and level30DemonOrcs; starter enemies
from(125,180)/(130,215) were still beside the player. Artifact scan0 and cleanup/
independent container absence pass. Health-aware inputs did not fix first-hour
pacing, and this failed run never reached collection. Do not rerun unchanged.

Inspection confirms target selection considers distance from the enemy's current
position, not its spawn. Thus an enemy can follow repeated ordinary retreats
indefinitely while each step stays within sight. Lost-target roaming also retains
the last chase destination until reached. This is a production pursuit problem,
although the automated retreat strategy contributes to the failed route and
combat balance/targeting still need actual play validation.

The candidate bounds ordinary level1–9 overworld Skeleton target acquisition to
60world units from their spawn. Outside their10-unit home patrol with no eligible
target, they walk home at their existing speed. There is no teleport, immunity,
healing, stat adjustment, player-level adaptation or reward grant. They can still
defend against another nearby player and still take ordinary damage. Existing
45-unit provoked response remains within their home boundary. Dungeons, raids,
elites, bosses, summons and other enemy families/levels are excluded.

This addresses starter trains, not every encounter or full first-hour pacing.
It does not approve the current collection balance, expanded31-chapter story,
experimental faster player attack cadence or a new deployment. Alpha47 remains
the candidate's version until this change is validated for integration.

Initial16963 passes the three new pursuit and three existing spacing tests in
0.314s. A continuous60-second retreat regression and broader server tests are
next. Fresh actual collection remains required after those checks.

Final36777 PASS7pursuit/spacing0.273s;8406 PASS226client version/regen checks;
28200 full lint/diff PASS. Full92956 **PASS** root4.235s/database0.035s/game119.618s,
terminal. All tested source remained frozen throughout both owned runs.

Actual38499 **FAILED2.5m** before collection: opening2kills/zero deaths,73HP/22mana
at(185.88,142.46),36retreats. No nearby Orc or distant starter train in the final
receipt; one level3Skeleton was5.69units away. The monitored level1 target was
idle47.19units away with28HP, while pending/hovered targets were null. The source
and simulation prove bounded pursuit, but this one actual run does not establish
overall survival or pacing improvement. The route needs to handle a disengaged
target rather than remaining attached to an out-of-range ID. Combat balance is
still open. Scan0/cleanup/independent exact-container absence pass. No unchanged
rerun or release approval. Both38499 and92956 are closed.

QA follow-up retains the production62791a5 pursuit change. After a retreat, a
living enemy outside basic range+2 with no active hostile auto-attack/chase can
be replaced by a currently visible Skeleton, acquired with an ordinary click.
Missing/dead targets remain available to the existing explicit failure/death
checks; no nearby replacement preserves the old target. Actual quest progress,
manual turn-in and120-second/two-respawn limits are unchanged. Collection rechecks
the previous target for delayed death before changing its observation.44250
passes35tests/three suites and lint; final missing-target/no-candidate coverage
and fresh actual verification follow. No direct targeting or movement writes.

Final79654 PASS36tests/1.986s and full lint/diff;3deaede committed. Actual23203
**FAILED4.0m**, terminal: opening3kills/no deaths and manual reward/login pass
45seconds, level5. Collection observed3target deaths/0seeds/0deaths, then a120s
encounter deadline.34retreats spread basic hits across several targets; final
readable receipt151HP/16mana, nearby one level1Skeleton. No unchanged rerun.
Scan0/cleanup/independent exact-container absence PASS. Failure capture viewed
and saved at `/tmp/eidolon-starter-reacquire-evidence-3d2EmT/failed-collection.png`.
This proves opening completion on this run, not collection or first-hour approval.

Next compare use of normally earned eligible equipment and stat points before
further enemy changes. Existing prepareEarnedClass is NOT directly usable here:
it requires level10 specialization and expects an open dungeon menu; opening ends
at5. A level-appropriate preparation path must not grant ranks, bypass a branch
gate, or discard the unprepared baseline. The observed opening reward remains
500XP→5 in this15-chapter candidate, unlike the expanded31-chapter worktree.
