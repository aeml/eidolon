# Alpha1.0.60 — second corrected verification pipeline active

Canonical corrected commit `caab6111f9d6eef1f375f7942a8163cb2d86da6c`, branch
`release/60-sanctuary-combat-feedback`, worktree
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`. Normal non-force push from this
worktree succeeded after the verified camera-framing correction below. Its
predecessor df91bb66e8e8f3b7125aa99412f09ba25898a3ac is deployed but failed final
acceptance. Root is ledger-only and is never pushed. Do not push a61successor
before60 is accepted; the current push repairs60's verification, not gameplay.

## Current verification — September10, 02:35UTC

02:58 update: sameCI34430017443 remains ACTIVE. Server/client/allthreebrowser
jobs SUCCESS. Browser1 job102724787728 completed29anonymous/10.5m,6nameplate/
49.1s and3resourceHUD/6s with no retry, retained completed-job log
`/tmp/eidolon-release60-yield-ci-browser1.log`. Predeploy102727073506 ACTIVE:
setup/checkout/Node/dependency+GPUverification passed and High/Low gallery is
running; disposable full-character stage pending. Canonicalcaab611 remains
unchanged. No deployment/final acceptance result yet.

Browser3 passed25/25 in5.8m with no retry. Its formerly failing respawn case
ran from02:48:03.921 until the next case at02:48:36.699 under reported
ANGLE/Vulkan SwiftShader. Retained completed-job log
`/tmp/eidolon-release60-yield-ci-browser3.log` and artifact10134436964 at
`/tmp/eidolon-release60-yield-ci-proof-B5RW5Z`, supplemental scan0. Inspected
the actual CI final Rogue PNG: no enclosing glowing box, same1280x720 fixture.
This establishes the corrected scenario passed in the actual CI environment;
it is not native gameplay, total pipeline success or final release acceptance.

Normal push78092 SUCCEEDED3a139c0→caab611 from the clean canonical worktree.
New CI34430017443 ACTIVE on exactcaab611; server102723358239 and client102723358452
are running. No runtime/version/patch-note change: only the respawn fixture,
its helper/tests and evidence document changed since3a139c0. Preserve this
candidate unchanged while its full pipeline runs.

Fixture codef827c80 passed bundled Chromium/SwiftShader79068, retries0,34.8s,
with the same120s deadline and all three respawn/stealth checks. Final image
inspected, same1280x720 quality and no enclosing cube. Archive
`/tmp/eidolon-visual-yield-render-proof-ZM4ryD`, scan0, exact41962web cleanup.
Full39933 passed255suites/3612tests104.772s+lint. Logs
`/tmp/eidolon-release60-visual-yield-browser-ready.log` and
`/tmp/eidolon-release60-visual-yield-full-{client,lint}.log`.
Finalcaab611 adds proof documentation only. Initial local startup failed before
rendering because ignored vendor files were absent; retained its evidence and
ran the actual `prepare:client` script before the successful browser replay.

Fresh public checks02:33 still identify healthy/database-ready60/df91bb6. The
latest commit is pushed, not yet deployed or finally accepted. All gates below
remain required; failed3a139c0 and originaldf histories are preserved.

## Previous CI result — September10, 02:28UTC

CI34427816379 is terminal FAILED on3a139c0. Client/server and browser groups1/2
passed; group3 failed its respawn visual fixture twice at120 seconds, with24
other tests passed. Predeploy/deploy/final live jobs were skipped. This push
did not replace the previously deployed df91bb6 runtime.

Both recorded traces show all three respawn visibility assertions and stealth
expiry passed; screenshot completed, disposal evaluation was unfinished at the
deadline. Ordinary button clicks took roughly10.4s each under SwiftShader.
Inspected the retained PNG: no enclosing glowing cube. Artifact10133758335 at
`/tmp/eidolon-release60-browser3-failure-akHxw8`, log
`/tmp/eidolon-release60-corrected-browser3.log`. This is not evidence of a new
runtime appearance regression or permission to bypass the failed gate.

The independent hover-diagnostic worktree now has a candidate fixture-only50ms
post-draw yield, retaining quality/viewport/real elapsed-time updates and all
assertions/deadlines. Focused77789 passed15tests/2suites0.746s+lint. Actual
bundled-Chromium respawn replay and full regression are pending until fresh-story
browser44940 ends. Canonical3a139c0 remains unchanged; no new push yet.

## Corrected release verification — September10, 02:02UTC (historical)

New [CI34427816379](https://github.com/aeml/eidolon/actions/runs/34427816379) is
started on exact3a139c0 after a normal non-force push. Previous failed run remains
retained below. No src/server/login/version/manifest/package/workflow changes
versusdf91bb6; existing60patch notes remain accurate. The correction uses real
canvas-wheel zoom to expose live wandering enemies before the existing hover
assertion and captures actual state if it fails. Position/protection, both combat
card assertions,10-second timeout and all recovery checks remain required.

Diagnostic35114 first reproduced the failure on actual live60: no candidate or
projection despite nearby living rendered Skeletons, settled camera, healthy
protected player and completed pointer processing. Inspected failure world image
at `/tmp/eidolon-live60-hover-proof-jeuKWn`, scan0. Default15-unit framing excluded
nearby observed positions. This was not observed spawn loss or failed recovery.

Corrected code77805df passed full44217 client254suites/3606tests69.017s+lint.
Then actual live24692 passed journey+expiry2/1.1m and real party1/13.2s on the
unchanged deployed runtime, with fresh ordinary registrations and no retries.
Real wheel15→30 retained protectedx94.985, actual enemy warning and departure
InRange; incoming2HP, acceptedFireballMP80, RecallHP108→110/MP80→92→110 and saved
rest bank9.701→10.165. Natural expiry/reentry and two-player High/Low aura/joystick
checks passed. Archive `/tmp/eidolon-live60-framing-proof-yGjGmQ`, scans0; inspected
warning/departure/rejoined/Low390party-world screenshots. Log
`/tmp/eidolon-live60-framing-corrected.log`. Final3a139c0 adds proof documentation.

These manual checks verify the correction, not the new pipeline's final outcome.
All new CI/deploy/final public gates below must pass before accepting60.

Player scope: the target card explains that a player must leave a safe zone to
attack ordinary enemies, and normal range feedback returns on departure. Valid
duel feedback remains intact. No changed protection, casting, costs, damage,
recovery, Well Rested, progression or reward rules. Version/login/patch notes and
all build defaults identify60. Expanded campaign and casino are not runtime scope.

## Local release evidence

Tested runtime/version commit2b30320; finaldf91bb6 adds documentation only.
Full33981 passed253suites3599tests75.35s and lint, plus all server-race packages
(game229.897s). Logs `/tmp/eidolon-release60-full-{client,lint,server}.log`.
Final interface70333 passed6cases15.9s; inspected desktop/phone warning cards,
phone journal and desktop long-label scene. Archive
`/tmp/eidolon-release60-interface-proof-0K6GU5`, scanner0.

Final native88699 passed1case36.4s. Real unprepared level1Wizard saw the warning
inside town atx94.985 and InRange on the same enemy after departure atx119.929.
Actual enemy damage2HP, acceptedFireballMP110→80, RecallHP108→110/MP80→92→110,
and bank11.385→11.771/aura persisted across login. Both boundary images and the
rejoined town image were inspected. Archive
`/tmp/eidolon-release60-native-proof-KPv2XQ`, wrapper sanitation0files/supplemental
scan0, exact disposable services/ports cleaned. Native log
`/tmp/eidolon-release60-native-final.log`.

## Original publication and failed acceptance — retained history

[CI34421323405](https://github.com/aeml/eidolon/actions/runs/34421323405) is terminal
FAILED on the exact canonical commit. Predeploy102701339923 and production input
validation102709034222 passed, followed by Pages102709062152 and server102709062218.
Final live character job102709210653 failed at01:36:08UTC; final acceptance remains
open. The deployment itself succeeded; do not conflate it with a fully accepted
release or claim the failed check proves a recovery-system regression.

The server retained the previous59 image as
`eidolon-api:rollback-2b3c5a1e95c7c12d16eb8abd412ef3428e50c2dd3e8d147dd8c90b6852ff9170`.
Schema preflight passed database9/supported9, so no schema upgrade occurred.
Server health verified the exact60 commit at01:23:52UTC. Deployment log retained
at `/tmp/eidolon-release60-server-deploy.log` using the completed job's REST log
endpoint; the ordinary run-log command was unavailable while the run was active.

Fresh public GETs around01:25UTC matched60/df91bb6 in the manifest, login label,
patch notes, main module release key and healthy/database-ready backend. The
release-keyed main module returned HTTP200/19736bytes. Repeat after final live QA.

Predeploy artifact10132381414 retained at
`/tmp/eidolon-release60-predeploy-proof-6jzgOY`; supplemental scan0. Inspected
actual warning/departure screenshots and the High-quality390px party-world view.
Predeploy recovery had one10-second enemy-hover timeout before passing on retry;
retain that flaky result, not an all-first-attempt claim. The original attempt
does not establish the timeout's cause. Retry observed warning inside town,
normal range outside, incoming2HP, accepted Fireball at80MP, normal Recall
recovery and saved bank29.070→29.502. Log `/tmp/eidolon-release60-predeploy.log`.

## Final live failure and next diagnostic

Live anonymous/persistent-character and four-class/remote-animation checks passed.
Natural rest expiry passed: bank13.924→0 outside town removed aura and returned
strength11→10/maxHP110→100; reentry restored aura/strength11/maxHP110 and earned
bank1.485. The following sanctuary journey failed the same10-second hover at
the inside-town boundary, before its warning screenshot, combat, Recall or login
checks. Party QA was not reached. Live credentials were not retried.

Artifact10132708546 retained at `/tmp/eidolon-release60-live-failure-7uE6Za`,
supplemental scan0, log `/tmp/eidolon-release60-final-live.log`. Inspected the
only journey screenshot: it precedes the boundary failure, so neither enemy
availability, occlusion nor pending pointer processing is established.

Separate diagnostic worktree `/tmp/eidolon-release60-hover-diagnostic-V1ICnd`,
branch`work/release60-hover-diagnostics`, commit6cf157a, adds failure-only actual
projection/hover/card/rendered-enemy/camera observations and an at-failure world
screenshot. No runtime change, selection/raycast injection, timeout extension or
weakened assertion. Focused5576 passed20tests/3suites0.849s+lint. This was the
initial diagnostic preparation; its subsequent live reproduction, correction and
verified promotion are recorded above. The old failed workflow remains retained.

## Required corrected-publication acceptance

- [ ] All new client/server/browser/predeploy/input validation jobs pass.
- [ ] Both new deployments pass; inspect server schema preflight and rollback evidence.
- [ ] Final live native/character verification passes; preserve and inspect evidence.
- [ ] Fresh public manifest, login/patch notes, release-keyed runtime GET and healthy
  backend all identify the exact60/caab611 release after the final live job.

This does not complete the broader1.1–1.10 goal, campaign/class/group balance,
physical-phone playability, full dungeon/raid story or two-floor casino scope.
