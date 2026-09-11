# Primary progression — accepted-fix integration

Status: local integration with full Go/client/lint and 116 browser cases passed;
native four-role dungeon clear and release acceptance remain open. This is not a new
published version or completion of the full1.1–1.10 roadmap.

## Sources and intent

Integration worktree `/tmp/eidolon-primary-current-1YoZU4`, branch
`work/primary-current-20260911`, merges primary8f37e2bd with successor689b0142
(accepted application a0cda0ff). Both original worktrees remain unchanged.
The successor's scoped native/full/browser proofs remain evidence for that
source, not automatic proof of this combined expanded-story application.

The next four-browser party run should use the current aura batching, socket/
equipment presentation, Forge refresh and trained ability consumers rather than
retesting the old primary's visual runtime. The earlier single15FPS screenshot
is not a benchmark and does not establish a speedup from this merge.

## Conflict decisions and retained scope

- Preserve expanded Chronicle chapters, hunts, investigations and reward/XP
  budgets, crystal repair/resume mechanics and Dark King phase protections.
  On-kill explosions, shield explosions and reflection retain the primary's
  actual phase-boundary damage cap. No later-stage story logic is discarded to
  match the narrower hotfix candidate.
- Preserve the exact primary four-role controller, healer triage, body-clear
  formation/escapes, checked ground projection and arrival rules,120-minute
  fixed overall profile and existing encounter/stall/death limits. Prepared
  gear, resources, rest threshold and manual individual turn-ins are unchanged.
  Keep stronger empty-stash and earned-storage fixture coverage too.
- Keep both Forge and ChronicleSite move-only regression targets and both sets
  of ground-input checks. Spin's lethal dispatch joins party-credit tests.
  Reward receipt assertions count total XP across any level boundary, preserving
  exact receipt equality rather than assuming the recipient cannot level up.
- Preserve the timed required-all sequence and its stop/cleanup behavior. Add
  Guardian Roar, Executioner Spin and Forge/socket routes; party support invokes
  both the existing phone route and desktop support. Keep expanded earned story
  readiness, not the successor's earlier short collection-only checkpoint.
  Well Rested transitions remain inside its complete helper.
- The shared browser runner now includes the primary's mandatory crystal-art
  stage, with separate artifacts and fail-closed coverage discovery. No crystal
  or interface coverage is lost through the CI merge. One worker is retained.
- Inherit Alpha1.0.60 metadata and its historical notes without claiming this
  primary tree is live. Docker's build identity stays after dependency layers,
  with one matching version declaration. No1.0.61 or1.1 assignment or push.

Exact comparisons against8f37e2bd found no changes to Chronicle expansion/hunts/
content, XP/quest budgets, raid phase logic, explosion/impact phase safeguards,
four-role route/timing, ground helper and earned/initial stash fixtures. Other
automatic merges were reviewed alongside the focused tests, not accepted solely
because Git could merge them.

## Verification — September11 02:53

-48039 passed96 tests/11suites5.885s and full lint. Conflict-sensitive movement,
  release sequencing, browser orchestration and party timing are covered.
-3282 passed292 tests/3suites2.359s, including exact timed command order and
  every-stage failure cleanup, version presentation and crystal-art retention.
  Exact discovery then verified116 cases with no omissions/duplicates. This is
  discovery only: it does not run browsers or replace rendered acceptance.
-72528 passed focused server race24.645s: party credit/receipts/explosion locks,
  Spin/Roar/Purifying paid area consumers and Dark King actual damage-path/phase
  regressions. This is not yet the full server suite or a native raid clear.

Logs `/tmp/eidolon-primary-current-{focused,lint,sequence,discovery,
server-focused}.log`. Full Go/client/lint,116-case browser execution and native
four-role dungeon acceptance are next. Preserve the interrupted/failed native
history: Warden and four complete town/resume cycles are not a full clear.
Schedule the long native run without competing with canonical predeploy on the
same GPU. Canonical62dc and successor release gates remain separate; never push
the root ledger branch or overwrite production with this unaccepted tree.

## Full regression follow-up — September11 03:05

Full server race59375 exited0 on ee1da4b4: root28.570s/game400.604s,
loadtest1.030s/database1.140s/lifecycle1.042s; other packages had no tests.
No race warning. Log `/tmp/eidolon-primary-current-full-server.log`.

Full client45446 exited1:335 suites/4672 tests passed, one test failed out of
336suites/4673tests170.905s. `RestAuraReleaseGate` expected the old untimed literal
`&& run_well_rested`, although required-all now calls it through run_qa_stage.
The actual helper-invocation checks passed; no Well Rested route was dropped.
The assertion now requires the timed Well Rested stage followed by the timed
Forge/socket tail, retaining both mandatory gates. No src/server/script changes.

Focused5163 then passed56tests/4suites1.981s and full lint, covering the actual
native helper sequence, timing failure/cleanup behavior and socket suffix.
Logs `/tmp/eidolon-primary-current-rest-gate-{focused,lint}.log`. Lint did not run
after the failed full client command; this separate lint pass is explicit.
Rerun the complete client suite on the corrected test source before browser/native
acceptance. The full server pass remains current because server source is unchanged.

## Full client and browser acceptance — September11 03:25

Corrected full client/lint73302 exited0:336 suites/4673 tests174.332s, full lint
passed. Logs `/tmp/eidolon-primary-current-full-{client,lint}-final.log`.
Frozen9c664f95 then passed all116 browser cases in13 stages using CI1, system
Chrome, Node24 and one worker. Group1/61836:40cases; group2/10508:50cases;
group3/93874:26cases, all terminal0. Embedded report stats for every stage
independently confirmed116 expected, zero unexpected/flaky/skipped. This includes
all10 crystal-art cases, not just discovery. Port41981 is clear after cleanup.

Archive `/tmp/eidolon-primary-current-browser-proof-igu3O6` contains all three
group logs and distinct reports/results. Credential scanner passed,0 files
sanitized; byte scanning does not assert pixel redaction. Earlier inspected720p
party roster and568x320 expanded-chat screenshots had no new clipping. The
crystal-art cases use controlled snapshots/prepared cameras, not native raid
completion or physical-phone acceptance. Those acceptance boundaries remain.

No local heavy/browser remains. Native four-role full clear, remaining required
native release gates and production acceptance are still open. Separate runner
queues were newly authorized by the user; infrastructure work is isolated in
`work/runner-queue-separation-20260911`, not bundled with this unaccepted gameplay.
