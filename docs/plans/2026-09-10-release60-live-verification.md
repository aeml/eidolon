# Alpha1.0.60 — corrected ground setup verified locally; new CI active

Canonical corrected commit `62dc2d1eb1baf8030fc69244b1522deb5f6d2340`, branch
`release/60-sanctuary-combat-feedback`, worktree
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`. Normal non-force push from this
worktree succeeded after the verified camera-framing correction below. Its
predecessor df91bb66e8e8f3b7125aa99412f09ba25898a3ac is deployed but failed final
acceptance. Root is ledger-only and is never pushed. Do not push a61successor
before60 is accepted; the current push repairs60's verification, not gameplay.

## Current status — September10, 03:51UTC

04:14 update: allclient/server/browser groups SUCCESS on unchanged62dc2d1.
Predeploy102741303703 is QUEUED. Repository has one matching online runner,
id21/eidolon-codex-chrome, busy running scheduled24h soak34433520743/
job102733792127 since03:30:19. Actual runner/job metadata confirms the shared
reservation; this is not a new test failure. User was asked asynchronously
whether to cancel this particular soak for deployment; approval is pending and
no cancellation/runner/workflow change has been made. Browser1 retained log
`/tmp/eidolon-release60-ground-ci-browser1.log` confirms29main10.5m,6nameplate49.8s,
3resourceHUD6.3s without retry. No predeploy/deployment/final acceptance yet.

04:05 update: sameCI34434837759 on62dc2d1 remains ACTIVE. Client/server both
SUCCESS; browser2/102738964543 and browser3/102738964477 SUCCESS. Browser1/
102738964490 remains ACTIVE. No predeploy/deployment/final acceptance yet and
no new push. Primary's new native84056 owns the local browser on separate
unversioned ea6cdbb; its changes do not mutate this frozen release candidate.

Normal push35621 succeeded caab611→62dc2d1 from the clean canonical worktree,
after exact remote-master guard, fast-forward promotion and diff check. Root
was NOT pushed. New CI34434837759 on exact62dc2d1 is ACTIVE: client102737643295
and server102737643429 are running. No deployment or final acceptance result.
Last verified public identity remains60/df91bb6; do not claim this new commit
is live until deployment and actual public/native verification establish it.

Code d03ecde passed actual isolated trained ground-shape7451:1/37.6s, retries0,
test35.5s, Node24 inside sg render, prepared browser assets. All three spells
rejected walls without cooldown, cast on reachable floor, retained trained
radius/High-Low attachment checks and saved rank5 after all five normal purchases.
Prepared QA level/skills establish geometry, not earned story progression.
Archive `/tmp/eidolon-ground-settled-proof-oQXGNa`, log
`/tmp/eidolon-ground-settled-native.log`, wrapper/supplemental scan0 and exact
18560/18561/41960 plus ownedground-settled-0910 services/image absent at cleanup.
The passed route has no screenshot; no rendered-image review is claimed.

Full54348 PASS256suites/3618tests151.078s plus lint; logs
`/tmp/eidolon-ground-settled-full-{client,lint}.log`. Commit62dc2d1 adds only
proof documentation atop tested d03ecde. Runtime/version/patch notes/workflow
remain unchanged; this fixes verification setup and does not ship new gameplay.
All CI/predeploy/deploy/final-native/public identity gates remain mandatory.

Primary22725 ended and its artifacts/cleanup were verified before7451 began;
there was no overlapping owned local browser. Its partial fresh-story result
does not change release60's scope; see the execution ledger for that evidence.

## Previous status — September10, 03:19UTC

CI34430017443 is terminal FAILED at predeploy102727073506. All server/client/
browser jobs and the High/Low gallery passed. Disposable gameplay passed seven
initial cases and trained Flame Whip, then the dungeon-ground-area test failed
before its actual spell assertions. Deployment/input-validation/final-native
jobs were skipped. Fresh03:16 public client/backend still identify healthy,
database-ready60/df91bb6; this candidate did not deploy.

First attempt failed a less-than-two-unit waypoint check with2.12694354remaining.
Its whole attempt lasted less than25s, so the45s approach loop had broken on an
earlier near-waypoint observation, not reached its deadline. Movement helper
returns after minimum displacement; the old setup checked distance before
waiting for IDLE. Retry reused its trained character and failed rank1vsrank5.
Neither failure establishes wall/ground spell behavior. Retained log
`/tmp/eidolon-release60-yield-predeploy.log`; artifact10134910275 at
`/tmp/eidolon-release60-yield-predeploy-proof-KIFTbd`, scan0. Only failure contexts,
no actual at-failure scene image/trace were available for this test.

Diagnostic branch/worktree now cleand03ecde with settled-character/camera approach
inside the same45s budget/two-unit tolerance, exact fresh-retry QA allowlisting,
initial rank0 assertion/allfivepurchases retained, and at-failure scene/state
capture. Runtime/version/patchnotes unchanged. Focused45367 passed6/1.252s+lint+
shellsyntax; broader1600 passed110/7suites2.315s. Actual ground-shape browser and
full client regression pending until primary22725 ends; do not cancel/overlap
that owned run. Canonicalcaab611 remains unchanged and no new push occurred.
See diagnostic plan`2026-09-10-ground-spell-approach-verification.md` there.

## Previous verification — September10, 02:35UTC

03:05 update: sameCI34430017443 remains ACTIVE. Server/client/allthreebrowser
jobs SUCCESS. Browser1 job102724787728 completed29anonymous/10.5m,6nameplate/
49.1s and3resourceHUD/6s with no retry, retained completed-job log
`/tmp/eidolon-release60-yield-ci-browser1.log`. Predeploy102727073506 ACTIVE:
setup/checkout/Node/dependency+GPUverification and High/Low gallery passed;
disposable full-character gameplay is running. Canonicalcaab611 remains
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
