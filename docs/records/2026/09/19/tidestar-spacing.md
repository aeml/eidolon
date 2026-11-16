# Tidestar — wave-two spacing failure and bounded driver correction

Detached run `waterraid0919b`, PID3804247, ended with `RAID_PROCESS_EXIT=1`.
Read-only watch27144 is terminal. Guardian defeated; all five clients recorded
ritual start, wave1 start/clear and wave2 start. No player died. The remaining
waves, manual claims and saved re-login did not complete and are not accepted.

## Cause and correction

The Wizard's spacing planner chose a1.147-unit move from
(89977.37636983006,19227.552667064792) toward
(89978.42636682202,19228.012208118933). A second Cleric was moving from behind
the Wizard across that route. By the click probe it occupied
(89979.1015625,19229.361328125), within a combined actor radius of the destination.
The Wizard slid0.708units away and stopped; its recorded movement includes a
blocked target. This was not normal arrival and must not be made to pass by
lowering minimum displacement or widening arrival tolerance.

The recorded-layout regression produces the exact old move. The QA-only planner
now defers optional spacing while a nearby friendly moves, but only when already
in a useful firing band and within healer reach. The role can keep attacking.
Stationary allies and hostile actors do not trigger this hold; melee danger and
out-of-range movement keep their original planning. Any issued movement failure
remains fatal. No production collision, reward, health, gear or ritual change.

The new regression failed before the correction. All101 spacing, formation and
ground-input tests pass afterward, plus changed-file lint/diff checks. Actual
full connected acceptance is still required; do not rerun without preserving
these artifacts, and do not overlap a new five-browser run with release QA.

## Retained evidence

Log, sanitized browser results and report:
`/tmp/eidolon-water-raid-20260919-r2-z4qo0c/`. Sanitizer cleaned2 files.
Private checkpoint:
`/tmp/eidolon-party-checkpoint-waterraid0919b-pLDecR/save.archive.gz`, SHA256
`67f694ed8c8a2c0a390da3e13fb758a010fd7f685b88eb691af8c43c79190c31`.
Owned containers and18285/18286/4187 listeners are absent. The archive does not
authorize bypassing the approved15-minute dungeon logout expiry.
