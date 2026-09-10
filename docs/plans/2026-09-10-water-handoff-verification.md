# Correct the fresh Earth → Water verification contract

Status: local QA correction; full regression passed, native full-route acceptance
is pending. No runtime, authored quest ordering, reward, version or deployment
change. This does not waive any campaign completion requirement.

## Confirmed mismatch

The existing `verifyEarthDungeonChronicleTurnIn` waits for
`chronicle_water_flood_shelter` immediately after manually completing Earth.
The expanded server catalog instead inserts `chronicle_water_missing_ferry`
after `chronicle_03_roots_remember`, before that shelter. `quests.go` builds the
expanded catalog and `ensureChronicleLocked` offers only the next unfinished
required chapter. `chronicle_hunts_test.go` already checks both neighbors of all
eight authored hunts. The generated client catalog matches that server content.

Consequently, expecting the shelter on a fresh character skips a required hunt.
This is a verification defect, not a reason to change the game's story ordering.

## Correction and checks

The new read-only `verifyFreshWaterHandoff` resolves the immediate expedition
from the shared authored catalog, checks it is a Water chapter, and requires its
replicated offer to be unaccepted, incomplete and at zero progress. It rejects
an early shelter offer rather than silently accepting the old ordering. The
dungeon helper runs it after the manual claim and again after ordinary login.
Existing kill-credit, manual reward and sealed/open Rootheart checks remain.

Focused24439 TERMINAL PASS106tests/7suites1.958s plus lint underNode24.18.0.
Coverage includes the authored transition, immutable replicated state, absent
offer, premature shelter, auto-acceptance, completion/credit injection and both
turn-in/relogin call sites, alongside existing hunt/class/dungeon/phase guards.
Logs `/tmp/eidolon-water-handoff-unit-final.log` and
`/tmp/eidolon-water-handoff-lint-final.log`.

Initial50529 failed one new test due to a Jest table-fixture shape mistake: an
empty array row was interpreted as a done-callback test. Wrapped each quest-array
scenario in a named object, preserving every negative case, then reran the
focused suite. The original failed log remains
`/tmp/eidolon-water-handoff-unit.log`; no native failure was relabeled.

## Active attempt and next verification

September10 follow-up: session96530 has terminated with exit1 at the first
Verdant boss's survival assertion, before reaching this handoff. Its original
failure is preserved in the primary branch's earned-Verdant failure plan; this
correction did not cause that result and does not turn it into a pass.

Full regression session88068 on clean4e4d46b1 exited0:289 suites,4074 tests,
137.043s, followed by passing lint under Node24.18.0. Logs:
`/tmp/eidolon-class-handoff-full-client.log` and
`/tmp/eidolon-class-handoff-full-lint.log`. This verifies the class-input and
handoff changes together locally, not a native clear or live deployment.

Historical run constraint: the owned Wizard attempt96530 ran on frozen626385d, which contains
the old shelter assertion. Do not alter that source mid-run. If it reaches the
handoff, retain its exact failure/evidence as such; it cannot become a full pass
by retroactively applying this correction. Its actual dungeon combat evidence
can still identify gameplay problems. This separate branch also includes the
class-input correctionc884455; full regression and integrated native acceptance
must be run after the current attempt finishes, without a second heavy/browser
workload competing with it.
