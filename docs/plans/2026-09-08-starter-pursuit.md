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
