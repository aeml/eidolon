# Roadmap execution ledger

Objective: implement the full 1.1–1.10 roadmap step by step, deploying each version
with patch notes. Scope and completion gates remain in
[the roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md); individual hotfixes do not close
the whole goal. Started September 5, 2026.

## Local toolchain — do not use the login-shell Node default

The login shell resolves `/usr/bin/node`18.19.1, below the required Node24.
For every local npm/Playwright invocation explicitly prepend
`/home/aeml/.local/share/eidolon-actions-runner/_work/_tool/node/24.18.0/x64/bin`
to PATH. With `sg render`, export that PATH **inside** its quoted command before
running the wrapper. Print `node --version` to verify24.18.0; do not change the
global Node installation. CI already explicitly installs24. The server module
declares go1.24.5 and `go version` inside server confirms automatic1.24.5 selection
(root-directory system go1.22.2 is not the module's selected compiler).

## Current checkpoint — September 10, 05:39 UTC

Previous turn was a VERIFIED WAIT; this continuation polled the same live13998
and observed new Seeds-phase proof. No code change/restart/cancellation/push or
deployment. Full1.1–1.10 remains active/incomplete with broader scope unchanged.

13998 ACTIVE, only owned local browser, primary clean/frozencb348ef, same
fresh-merchant-0910/18560/18561/41960/log
`/tmp/eidolon-fresh-merchant-replay.log`. Seeds8/manual turn-in PASSED188520ms/
1200000ms,22observed target deaths, zero player deaths. Count stayed7 from the
11th through21st observation but reached8 normally on22nd; no intervention or
confirmed pickup defect. During collection, ordinary bag maintenance equipped
eight earned items, freeing4→12slots and preserving1526Gold. No merchant sale
or stash deposit was needed/proven by that visit.

Imp phase ACTIVE: first earned milestone atlevel10 purchased2available mastery
ranks through normal UI, preserving level/XP/Gold. Latest logged5/60 at216s,
level11/2229XP/2540Gold, zero deaths,2recovery stops,1training stop. Later normal
recovery atlevel12 restored27→368/full mana. Server receipts show actual Fireball
hits, not just a cast animation. All60/manual/save, scars,50Orcs/manual/save,
dungeon handoff and strictstory-onlylevel30 readiness remain pending. No final
campaign or class/group/realm/dungeon/raid/physical-phone acceptance.

At05:39:19 re-polled CI34434837759/predeploy102741303703: still QUEUED;
soak34433520743 still in progress. Cancellation approval remains unanswered;
canonical62dc2d1 unchanged, no new deployment/live acceptance. Root ledger-only
and NEVER pushed. Continue exact13998 and release queue, retaining all aura,
CIcost, casino and remaining1.1–1.10 work.

## Previous checkpoint — September 10, 05:32 UTC

Previous goal turn was a VERIFIED WAIT. This continuation kept observing the
same live13998 and gained complete Watch-phase evidence; no restart or source
mutation. Full1.1–1.10 goal stays active/incomplete, all broader gates intact.

13998 ACTIVE, only owned local browser, primary clean/frozencb348ef, same
fresh-merchant-0910/18560/18561/41960/log
`/tmp/eidolon-fresh-merchant-replay.log`. Watch40/manual100Gold1593XP/save PASSED
422s, zero deaths,10ordinary town recovery stops, no training stops. Exact claim:
level6/262XP/1275Gold→level8/130XP/1375Gold;17occupied bag slots,740unsold gear
value. Named phase PASS421516ms/1800000ms. This is one fresh Wizard attempt;
shorter duration than prior random runs is not a balance/performance claim.
Seeds phase ACTIVE, latest1/8 after1observed target death, no deaths. Full8Seeds,
Imp60/scars/Orc50/manual rewards/save/handoff and strictstory-onlylevel30 remain
pending. Keep source frozen and preserve the eventual true terminal result.

ReleaseCI34434837759/predeploy102741303703 re-polled and still QUEUED;
soak34433520743 confirmed in progress. No cancellation approval, new push,
deployment or final live acceptance. Canonical62dc2d1 unchanged. Root remains
ledger-only and NEVER pushed. Class/group/realm/dungeon/raid/phone/aura/CIcost/
casino and the full remaining1.1–1.10 scope remain open.

## Previous checkpoint — September 10, 05:26 UTC

Previous goal turn was PROGRESS. This continuation is a VERIFIED WAIT: polled
the same live13998 and the specific queued release/occupying soak jobs. No
source mutation, restart, cancellation, push or deployment; full goal remains
active/incomplete, not at an impasse while the earned playthrough advances.

13998 ACTIVE, only owned browser, primary clean/frozencb348ef, same
fresh-merchant-0910/18560/18561/41960 and
`/tmp/eidolon-fresh-merchant-replay.log`. Actual opening three kills/manual
100Gold100XP/save passed38s with no deaths. Diary/manual25Gold200XP/save passed;
named opening phase PASS83330ms/600000ms. Watch phase ACTIVE: latest milestone
5/40 at64s, level4/60XP/341Gold, no deaths, one ordinary town recovery. Mana
5→170/full, with naturally banked rest and ordinary departure verified. All
remaining35Watch kills, Seeds, Imps, scars,50Orcs/manual/save/handoff and strict
level30 readiness are still pending in this attempt. No final campaign pass.

At05:26 CI34434837759/predeploy102741303703 remains QUEUED; scheduled
soak34433520743 remains in progress. No new cancellation approval. Canonical
62dc2d1 unchanged; no live release acceptance. Keep observing exact13998 and
release queue without narrowing class/group/realm/dungeon/raid/phone/aura/
CIcost/casino or the rest of1.1–1.10 scope. Root ledger-only and NEVER pushed.

## Previous checkpoint — September 10, 05:23 UTC

This continuation made PROGRESS; the full1.1–1.10 goal remains active and
incomplete. Merchant correction native36179 TERMINAL PASS1/1.2m on1b5a81b,
all12ordinary Recall/walk/shop visits, retries0, no pending target, camera
settled, shop/bag visible, zero blocked stops (original diagnostic accumulated12).
Archive `/tmp/eidolon-merchant-settled-proof-ijYfo8`, log
`/tmp/eidolon-merchant-settled-native.log`; actual-credential scan passed and
exact API/Mongo/image and18560/18561/41960 listeners absent after cleanup.
No success screenshot was emitted; no rendered-art quality claim.

Primary proof commitcb348ef documents the actual Orc37failure and corrected
merchant evidence. Code1b5a81b is backed by full8866 PASS288suites4056tests/
141.599s plus lint and focused54885 PASS19/3/1.023s. This fixes a QA movement
projection race, NOT a claimed runtime collision issue. Full earned acceptance
still requires all50Orcs/manual reward/save/handoff/strictstory-onlylevel30.

**13998 ACTIVE**, ONLY owned local browser task (building at checkpoint), new
fresh-story-ready run fresh-merchant-0910 on clean/frozencb348ef, same loopback
18560/18561/41960, log `/tmp/eidolon-fresh-merchant-replay.log`. Fresh unprepared
Wizard, explicit REST_RECOVERY1, CIunset/retries0, Node24inside sg-render and
actual prepare:client. Preserve all phase/encounter/death/manual reward/save/
readiness requirements. Do not restart on observation timeout or edit this source
while it runs; preserve/sanitize actual terminal evidence and exact cleanup.
All classes/groups/realms/full dungeons/raids/physical-phone/aura/CIcost/casino
and remaining roadmap milestones stay open. No casino runtime work.

At05:22:43 re-polled releaseCI34434837759: predeploy102741303703 still QUEUED;
soak34433520743 remains in progress. Cancellation question still unanswered.
Canonical62dc2d1 unchanged, no new push/deployment or final live acceptance.
Root stays ledger-only and NEVER pushed. Next: observe exact13998 and exact
release queue while retaining all broader scope.

## Previous checkpoint — September 10, 05:20 UTC

This goal turn is PROGRESS: preserved the failed fresh campaign, ran a bounded
native diagnostic, corrected an independently confirmed QA projection race, and
completed full regression checks. The full roadmap remains active/incomplete;
none of the class/group/campaign/raid/phone/aura/casino gates were removed.

Original merchant diagnostic80980 TERMINAL PASS1/1.0m, all12fresh Recall/walk/shop
visits on72fa6b8. It did NOT reproduce the Orc37/50 failure. Archive
`/tmp/eidolon-merchant-original-proof-PyNrX6`, actual-credential scan passed,
exact API/Mongo/image and18560/18561/41960 listeners absent after cleanup.

Source confirms `moveByGroundClick` returns after movement starts, while the
old loop calculated its next offset before actor/camera arrival. Primary1b5a81b
now settles before each read/click and accepts only stopped proximity. Same
eight-move bound,12-unit clicks/three-unit stand-off, ordinary Shift-click,
15-second individual settle limit, plus one fixed45-second approach deadline.
Error-cause/position/target/camera/blocked-stop evidence retained. This is a QA
correction, not a claimed production collision fix or full fresh-route pass.
Focused54885 PASS19/3/1.023s; full8866 PASS288suites4056tests141.599s plus lint.
See primary `docs/plans/2026-09-10-merchant-approach-verification.md`.

Corrected native36179 ACTIVE, building at this checkpoint, ONLY owned browser
task, clean/frozen1b5a81b. Run merchant-settled-0910,18560/18561/41960, route
earned-merchant-approach, log `/tmp/eidolon-merchant-settled-native.log`.
No further source changes/heavy tests before terminal preservation and cleanup.
Then replay the entire earned story-only route;37/50 cannot satisfy Orc/manual
reward/handoff/strict level30 readiness acceptance.

ReleaseCI34434837759 re-polled: hosted jobs passed, predeploy102741303703 still
QUEUED. Soak34433520743/job102733792127 still in progress. No cancellation
approval received, no cancellation/new push/deployment. Canonical62dc2d1 frozen;
root ledger-only and NEVER pushed. This operational wait does not block other
meaningful local roadmap work.

## Previous checkpoint — September 10, 05:12 UTC

The preceding casino-only turn was NO PROGRESS toward implementation: it verified
already-recorded scope without changing it. This continuation revalidated the
release jobs and preserved fresh-run evidence, then added a bounded native
merchant diagnostic. Full 1.1–1.10 scope remains active and incomplete.

Fresh phase run84056 is TERMINAL FAILED on ea6cdbb, not active. Opening/diary,
Watch40, Seeds8, Imp60 and all three scar investigations passed, but Orc progress
stopped at37/50, level29, with no deaths. The failure is the merchant helper's
15-second IDLE/no-target/camera-settled predicate, not the enclosing campaign or
Orc phase timeout. Final position [23.655,0,199.79286313409136], full902HP/638MP,
three free bag slots. Viewed failure PNG: player obscured beside the market
stall. Existing evidence does not isolate which part of the predicate remained
false; do not label this a confirmed production collision regression yet.

Archive `/tmp/eidolon-fresh-orc-phase-proof-A6Wgqj`, log
`/tmp/eidolon-fresh-phases-replay.log`; actual wrapper credential scan passed and
exact disposable cleanup was verified at termination. Retained HTML confirms
the15-second merchant poll. No final50-Orc/manual-save/dungeon-handoff/strict
level30 story-readiness pass. Do not discard or reclassify this failed attempt.

Primary72fa6b8 adds read-only merchant movement/camera/target/blocked-stop failure
evidence, preserves the original cause, and exposes a12-visit native Recall/shop
diagnostic. Original inputs, approach algorithm and15-second settle limit remain
unchanged. Focused29275 PASS10tests/2suites1.198s, lint and shell/diff checks pass.
Native80980 ACTIVE (building at this checkpoint), only owned local browser task,
clean/frozen72fa6b8, route earned-merchant-approach, run merchant-approach-0910,
ports18560/18561/41960, log `/tmp/eidolon-merchant-approach-native.log`. Do not
edit this source or start another heavy/native test until its terminal result.

Re-polled CI34434837759: all hosted client/server/browser jobs succeeded;
predeploy102741303703 still QUEUED. Soak34433520743/job102733792127 remains
in progress. No new approval to cancel it, no cancellation, push or deployment.
Canonical62dc2d1 remains frozen. Root stays ledger-only and NEVER pushed.

## Previous checkpoint — September 10, 04:47 UTC

Previous goal turn was a VERIFIED WAIT. This continuation observed new native
phase proof: full Imp/manual/save and scar investigation phases passed under the
new ordered phase runner, and Orc phase started. Full goal remains active and
incomplete. No code/source mutation, cancellation, restart, push or deployment;
root ledger-only and NEVER pushed. No whole-goal impasse while the earned run
continues, despite the still-unanswered release-runner operational question.

**84056 ACTIVE**, ONLY owned local browser, primary still clean/frozenea6cdbb,
samefresh-phases-0910/18560/18561/41960/log
`/tmp/eidolon-fresh-phases-replay.log`. Full60Imp/manual200Gold6843XP/save passed
1734s,zero deaths,24natural townstops and2earnedtrainingstops. Exactclaim:
21/9503XP/10071Gold→22/6246XP/10271Gold;17 bag slots/2400unsold gear value.
Actual namedimps phase PASS1733807ms/2700000ms. No performance or balance
improvement claim from its shorter duration versus the earlier random playthrough;
runtime combat/rewards were unchanged and this is still one class/attempt.

All3scar investigations/manual25Gold200XP then PASSED, actual phase32962ms/
600000ms. **Orcs phase ACTIVE**,3600000ms cap, startslevel22/6446XP/11125next/
10296Gold,full709HP/522MP,17bag slots/2400unsold gear value. All50Orcs/manual/save,
dungeon offer/gear persistence and strictstory-onlylevel30 readiness are still
pending. No final campaign acceptance. Same120s encounters/two-death bounds and
normal recovery/input remain required; no additional local browser/heavy tests
or source edits until exact terminal preservation/sanitation/cleanup.

**Predeploy102741303703 remains QUEUED** inCI34434837759 on unchanged62dc2d1;
all hostedclient/server/browser jobs passed. Scheduled24h soak34433520743/
job102733792127 was re-polled and remains in progress on the solematchingrunner.
The specific cancellation question remains unanswered: no authority to cancel
that run, change labels/scheduling or claim24h completion. Last verified public
still60/df91bb6; no predeploy/deploy/finalnative/liveidentity acceptance. Continue
exact84056 and release queue; all1.1–1.10/class/group/raids/phone/aura/CIcost/casino
gates remain open and unchanged.

## Previous checkpoint — September 10, 04:31 UTC

Previous goal turn and this continuation are VERIFIED WAITs: repeatedly polled
the same live84056 and queuedpredeploy102741303703, with its occupying soak
102733792127 confirmed in progress. No source changes, rerun, cancellation,
new push or deployment. Full goal stays active; pending release-runner approval
does not make the whole goal an impasse while earned gameplay is still running.
Root is ledger-only and NEVER pushed.

**84056 ACTIVE**, ONLY owned local browser, primary clean/frozenea6cdbb, same
fresh-phases-0910/18560/18561/41960 and`/tmp/eidolon-fresh-phases-replay.log`.
Watch phase already passed563138ms, including40kills/manual100Gold1593XP/save,
zero deaths/16 townstops. Seeds phase subsequently PASSED152103ms:8 earnedSeeds,
15 observed target deaths/zero playerdeaths, normal manual turn-in. Imp phase
ACTIVE within its2700000ms cap; latest26/60credit,zero deaths,12townstops,
1earnedtrainingstop,859huntseconds. Level17/1893XP/6500next/4955Gold,18 bag slots,
1020unsold gear value,561maxHP/385maxMP. Actual unfinished-encounter and normal
between-encounter town recovery continue without changed120s encounter budgets.
All60Imp/manual/save,scars,50Orcs and strictlevel30 readiness remain pending.
Preserve source until exact terminal result, archive/sanitize and verify cleanup;
no second owned browser or heavy local regression while84056 owns the slot.

Canonical/diagnostic62dc2d1 andCIcostdf6f806 remain clean/unchanged. Release
CI34434837759 has all hosted jobs SUCCESS but predeploy102741303703 still QUEUED
for the single runner held by scheduled24h soak34433520743/job102733792127.
The asynchronous request to cancel THIS soak remains unanswered; no permission
to cancel it, alter scheduling/labels or reuse an earlier soak approval. No
predeploy/deploy/finalnative/public acceptance claim; last verified public remains
60/df91bb6. Continue exact runs and all broader1.1–1.10 gates without narrowing
scope to these successful partial chapters.

## Previous checkpoint — September 10, 04:14 UTC

Previous goal turn was a VERIFIED WAIT. This continuation made PROGRESS:
confirmed all browser jobs passed, established an independent runner-allocation
delay, requested specific soak-cancellation approval, and observed Watch phase
completion in the same native run. Full goal active, not at an impasse while
independent earned gameplay continues. Root ledger-only and NEVER pushed.

**CI34434837759 queued at predeploy102741303703**, exact62dc2d1 unchanged.
Client/server/allthreebrowser jobs SUCCESS. Completed browser1 log retained at
`/tmp/eidolon-release60-ground-ci-browser1.log`:29main10.5m,6nameplate49.8s,
3resourceHUD6.3s, no retry. This is not predeploy/deployment/final acceptance.
Last verified public remains60/df91bb6, not the new candidate.

Authoritative repository runner API returned **one** online runner: id21,
eidolon-codex-chrome, busy. Queued predeploy requires its self-hosted/linux/x64/
eidolon-live-browser labels. The same runner is executing Nightly Multiplayer
Soak34433520743/job102733792127; its load step began03:30:19. Scheduled workflow
default24h, same labels, so this is runner reservation rather than another
browser-test failure. An asynchronous question asks the user whether to cancel
THIS soak to prioritize deployment, explaining that it loses a complete soak
result. **Approval remains pending; no cancellation is authorized by this
checkpoint.** Do not reuse permission for an earlier, different soak. No labels,
runner services, workflow duration or preemption policies were changed.

CI-cost prototype now cleandf6f806 (documentation only atop080e175). Its plan
records this separate end-to-end bottleneck and the need for an operational
choice on separate capacity or approved interruption/evidence recovery, without
weakening24h/100-client stability gates. Original proposed three-group native/
timing/rendering/remote-CI proof remains pending. No prototype was published.

**84056 ACTIVE**, ONLY owned local browser, unchanged primaryea6cdbb; same
fresh-phases-0910/18560/18561/41960 and`/tmp/eidolon-fresh-phases-replay.log`.
Watch40 manual100Gold/1593XP and saved progress PASSED563s,zero deaths,16 town
stops. Before claim6/551XP/1408Gold→8/419XP/1508Gold;15 bag slots/400 unsold gear
value. Actual namedwatch phase PASS563138ms/1800000ms. Seeds phase now ACTIVE
with1200000ms cap. Earlier opening/diary phase passed85495ms. Later Seeds/Imp/
scars/Orcs/level30 readiness remain open; this is not full campaign balance proof.
Keep source frozen, no heavy local regression or second owned browser until
terminal artifact preservation/sanitation and exact cleanup. Continue84056 and
queuedpredeploy/actualsoak state; await the user's operational choice without
abandoning remaining1.1–1.10/class/group/raid/phone/aura/CIcost/casino work.

## Previous checkpoint — September 10, 04:05 UTC

Previous goal turn made PROGRESS (ground QA/native/full promotion and actual
fresh-route deadline diagnosis). This continuation made PROGRESS: implemented
explicit story-only phase observation, verified focused/full client coverage,
started a new frozen-source native attempt and observed its first phase pass.
Full goal active/incomplete, no impasse. Root ledger-only and NEVER pushed.

Primary clean **ea6cdbbca4d8320c7e63747aed1d60e1ec0d2266**, codef2ca8e5 atop
1f8882e. New `tests/freshCampaignPhases.js` supplies eight ordered Playwright
steps only for validated story-only readiness. Caps in minutes: opening+diary10,
Watch30,Seeds20,Imp45,scars10,Orcs60,handoff5,readiness5. Fixed185-minute sum,
set once; phases have their own deadlines. This explicitly addresses the actual
one-hour overall timeout, NOT game difficulty or encounter watchdogs. Same150
kills/8Seeds/3scars,120s encounters,two-death bounds,4s/8s jump checks, ordinary
recovery, manual claims/exact saves, no grants/dailies and strictlevel30 entry
remain. Existing shorter/comparison diagnostics retain their old budgets.
No phase skip/repetition/concurrency or continuation after failure can count as
success; final readiness cannot be omitted. Phase caps are QA observation limits,
not approved player-facing pacing. Plan in primary:
`docs/plans/2026-09-10-fresh-story-phase-verification.md`.

Focused72393 PASS87tests/6suites1.562s+lint+actual Playwright discovery. Full88926
PASS287suites/4047tests138.029s+lint onclean f2ca8e5, including prior jump-cause
tests. Logs `/tmp/eidolon-story-phase-{focused,lint,discovery}.log` and
`/tmp/eidolon-story-phase-full-{client,lint}.log`. Proof-doc-onlyea6cdbb then
started new native **84056**, still ACTIVE, ONLY owned local browser.

84056: `fresh-phases-0910`, API18560/Mongo18561/web41960, log
`/tmp/eidolon-fresh-phases-replay.log`; Node24 inside sg render, normal client
preparation, CI unset/retries0, explicit natural rest, fresh unprepared Wizard.
Opening3kills/manual100Gold100XP/save passed38s/0deaths. Diary1/manual25Gold200XP/
save passed86s,level3. Actual new `opening` phase PASS85495ms inside600000ms;
`watch` phase ACTIVE with1800000ms cap, entered atlevel3/138XP/196Gold,full165HP/
143MP. Restored mana during reconnect occurred in healing town; not offline
healing or an uninterrupted pacing claim. Preserve source unchanged until the
exact process is terminal, then archive/sanitize/verify cleanup. No heavy local
regression or second owned browser while84056 owns the slot. All remaining
Watch/Seeds/Imp/scars/Orcs/readiness native gates are still open for this attempt.

**CI34434837759 ACTIVE** on unchanged canonical/diagnostic62dc2d1. Client
102737643295/server102737643429 SUCCESS; browser2/102738964543 and
browser3/102738964477 SUCCESS. Browser1/102738964490 ACTIVE. No predeploy,
deployment/finalnative/public-identity acceptance yet. Last verified public
remains60/df91bb6; do not claim the new candidate deployed. Continue exactCI and
84056. Aura/CIcost/physical-phone/class/group/realms/raids/casino and all remaining
1.1–1.10 requirements remain open and unchanged. No new push this continuation.

## Previous checkpoint — September 10, 03:51 UTC

Previous goal turn was a VERIFIED WAIT. This continuation made PROGRESS:
preserved exact fresh-story terminal evidence, distinguished overall timeout
from a jump defect, retained the error cause, verified pending ground-spell
correction natively/full-client and pushed its new release CI. Full goal remains
active/incomplete, no impasse. Root ledger-only and NEVER pushed.

**22725 TERMINAL FAILED** on a285fbc after3600327ms. Fresh Watch40/manual/save,
8Seeds (23 observed deaths), Imp60/manual/save and all3 scar investigations
passed; final Orc4/50 atlevel23 with770HP/495MP and no daily credit. Imp completed
2169s,0deaths,26townrests,2earnedtrainingstops; exact200Gold/6843XP claim changed
21/9660XP/10411Gold→22/6403XP/10611Gold, then scar25Gold/200XP. The whole Earth
route and unchangedlevel30 readiness did NOT pass. All completed content remains
partial evidence, not full class/group/economy/campaign acceptance.

Archive `/tmp/eidolon-fresh-orc-departure-proof-AlfWPN`, log
`/tmp/eidolon-fresh-hunt-rest-replay.log`; wrapper/supplemental scan0, actual
failed-collection and Seeds-ready PNGs inspected. Exactfresh-hunt-rest-0910
API/Mongo/image and18560/18561/41960 listeners absent after normal cleanup.
Retained HTML report: start02:43:18.586, final landing poll03:43:17.069/984ms
explicitly reports `Test timeout of 3600000ms exceeded`. Previous jump landed
in1975ms. The helper swallowed that cause and emitted “did not land” at98.4%
of the current1.28s jump, NOT at its8s landing limit. This is not a proved
runtime jump defect. No cancellation or source mutation during the live run.

Primary now clean **1f8882e**: preserve original jump assertion message/cause,
fallback diagnostic state if observation itself fails, retain4s/8s limits.
Tests cover overall timeout, actual landing timeout and unavailable diagnostics.
69788 PASS19/2suites1.19s+lint/diff, log
`/tmp/eidolon-jump-failure-cause-{focused,lint}.log`; this change has not had a new
full client or native replay. Primary integration plan records the full evidence.
Next fresh-route task: explicit authored-phase/session timing for150 required
kills and normal travel/rest, preserving encounter limits/death guards/manual
claims/save/no-grants/no-daily/level30 gates. Do not claim a longer test balances
gameplay, or retry the unchanged one-hour route hoping for full proof.

**7451 TERMINAL PASS** native ground-shape1/37.6s (test35.5s), retries0 onclean
d03ecde; started AFTER22725 terminal/preservation/cleanup. Prepared QA Wizard,
all5trainingpurchases, three blocked-wall/no-cooldown and reachable-floor casts,
actual radius/High-Low shape checks and savedrank5 passed. Archive
`/tmp/eidolon-ground-settled-proof-oQXGNa`, log`/tmp/eidolon-ground-settled-native.log`,
wrapper/supplemental scan0, exactground-settled-0910services/image/ports absent.
No success image emitted; do not claim image review or earned-level proof.
Full54348 PASS256suites/3618tests151.078s+lint, logs
`/tmp/eidolon-ground-settled-full-{client,lint}.log`. Proof-doc-only62dc2d1 then
fast-forwarded canonical60 fromcaab611 after exactremote guard; normalpush35621
SUCCEEDED. No runtime/version/patchnote/workflow change or new gameplay claim.

**CI34434837759 ACTIVE** exact62dc2d1eb1baf8030fc69244b1522deb5f6d2340; client
102737643295/server102737643429 running. Canonical/diagnostic both clean62dc2d1;
do not change candidate mid-CI. Latest knownpublic still60/df91bb6; deployment,
finalnative/publicidentity acceptance pending. Also observed scheduled Nightly
Multiplayer Soak34433520743 ACTIVE oncaab611; not restarted/cancelled/modified.
No owned local browser or heavy local test remains active now. Continue exactCI
and next primary timing work; all1.1–1.10/aura/CIcost/phone/casino gates remain.

## Previous checkpoint — September 10, 03:28 UTC

The preceding casino-only reply reconfirmed existing roadmap scope without new
implementation or evidence that changes the next action (NO PROGRESS toward the
active implementation goal). This continuation revalidated the current trees
and repeatedly polled exact live22725: VERIFIED WAIT, not a stopped run or
impasse. Full goal remains active. Root remains ledger-only and NEVER pushed.

**22725 remains ACTIVE**, only owned local browser, unchanged primarya285fbc.
Latest fresh-story Imp milestone45/60, zero deaths,20 recovery stops and2 earned
training stops,1607 hunt seconds; level20/1660XP/9125next/7266Gold,18 bag slots,
3760 unsold equipment value,687 maxHP/445 maxMP. Level20 preparation equipped
two earned items and spent two existing talent points without changing XP/Gold.
Following health retreat naturally restored485→687HP and209→445MP and departed
with291.597 bank seconds in18.559s. Full60/manual/scars/50Orcs and unchanged
level30 dungeon-readiness assertions remain pending. Same log
`/tmp/eidolon-fresh-hunt-rest-replay.log`; preserve/sanitize exact terminal
artifacts and verify cleanup before another owned browser begins.

Reviewed pending diagnosticd03ecde and its launch configuration; no source
changes or premature promotion. Native ground-shape and full client regression
remain the next release priority after22725. Host read-only capacity check:
16 logical CPUs with load approximately28–29 and swap fully occupied; avoid
additional heavy regression during this browser run. This is contention risk,
not evidence that host load caused the earlier CI setup failure. Unrelated
processes remain untouched. Canonicalcaab611 unchanged; last confirmed CI is
terminal failed as detailed below. No new push/deployment or acceptance claim.
All class/group/story/raid/phone/aura/CI-cost/casino and1.1–1.10 gates remain open.

## Previous checkpoint — September 10, 03:19 UTC

Previous goal turn was a VERIFIED WAIT. This continuation made PROGRESS:
inspected true terminal predeploy failure, retained artifacts, diagnosed two
independent QA setup failures, prepared/committed correction with focused tests.
Full goal active, no impasse or new push. Root ledger-only/NEVER pushed.

**CI34430017443 TERMINAL FAILED**, canonicalcaab611 unchanged. All server/client/
browser jobs and High/Low gallery passed. Predeploy102727073506 passed initial
seven native cases and FlameWhip, then failed dungeon-ground-area setup; later
deployment/validation/final jobs skipped. Fresh public03:16 remains healthy/
database-ready60/df91bb6. No rollback needed for an undeployed candidate and no
accepted60claim. Retained log`/tmp/eidolon-release60-yield-predeploy.log`, artifact
10134910275 at`/tmp/eidolon-release60-yield-predeploy-proof-KIFTbd`,scan0. This
test's retained evidence has contexts but no failure screenshot/trace.

First attempt <25s duration rules out45s approach deadline exhaustion. It broke
after observing <2unitdistance, then failed next distance read2.12694354 before
the old IDLE wait. moveByGroundClick returns after minimum displacement, not
settled arrival. Retry reused rank5character and expectedrank1. These failures
precede spell rejection/acceptance assertions; do not call them proved game
collision/ability regressions or skip their original requirements.

**Diagnostic now cleand03ecde**, `/tmp/eidolon-release60-hover-diagnostic-V1ICnd`,
branchwork/release60-hover-diagnostics. Adds bounded settled-ground helper:
IDLE/no target/settledcamera before distance or next click, sameabsolute45s,
strict<2units and12unitsteps. Captures room/destination/state+image at failure
before automatic town exit. Retry getsfresh -retry1character and exact-ground
allowlist; assertsrank0 then allfivepurchases, retained3spells/wallrejection/
cooldown/shape/quality/savedrank assertions. No runtime/version/workflow/notes
change; onlyQA/helper/tests/plan. Focused45367 PASS6/1.252s+lint+shellsyntax;
expanded1600 PASS110/7/2.315s. Logs`/tmp/eidolon-ground-approach-{focused,lint,regression}.log`.
FULL CLIENT/NATIVE NOTRUN. Plan`2026-09-10-ground-spell-approach-verification.md`.

Next owned browser priority AFTER22725terminal/preservation/cleanup: existing
`ground-shape` route in diagnosticWT, uniqueisolatedrunID/ports, Node24 inside
sg render, normalprepare:client, retries0 first. It trains prepared QA geometry,
not earned progression. Preserve actual spell/failure evidence; full client
regression before canonicalmerge/normalpush. Then allnewCI/deploy/finalgates.
Canonicalcaab611 is not advanced merely because focusedtests passed.

**22725 ACTIVE**, onlyownedlocalbrowser, primarya285fbc frozen. Samefresh-hunt-rest-
0910/18560/18561/41960, log`/tmp/eidolon-fresh-hunt-rest-replay.log`. Latest Imp
milestone25/60,0deaths,12townstops,1trainingstop,944s;level17/885XP/6500next/4648Gold,
605maxHP/396maxMP,17bag slots/2110unsoldgearvalue. Recovery remains natural;
60Imp/manual/scars/50Orcs/unchangedlevel30readiness stillopen. Keep samehandle;
do not mutate source/cancel for age/overlap another browser or heavytests.
Aura remainsa877d46, unpublished with full/native/rendered gates. All broader
class/group/story/raid/phone/CIcost/casino and1.1–1.10scope stays open.

## Previous checkpoint — September 10, 03:09 UTC

Previous goal turn made PROGRESS (8Seeds and progress past the Imp stall).
This continuation is a VERIFIED WAIT: same22725 and predeploy102727073506 were
re-polled and remain live. Imp credit advanced to10, but the next action remains
continuing the current run. No source changes, new push, restart or impasse.
Full goal active; root remains ledger-only/NEVER pushed.

**CI34430017443 ACTIVE**, canonicalcaab611 frozen. All server/client/browser
jobs remain SUCCESS. Predeploy102727073506 ACTIVE: deterministic High/Low
gallery SUCCESS; disposable full-character gameplay now running. No deployment
or final acceptance yet. Continue same job/workflow and preserve its terminal
artifacts before claiming any native/release gate. Last knownpublic60/df91bb6.

**22725 ACTIVE**, primarya285fbc frozen, same`fresh-hunt-rest-0910`/18560/18561/
41960 and `/tmp/eidolon-fresh-hunt-rest-replay.log`. After Watch40manual+save,
collection earned8Seeds in23observedtargetdeaths/0playerdeaths and proceeded
through manual turn-in to Imp chapter atlevel9/685XP/1916Gold, full385HP/264MP.
Actual **unfinished-hunt** mana retreat in Imp: level9/249HP/27MP/rest0 →
town305HP/66MP → naturallyfull385HP/264MP/bank9.901 → departurebank17.919,
22.503s, with the same120s absolute encounter deadline. Earned level10 training
then spent2availabletalentpoints normally; no state grants or dailies.

Latest Imp milestone **10/60**,0deaths,5reststops,1trainingstop,449huntseconds,
level13/2535XP/3700next/2904Gold. HP357/495,MP152/330,19bagslots/1070unsoldvalue.
Another unfinished mana retreat restored17→330MP in22.977s before that milestone;
the subsequent between-encounter health stop restored357→495HP and153→330MP,
departing with103.903bankseconds. These are continued qualifying progress after
ordinary recovery, NOT complete Imp or wholecampaign/balance proof.
Keep full60/scars/50Orcs/unchangedlevel30dungeon readiness gates intact. Continue
sameprocess; no primary source edits, second owned browser or heavy tests until
terminal, then retain/sanitize artifacts and verify exactcleanup.

Aura remainsa877d46 with full/native/rendered gates pending; CIcost and all other
class/group/realm/raid/phone/casino and remaining1.1–1.10scope unchanged/open.
Next same22725 and predeploy102727073506; act on true terminal results, not age.

## Previous checkpoint — September 10, 02:58 UTC

Previous turn made PROGRESS (actualCI respawn proof). This continuation yielded
new actual-play evidence and a new release stage: first full Watch completion
after ordinary in-encounter town recovery, all browser jobs green, predeploy
running. Full goal active; no impasse, cancellation, source change or new push.
Root stays ledger-only and NEVER pushed.

**CI34430017443 ACTIVE**, unchanged/frozen canonicalcaab611. All server/client/
threebrowser jobs SUCCESS. Browser1 completed29anonymous/10.5m,6nameplate/49.1s,
3resourceHUD/6s without retry; log`/tmp/eidolon-release60-yield-ci-browser1.log`.
**Predeploy102727073506 ACTIVE** on runner`eidolon-codex-chrome`: setup/checkout/
Node/dependency+GPUverification passed, deterministic High/Low gallery running.
Disposable full-character stage is pending. Do not read this as deployed or
accepted60; predeploy, bothdeployments, finalnative and exactpublicidentities
remain required. Continue exact workflow; no new successor/source changes.

**22725 ACTIVE**, sameprimarya285fbc frozen, `fresh-hunt-rest-0910`,18560/18561/
41960, log`/tmp/eidolon-fresh-hunt-rest-replay.log`. First Watch40/40 COMPLETE
with manual100Gold1593XP and freshlogin exactprogress verification: level6/
640XP/1389Gold beforeclaim → level8/508XP/1489Gold.0deaths,18townvisits,746s.
Unsoldbaggearvalue1210 is not cash income or proof of overallloot balance.
Inspected current actual`earned-watch-ready.png`: 40/40, displayed correct
rewards and explicit CompleteQuest button in Ilyra dialogue. Preserve archive
only after terminal; this active test-results file must not be overwritten.

New **unfinished-hunt** recovery branch was exercised during Watch after30credit:
livinglevel6/225HP/15MP/rest0 → actualtown247HP/41MP → naturallyfull192MP,
bank9.669 → departurebank17.093 after21.346s. Subsequent35credit and full40/manual/
reconnect passed without resetting the existing encounter watchdog. This proves
ordinary mid-hunt recovery plus resumed credit in THIS run; no claim of Imp
success, wholecampaign/class/group readiness or tunedfun/difficulty. Retain
observed~12.4minute/18visit pacing for later balance review. Seeds/Imp/scars/Orcs/
unchangedlevel30dungeon gate still pending. No daily/grants/prepared level.

Keep22725 until terminal, no second owned browser/heavytests or primary source
edits; preserve/sanitize/exactcleanup afterward. Auraa877d46 unchanged, remains
unpublished with full/native/rendered gates open. Allclass/group/campaign/raid/
phone/CIcost/casino and full1.1–1.10scope remain open. Next same22725 and exact
predeploy102727073506, then follow true release terminal/acceptance results.

## Previous checkpoint — September 10, 02:53 UTC

Previous goal turn made PROGRESS (aura ownership tests). This continuation
completed actual CI respawn correction verification and artifact inspection,
and revalidated the same two live handles. Full goal remains active; no impasse,
runtime edit/restart or new push. Root ledger-only/NEVER pushed.

**CI34430017443 ACTIVE**, canonicalcaab611 unchanged/frozen. Server/client and
browser2/3 now SUCCESS; only browser1 job102724787728 still ACTIVE at02:53.
Browser3 job102724787664 passed25/25 in5.8m, no retry. Its corrected respawn
case ran02:48:03.921→nextcase02:48:36.699 under ANGLE/Vulkan SwiftShader, not
the old two120s failures. Retained log`/tmp/eidolon-release60-yield-ci-browser3.log`
and artifact10134436964 at`/tmp/eidolon-release60-yield-ci-proof-B5RW5Z`,scan0.
ActualCI Rogue PNG inspected: no enclosing cube, same1280x720 fixture. This
proves the isolated correction in CI, NOT pipeline/deploy/native acceptance.
Predeploy, deployment, final character QA and exactpublic60/caab611 gates remain.

**22725 ACTIVE**, primarya285fbc frozen; same`fresh-hunt-rest-0910`/18560/18561/
41960, log`/tmp/eidolon-fresh-hunt-rest-replay.log`. Opening+diary manual/reconnect
passed. Latest Watch milestone20/40,0deaths,10rest stops,level5/388XP/780Gold,
10bag slots/810unsoldgearvalue at391huntseconds. Actual town visits heal/fullmana
and accrue bank; bank also naturally expired outside before some returns. No
new unfinished-encounter retreat observation yet. Watch completion, Seeds/Imp/
scars/Orcs and unchangedlevel30dungeon readiness remain open. Continue same run;
no second owned browser or heavy tests until terminal, then retain/sanitize and
verify exact cleanup. Do not treat partial progress as full pacing acceptance.

Aura remains cleana877d46, all native/rendered/full promotion gates pending.
Read-only economy check noted single-eligible-member party Gold uses1.1factor
while recipientCombatExperience intentionally has no bonus for size<=1; no new
balance decision/fix or claim that this explains the Imp stall. Do not substitute
that observation for existing full class/group/economy evidence requirements.
Next: continue exactCI and22725. All broaderstory/raid/phone/aura/CIcost/casino
and full1.1–1.10scope remain open.

## Previous checkpoint — September 10, 02:48 UTC

Previous goal turn made PROGRESS (guarded hunt recovery and fresh replay).
This continuation made PROGRESS in the independent aura lifecycle verification
and revalidated both running handles. Full goal active; no impasse, no source
mutation/restart of either active runtime and no new release push. Root remains
ledger-only and NEVER pushed.

**CI34430017443 ACTIVE**, canonicalcaab611 frozen. Server/client SUCCESS;
browser2 job102724787734 now SUCCESS. Browser3/1 jobs102724787664/102724787728
confirmed ACTIVE. Predeploy/deploy/final native/public60acceptance still pending.
Continue exact workflow; do not merge60 into accepted prototype baselines yet.

**22725 ACTIVE**, primarya285fbc frozen, same`fresh-hunt-rest-0910`/18560/18561/
41960 and `/tmp/eidolon-fresh-hunt-rest-replay.log`. Opening3kills/manual100Gold/
100XP+reconnect passed71s/0deaths. Diary manual25Gold/200XP passed113s,level3.
Current Watch hunt latest milestone5/40,level4,0deaths,2restStops at95huntseconds;
additional two between-encounter town rests afterward fully restored159MP and
bank accrued before departure. The new unfinished-encounter retreat branch has
not yet been observed; full Watch/Seeds/Imp/scars/Orcs/level30readiness are open.
Keep the same run/source until terminal and preserve/sanitize/exactcleanup then.
No second owned browser or heavy tests alongside it.

**Aura prototype now cleana877d46**, `/tmp/eidolon-rest-aura-batching-k1vBvU`,
accepted59 baseline/runtime still unchanged. Added two tests with actual Fighter
actor lifecycle synchronization: repeated High/Low and effect-scene changes,
stealth, death, inactivity and rest-expiry/reentry dispose each retired batch
exactly once, preserve16/8sparks/oneowner/meshposition, and leave a second actor's
original aura/matrices/sharedshape/materials untouched. Both scenes empty at
final cleanup; replicated bank unchanged. Focused55010 PASS35/3/2.705s+lint,
logs`/tmp/eidolon-aura-transition-lifecycle{,-lint}.log`. Only tests/docs changed.
This is disposal-event/ownership evidence, NOT WebGL memory/actual rendered
transitions/native multiplayer/FPS/physicalphone proof. All full/native/rendered
promotion gates in its plan remain due; no runtime merge or publication.

Next: same22725 actual play and sameCI34430017443. Full campaign/class/group,
dungeon/raid/physicalphone, aura native/performance, CIcost, casino and remaining
1.1–1.10scope unchanged and open.

## Previous checkpoint — September 10, 02:43 UTC

Previous goal turn made PROGRESS (verified/pushed caab611). This continuation
also made PROGRESS: identified a hunt-driver restriction inconsistent with the
requested town-recovery loop, implemented bounded ordinary disengagement,
verified regression/death accounting and started the full fresh replay. No
impasse; full objective remains active. Root remains ledger-only/NEVER pushed.

**Release60 CI34430017443 ACTIVE** on unchanged canonicalcaab611. Server
102723358239 and client102723358452 now SUCCESS. Browser3/1/2 jobs102724787664/
102724787728/102724787734 are confirmed ACTIVE. Keep canonical source frozen;
predeploy/deploy/final native/public identity gates remain required. No new
push, release successor or accepted60claim. Last public runtime60/df91bb6.

**Primary nowa285fbc**, guarded hunt resource correction after06fb7a2. Before this
change, ordinary recovery was available only after a credited hunt kill;44940
ended at4/60Imp/emptyMP/58retreats with its original target still alive. The
driver now permits ordinary Recall while an encounter is unfinished if below
one primary cast or35%HP, then verifies actual safe-zone arrival, natural full
HP/MP and rest banking, and leaves town normally. All this time stays INSIDE the
unchanged absolute120s encounter deadline; no credit/count/level/reward changes,
grants, daily workaround or watchdog reset. Between-encounter two-cast/80% policy
is unchanged. In-flight kills may legitimately advance level during a retreat;
strict level equality remains between encounters. An observed death immediately
before Recall now throws rather than silently using the helper's respawn path.
Existing explicitly permitted respawn callers keep their previous default.

Focused96406 PASS41/3/.838s+lint on06fb7a2; full15472 PASS286/4034/115.724s+lint.
The later death-race guard passed focused38521 PASS50/4/.857s+lint. That guard
was added AFTER the full run, so do not claim4034 includes its new cases. Logs
`/tmp/eidolon-hunt-disengage-{focused,lint,full-client,full-lint}.log` and
`/tmp/eidolon-hunt-disengage-guard-{focused,lint}.log`. All changes are QA strategy
and evidence, not a production resource/balance fix; actual success still needed.

**22725 ACTIVE**, only owned local browser workflow, Node24 inside sg render,
primarya285fbc source FROZEN. Run`fresh-hunt-rest-0910`, API18560/Mongo18561/
web41960, route`fresh-story-ready`, log`/tmp/eidolon-fresh-hunt-rest-replay.log`.
Services became ready and actual play began: two opening kills at27s,0deaths;
later hunt recovery and full readiness are not yet reached.
No daily/prepared level/grants; all seven Earth chapters and unchangedlevel30/
accepted-uncleared dungeon gate remain required. Do not launch another owned
browser/heavy tests or mutate its source. Preserve/sanitize/exactcleanup only
after terminal state. Previous failure archiveqYOiwO and original log retained.

Next: continue same22725 and CI34430017443; observe actual in-encounter recall
and qualifying hunt progress, not just policy-unit success. Early Imp difficulty,
full campaign/group/class readiness, physical phones, complete dungeons/raids,
aura/CIcost prototypes, casino and all remaining1.1–1.10 gates stay open.

## Previous checkpoint — September 10, 02:35 UTC

This continuation made PROGRESS: diagnosed both terminal runs, retained/inspected
evidence, verified the respawn fixture correction with actual software rendering
and full regression, and pushed the corrected60 verification candidate. No
impasse; full goal remains active. Root is ledger-only/NEVER pushed.

**Canonical60 caab6111f9d6eef1f375f7942a8163cb2d86da6c PUSHED**, normal78092
3a139c0→caab611 from clean`/tmp/eidolon-safe-zone-release-preview-gCLEaT` after
fast-forwarding verified diagnostic branch. New CI34430017443 ACTIVE confirmed
with server102723358239/client102723358452 running. Freeze source until terminal.
No src/server/version/package/workflow changes; existing60patch notes accurate.
Public02:33 still healthy60/df91bb6. No accepted60or61successor yet.

Diagnostic worktree now cleancaab611, codef827c80. Browser79068 PASS1/34.8s
bundled Chromium/SwiftShader, CI=1/retries0, same120sdeadline,1280x720quality and
all three respawn+stealth assertions. Image inspected no cube; archive
`/tmp/eidolon-visual-yield-render-proof-ZM4ryD`,scan0,web41962closed. Full39933
PASS255/3612/104.772s+lint. Logs`/tmp/eidolon-release60-visual-yield-browser-ready.log`
and`/tmp/eidolon-release60-visual-yield-full-{client,lint}.log`. Initial67098
failed before scene loading due absent ignored vendor assets; archive
`/tmp/eidolon-visual-yield-startup-proof-AmIcGE`. `prepare` was a mistaken script
name; actual`prepare:client` passed before79068. Do not claim first-attempt pass.

**Primary44940 TERMINAL FAILED16.9m**, no local browser running now. Fresh story
on79e9571/code d47f5c6 completed opening/diary/Watch40/Seeds8manual+reconnect but
stalled at4/60Imp credit in unchanged120sencounter. Level11, HP304/380, MP0/260,
rest0,58retreats,10acceptedFireballs,97hits/1440damage; originalImp204stillalive74HP
at2.97units, actualhover/requestedSkeleton168 in crowded melee. Actual attacks
registered; no evidence a qualifying Imp died without credit. Between-encounter
rest waits for quest-credit progress. Investigate resource-starved retreat/target
switching and earlylevel9→min20Imp difficulty, not presumed server credit loss.
No reward/level/watchdog adjustment or daily/state-grant workaround made.

Archive`/tmp/eidolon-fresh-imp-credit-proof-qYOiwO`,scan0; failed-collectionPNG
inspected. Exact18560/18561/41960ports/ownedcontainersabsent afterwrappercleanup.
Primary nowclean45a557c (failure evidence doc only after79e9571). Source no longer
frozen by browser. Log`/tmp/eidolon-fresh-diary-ack-replay.log`; full hunt/scars/
Orcs/unchangedlevel30dungeon gate remains unproven. Next useful local work is a
bounded diagnosis of this real encounter/resource behavior, preserving complete
fresh campaign acceptance. Fullgroup/class/dungeon/raid/story/physicalphone/aura/
CIcost/casino and all remaining1.1–1.10scope remain open. Continue exact new CI
handle and do not skip predeploy/final native/public verification.

## Previous checkpoint — September 10, 02:28 UTC

Previous user-facing roadmap confirmation was NO PROGRESS toward implementation:
it verified already-recorded casino scope without new edits. This continuation
made PROGRESS: revalidated actual handles, inspected terminal CI failure and both
traces, prepared a bounded fixture correction and passed its focused tests/lint.
Full goal remains active; no impasse. Root is ledger-only and NEVER pushed.

**Corrected60 CI34427816379 TERMINAL FAILED**, canonical3a139c0 unchanged. Server,
client and browser1/2 passed. Browser3 job102718128498 failed respawn-appearance
twice at120s;24other tests passed. Predeploy/deploy/final jobs skipped. Both
traces prove all three respawn visibility checks and stealth expiry passed, with
the final PNG captured before timing out at disposal. Each normal button click
took~10.4s under SwiftShader. PNG inspected, no enclosing cube. Artifact10133758335
at`/tmp/eidolon-release60-browser3-failure-akHxw8`, log
`/tmp/eidolon-release60-corrected-browser3.log`. This differs from the old54clock
failure; do not claim a new appearance regression or accepted release.

Candidate in `/tmp/eidolon-release60-hover-diagnostic-V1ICnd`: fixture-only50ms
post-draw idle before next RAF, actual elapsed actor clock retained, same120s
deadline, quality, viewport, three cycles and assertions. Cancel frame+timer on
stop, ignore late callbacks, propagate draw errors. New helper/tests and plan
`2026-09-10-respawn-fixture-render-yield.md`; focused77789 PASS15/2/.746+lint after
fixing missing ESM Jest import. FULL CLIENT/BROWSER NOTRUN. Next owned browser
priority after44940 terminal: bundled Chromium/SwiftShader respawn with retries0,
then full regression; only merge/push canonical60 if verified. No successor yet.

**44940 ACTIVE**, confirmed handle, primary79e9571/code d47f5c6 unchanged/frozen.
Run`fresh-diary-ack-0910`, ports18560/18561/41960, log
`/tmp/eidolon-fresh-diary-ack-replay.log`. Opening+diary manual/reconnect passed.
First hunt40/40 completed527s/0deaths/14town rests, manually claimed100Gold1593XP
tolevel8. Eight Seeds earned in10observed target deaths/0deaths, then story
progressed to Imp hunt atlevel9. Latest earned preparation reachedlevel10 and
spent2earned talent points; full60Imp count/turn-in, scars, Orcs and unchanged
level30dungeon readiness remain unproven. No daily or state grants. Preserve
source until terminal, sanitize/retain artifacts and exactcleanup before another
owned browser or heavy tests. Group/class/fullstory/raid/physicalphone/aura/casino
and all remaining1.1–1.10 gates stay open.

## Previous checkpoint — September 10, 02:20 UTC

This continuation is a VERIFIED WAIT: re-polled exact live44940 and corrected60
CI34427816379; neither is terminal. Previous turn made PROGRESS. No impasse,
restart, cancellation, runtime change or successor push. Full goal active;
root ledger-only/NEVER pushed. Do not infer completion from partial hunt progress.

**44940 ACTIVE**, primary79e9571/code d47f5c6 frozen. Same freshWizard story-only
run`fresh-diary-ack-0910`,18560/18561/41960,
log`/tmp/eidolon-fresh-diary-ack-replay.log`. Opening/diary/manual/reconnect remain
passed. Latest numbered hunt receipt:20/40Skeletoncredit,0deaths,level5/195XP,
719Gold,6equipment slots,1talentpoint,7rest visits at272hunt seconds; additional
ordinary mana recovery visits continued afterward. Bank accrues in town and
mana fully recovers before departure. No readiness, complete hunt or later
collection/Imp/Orc result yet. Keep the same process and source to terminal;
preserve/sanitize artifacts and exact cleanup before another browser/heavy tests.

**CI34427816379 ACTIVE** on unchanged3a139c0. Client/server and browser2/3 SUCCESS;
browser1/3job102718128481 and3/3job102718128498 remain ACTIVE. No corrected60
predeploy/deploy/final live acceptance yet. Canonical/diagnostic worktrees frozen.

Read-only source review reconfirmed an already documented group budget risk,
not a new audit or new measured party result. `combat_death.go` grants party
members shared combat XP and personal story kill credit. Existing7980 production
helper audit `/tmp/eidolon-primary-earth-budget-audit.log` models7pre-dungeon
chapters/25979questXP,lowest qualifying enemies and8/20collection kills:2players end
25/27 and5players22/23 for no/all-kill rest. Those scenarios omit incidental combat
and are not actual party campaigns. Retain the original findings below; do not
rerun unchanged diagnostics or tune runtime from a partial solo replay. Actual
class/group readiness remains required without daily/grant substitutions.

## Previous checkpoint — September 10, 02:14 UTC

This turn made PROGRESS: inspected terminal fresh-diary failure, corrected
acknowledgement-during-approach handling, passed full regression, and verified
opening/diary/manual/reconnect in the new actual fresh replay. Previous turn was
PROGRESS. Full goal stays active, no impasse; root ledger-only/NEVER pushed.

**Corrected60 CI34427816379 ACTIVE**, exactcanonical3a139c0 unchanged. Server
102716687086 and client102716687272 SUCCESS; browser2/3job102718128475 SUCCESS.
Browser1/3job102718128481 and3/3job102718128498 ACTIVE. No predeploy, deployments,
or final new live acceptance yet. Keep canonical and diagnostic worktrees frozen;
do not push a61successor or accept the old failed60run34421323405.

Primary62038 TERMINAL FAILED1.2m on5a01ce8. Opening/manual100Gold+100XP/reconnect
passed36s,level2,0deaths. Failure during resumed diary approach had exact Mara
reading open and1/1servercredit, healthy136/137HP,96/126MP,25freebag. An ordinary
pending inspection could be acknowledged after the initial journal-state check;
movement continued under the reading and failed0.748versus1unit displacement.
No missing diary credit or balance conclusion. Archive
`/tmp/eidolon-fresh-diary-race-proof-U6i3rY`, wrapper sanitized2files, supplemental0,
at-failure screenshot inspected, exact owned services/18560/18561/41960absent.
Log `/tmp/eidolon-fresh-story-0203.log` retained.

Primary correction **d47f5c6**: guard each resumed movement against the exact
visible/open entry; recognize acknowledgements during successful or failed
movement and return`already-open`, not a movement/inspection claim. Unrelated/
hidden/collapsed entries cannot suppress errors. Preserve survival, title/read,
server credit, unclaimed rewards and manual Ilyra completion. No runtime/quest/
threshold/timeout/reward changes. Focused21692 PASS19tests/2suites.825+lint;
full65008 PASS286suites/4026tests114.77s+lint. Logs
`/tmp/eidolon-diary-ack-full-{client,lint}.log`. Proof-onlyprimary **79e9571**.

**44940 ACTIVE**, only owned local browser: freshWizard story-only readiness on
79e9571/code d47f5c6, run`fresh-diary-ack-0910`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-fresh-diary-ack-replay.log`. Source frozen; no heavy owned tests
or second browser. Actual opening/manual/reconnect passed63s,0deaths; diary
approach/read/manual25Gold+200XP/reconnect passed at100s,level3. This run used
the ordinary`inspected`branch, not a recorded delayed-ack branch replay. Unit
checks cover that race.40Skeletonstoryhunt has started atlevel3/121XP/172Gold,
zero equipped slots/talentpoints, no grants/dailies. Do not claim readiness yet.
At terminal preserve/sanitize evidence and verify exact cleanup. Seven authored
manual chapters and unchangedlevel30/accepteduncleared dungeon remain required.

Prepared Earth65010 PASS3/16.2m remains valid for its owncode/functional scope,
not this fresh balance gate. Full class/group/dungeon/raid/story, physical phones,
aura batching, CIcost prototype, casino and remaining1.1–1.10work stay open.

## Previous checkpoint — September 10, 02:03 UTC

This turn made PROGRESS: complete prepared Earth chain passed; reproduced live60
hover failure with real evidence, corrected ordinary camera framing, passed full
client and live native checks, pushed corrected60 normally, and started fresh
story-only progression. Previous turn was PROGRESS. No impasse; full1.1–1.10goal
active, root ledger-only/NEVER pushed. No requirements reduced.

**65010 TERMINAL PASS3/16.2m** on primaryef1ca35/code299cded. Stage1 opening/diary/
40Skeletons/8naturalSeeds/manualconsumption4.4m; stage2 60Imps/all3scar readings/
manual6.1m; stage3 50DemonOrcs/manual/dungeonoffer5.6m. Raid remained sealed.
Four normal stash visits deposited7whole earned items with all conservation and
per-item Gold checks; repeated capacities100/98/96/95correct. All stage logins
preserved full stash and Seed count. Preparedlvl100, NOTfresh balance or dungeon/
raid clear. Archive `/tmp/eidolon-earth-complete-proof-R5oR8R` HTMLreport, no success
PNG; log `/tmp/eidolon-earth-padding-0133.log`, wrapper sanitation0/supplemental0,
exact containers and18560/18561/41960absent after cleanup. Primary proof5a01ce8.

Live60 diagnostic35114 on6824707 TERMINAL FAILED1/1PASS1.0m against exactdf91bb6,
fresh ordinary registrations/no origin override. Natural expiry passed. Failed
hover found no candidate/projection; nearby Skeletons living/rendered, camera
settled, healthy protected playerx94.985, pointer complete. Screenshot inspected:
close gate framing. Archive `/tmp/eidolon-live60-hover-proof-jeuKWn`, scans0,
log `/tmp/eidolon-live60-hover-diagnostic.log`. No missing-spawn/healing failure.

Correction77805df uses existing ordinary canvas/wheel zoom15→30 before the same
hover, preserving player position/protection, warning/departure assertions and
timeout. Projection regression uses observed nearby coordinates. Failure evidence
retains last attempted projection. Focused63243 PASS23/3/.745+lint; full44217
PASS254suites/3606tests69.017s+lint. Actual corrected live24692 PASS journey+expiry
2/1.1m, party1/13.2s: warning, InRange after departure,2incomingHP,Fireball80MP,
RecallHP108→110/MP80→92→110, bank9.701→10.165 acrosslogin, naturalexpiry/reentry,
2realplayers High/Low/joystick. Archive `/tmp/eidolon-live60-framing-proof-yGjGmQ`,
scans0, inspected both boundary images/rejoined/Low390party. Log
`/tmp/eidolon-live60-framing-corrected.log`. No physical-phone claim.

**Corrected canonical60 = 3a139c0179221f06e7f027218e15fea63c561842**; final docs-only.
Canonical worktree `/tmp/eidolon-safe-zone-release-preview-gCLEaT` fast-forwarded
and normal68566push SUCCEEDED df91bb6→3a139c0. Diagnostic worktree
`/tmp/eidolon-release60-hover-diagnostic-V1ICnd` samecleancommit. No runtime/server/
login/version/manifest/package/workflow changes, so existing60notes remain true.
This repairs failed60 acceptance, not a61successor. **CI34427816379 ACTIVE**, exact
newcommit. Keep old failed34421323405history; require all new jobs/deploys/final
live/public acceptance before successor. Do not merge into accepted baselines yet.

**62038 ACTIVE**, only owned local browser: freshWizard story-only readiness on
cleanprimary5a01ce8 (code299cded), run`fresh-story-0910-0203`, API18560/Mongo18561/
web41960, log`/tmp/eidolon-fresh-story-0203.log`; route`fresh-story-ready`.
No prepared level, daily contracts or state grants. Preserve seven manual Earth
chapters, unchangedlevel30gate and accepted uncleared dungeon. Source frozen,
no heavy owned tests/second browser; preserve/sanitize/exactcleanup at terminal.
Class/group pacing, full dungeons/raids/story, physical phones, aura batching,
CIcost prototype, casino and all remaining1.1–1.10scope stay open.

## Previous checkpoint — September 10, 01:41 UTC

This turn made PROGRESS: inspected terminal live60failure and artifacts, narrowed
what evidence is missing, added read-only failure capture with tests in a separate
diagnostic worktree. Previous turn was PROGRESS (actual stash proof/correction/
regression). Full goal active, no impasse; root ledger-only, NEVER pushed.

**60 CI34421323405 TERMINAL FAILED**, final live102709210653 at01:36:08UTC.
Both deployments and preceding gates succeeded; exact60/df91bb6 is deployed but
not accepted. Anonymous/persistent-character and four-class/remote-animation live
checks passed. Natural Well Rested expiry/reentry passed (bank13.924→0 removes
aura/stats; reentry restores and earns1.485). Sanctuary journey then failed its
same10-second inside-boundary enemy-hover assertion, as in the earlier predeploy
retry. No live combat/Recall/reconnect or party pass. Do not blindly rerun CI or
push a successor. Canonical worktree remains unchanged atdf91bb6.

Live failure archive `/tmp/eidolon-release60-live-failure-7uE6Za`, artifact10132708546,
scan0; inspected pre-boundary town screenshot. It cannot identify missing enemy,
occlusion or stale pointer; no at-failure scene was retained. Original live log
`/tmp/eidolon-release60-final-live.log`; acceptance document updated accurately.

**New clean diagnostic6cf157a**, worktree
`/tmp/eidolon-release60-hover-diagnostic-V1ICnd`, branch`work/release60-hover-diagnostics`
based exact60. Failure-only read observations retain last candidate/projection,
actual hover/card, needsRaycast/canvas, camera/player state, overlay identity and
nearest20replicatedSkeletons' rendered/alive state; capture entered-world failure
PNG and rethrow original assertion. No runtime/timeout/selection/health/buff or
gameplay change. Focused5576 PASS20/3/.849+lint; no native diagnostic yet. Logs
`/tmp/eidolon-sanctuary-hover-observation-{tests,lint}.log` and plan
`2026-09-10-sanctuary-hover-diagnostic.md` in that worktree.

**65010 remains ACTIVE**, exact same primaryef1ca35 serial Earth replay,
run`earth-padding-0910-0133`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-padding-0133.log`. Stage1 PASSED4.4m including8naturalSeeds,
all manual claims and saved state; stage2 still running. Source frozen, no second
owned browser or heavy tests. Preserve/sanitize/verify cleanup at terminal.
**Next browser priority changes to the failed live60 diagnostic**, using a fresh
ordinary QA registration against exact deployed60, then determine the actual
correction from captured evidence. Do not cancel the Earth replay to start it.
The prepared complete-chain, fresh story-only readiness, class/group/dungeon/raid/
phone/casino gates all remain intact and open. Aura4a91c75/CIcost080e175 unchanged;
do not merge60 into accepted baselines before resolving its final acceptance.

## Previous checkpoint — September 10, 01:33 UTC

This continuation made PROGRESS: inspected the terminal Earth replay, verified
its first actual stash transfer, corrected the second-visit occupancy calculation,
passed full regression and started the next complete replay. Also verified60's
deployments and exact public identities; final live acceptance is still pending.
The preceding roadmap-only reply confirmed existing casino scope without new
implementation. No impasse; full goal stays active, root ledger-only/NEVER pushed.

**60 CI34421323405 ACTIVE**, frozen canonicaldf91bb6. Client/server/all3browser,
predeploy102701339923/input validation and both deployments SUCCESS. Final live
**102709210653 ACTIVE**: anonymous/persistent-character checks passed; four-class/
remote-animation running, native town recovery and upload still due. Public
manifest/login/patch notes/main-module key/backend match Alpha1.0.60/df91bb6;
runtime GET200/19736bytes. Server schema9→9 and previous59 rollback image verified.
See updated `2026-09-10-release60-live-verification.md`. Predeploy archive
`/tmp/eidolon-release60-predeploy-proof-6jzgOY`, scan0; warning/departure and
High390party-world screenshots inspected. Predeploy recovery passed on retry
after one10-second hover timeout, cause unproven; retain this flaky result.
Do not push a successor before final live results and fresh public checks pass.

Primary **12987 TERMINAL FAILED15.7m** on752c888. Stage1 PASS4.6m: opening,
diary,40Skeletons and8naturalSeeds/manualconsumption/reconnect. Stage2 PASS6.9m:
60Imps,all3scar investigations/manual/reconnect. Stage3 reached41/50DemonOrcs.
One actual normal stash visit preserved entire armor item1606094121388945210,
all other items/quests/equipment and Gold; only its3sales earned1720Gold. Then
the second visit failed before deposit: the helper treated a100-entry client
array padded with99nulls as100occupied slots. Screenshot shows1stored item and
empty slots; `GameEngineNetworkMessages` confirms padding. This is a test-driver
error, not full storage or a runtime rejection. No complete chain/save proof yet.
Archive `/tmp/eidolon-earth-stash-capacity-proof-BDzPFc`, wrapper sanitation0,
supplemental scan0, screenshot inspected, exact services/18560/18561/41960absent.
Log `/tmp/eidolon-earth-pickup-0110.log` retained.

Primary now **ef1ca35**, code **299cded**: count actual stash item IDs against
rendered capacity, fail closed for invalid/impossible observations, record space
receipt. All item protection/conservation, quest counts, drops, timeouts and
normal inputs retained. Focused68065 PASS31/3/.691+lint; full77046 PASS286suites/
4018tests92.011s+lint on814f733. Logs `/tmp/eidolon-stash-padding-full-{client,lint}.log`.
Historical progression report now explicitly separates old daily-route passes
from the current story-only gate (root8cb0c9d, primary814f733).

**65010 ACTIVE**, only owned local browser: complete corrected serial Earth,
run`earth-padding-0910-0133`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-padding-0133.log`. Primary frozen until terminal; preserve/
sanitize evidence and verify exact cleanup before another browser. No heavy
owned tests alongside. Fresh story-only readiness remains next after the full
prepared-chain pass; no dailies/grants may satisfy its unchanged level30gate.
Aura4a91c75 and CIcost080e175 remain independent/unpublished. Class/group pacing,
full dungeons/raids/story, physical phones, casino and all1.1–1.10scope remain open.

## Previous checkpoint — September 10, 01:11 UTC

This turn made PROGRESS: actual replay reached a collection failure, inspected
current drop authority and retained evidence, corrected incomplete ground-pickup
handling and final-encounter checking, then passed full regression and launched
the next actual replay. Previous turn was PROGRESS. Full goal active, no impasse;
root ledger-only and NEVER pushed.

**60 CI34421323405 ACTIVE** on frozen canonicaldf91bb6. Client/server/all3browser
groups SUCCESS; predeploy102701339923 still actual full-character gameplay.
No deployment/final native/public60acceptance yet. Same pipeline only; no successor
push or cancellation based on elapsed time.

Primary49128 TERMINALFAILED3.5m on370f029: opening/diary/40Skeletons complete,
Seeds7/8 after40encounters; no dailies, full2605HP,7freebag slots. One equip-only
visit freed11slots. No stash transfer occurred. Archive
`/tmp/eidolon-earth-seed-budget-proof-9gBFvf`, sanitation0/exactcleanup, screenshot
inspected; log`/tmp/eidolon-earth-stash-diag.log`. Database/API started successfully
this time; it does not identify the preceding17921startup failure's cause.

An initial commentary incorrectly assumed20% from stale context; immediately
corrected against current `ChronicleDropForKill`:35% for CollectionVersion2,
guaranteed after4misses; grandfathered accepted contracts65%. **No drop-rate or
encounter-budget change.** World accounting reserves outstanding fragments. Old
functional helper moved only once toward ranged death and could leave before
pickup, then unconditionally failed after the last allowed encounter. A particular
abandoned Seed was not recorded and remains a source-supported hypothesis.

Primary now clean **752c888**, code **e0cbb32**. Bounded real move-only approach
reaches the actual death location within2units; waits900ms as the fresh route
already does, then requires nearby quest drops/pending pickups to drain normally.
Checks completion after the final permitted encounter. Failure evidence now lists
replicated quest-drop positions/ranges/pending flags and auto-loot state.
Existing40collection encounters,600s/stage,8Seeds,150hunt kills/manualclaims and
stash protection remain. Focused63729 PASS29/4/.715+lint; full63729 PASS286suites
4011tests86.196s+lint, including new startup diagnostics. Logs
`/tmp/eidolon-fragment-pickup-full-{client,lint}.log`; primary plan
`2026-09-10-earned-fragment-pickup.md` details evidence and limits.

**12987 ACTIVE**, only owned local browser workflow: corrected complete serial
Earth route on752c888, run`earth-pickup-0910-0110`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-pickup-0110.log`. Primary frozen until terminal; preserve/
sanitize artifacts and check exact cleanup before another browser. No heavy
owned tests alongside. Actual storage success/full chain and separate earned
fresh/class/group/dungeon/raid/phone/casino gates remain unproven. Independent
aura4a91c75 remains unchanged with full/native/performance gates still pending.

## Previous checkpoint — September 10, 00:59 UTC

This continuation made PROGRESS: diagnosed a startup-only failed attempt's
evidence gap, added bounded/redacted failure capture with behavioral checks,
successfully started the next actual replay, and integrated accepted59 into the
aura prototype. Previous turn also PROGRESS; no repeated blocking condition.
Full goal remains active; root ledger-only and NEVER pushed.

**60 CI34421323405 still ACTIVE**, canonicaldf91bb6 frozen/clean. All client,
server and three browser groups SUCCESS. Predeploy102701339923 is confirmed
inside `Run disposable full-character gameplay`; setup and deterministic
High/Low gallery passed. No deployment/final live/public60 acceptance yet.
Continue this exact run; no successor push or restart based on elapsed time.

Primary17921 TERMINALFAILED before gameplay: Mongo readiness timed out, API and
Playwright never started. `/tmp/eidolon-earth-stash-0050.log` retained; exact
owned services/18560/18561/41960absent. Disk134GBfree and retained destroy event
do not establish the database failure cause; original logs were removed by
cleanup. Do not attribute old screenshots or78199's quest results to this run.

Primary now clean **370f029**. New failure-only helper records exact disposable
container State (never Config/Env) and last80stdout/stderr log lines with5second/
1MBbounds per command. Known QA/database secrets are redacted in memory before
private artifacts are written. Fatal startup status, deadlines and exact cleanup
are unchanged; missing diagnostics cannot imply success. Focused89605 PASS59/4/
1.001s+lint+shellsyntax/diff. Tests cover redaction, bounds, failures/timeouts,
exact targets, all route order and cleanup. Runtime/stash helper remains the
full3995-test-tested4e7bc8d; a complete integrated regression remains a later
publication gate. Primary doc `2026-09-10-isolated-startup-evidence.md` explains.

**49128 ACTIVE**, only owned local browser workflow: corrected serial Earth
route on370f029, run`earth-stash-0910-diag`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-stash-diag.log`. Mongo/API became ready, actual3tests started,
diary inspection logged. Primary frozen untilterminal; no heavy owned tests or
second browser. Preserve/sanitize terminal artifacts and check exact cleanup.
If startup ever fails again, inspect retained isolated-service diagnostic folder
before another run can overwrite test-results. Full stash/quest completion and
fresh/class/group/dungeon/raid/phone/casino gates remain unproven.

Aura prototype now clean **4a91c75**, accepted59 merged into54b861f in
`/tmp/eidolon-rest-aura-batching-k1vBvU`. Retains final58/59 recovery, interface,
connection and casino-roadmap work along with all batching/native profile
assertions. Single conflict combined new evidence imports with accepted
backend-origin arguments; both preserved for the second actual browser.
Focused78996 PASS299tests/6suites2.45s+lint. Full integrated client/server,
controlled render/native party/expiry/journey and remaining lifecycle/performance
gates still NOTRUN. Inherited59metadata is not a new release or permission to
publish before60acceptance. No aura integration into primary or production.

## Previous checkpoint — September 10, 00:50 UTC

This continuation made PROGRESS: actual saved Earth stages1and2 passed; final
stage exposed a conservative sale-only bag limitation, now extended with real
stash preservation and full client regression. Also strengthened native party
evidence in the independent aura prototype. Previous turn was PROGRESS, not an
impasse. Full roadmap goal active; root ledger-only and NEVER pushed.

**60 CI34421323405 ACTIVE** on frozen clean canonicaldf91bb6. All client/server
and three browser groups SUCCESS. Predeploy character job102701339923 ACTIVE;
do not restart or push a successor while it runs. Deployment, final native live
checks, retained artifacts and fresh exact public60identity remain required.

Primary78199 TERMINALFAILED8.8m on e32d37a: stage1 passed2.7m (opening, diary,
40Skeletons,8naturalSeeds/manualconsumption/reconnect); stage2 passed4.4m
(60Imps,3scar inspections/manualclaims/reconnect). Stage3 reached19/50DemonOrcs,
then required3spare low-rarity sales but had only2. Healthy town screenshot
inspected, not a blocked combat state or another timeout. Three merchant visits
verified160/720/720Gold; initial equip-only visit freed11slots. Archive
`/tmp/eidolon-earth-stash-gap-proof-RQhBr1`, sanitation0/exactcleanup passed.
Log `/tmp/eidolon-earth-stages-0032.log`. No full clear or fresh pacing claim.

Primary now clean **a9678db**, code **4e7bc8d**. After equipping and conservative
sales, ordinary move-only travel/real stash click/right-click deposits preserve
spare non-stackable gear, including rare/future upgrades. Quest/crafting/gem
items remain carried; worn IDs/empty-slot gear excluded. Per-transfer whole-item
and all remaining bag/stash/Gold/equipment/quest conservation checks; real capacity,
unchanged5minimum/8targetslots. Serial stage reloads also compare entire stash.
No runtime/rate/progression change. Focused18225 PASS25/4/0.597+lint; full85092
PASS284suites3995tests88.258s+lint. Logs
`/tmp/eidolon-earned-stash-full-{client,lint}.log`; primary plan
`2026-09-10-earned-stash-preservation.md` retains failure and verification scope.

**17921 ACTIVE**, only owned local browser workflow: corrected full prepared
Earth serial route, run`earth-stash-0910-0050`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-stash-0050.log`, primarya9678db frozen. Continue samehandle
to terminal, preserve/sanitize evidence and check exact wrapper cleanup before
another browser. No heavy owned tests alongside. Actual stash success, full
Earth completion, independent fresh story/class/group pacing and dungeon/raid/
physical-phone/casino gates remain open.

Independent aura WT`/tmp/eidolon-rest-aura-batching-k1vBvU` now clean **54b861f**.
Existing native two-player phone journey now requires5/4meshes,2batches,16/8sparks,
one owned group per actor through High→Low→High and fresh login. Reuses actual
scene profiler for180frames after60warmup, with hardware/viewport/visibility and
frame/CPU/draw/allocation evidence. No claimed speedup or physical-phone proof.
Focused83040 PASS18validatorcases0.416s+lint+one-test discovery; full regression,
native journey/expiry/party and remaining lifecycle/steady-frame gates NOTRUN.
No runtime change this turn and no integration/publication of the aura prototype.

## Previous checkpoint — September 10, 00:33 UTC

This continuation made PROGRESS: published locally verified60, integrated
accepted59 into expanded campaign work without dropping requirements, and began
the fully earned serial Earth replay after full regression. No impasse; full
roadmap goal remains active. Root ledger-only and NEVER pushed.

**Release60 PUSHED, not yet accepted live.** Canonical clean **df91bb6** on
`release/60-sanctuary-combat-feedback`, worktree
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`. Push82118 succeeded normally from
e236b37 after all local gates. **CI34421323405 ACTIVE**, exactdf91bb6; client tests
passed, server102697171693 active at latest observation. Continue this pipeline,
not a replacement run or successor push. Full browser/predeploy/deploy/native
live/public identity gates remain. See
[release60 live verification](2026-09-10-release60-live-verification.md).

Final native88699 TERMINALPASS1case36.4s: actual same-target warning inside town
and normal range outside, incoming2HP, FireballMP110→80, RecallHP108→110 and
MP80→92→110, saved bank11.385→11.771 with aura. Both boundary world screenshots
and rejoined town image inspected. Archive
`/tmp/eidolon-release60-native-proof-KPv2XQ`, wrapper/supplemental scanner0 and
exact services18560/18561/41960cleaned. Earlier full33981 and interface70333
passes remain recorded below; final release commit adds documentation only.

Primary **e32d37a**, clean, includes staged routef3e0fcf and accepted59 merge
f11d5bc. Conflict resolution preserves the full diary fixture, sanctuary tests,
crystal/artificer runs, movement/reading coverage, detailed prototype history,
Docker cache ordering and all casino scope. One duplicate idempotent QuestUI
class addition from automatic merge removed. Full66813 TERMINALPASS onf11d5bc:
284suites3991tests87.363s+lint. Logs
`/tmp/eidolon-primary-staged-earth-full-{client,lint}.log`. New primary docs explain
stage budgets, integration and accepted59 evidence. Inherited59metadata is not
authorization to publish expanded content as59 or to bypass60's pipeline.

**78199 ACTIVE**, only owned local browser workflow: actual serial prepared
Earth route, run`earth-stages-0910-0032`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-earth-stages-0032.log`. Freeze primary until terminal; preserve
and sanitize artifacts before another run, then check exact wrapper cleanup.
No heavy owned tests or second browser alongside. Each of3stages retains600s;
same actual earned account and saved Seed counts, all150qualifyinghunt kills,
investigations, manual claims and sealed-raid check. Only firststage prepares
levels. Full fresh/class/group pacing and actual dungeon/raid completion remain
separate gates; no claims beyond completed evidence.

## Previous checkpoint — September 10, release60 final local verification

The immediately preceding casino-response turn only reconfirmed existing scope
(NO PROGRESS toward implementation); this continuation revalidated active work
and made PROGRESS. The full roadmap goal stays active; root remains ledger-only
and must NEVER be pushed.

Release59/e236b37 is fully accepted: CI34414624304 and all10jobs were rechecked
SUCCESS, including final native live QA. Fresh public identity and inspected
artifacts are recorded in [release59 live verification](2026-09-10-release59-live-verification.md).
Remote master still matches59; no successor push yet.

Release60 canonical worktree `/tmp/eidolon-safe-zone-release-preview-gCLEaT`,
branch `release/60-sanctuary-combat-feedback`, now clean **2b30320**. Version,
login text, build defaults and patch notes are synchronized. Session33981 is
TERMINALPASS: focused254tests, full253suites3599tests75.35s+lint; server-race all
packages passed (game229.897s). Logs `/tmp/eidolon-release60-full-{client,lint,server}.log`.
Final interface70333 passed6cases15.9s; desktop/phone sanctuary warnings, phone
journal and long-label rendering inspected. Archive
`/tmp/eidolon-release60-interface-proof-0K6GU5`, scanner0/port41961absent.

**88699 ACTIVE**, only owned local browser workflow: final versioned native
sanctuary journey, run`release60-native-0910-final`, API18560/Mongo18561/web41960,
log`/tmp/eidolon-release60-native-final.log`. Candidate frozen until terminal.
No heavy owned tests alongside this browser. Final native proof, exact diff,
canonical normal push and complete CI/live/public60 acceptance still required.

Primary70286 is TERMINALFAILED at600s, not still running. It earned the opening,
diary,40Skeletons,8Seeds,60Imps and scar3/3, then reached19/50DemonOrcs. Four actual
merchant visits passed; screenshot shows active combat. Archive
`/tmp/eidolon-functional-earth-budget-failure-kMxAKx`, sanitation/exact cleanup
complete; no claim of full completion or fresh pacing.

Primary now has an uncommitted three-stage serial refactor preserving the same
earned account, all objectives/manual claims and saved Seed counts. Only stage1
prepares levels; retries replay the whole chain on a fresh disposable account.
The composite actual-dungeon helper retains every prerequisite. Focused42307
PASS5tests0.38s+lint/diff check. Full client and actual staged replay remain due;
see primary `2026-09-10-earth-functional-stage-budgets.md`. No progression/rate
changes or fresh/class/group/physical-phone/raid/casino gate reductions.

## Previous checkpoint — September 10, 00:03 UTC

This turn made PROGRESS: release59 deployed with matching public identity, actual
merchant-sale proof obtained, repeat-visit helper corrected, and standalone
sanctuary fix full client/server regression passed. Full goal stays active; root
ledger-only and NEVER pushed. Previous turn was also PROGRESS, not an impasse.

**59 DEPLOYED, final acceptance PENDING.** Canonicale236b37 remains frozen/clean.
CI34414624304 all client/server/browser/predeploy/input/deployment jobs SUCCESS.
Predeploy passed23:56:45 (41m19s), server23:57:19, Pages23:57:34. **Final live
102690642047 ACTIVE** since23:57:36 in anonymous/persistent-character QA; its other
native stages and fresh post-pass identity verification remain due. Uncached
public release.json/login/runtimekey/backend allmatched59/e236b37 around23:58;
actual release-keyed main.js GET200/19736bytes. Schema9→9 preflight passed and
previous58 rollback image retained; no schema-upgrade backup required. Details in
[release59 live verification](2026-09-10-release59-live-verification.md).
No successor push, and do not call59 fully accepted untilfinal checksfinish.

Primary39733 TERMINAL FAILED6.3m on9d01157 during a later merchant visit. Context
shows level100, InkThatWalks39/60, full2997HP/1974MP, Gold7633, bagvisible/shophidden.
Earlier40hunt/Seeds/manualconsumption progressed intoImp. One actual merchant
visit verified2equips plus3Common sales10+10+80Gold:6841→6941, free3→8,17.366s,
with individual item/Gold and preserved quest/equipment/remaining-bag checks.
This proves that visit, NOT reliability of subsequent visits or fresh pacing.
Archive `/tmp/eidolon-functional-merchant-failure-ZXNcRk`, wrapper sanitized2files,
archive rescan0/exact servicescleaned. No screenshot existed; context retained.

Primary now **419df41**, clean. Merchant approach uses existing move-only/no-jump
input; new visibility helper retains an already-open shop instead of toggling
again, otherwise clicks once and requires shop AND bag visible. Failure still
propagates, with future full-world screenshot/read-only progress evidence. Actual
failed prior toggle sequence is a source-supported hypothesis, not recorded fact.
Focused10870 PASS28/4/0.685+lint; full51243 PASS284suites3989tests96.093s+lint.
Logs `/tmp/eidolon-merchant-repeat-full-{client,lint}.log`; newplan
`2026-09-09-earned-merchant-repeat-visit.md`. No runtime/campaign/economy edits.

Standalone sanctuary preview now clean **43c58ce**, testedcode95e3f28/base63343d2.
Full11025 TERMINALPASS: client253suites3598tests81.541s+lint; Go-race root14.220,
game235.846,database1.116,lifecycle1.032s. Logs
`/tmp/eidolon-safe-release-full-{client,lint,server}.log`. Prior exact native/card
proof retained below. Still no successor version bump or push; accepted59 and
synchronized successor defaults/notes plus release/live gates remain required.

**70286 ACTIVE**, only owned local browser, corrected prepared Earth route on
primary419df41: `merchant-repeat-0910-0002`, API18560/Mongo18561/web41960,
`/tmp/eidolon-earth-merchant-repeat-0002.log`, routechronicle-collection, Node24
inside sg render. Primary frozen untilterminal, preserve/sanitize/exactcleanup
afterward. No heavy ownedtests/second browser alongside. Fullfresh replay after
travel/merchant corrections still due; preserve all class/group/phone/raid/casino
and overallroadmap gates. Continue same70286 and finalCI102690642047 handles.

## Previous checkpoint — September 9, 23:49 UTC

This continuation made PROGRESS: verified earned milestone training, diagnosed
an incidental dialogue blocking travel, corrected the shared travel gesture, and
passed real native sanctuary-card/recovery gameplay. Previous turn was PROGRESS
as well. Full goal remains active; root ledger-only, NEVER push root.

CI34414624304 remains ACTIVE, exact predeploy102681209941 full-character gameplay.
Client/server/allthree browser jobs and predeploy gallery passed; canonical59e236b37
remains frozen. No deployment/final native live/public59 acceptance yet; no new
push. Recovery58 remains the last accepted release. Continue polling exact job.

Primary12121 TERMINAL FAILED14.6m on7fab2eb. Retains the prior successful opening,
diary,40hunt/manual/reconnect and8Seeds/manual/consumption/equipping-only proof.
New actual milestone: level10 earned build branchC/WIZ_01rank2 (2→0talentpoints),
no stat allocation/grants, then resumed combat and reachedlevel11. Failure occurred
in findExpeditionTarget ordinary travel at(-15.17,199.29), full407HP/319MP,9freebag
slots, inside town. GroundInputUnavailableError had0attempts and quest-windowopen.
Viewed screenshot shows daily DemonOrc offer blocking canvas. Exact prior opening
click was not captured; do not claim a recorded click race or full Imp count.
Archive `/tmp/eidolon-story-travel-dialogue-failure-G3M8F7`, original scanner2files
sanitized, archive rescan0; wrapper's exact containers/18560/18561/41960 absent.

Primary **9d01157**, code **bac74f9**, clean. Shared expedition search now uses
existing real Shift-click move-only travel to avoid incidental NPC interactions;
retains authoritative movement/collisions/optional jump fallback and bounds.
Added actual QuestNPC regression, quest counts to read-only failure receipts and
accurate equipping-only bag note (no misleading sale-proof claim). Focused59919
PASS37/5/0.835+lint. Full82812 PASS283suites3984tests101.714s+lint, logs
`/tmp/eidolon-expedition-move-only-full-{client,lint}.log`. New explanation in
`2026-09-09-expedition-travel-dialogue-recovery.md`; integrated functional coverage
document reconciled, no runtime/campaign/economy rule changes.

Standalone sanctuary preview clean **63343d2**, code **95e3f28**, same
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`. Extended existing native recovery
journey with actual hover atx94.985 inside → sameenemy hover atx119.929 outside.
Focused59653 PASS28/4/1.574+lint. Card62768 PASS2/6.5 desktop+phone, bothscreens
viewed; archive `/tmp/eidolon-safe-release-card-proof-N7eOTh`, scanner0/41961absent.
Native25868 PASS1/35.9: correctwarning→InRange, real outgoing damage, incominghit,
FireballMP110→80, RecallHP106→110/MP80→93→110, bank17.624→17.998acrosslogin/aura.
Both whole-world boundaryscreens viewed; archive
`/tmp/eidolon-safe-release-native-proof-py0yzm`, scanner0/exactcleanup. Logs
`/tmp/eidolon-safe-release-card-2343.log`, `/tmp/eidolon-safe-card-native-2344.log`.
Preview still needs full client/server on exactbase, accepted59 prerequisite,
successor version/patchnotes and entire deployment/live gates. NOT published.

**39733 ACTIVE**, only owned local browser: actual prepared functional Earth route
on primary9d01157, `earth-functional-0909-2346`, API18560/Mongo18561/web41960,
`/tmp/eidolon-earth-functional-2346.log`, routechronicle-collection. Diary inspection
logged; full authored hunts/Seeds/manualclaims/reconnect/raidseal still pending.
This level-prepared route is NOT fresh-level balance proof. Primary frozen until
terminal; no heavy owned tests or second local browser. Preserve/sanitize/exact
cleanup only afterterminal. Later rerun full fresh earned readiness and complete
remaining class/group/physical-phone/raid gates. Casino stays later roadmap only.

## Previous checkpoint — September 9, 23:35 UTC

This continuation made PROGRESS through standalone fix preparation and new earned
collection/bag evidence, with VERIFIED WAIT on exact live12121 and34414624304.
Previous user-facing casino turn verified its existing committed roadmap; it did
not implement casino runtime or finish the full goal. Root stays ledger-only and
must NEVER be pushed. Recovered prior root checkpoint commit2bd9805 successfully.

Release59 remains cleane236b37 in its frozen canonical interface worktree.
CI34414624304 all client/server/browser jobs SUCCESS; exact predeploy102681209941
still ACTIVE in disposable full-character gameplay, with its gallery passed.
Deployment, final native live QA and fresh public59 identity still required;
accepted recovery58 remains the last accepted production release. No new push.

Primary7fab2eb remains clean/frozen, **12121 ACTIVE**, same
`story-safe-exit-0909-2322` API18560/Mongo18561/web41960 and log
`/tmp/eidolon-story-safe-exit-2322.log`. The first hunt now passed40/40, manual
1593XP/100gold, completion conversation and reconnect in459s,0deaths13town rests,
reaching level8/xp251/gold1480 with18occupied slots. Actual receipt observer logged
91outgoing hits/3006damage and one incoming hit/8damage, not just cast acceptance.

Collection then passed all8Seeds after18observed target deaths,0player deaths,
manual turn-in and exact8-item consumption before entering the Imp hunt atlevel9,
xp348/gold1814. Do not mistake this partial chain for the final reconnect/dungeon
readiness gate, which is still later. At4free bag slots, the actual bag helper
equipped9already-earned items and reached13free slots in15.896s, preservinggold1676.
Its sales array was EMPTY: no merchant visit/sale is proved despite the helper's
generic "Verified merchant proceeds" note. The actual sale branch remains due.
Observed normal Imp-stage recovery restored HP279/352 and MP108/286 to bothfull
before ordinary departure. Imp completion, earned level10 training, later hunt,
scar/full Earth readiness and class/group balance remain unproven. Keep the only
owned browser running; no heavy owned tests or second browser alongside it.

Prepared a separate unpublished interface-only port in
`/tmp/eidolon-safe-zone-release-preview-gCLEaT`, branch
`work/safe-zone-release-preview-20260909`, clean **1555109**, based on59e236b37.
Only engine/UI sanctuary warning plus direct Go/Jest/card-browser regressions from
primary28057a5 were imported. No expanded campaign/earned helpers, combat/economy
change, version bump or push. Focused60020 PASS12tests/2suites1.451s+lint onNode24.
New local plan `2026-09-09-safe-zone-release-preview.md` includes a draft patch
note and explicit remaining gates. Full client/server, exact browser/native proof,
accepted59 prerequisite, synchronized successor identity/notes and entire release
pipeline remain required. Do not borrow primary acceptance for this candidate.

Next: poll the same12121/34414624304 handles; retain/sanitize actual test artifacts
and perform exact cleanup only after terminal state. Once the browser slot is
free, complete prepared functional Earth actual-play coverage and/or standalone
feedback verification in order; never overlap owned browser runs. Casino remains
plan-only for later1.5/1.8/1.9/1.10 stages. Entire full-roadmap goal remains active.

## Previous checkpoint — September 9, 23:23 UTC

This continuation made PROGRESS: completed first-hunt earned proof, diagnosed
safe-zone collection failure, fixed actual misleading combat feedback, completed
missing functional Earth hunt coverage, and verified integrated client/render
checks. Full objective remains active. Root documentation-only, NEVER pushed.

Release59 e236b37 remains frozen/clean in canonical interface worktree.
CI34414624304 client/server/ALL3browser groups SUCCESS. **Predeploy102681209941
ACTIVE** since23:15:26; High/Low gallery passed, disposable full-character gameplay
running. Actual deployment/final native live/exact public59 identity remain due.
No successor pushed; last fully accepted release remains recovery58/ef9.

Primary47584 TERMINAL FAILED14.1m on0691772. Opening and diary passed as below;
first40hunt/manual1593XP100gold/reconnect passed573s,0deaths15reststops→level8,
14occupiedslots. Collection observed3target deaths and0/8Seeds before timeout.
Failure had11free slots, so NOT the prior full-bag issue. At83.51,296.40 with
server safeZone=lanternhold, character kept casting from inside town. Viewed
failed-collection.png shows hero behind fence and card falsely saying IN RANGE.
Server PvE CombatRelationship is neutral in safety; fence geometry can also block
shots. Archive `/tmp/eidolon-story-safe-zone-combat-failure-2jkvBl`, scanner0 and
exact containers/ports cleaned up. Bag/merchant/collection/Imp readiness still
unproven. Do not recycle this failed result as a successful full-story playthrough.

Primary now clean **7fab2eb** (integrated code51eeaa8), unpublished/inherited58.
28057a5 uses replicated safeZoneId to show LEAVE THE SAFE ZONE for PvE instead of
claiming an in-range attack; preserves duel rules, healing, protection and combat
formulas. Earned opening/collection/hunt loops now leave through normal input and
wait for replicated departure when travel crosses into town, without resetting
the combat watchdog or granting progress. Focused31432 PASS16/3/1.366+lint;
server-race46016 PASS1.800 for observed point/fence/departure/scene/duel/acquisition.
No server production code changes. Document `2026-09-09-safe-zone-combat-feedback.md`.

Functional Earth correction prepared separately in
`/tmp/eidolon-functional-earth-chain-2zZuXD`, branchwork/functional-earth-chain-20260909,
clean644076d; integrated into primary6d9d8de after47584 ended. Dispatches allthree
required hunts from authored BeforeQuestID, checks predecessor/manualclaim, uses
shared ordinary subtype/level target acquisition and conservative bag management.
Original prepared-level/waypoint provenance and600s budget remain; no quest grants
or reduced requirements. Moved unchanged selector into shared module, correcting
one old source-location test assertion. Focused37542 PASS67/4/1.314+lint;
separatefull57496 PASS282/3976/94.532+lint. Actual prepared functional route still
NOTRUN. Primary integration also retains normal sanctuary departure in this loop.

Integrated full37716 PASS283suites3983tests97.767s+lint; logs
`/tmp/eidolon-safe-functional-integrated-{client,lint}.log`. Browser14323 PASS2/6.9s
using real engine/card/controller: desktop+phone warning and restored In Range
after departure. Both screenshots inspected; archive
`/tmp/eidolon-safe-zone-warning-proof-kqqx2s`, scanner0/port41961absent. These are
presentation fixtures, not yet actual gameplay departure proof.

**12121 ACTIVE**, only owned local browser, freshWizard story-only on7fab2eb:
run `story-safe-exit-0909-2322`, API18560/Mongo18561/web41960, Node24 inside
sg render, log `/tmp/eidolon-story-safe-exit-2322.log`. Source frozen until terminal;
preserve artifacts/exactcleanup afterward. No heavy owned tests/second local
browser alongside. Continue exact59 predeploy monitoring and this earned run;
full roadmap/casino/physical-device/group/other prototype gates remain open.

## Previous checkpoint — September 9, 23:04 UTC

This continuation made PROGRESS through new earned opening/diary evidence and a
static coverage finding, and VERIFIED WAIT on exact live47584/CI34414624304.
No primary/candidate changes or successor push. Release59 canonicale236b37 is
clean/frozen. CI server102676618626 and client102676618794 now SUCCESS; browser
groups1/2/3 ACTIVE102678370056/102678370089/102678369971. Full predeploy, deploy,
native live QA and exact production59 identity remain due. Recovery58 is still
the last accepted release; do not claim59 delivery from these intermediate passes.

Primary0691772 **47584 still ACTIVE**, same story-ready-race-0909-2257 services
and `/tmp/eidolon-story-ready-race-2257.log`. Actual opening3kills/manual100XP100gold
and reconnect passed81s,0deaths4retreats→level2. Diary actual inspection/manual
200XP25gold/reconnect passed119s→level3; reading branch="inspected". This proves
that full segment, not reproduction of the prior already-open branch. Current
first40hunt15/40,0deaths7townreststops,259s,level5xp78,gold548,6occupiedbag slots.
Bag/merchant, collection, trained Imp and full Earth readiness remain unproven.
Keep source frozen and one owned browser; no heavy owned tests alongside47584.

New [expanded functional-route audit](2026-09-09-expanded-functional-route-audit.md)
records a concrete later correction: primary `prepareEarthChronicleThroughPlay`
still skips the40Skeleton/60Imp/50DemonOrc hunts required between its old chapters.
Authored insertion graph and shared seven-chapter readiness prefix establish the
missing coverage; this older prepared functional route was NOT run in this turn.
Fix after active primary run ends, preserve actual kills/manualclaims/seed use,
and do not mistake nearest-enemy QA waypoints or level preparation for qualifying
targets/fresh progression. No test/runtime edits made for this audit. Full goal,
casino plan and all previously open prototype/physical-device/group gates remain.

## Previous checkpoint — September 9, 22:57 UTC

This continuation made PROGRESS: corrected two earned-story driver failures,
completed local release59 validation, and normally pushed the accepted58-based
interface successor. The full goal, including the new casino requirement,
remains active. Root is documentation-only and NEVER pushed.

**Alpha1.0.59 PUSHED e236b37c6110f0307985ecb29574bbcdaec7d0f0** from canonical
`/tmp/eidolon-interface-release59-S4ykfn`, branch
`release/59-quest-and-combat-interface`, clean. Push45965 TERMINAL0; remote master
independently matches. **CI34414624304 ACTIVE**, server102676618626 and client
102676618794 in progress. No deployment/live59 claim: all later browser/full
predeploy/deploy/final native live gates and exact public identity checks remain
due. Do not publish a successor or alter this candidate before terminal review.
Previous58 CI34361293407 freshly confirmed ALLTEN SUCCESS; fresh public client/
backend remained58/ef9/ready before59push. Recovery58 remains accepted/live.

59 includes independent daily disclosure/ready-first ordering, archive/focus
preservation, phone reward rows and readable labels; target levels, honest attack
power/configuredMP card and bounded long desktop action labels. Ports9b168be,
4bb3bd1, c854f8e plus only necessary UI dependencies. NO expanded investigations,
new curve/quest requirements/rewards/drop rules/raid art or casino runtime.
Server diff against58 is version defaults only. Casino plan and corrected live
recovery status are now also carried on the canonical release branch. Login,
package, manifest, build/deploy defaults and retained-history patch notes all59.

59 full71211 PASS253/3595/122.349s+lint+prepare; full98362 Go-race PASS root19.679/
game331.636/database1.122/lifecycle1.043. Logs
`/tmp/eidolon-release59-full-{client,lint,server}.log`. Focused97511 PASS128/5,
version40528 PASS234/1. Actual browser97435 PASS6/19.6; inspected screenshots
exposed incomplete collection fixture objective, fixed only fixture/type/copy
and added regression assertion. Final67774 PASS6/19.9+lint. Archive
`/tmp/eidolon-release59-interface-proof-xvxcgY`, scanner0/port41961absent;
desktop/phone cards+journals and1280/1920labels viewed. Original proof retained
`/tmp/eidolon-release59-first-interface-proof-z5L3I1`. These are presentation
fixtures, not earned-world or physical-phone proof. Candidate acceptance record
is `docs/plans/2026-09-09-release59-interface-acceptance.md` in canonical worktree.

Primary now clean **0691772**, codee530999, UNPUBLISHED expanded work. Diary
reading fix1ff8e2a recognizes already-open exact evidence after ordinary combat;
keeps server credit/manualclaim assertions and captures future reading failures.
Full87041 PASS280/3963/115.831s+lint. Replay30264 TERMINAL FAILED2.5m BEFORE diary:
opening was already3/3 but credit arrived during target acquisition; driver used
before=3 and waited120s for impossible fourth credit. Archive
`/tmp/eidolon-story-opening-credit-race-Dfdn0o`, scanner0/exactownedcleanup.
No merchant/diary/readiness pass inferred. Correctede530999 checks credit before
and after target acquisition, leaving manual turn-in intact. Focused45762 PASS
14/2/.711+lint; full94963 PASS281/3972/137.488+lint. Logs
`/tmp/eidolon-opening-credit-race-{focused,lint,full-client,full-lint}.log`.

**47584 ACTIVE**, only owned local browser, freshWizard story-only on0691772:
run `story-ready-race-0909-2257`, API18560/Mongo18561/web41960, Node24 inside
sg render, log `/tmp/eidolon-story-ready-race-2257.log`. Source frozen until
terminal; preserve artifacts/exactcleanup afterward, no heavy owned tests or
second local browser alongside. This is the next actual diary/bag/merchant/
collection/training/Imp/wholeEarth proof, not yet a pass. Other prototypes stay
separate; full roadmap1.1–1.10 acceptance remains open.

## Previous checkpoint — September 9, casino scope addition

User added a fully functional two-floor main-town casino to the existing **1.10
completion** goal, explicitly for later implementation. Updated the canonical
roadmap and added [the casino scope and acceptance plan](2026-09-09-town-casino-roadmap.md).
Stages:1.5 economy/currency boundary,1.8 seated multiplayer/session infrastructure,
1.9 world layout and games,1.10 complete public+VIP release acceptance. Public
uses existing Gold; VIP uses a separate future currency whose identity/economics
remain undefined and require a later design decision. No casino runtime changes,
new currency, version bump or claim of shipped casino content. Root remains
documentation-only and is not pushed. The full goal remains active and expanded.

Previous status-only turn rechecked live58/ef9; it did not advance implementation.
This continuation inspected terminal38966: story run failed at diary approach
after ordinary combat, with quest-journal open, before the bag helper was reached.
Archive `/tmp/eidolon-story-diary-input-failure-gOwlye` contains sanitized context,
HTML report and run log; this failure produced no screenshot. Exact run containers
and ports18560/18561/41960 are absent. No story/merchant readiness pass is claimed.
Primarycf9f2cc now has uncommitted test-only reading-state changes: recognize an
already-visible/open exact diary entry, otherwise close an unrelated journal via
its normal button before approach; keep evidence, server quest count and manual
turn-in assertions. Add failure capture around reading/second approach. Focused
83791 passed15tests/3suites0.59s and lint. Actual browser replay and fullclient are
still due; no successor release has been created or pushed. Work paused for this
requested roadmap addition, not abandoned or treated as complete.

## Previous checkpoint — September 9, 22:29 UTC

This continuation made PROGRESS. Primary merge51704bd fullclient26781 PASSED
277suites3946tests128.14s+lint; fullGo-race90945 PASSED root22.394/game318.255/
database1.097. Logs `/tmp/eidolon-primary-accepted58-full-{client,lint,server}.log`.
No server files changed while later client-only bag tests were prepared. Recovery58
remains accepted/live; fresh22:27 backend58/ef9/ready. No successor publication.

Primary now clean **cf9f2cc** (code9900cd2), still unpublished/inherited58metadata.
New ordinary test-driver bag management addresses observed25/25fullbag: below5
free slots, pauseauto-loot viaSettings, Recall, equip eligibleempty slots, then
sell onlyneeded spareCommon/Uncommon gear viaactual merchant/rightclick to reach8
free slots. Protectquest/material/gem/relic/Rare+/futurelevel/wornitems; insufficient
eligiblegear fails explicitly. Re-resolve IDs aftercompaction, verify eachsalegold,
allunsolditems/equipment/questprogress/level preserved, log actualmerchantproceeds
and visitduration, ordinarydeparture. No game auto-selling/inventory/drop changes.
Runsbetweenencounters before120swatchdog; explicitno-restdiagnostics unchanged.
Allstoryfailure receipts now include bag state even withoutthehuntobserver.
Focused24502 PASS28/4/.945s+lint; full6072 PASS279/3958/102.934s+lint on9900cd2.
Logs `/tmp/eidolon-earned-bag-{final-focused,final-lint,full-client,full-lint}.log`.

**38966 ACTIVE**, only owned local browser, freshstory-only Wizard oncf9f2cc:
run `story-bag-wizard-0909-2228`, API18560/Mongo18561/web41960, Node24 inside
sg render, log `/tmp/eidolon-story-bag-wizard.log`. This is the next actual
merchant/collection/milestone/Imp/wholeEarth proof, not completed yet. Source
frozen until terminal; preserve artifacts and exactcleanup afterward. No heavy
owned test/browser alongside it. Prior11948 failure remains archived/failed.

Separate CI-cost prototype now clean **080e175** (code126877c); full81238 PASSED
278suites3957tests100.895s+lint+prepare:client. Logs
`/tmp/eidolon-browser-cost-final-full-{client,lint}.log` and
`/tmp/eidolon-browser-cost-prepare.log`. Actual107-case discovery/coverage already
passed, but allthree bundled-browser groups, reportretention/rendering/duration
and remoteCI proof remain PENDING. NOTintegrated/pushed; its ancestry predates
accepted58merge, so do not publishas-is or claim measuredspeedup. Aura GPUprototype
also remains separate with party/lifecycle/FPS proof pending. Full1.1–1.10open.

## Previous checkpoint — September 9, 22:17 UTC

58 remains FULLY ACCEPTED/live as recorded below; no successor push. Primary
now clean **51704bd**, actual merge of acceptedef9 ancestry into941ecf6, inherited
58metadata and still UNPUBLISHED expanded-roadmap work. Reviewed7conflicts:
preserve expandedstory/earned checkpoints/crowd controls/one observer wrapper;
preserve phone-stash/stabletap +deployment-image pin/build-context protection;
keep Docker releaseARGs afterdependencies/update inherited58version. Add accepted
native rest/expiry/party stage to timed fullgate, retain focused suffix/allrest
routes.36-stage failure/cleanup harness now covers the added stage. Removed
automatic-merge duplicate policy import and pointerobservation block.
313focused/8suites2.664s+lint+shellsyntax27848PASS. Primary doc
`2026-09-09-accepted-recovery-primary-integration.md` records decisions and scope.

**26781 ACTIVE** fullprimaryclient/lint; **90945 ACTIVE** fullprimaryGo-race,
logs `/tmp/eidolon-primary-accepted58-full-{client,lint,server}.log`. No owned
browser active; don't alter these test sources until terminal. Next ordinary
bag-management correction is still required before story-ready replay: last
fullbagfailure11948 had25/25slots atcollection start and actualseeds onground,
not missingquestdrops. No inventorymanagement fix or Imptraining/fullEarth proof
has been claimed yet.

CIprototype82632 fullFAILED two old VersionPresentation source-literal assertions;
277suites3955tests passed. Preservedfullclientlog. Corrected assertions now prove
runner invocation +exactone nameplate/resource stage in actual plan;29078GREEN
250/4/1.765s+lint. Prototype latestcommit records this; fullrerun, prepareassets,
all3CI-modebrowsergroups and measuredruntime/remoteCI stilldue. NOTintegrated or
pushed; no actualspeedup claim. Rootledger-only. Full1.1–1.10 goal remainsopen.

## Previous checkpoint — September 9, 22:12 UTC

This continuation made PROGRESS. Clock advanced from15:05 to22:07 across a
continuation; rechecked actual terminal state rather than assuming handles lived.
**58 FULLY ACCEPTED** exactef9a638, CI34361293407 alltenSUCCESS, full predeploy
15:12:45, Pages/server15:13:33/55, final live15:28:04. Fresh22:08 manifest/login/
actualruntimeGET20019736bytes/readybackend all58/ef9. Finalnative healing/rest/
naturalexpiry/reentry/persistence/2memberpartyHighLow/phone allPASS; actualbackup
SHA256/gzip/exactoldimage-loadPASS. Full details in acceptance doc. User notified
healing and Well Rested are live. No successor published; root neverpushed.

Primary11948 TERMINAL FAILED14.6m on941ecf6. First40hunt/manualclaim/persistence
passed469s,0deaths14townvisits→level8,25occupiedslots/670unsoldvalue. Collection
then0/8 after42observedtargetdeaths. Viewed failure screenshot: INVENTORY FULL
and actualMemorySeeds onground; this is not evidence of missing quest drops.
Full archive `/tmp/eidolon-story-collection-inventory-failure-OkOJvh`, scan0 and
exactownedcontainers/image/portsabsent. Need ordinary earnedinventory management
before/through long route, not grants/lowerrequirements/discarded player gear.
No corrected training/Imp readiness result yet. Primaryclean941ecf6.

CI-cost prototype separateWT `/tmp/eidolon-browser-cost-partition-rcKAR6`, branch
work/browser-cost-partition-20260909, **2b7ba71**, based941ecf6, NOTintegrated/pushed.
New safe runner splits ordinary files and two independentrenderfamilies across
same3hostedjobs/oneworker, retains eachstage'sreports/status. Actualdiscovery55018
PASS exact107-case union/noomissions/duplicates/emptygroups: layout22/21/21,
entrance4/3/3,effects3/3/2; extras9on1/16on2. No actualspeedup orbrowserproof yet.
Focused15/2/.941s+lint, workflowRED2fail then94828GREEN/commit. **82632 ACTIVE**
fullclient/lint/assetprepare, logs `/tmp/eidolon-browser-cost-{full-client,full-lint,prepare}.log`.
No owned browser active. Prototype doc records all outstanding CI-mode groups,
actualtiming/rendering/fullremote proof. No active/released workflow changed.

Read-only merge-tree primary941ecf6 +accepted58 ef9 identifies7conflicted files
(QA runner,Dockerfile,recovery policy tests,earned/prepared input tests,ranged
defense,openingroute). Worktree stillclean: merge not yet begun. Next integrate
accepted58 ancestry preserving expandedstory/QA and both sets of proved fixes,
resolve and validate before new sourceplaythrough. Full1.1–1.10 remainsopen.

## Previous checkpoint — September 9, 14:59 UTC

This continuation made PROGRESS: completed desktop visual comparison, full
integrated client regression and first actual GPU aura-batching comparison;
started the corrected earned story replay. Previous status turn was a VERIFIED
WAIT on34361293407. Release58 ef9a638 remains frozen and ACTIVE in full predeploy
gameplay; fresh14:58 public client/backend remain57/8af54f2/ready. No successor
push or production mutation. Actual backup/deploy/native live recovery still due.

Primary now clean **941ecf6**, unpublished/inherited57metadata.25041 failed one
stale source assertion requiring the pre218a0b7 distance-only target guard;
479f302 asserts the correct visible-target helper and absence of that guard,
retaining encounter/death/credit checks. Focused29/2/.81s+lint35486PASS.
Integrated full42881 oncb80d65 PASSED276suites3942tests129.103s+lint, logs
`/tmp/eidolon-primary-visual-story-full-{client,lint}.log`;941ecf6 docs-only closure.

Desktop actual-rendered baseline46843 FAILED2/2 as expected: old2505b369 dispatch
produced614.074px-wide labels at1280/1920. Fixed95533 PASS2/7.1s, <=216px/full
accessible identity/min16px/viewport bounds/pointer transparency/lifecycle;
both fixed screenshots and baseline1280 viewed. Archives
`/tmp/eidolon-desktop-action-baseline-proof-7eDYEr` and
`/tmp/eidolon-desktop-action-fixed-proof-dvLaWX`, scans0/portclosed. cb80d65 adds
fixed spec to successor combat-card CI command. Fixture proof, not multiplayer.

Aura separateWT `/tmp/eidolon-rest-aura-batching-k1vBvU` now5fefc38 docs-only,
code59be536 unchanged. GPU7912 PASS1/4.9s, AMD Vulkan1.4.318 RADV RENOIR:
High9/10/10 incremental draws vs37/38/38; Low8 vs20 at0.37/1.8/4.2s. Pixel
difference0 in all six256px comparisons with visible reference signal. Log
`/tmp/eidolon-rest-aura-gpu-comparison.log`, archive
`/tmp/eidolon-rest-aura-gpu-proof-EVNdVm`, scan0/both quality screenshots viewed.
Not integrated/pushed; populated party, steady frame times, lifecycle/native
rested gameplay and physical-phone results remain required. No FPS claim.

**11948 ACTIVE**, only owned local browser, primary941ecf6 fullstory-only Wizard.
Run `story-ready-train-0909-1458`, API18560/Mongo18561/web41960, Node24 inside
sg render, log `/tmp/eidolon-story-ready-training-wizard.log`. Isolated services
ready and fresh level1 baseline entered. Source frozen until terminal; do not
restart for elapsed time. No additional heavy owned test while it is running.
Next poll same11948 and34361293407 handles, preserve terminal artifacts; continue
actual milestone training/Imp/wholeEarth readiness. Full1.1–1.10 goal remains open.

## Previous checkpoint — September 9, 14:50 UTC

Previous ETA turn was a VERIFIED WAIT: exact34361293407 still active, fresh
14:44 public client/backend57/8af54f2/ready. This continuation made PROGRESS.
58 frozenef9a638 still in full predeploy gameplay, all earlier jobs passed.
No production58 claim, successor push, cancellation or production mutation.

Primary20538 TERMINAL FAILED16.0m on218a0b7. Preserved sanitized complete
report/images/log at `/tmp/eidolon-story-milestone-travel-failure-OV9pLT`, scan0,
exact owned containers/image and18560/18561/41960 listeners absent. Viewed
failed-collection.png: level10, Imp2/60, x-183/z211. First40hunt/manualclaim/
persistence passed (607s,0deaths,15town visits);8Seeds/19selected-death observations
manually consumed→level9. Imp segment23 outgoing events/reported775, actual60fire/
5physical hits; these are not netHP-drained totals. Failure is milestone training
calling the nearby-guide helper from the field, without first returning to town.

Primary506ed57 adds ordinary verified Recall before earned guide/training and
behavioral order/failure tests. Also reproduced and fixed duplicate ranged/Fighter
diagnostic counters on repeated same-game installation: reset segment, one wrapper
per game, unchanged forwarded messages. RED3suites; GREEN38/5/1.197s+lint71991.
Logs `/tmp/eidolon-story-milestone-{before,after,lint}.log`. No combat deadline,
death allowance, rewards, stats, requirements or runtime damage changed. Fresh
actual training/fullEarth replay remains required; old failures remain failures.

Combat-card prototypee37bab6 fullclient/lint83764 PASSED275/3935/125.323s,
logs `/tmp/eidolon-combat-preview-full-{client,lint}.log`. Integrated into primary
as4bb3bd1/8dfabd5; doc0527fb7. **25041 ACTIVE** integrated fullclient/lint,
logs `/tmp/eidolon-story-milestone-integrated-{client,lint}.log`. No local browser
active. Primary remains unpublished/inherited57metadata; never publish it before
58 fully accepted and successor packaging/verification. Root remains ledger-only.

Next: complete25041, actual pending desktop long-label baseline/fixed browser proof,
then fresh corrected story-only route.58 full predeploy/paired production backup/
deploy/native public journey+expiry+party/exact public identities still required.
All full roadmap gates remain intact and open.

## Previous checkpoint — September 9, 14:36 UTC

This continuation made PROGRESS through new completedCI timing evidence and
actualfirststoryhunt/manualclaim/persistence proof, while verifying both live
handles.58CI34361293407 exactef9a638 ACTIVE predeploy102506533929; galleryPASS,
full disposablegameplay current. No release mutation/push; lastfreshpublic14:28
57/8af54f2/ready. Remaining58productionbackup/deploy/nativepublicproof unchanged.

Primary218a0b7 **20538 ACTIVE**, sameownedrun/ports/log. Firststoryhunt40/40
completed594s; manual1593XP100gold +persistence verified607s, level6→8,
beforeclaim1287gold→1387,15occupiedslots/490unsoldvendorvalue.0deaths/15ordinary
townrecovery stops, no training milestone yet. Serverdamage observer89outgoing
events/reportedamount2885,2incoming/reported20; retainedFireball samples50–52,
separatefromacceptedcasts. Do notinterpret summedreportedamount as netHPdrained
or an independentkillcount. Viewedreadyquestwindow correctmanualbutton/lore/
rewardcopy; progressimagecopy`/tmp/eidolon-story-acquire-watch-proof-2WniHT`.
Memorycollectionnowactive:3/8seeds after9selected-targetdeathobservations,
no deaths. WholeEarthreadiness/Imp result stillnotproved; no restart.

CIanonymouscostdiagnosis: completedjobs102501457840/814/596 ran29/26/25cases
in11.8m/2.1m/6.9m. Tenentrancevisibilitycasesoccupied550.5s onshard1.
Read-onlypinnedPlaywright1.61.1 discovery75592PASS(no browser): fully-parallel
equalizescounts27/27/26 butkeepsalltenentrancecases onshard1. Thereforeflagalone
isnotan evidencedfix. Newrootplan`2026-09-09-browser-smoke-cost-distribution.md`
recordsprimarylogs/officialdocs, render-familyredistribution proposal, exactcase
union+separateartifact+actualtimingacceptance. NOTimplemented or shippingin58.

Hostread-onlycheck14:33:16logicalCPUs/load35.35/15GBavailableRAM; unrelated
workloadspresent. Noauthorityinferredtochangethem, no claimthiscausedpriorfailures.
No additionalheavyownedtestlaunched; combatcarde37bab6 fullclient/integration
stillpendingafter20538terminal. Rootledgeronly; allbroaderroadmapgates remainopen.

## Previous checkpoint — September 9, 14:28 UTC

Previous goal turn made PROGRESS (earnedroute and combatcard changes). This
continuation is a VERIFIEDWAIT on34361293407 and20538, with new evidence:
58server/client/ALLthreebrowsergroups PASSED; predeployjob102506533929 ACTIVE,
currentHigh/Lowgallery. Frozenreleaseef9a638 unchanged; fresh14:28publicmanifest/
backend57/8af54f2/ready. Stillrequiresfullpredeploygameplay, actualschema8→9paired
backup, deploy, nativepublichealing/rest/expiry/party and exact58identities.

Primary218a0b7 storyreplay20538 ACTIVE, sameownedrun/ports/logbelow, nowpastits
previousfirst-hunt failure:10/40servercredits,0deaths,4normalresource-reststops,
level4/gold492/6occupiedslots/260unsoldvalue at159s huntelapsed. Ordinary town
mana10→159andrestbankgrowth observed. No fullstory/readiness claim or Impresult
yet, no cancellation/restart. Oneownedbrowserstillrunning; noheavyownedtest
concurrency. Combatcarde37bab6 fullclient/integration remains pending; no further
mutations/pushes beyond rootledger checkpoint. Fullroadmap remainsopen.

## Previous checkpoint — September 9, 14:24 UTC

Previous goal turn made PROGRESS: repaired/replayed phone predeploy failures,
passed localfullchecks and pushed58ef9a638. This turn also made PROGRESS:
new earnedbuild/hit evidence, one failedstory replay diagnosed and preserved,
corrected target acquisition, plus verified combat-card presentation prototype.

58 **CI34361293407 ACTIVE**, frozenef9a638: server/client/browser2/3+3/3 PASS,
browser1/3 active. Lastfreshpublic14:05 remains57/8af54f2/ready. Needallremaining
predeploy/pairedproductionbackup/deploy/nativehealing+rest+expiry+party/exactpublic
58proof. No successor publication or primaryprototype included.

Primary `/tmp/eidolon-primary-town-recovery-lAKY3k` now clean **218a0b7**,
UNPUBLISHED/inherited57metadata. bd8a347 added earnedmilestone training and actual
serverdamage receipts, fullclient/lint PASSED275suites3932tests107.303s in79981
chain. Browser79981 FAILED3.8m beforeImp: firstSkeletonhunt0/40/searchdeadline.
Archive `/tmp/eidolon-story-preparation-travel-failure-xuRWfI`, scan0/exactcleanup;
failed-watch imageviewed, finallevel4/HP134/175/MP8/145. Opening3kills26s,
manualclaim35s, diary80s. Log `/tmp/eidolon-story-ready-prepared-wizard.log`.

Important correction: onlineattributes growautomatically inawardExperienceLocked;
Actor.increaseStatrejectsmultiplayer/UIhidespoints. Replaylevel3 recorded0points.
Unused onlineattribute points are NOTthe Imp explanation. Removed speculative
all-point earlypreparation change in218a0b7; no new onlinepointallocationfeature.
Earnedbranch/mastery milestone handoff and actualdamage diagnostics retained.

Source exposedvisible-far-target no-inputloop (search returns samevisiblefoe
instead ofnormalclick/chase).218a0b7 engagesvisiblelivingtargets regardlessbasic
range, seeksmissing/dead/hidden; keeps120screditwatchdog/2deaths/no grants/dailies.
Adds failureattachment forALLstoryfailures (prior search error missedhitdump),
actualdamage source/target/amount/kind separatefromacceptedcasts and100-eventcap.
Focused41/4/.833s+lintPASS, logs`/tmp/eidolon-expedition-acquisition-{before,after,lint}.log`.
**20538 ACTIVE** correctedfullstory-onlyWizard, onlyownedbrowser,
runstory-ready-acquire-0909-1422/API18560/Mongo18561/web41960,
log`/tmp/eidolon-story-ready-acquisition-wizard.log`. No terminalclaim/restart.
Doc`2026-09-09-story-earned-preparation-evidence.md` recordslimitsandhistory.

Separatecombatcard WT`/tmp/eidolon-combat-preview-0F3tMN`, branch
work/combat-preview-20260909, clean **e37bab6** (codefdcccb2), UNPUBLISHED.
Replaces arbitraryclassmultiplier spelldamage withAttackpower(characterstat) and
actualconfiguredMPcost, commonrealcastcalculationincltalent/equipmentdiscounts;
unknowncostdash/free0MP; engine+UIcache refresh. No serverdamagechange.
RED3failures, GREEN26/4/1.971s+lint. Browser93717PASS2/6.6s, archive
`/tmp/eidolon-combat-preview-proof-nHkrnp`, correctedNode24scanner0, bothscreens
viewed (desktop5power/27MP;phonecompactlevel/status). Anonymousfixtureonly,
notrealservercastproof. CIshard2futuretestwired. **Fullclientverification and
integration stillpending**; waitfor20538terminalbeforeownedheavy/browserwork.
Originalmistypedscanner path/Node18invocation failedwithoutchanges; correct
scripts/sanitize-playwright-artifacts.mjs withNode24 thenpassed.

Next: monitor58CI towardactualproductionrecovery; observe20538terminal, preserve
itsresults andcontinueclass/party/curve/dungeonreadiness. Thenfullvalidate+integrate
combatcardprototypewithoutalteringactivebrowsersource. Desktoplonglabelbaseline/
fixedbrowserproof, fullraid/Vigil/rejoin/phases/1.1–1.10 remainopen. Rootneverpush.

## Previous checkpoint — September 9, 14:05 UTC

58 corrective candidate **ef9a638b1478f59df9a8b68021f2fc58f11b2b22 PUSHED**
normally from `/tmp/eidolon-standalone-town-recovery-QJ6Drv`, branch
work/standalone-town-recovery-20260909.10849TERMINAL0; remote master matches.
New **CI34361293407 ACTIVE**; original34355888468failed remains failed.
Fullclient/lint4886PASS253suites/3570tests93.511s on d0a129c; ef9onlyadds
verifiedclosure doc. Runtime/server/metadata/playernotes identicalfb8db754.
Correctedphone36862PASS2/1.5m incl8freshentries, scan0/ownedcleanup, asbelow.
Fresh14:05 publicmanifest/backendremain57/8af54f2/ready.58NOTyetlive.
Requirednext: monitor34361293407 exacthandle through fullCI/predeploy, actual
schema8→9pairedproductionbackup, client/serverdeploy, final native healing/rest/
expiry/party proof, fresh exactef9/58manifest/login/runtimeGET/backendidentities.
Do not restart for elapsed time, do not push successor before58fullacceptance.
No local active test/browser sessions. Primary75e30eb excluded and unchanged;
earnedImpstoryfailure needs preparation/levelgap evidence next; journalcompleted
locallyonly. Full1.1–1.10goal remains open; root ledger-only and neverpushed.

## Previous checkpoint — September 9, 14:04 UTC

This turn made PROGRESS: reproduced58predeploy stash failure in97427 on
51e3f30, entry5/8. Old orientation camera generated stale tap261.41,209.11;
settledportrait chest381.72,289.63. Actualhover/pending/hitstackempty, actor
remainedatspawn. Screenshotviewed; archive
`/tmp/eidolon-rest58-stash-entry-failure-XKKRDY`, scan0/exactcleanup.
Corrected58d0a129c observes rendered/stableprojection before tap, retains30s
actualopen/wholeitem savedtransfer assertions. Fullgate now includes8fresh
orientationentrychecks. Natural gear setup allows32encounters within original
420s instead of unsupported8-kill guarantee (~6.9%none at authored28.4%drop).
No gameplay/server/reward/version/notes diff vs fb8db754. Diagnostics remain.
36862PASS2/1.5m fullbag/storage plus8freshentries, archive
`/tmp/eidolon-rest58-phone-fixed-proof-PsJZGP`, scan0/ownedports+containersclean.
94314lintPASS;4886fullclient/lintACTIVE, log
`/tmp/eidolon-rest58-phone-fix-full-{client,lint}.log`. NO correctionpushyet.
Next finish4886; recordverifiedcode, normalpushcanonical58only; fullCI/predeploy/
productionbackup/deploy/nativehealing+rest+expiry+party/exactpublic58proof due.
Original34355888468failed, public57unchanged; primary75e30ebexcluded. Rootneverpush.

## Previous checkpoint — September 9, 13:56 UTC

Previous status turn made PROGRESS: discovered authoritative58CI failure and
inspected failed predeploy logs, changing the next action from monitor to diagnose.
CI34355888468 failed13:51:52 on phone inventory: no gear after8kills firstattempt;
retry earnedgear/passed portrait+landscape bag actions then stash hidden30s.
Deploy skipped; public57/8af54f2 healthy at13:53. Downloaded original evidence
`/tmp/eidolon-rest58-mobile-failure-Hpj06F`; no CI restart.
Local58 fee85d2 adds read-only diagnostics, NOT runtime changes or pushed.
Owned focused35143 ACTIVE; run rest58-phone-diag-0909-1400 on18560/18561/41960,
log `/tmp/eidolon-rest58-phone-diagnostic.log`. Exact gear rule ~28.4%/ordinarykill
does not guarantee gear in8kills; stash cause unproven. Preserve original failure,
fix evidenced cause, verify focused/fullrequiredgates before publishing correction.
Primary75e30eb/journal/story evidence unchanged and excluded. Root ledger only.

## Previous checkpoint — September 9, 13:49 UTC

This turn made PROGRESS: actual earned story run reached a retained failure that
changes the next investigation, and the journal polish passed rendered/fullclient
verification and was integrated into primary. Goal remains fully open.

58CI **34355888468** ACTIVE exactfb8db754: all client/server/disposablebackup/
threebrowser shards PASSED. Predeploy Character QA now runs its disposable full
gameplay step (gallery already passed). Do not cancel/restart for elapsed time.
Fresh13:48 public manifest/backend still healthy57/8af54f2.58notlive. Still requires
completepredeploy, actual schema8→9 production backup/deploy and final mandatory
native public healing/rest/expiry/party tests plus exactpublic58identity.

Primary story-only Wizard **2268 TERMINAL1/FAILED after17.7m**, not a fullpass.
Same a4ea4cc source: opening/diary/first40hunt and8seed collection manually earned;
collection completed after21selected-target deathobservations/no deaths. Next
InkThatWalks startedlevel9 with11earnedpieces equipped, required60level20+Imps.
Only1credit reached, then unchanged120s kill-credit watchdog failed. Finallevel10,
HP288/365,MP8/265,restBank0,outside; targetImp20hp51,eliteImp hovered,69retreats/
20acceptedFireballs. Exactperhittargets/unspenttrainingpoints were not captured.
Townhealing hadworkedearlier; driver only schedules rest between creditedkills
and only trains at hunt START ifalready≥10. Level9→20authored content gap and
preparation/strategy need coordinated investigation; do NOT claim human combat
impossible or silently change XP/death/deadline rules to erase this result.
Archive **`/tmp/eidolon-story-ready-imp-failure-mptII0`**,scan0, all exactrun
containers/image/ports absent. Failure screenshot viewed. No ownedbrowser remains.
Detailed primarydoc`2026-09-09-earth-ready-imp-failure.md` preserves facts/limits.

Separate confirmed presentation defect exposed by that screenshot: Fireball~8
is from AbilityController.buildSoftDamagePreview's arbitrary1.5×basicdamage table,
NOTserver Fireball's20+2Intelligence/training/effects calculation. Do not use
the hover number as damage/balance evidence. Needs source-backed estimates or
honest cast information, not new arbitrary ratios. No spell-damage change made.

Journal prototype browser1832 PASS2/7.2s, archive
`/tmp/eidolon-journal-daily-proof-uTs1qn`,scan0. Viewed desktopcompact and phone
accepted-first; fixture omittedobjective metadata and showedgenericDefeat1target.
Corrected fixture now imports actualdiary title/acceptance/directions.96559 replay
PASS2/7.4s, archive **`/tmp/eidolon-journal-diary-proof-Of6uSy`**,scan0/port41961clean;
actualcorrecteddesktop diarycapture inspected. NativeEnter toggle,44pxsummary,
viewportbounds,independentlore/dailyfocus,ready-first ordering passed. No earned
quest/progression claim from this controlledUIfixture.
95282fullclient PASS273suites3916tests79.928s+lint onca674c6. Logs
`/tmp/eidolon-journal-daily-{browser,browser-r2,full-client,full-lint}.log`.
CIshard2future`npm run test:e2e:journal` wired. Imported b03e8d4/ca674c6 intoprimary
as c854f8e/f180ccb AFTER2268terminal; source trees matchtestedclient/script/CI.
Primary clean **75e30ebafa115dd89ee9a7fd7add2be39f3ff73d** includesdocclosures.
SeparatejournalWT remainsclean ca674c6, no active handle. No need repeat its
alreadycompleted UI proof; broaderstory/newsource verification remains due.

Next priorities: monitor58deployment to actualnativeproduction recovery; then
record/use an ordinary earned preparation baseline and actualperhitreceipts for
the Imp handoff before coordinatedallclass/party progression decisions. Preserve
the full originalroadmap (remaining raids/DarkKing/art/mobile/balance etc.).
No successor publication before58accepted; root remains ledger-only/neverpush.

## Previous checkpoint — September 9, 13:32 UTC

This continuation made PROGRESS: verified ongoing58CI/story handles, obtained
new earned hunt/collection evidence, and implemented a bounded future journal
presentation fix in a SEPARATE worktree without mutating either frozen candidate.

58CI **34355888468** ACTIVE fb8db754: server/client and browsers2/3,3/3 PASSED;
browser1/3 still ACTIVE. Required predeploy/production backup/deploy/final native
recovery gates remain. No release59/other successor push and no live58 claim.

Primary **2268 remains ACTIVE**, sameclean a4ea4cc/source/ports/runid below,
only owned browser. First authored40killhunt completed manually: fromlevel3 to
level8 after1593XP/100gold claim,0deaths,16ordinarytownstops,566s. Final preclaim
gold1541/18occupiedslots/1120unsoldvendorvalue; vendorvalue is NOT received income.
Collection now6/8seeds after17selected-target death observations (not a separate
count of every eligible/AoE kill or a statistical drop-rate estimate). Whole
seven-chapter readiness remains UNKNOWN. Do not cancel/restart for elapsed time.

New separate branchwork/journal-daily-context-20260909, WT
`/tmp/eidolon-journal-daily-context-PYTpq7`, clean **b03e8d4**:
QuestUI replaces the unconditional reward-sorted ladder with native Daily contracts
disclosure. Ready claims/accepted work sort ahead of unaccepted offers. No
unsupported fastest-XP advice, false level locks or reward/eligibility changes.
Defaultclosed beside currentstory when noaccepted daily, preservesuser open/focus
acrossrefresh,44px summary,existingmobile16px/fullstackedrewardrows. Explicit lore
archive selector prevents daily disclosure from corrupting lore open/focus state.
Three initial regressions failed; final53tests/2suites/.924s+lint PASS. Logs
`/tmp/eidolon-journal-daily-context-{before,after,lint,final-focused,final-lint}.log`.
New2viewport actualQuestUI/DOM/CSS browserfixture DISCOVERED but NOT EXECUTED;
`tests/e2e/journal-daily-presentation.spec.js`. It must wait for owned2268terminal.
Still requires actual rendered desktop/phone acceptance, fullclient regression
and eventualCI wiring/integration. No acceptance/publish claim; planned notes in
`docs/plans/2026-09-09-journal-daily-context.md`. This is not a replacement for
the still-required broader economy/level suitability and environmental art work.

## Previous checkpoint — September 9, 13:23 UTC

Previous goal turn made PROGRESS: recovered/accepted57 and pushed58. This turn
verified live58 CI handles and began the required actual story-only readiness
route, obtaining new earned opening/diary/hunt evidence. Full objective remains
unchanged; no successor publication or production recovery claim.

58CI **34355888468** ACTIVE exactfb8db754: client and server jobs PASSED;
allthreebrowser smoke shards ACTIVE. Still needs predeploy, actual schema8→9
production backup, deploy and mandatory native public recovery/expiry/party checks.
Canonical58 is clean/frozen. Last accepted public release remains57/8af54f2.

**2268 ACTIVE**, the only owned local browser, on frozen/clean primary
**a4ea4ccea2adbf1e1a4d756e1b453566b47bc96a**. Exact isolated project suffix
`story-ready-w-0909-1319`, API18560/Mongo18561/web41960, Node24 inside `sg render`.
Invocation `EIDOLON_ISOLATED_QA_ROUTE=fresh-story-ready`,
`EIDOLON_E2E_FRESH_CLASS=Wizard`, log
`/tmp/eidolon-story-ready-wizard-0909-1319.log`. Do not cancel/restart merely for
elapsed time; poll2268 through terminal and preserve/sanitize artifacts before
another browser. No heavy local fullclient/server work while this browser owns
the candidate. External CI is separate. Do not modify primary source mid-route.

Route verified by inspection: fresh ordinary registration, no grant helpers,
seven manually completed pre-dungeon chapters, all150 authored hunt kills,
collection/investigations and normal town recovery. Explicit policy rejects
daily/comparison/prepared shortcuts. Final requires living earned level≥30,
accepted uncleared Earth dungeon count0, Normal30 entry enabled and raid sealed.
The1h test limit is not approval of pacing. Rogue/Fighter/Cleric and realparty
readiness remain separately required. Never conceal a shortfall with daily XP.

Observed so far: opening3kills118s/no deaths/24retreats, manual reward100XP/100gold,
saved/rejoined level2 at126s; diary manually completed at171s→level3,200XP/25gold.
First40killhunt underway:5credited/40 at93s, level4/no deaths,2townstops.
Actual depletedMP10→town28→159/159, saved rest bank grew while safe; ordinary
return to combat, not a prepared resource grant. Full route outcome UNKNOWN.

Viewed actual diary approach and recovered-lore journal snapshots. Reading text
is legible and manual turn-in remains explicit. Progress-only copies retained
at `/tmp/eidolon-story-ready-progress-GEWgC6`; full terminal archive still due.
Visual follow-ups within existing polish scope: keeper-house art remains sparse
(low cutaway walls/book table without much environmental storytelling); journal
shows highest-value endgame dailies to this level2 player under a claimed
“fastest XP” ladder. SourceQuestUI sorts reward totals, not measured time/level
suitability. This is an observed guidance/presentation issue, not a proven quest
eligibility defect or permission to alter58 economy. Keep it for later UI polish.

## Previous checkpoint — September 9, 13:15 UTC

57 is now FULLY ACCEPTED:34347504351 all10 jobs SUCCESS after failed-job-only
retry. Final live QA8tests4.5m, allfourclass routes and actual remote-animation
passed, evidence scan sanitized2. Actual production backup receipt/integrity and
normal image-archive loading verified below. Fresh13:14:37 public manifest/login/
actualrelease-keyed main.jsGET20019736bytes/backend all57/8af54f2/database ready.
Original attempt1 remains failed; no test/backup/production gate was bypassed.

58 **fb8db75412adaf38bf13ce2e0304bdd16c951bea PUSHED** with normal fast-forward
from canonical `/tmp/eidolon-standalone-town-recovery-QJ6Drv`; exact19119
TERMINAL0 and independent remote masterfb8db754. Root was NOT pushed.
CI **34355888468** is QUEUED/starting for exactfb8db754. No claim it has passed
or that town recovery is live. Watch all client/server/disposable-context+backup/
browser/predeploy gates, actual production schema8→9 recovery receipt/deploy,
final live native healing/rest/expiry/party QA, then fresh public58 identities.
Do not publish a successor before all these finish. Source is clean/frozen;
latest full local regression94121 PASS and full accepted game-runtime all-route
19624 PASS on e73be3a (fb8db754 changes deployment only), as recorded below.

No local browser or full regression remains active. Primary a4ea4cc is clean,
unpublished, and must later merge accepted58 ancestry without overwriting its
expanded QA/story helpers. Pending major work still includes actual earned
fresh-story-ready allclasses, investigations/reward pacing, fullgroup Vigils/
transport/rejoin and Dark King fourphase encounter, desktop action-width rendered
comparison, wider visuals/mobile/roadmap milestones. Recovery remains priority.

## Previous checkpoint — September 9, 13:13 UTC

58 full regression94121 is TERMINAL0/PASS on unchanged cleanfb8db754:
253client suites3570tests78.957s, lint, fresh fullGo-race root12.522s/
game230.497s/database1.090s. All prior source/readiness restrictions still apply.
57 final live job102475487008 remains ACTIVE, not failed/timed out/cancelled.
Fresh HTML has57 login label and exact8af54f2 release-keyed main.js.

The actual57 production backup's `previous-api.tar.gz` was also loaded with the
normal unfiltered Docker load command, successfully restoring exact8754f0b8.
Archive metadata was checked first: no repository tags to overwrite. Current
57 container/image and backend health stayed unchanged. This validates image
archive usability, not permission to restore historical player data.

Primary doc-only closure **a4ea4cc** records its117fffe full Maelin regression.
No additional story runtime/visual changes and no owned local browser.

## Previous checkpoint — September 9, 13:08 UTC

This continuation made PROGRESS: diagnosed and recovered57's actual production
backup failure without bypassing backup/migration gates or replacing player data,
then added/tested58's prevention fix. Previous goal turn yielded the terminal
failure and changed the next action; it was evidence-producing progress.

57CI34347504351 attempt1 passed all tests/predeploy but failed server deployment
12:50:58: replacing the shared build tag made old image8754f0b8 unresolvable in
Docker's containerd image store. Backup's trap restarted the exact old container.
Public client was57/8af54f2 while healthy backend remained56/31c7d9f. No acceptance.

Read-only BuildKit historytb7d6phk6ub40cq5ojdqgn0xp retained the exact original
production56 index/config/runtime layers. All retrieved bytes were verified
against their original SHA256/length. An optional attestation payload was missing;
two initial reconstruction/load attempts failed safely. Including attestation
manifest metadata and explicitly loading linux/amd64 restored EXACT8754f0b8 and
runtime manifest89e88940. No container/data replacement. Normal image-save then
succeeded. Retained `eidolon-api:rollback-31c7d9fc-20260909` tag prevents re-loss.
Archive `/tmp/eidolon-exact-image-VoQmYX/previous-exact-image.tar`, operational
script `/tmp/eidolon-image-recovery-tools-GB6y7J/recover.mjs`. A separate diagnostic
old-source rebuild differed in identity and was NOT substituted for the original.

Only FAILED jobs of34347504351 were rerun, unchanged57/8af54f2. Serverdeploy job
102475331106 PASSED. Actual production recovery receipt
`/home/aeml/eidolon/server/backups/save-upgrade-20260909T130106Z-boTz4I/COMPLETE`
names8af54f2/13:01:08UTC and prior8754f0b8. Independently rechecked all four SHA256
and all three gzip archives, all PASS. Public manifest/backend now57/8af54f2.
Final liveQA job102475487008 remains ACTIVE: release-identity and anonymous/
persistent-character steps PASS; four-class/remote-animation still running.

58 clean/frozen **fb8db75412adaf38bf13ce2e0304bdd16c951bea**, canonical
`/tmp/eidolon-standalone-town-recovery-QJ6Drv`, supplements accepted e73be3a ONLY
with pre-build exact-image retention, private-backup Docker-context exclusion,
deployment tests/CI wiring/docs and one patch-note bullet. No game/client runtime,
schema, quest, reward, aura or recovery policy changes. Before build under the
existing lock, pin old digest to an immutable-name rollback tag; fail closed on
missing/invalid/multiple identity, collision or tag failure without downtime.
Original preflight regression RED3; focused race PASS1.253s. Actual owned build
tag-replacement + backup/restore PASS15.20s; actual Docker COPY proves private
backups/logs/.env excluded PASS1.21s, combined17.433s. Logs
`/tmp/eidolon-deploy-image-pin-{focused,disposable,disposable-r2}.log`.
94121 ACTIVE Node24 fullclient→lint→fullGo-race on frozenfb8db75; logs
`/tmp/eidolon-rest58-image-pin-full-{client,lint,server}.log`. No owned browser.
Do not push58 until57 full live acceptance and new58 source checks finish.

Primary **117fffe** full28798 now TERMINAL0/PASS:273client suites3912tests87.23s,
lint, full fresh Go-race root18.393s/game224.339s/database1.086s. Logs
`/tmp/eidolon-primary-maelin-final-{client,lint,server}.log`. This covers latest
dedicated Maelin model/Channel dispatch/server-facing. Still not actual full
earned group Vigil/transport or Dark King encounter acceptance. Larger roadmap
remains open/unpublished. Root remains LEDGER ONLY; never push it.

## Previous checkpoint — September 9, 12:48 UTC

This continuation made PROGRESS: implemented dedicated Maelin art and fixed the
reproduced serverCHANNELING→clientIdle presentation defect, then verified actual
rendered behavior in hardware and CI-mode browsers.58remains unchanged/accepted.

Primary clean/frozen **117fffe1bdd399431e210db097c25ed49533d4c0** carries c60d374
dedicated CrystalKeeper model/recipe, role-specific remote resting-animation hook,
server-owned facing toward the crystal, and Idle/Channel animation loops. The
model reuses the adult NPC rig/caches but adds tailored workwear, open face/braided
hair/goggles, toolkit, four vials and tuning fork; not player Wizard/quest giver/
angel summon. Existing town actors and true Spirit Guardians remain unchanged.
08923bbadds actual late-mesh-load regression. New test:e2e:crystal-art is included
in this later candidate's anonymous CI shard2. No import or publication into58.

Red `/tmp/eidolon-maelin-channel-before.log` reproduced absent mesh/channel;
72187focused35/3/1.02+lint passed;1819serverrace5.024s passed including real NPC
spawn/facing and snapshot/resume.77351hardware browser PASS10/30.3s onc60d374,
archive `/tmp/eidolon-maelin-artificer-proof-hbZO36`,scan0. Inspected desktop and
portrait Highchannel plus desktopLowreturnIdle model comparisons.67581late-mesh
unit initially failed on its absent 2DcanvasmeasureText; only that unit's name-tag
paint endpoint was stubbed (real labels covered in browser), not mesh/mixer/state.
Finalfocused36/3/0.955+lint passed.33566CI-mode bundledChromium PASS10/52.0s,
retries0, archive `/tmp/eidolon-maelin-ci-proof-vMum07`,scan0/port41961clean.
Logs `/tmp/eidolon-maelin-{artificer-browser,artificer-ci-browser,channel-after,
channel-complete-focused-r2,channel-complete-lint-r2,facing-server}.log`.
Detailed evidence/pending player patch notes in candidate
`docs/plans/2026-09-09-maelin-channel-and-model.md`.

**28798full primary regression ACTIVE** on117fffe: Node24fullclient thenlint then
freshfullGo-race. Logs `/tmp/eidolon-primary-maelin-final-{client,lint,server}.log`.
No owned browser remains; do not modify primary during this compound run or
restart it because a poll is quiet. Prior full47504passed onaa4f0f1but predates
the latest model/hook/server-facing change. Full group combat/rejoin transport,
earned31chapter progression/class/party balancing, broader mobile/interior/polish
acceptance remain incomplete; neither gallery fixtures nor fullunit pass replace
those gates. Next free earned browser priority remains fresh-story-ready after
urgent recovery delivery needs are satisfied.

57CI34347504351 remains ACTIVE in predeploy characterQA (started12:09:17), all
precedingserver/client/backup-restore/browserjobs passed. No cancellations or new
deployment. Must finish57production backup/deploy/final liveQA/exactpublicidentity
before normally publishing accepted58e73be3a. Root is ledger-only, never push it.

## Earlier checkpoint — September 9, 12:33 UTC

Final update: **47504 TERMINAL0/PASS** on aa4f0f1. Fullclient273/3909/83.194 plus
lint, then fresh fullGo-race: root19.472s/internal-game243.181s/database1.295s.
All three logs retained at `/tmp/eidolon-primary-crystal-full-{client,lint,server}.log`.
Primary source freeze is lifted; no owned browser or local regression remains.
This closes full local regression for the ready-unclaimed Vigil fix, crystal
snapshot contract, visual consumer and lighting/glare work, not live/group/story
acceptance. Maelin channel gap is the next reproduced presentation defect.
57CI remains active predeploy;58still waits, no push/live claim.

This continuation made PROGRESS by accepting the completed full-client component
and reproducing Maelin's missing ritual animation through an actual remote actor
tick.47504 remains ACTIVE on unchanged primaryaa4f0f1: fullclient273suites/3909tests/
83.194s plus lint PASSED; freshfullGo race is running. Root server package passed
19.472s/database1.295s; internal/game is not yet terminal. Same logs as below.
Do not edit the candidate or start an owned browser beside this heavy regression.

Read-only Node24 probe constructed the real CrystalKeeper, set isRemote=true,
called updateState("CHANNELING") then actual update(1/60), observing only the
animation-dispatch endpoint. Result: stateCHANNELING requestedAnimations["Idle"].
Log `/tmp/eidolon-maelin-channel-source-probe.log`. This is an actual remote tick,
not a rendered channel-pose acceptance. Source Actor.js remote animation fallback
has no CHANNELING case, and current Maelin still uses the Wizard mesh. Next staged
art task should give the dedicated actor a real Channel loop and bespoke clothed
artificer model, retain server-owned state/no quest marker/no summon lifecycle,
and test entry mid-ritual, completion, mesh-load timing and pool reset. Preserve
other actors' state/animation behavior and true Spirit Guardians.

57CI34347504351 is still ACTIVE in predeploy character QA; all preceding jobs
passed. No elapsed-time restart/cancellation. Read-only git check-ignore verifies
server/backups/ and server/logs/ are ignored; existing git clean -fd does not use
-x, so those private recovery paths are preserved. This is source-level safeguard
inspection, not the still-due production backup receipt.58accepted e73be3a remains
clean/unpublished; no new production recovery claim or primary import.

## Earlier checkpoint — September 9, 12:28 UTC

This continuation made PROGRESS: the entire standalone58 all-route passed and
was archived/cleaned, and later-story crystal visuals received actual GPU proof
and a screenshot-driven glare correction. The full roadmap remains active.

**58 COMPLETE LOCAL ALL-ROUTE PASS**:19624 TERMINAL0 on unchanged clean
**e73be3acb195dbd87c20108fc1619f9457c4c5df**. Archive
`/tmp/eidolon-rest58-full-proof-veHaDo`, log
`/tmp/eidolon-rest58-all-node24-rerun-1149.log`. Wrapper credential scan0; exact
r13API/Mongo/image/network and18560/18561/41960ports verified absent after normal
cleanup. No cancellation or test bypass. Seven dungeon cases5.5m, all spell/phone/
fresh-story/resource/movement checks, four duels1.8m, all class matrices, actual
multiplayer1.8m, town nameplates3/19.9s and native recovery/expiry2/1.1m plus actual
rested party1/12.4s passed. The strict fresh hostile-interception evidence branch
was observed in the Cleric matrix, which completed54.6s; no claim that the original
dungeon failure timing was reproduced. Real fresh combat reducedHP110→108 and
acceptedFireballMP110→80; Recall/town restoredboth110, reconnect preservedbank.
Natural expiry removed110maxima/stat/aura to100, and reentry earned them again.
PartyHigh19/Low10parts. Inspected retained native town screenshot: golden rings,
no enclosing white cube. All original interrupted/failed runs remain failed.

**57 CI34347504351 still ACTIVE**,8af54f2: server/client/backup-restore and all
three browser shards PASSED; predeploy character QA ACTIVE.57production backup
receipt, deployment, final live QA and exact public identities still required
before58publication.58 login/patch notes and mandatory native postdeploy recovery
gate independently rechecked. NO58push yet; town recovery is NOT production.

**Primary clean/frozen aa4f0f1d3fe4caffe40dd4bbc9f40da70840edd3** now includes
3587363four elemental reliquaries plus exact-instance snapshot consumer and raid
lighting aliases; d81c9c7screenshot-driven decorative glare correction; aa4docs.
84focusedtests/6suites/3.025+lint passed; initial actual raid lighting failed all
five alias cases before correction. First8browserPASS22.5s on3587363, archive
`/tmp/eidolon-crystal-visual-first-proof-EfFXcC`. All eight restored screens viewed;
old generic boss spirit ring overwhelmed Maelin. Replaced onlycrystal_vigil's
decorative ring with thin metal inlay, preserved objective/clear markers and
ordinary boss dressing, lowered crystal emission to preserve facets. Final
42focused/3/1.625+lint; **64594corrected8browserPASS22.3s** ond81c9c7; archive
`/tmp/eidolon-crystal-visual-glare-proof-FVvi7I`,scan0/port41961clean. Inspected
corrected Earth/Air restored, Fire fractured, Water phoneLowrepairing. Actual GPU
visibility/HighLow/state fixtures, not earned group or transport-rejoin proof.
Docs `2026-09-09-crystal-sanctum-presentation.md` in candidate contain evidence,
pending patch notes and open bespokeMaelin/floor-pattern/full-architecture gates.

**47504 primary full regression ACTIVE** on clean aa4f0f1, Node24: fullclient then
lint then freshfullGo-race; logs `/tmp/eidolon-primary-crystal-full-{client,lint,server}.log`.
Server has not started unless preceding client/lint succeeded; poll exact47504.
No owned local browser remains; CI's separate browser is expected. Preserve
primary source until this compound run terminates. No import into58 or primary
publication authorization from its inherited1.0.57metadata. Root remains ledger-only.

## Earlier checkpoint — September 9, 12:05 UTC

Previous user-status turn was a VERIFIED WAIT on exact live19624 and
CI34347504351, with fresh public56 manifest/backend evidence. This continuation
made PROGRESS on the later story's missing crystal-state contract while preserving
the only owned recovery browser. No cancellation, new local browser or root push.

57CI34347504351 remains ACTIVE on8af54f2: server/client, disposable backup/restore
and browser shards2/3 and3/3 PASSED; shard1/3 still ACTIVE. Production backup,
predeploy/full deployment/final live QA and exact public57 identities remain due.
58full19624 is ACTIVE on clean/frozene73be3a, log
`/tmp/eidolon-rest58-all-node24-rerun-1149.log`, same18560/18561/41960ports. Seven
dungeon cases passed5.5m, later ability/phone checks passed, ordinary fresh Wizard
collection ongoing with real mana recovery/rest banking in Lanternhold. This is
partial local evidence, NOT full regression or production recovery. Public56
was freshly confirmed this turn; user ETA remains14:00–17:00UTC conditional on
all remaining gates. Do not publish58 before57's entire acceptance completes.

Primary clean **13a55fddc8f45263951675192edf7e125ff7f0ef** adds server-owned crystal
identity/position/stage/wave/progress to the existing room-state wire contract.
No save-schema/client visual/quest reward change. Shared restart/readiness helper
keeps exact completed defenses distinct from manual Ilyra turn-in. All four initial
raid identities, live three-wave worker, every-member readiness and reconstructed
ready/claimed raid snapshots tested. Red98986 reproduced absent wire state;
15817racePASS4.192,26468expandedracePASS7.332,68366actual entry serializerPASS1.564.
Logs `/tmp/eidolon-crystal-snapshot-{before,after,expanded,protocol}.log`.
Detailed candidate doc `docs/plans/2026-09-09-crystal-sanctum-snapshot.md`.
The worker test explicitly clears its spawned enemies as a server fixture, not
earned group combat. Full server/client regression, actual reconnect/update
transport, authored crystals/sanctums/bespoke Maelin and rendered group progression
remain open. NO import into58. Avoid heavy regression beside19624; full primary
Go remains due for both prior ed95214 and this13a55fd contract.

## Earlier checkpoint — September 9, 11:52 UTC

This turn made PROGRESS:56completed all CI/live gates,57was normally published,
the seven-case recovery replay passed, and final-ancestry full58regression began.
Whole roadmap remains active; town recovery is not yet live.

**56 COMPLETE**,31c7d9fc3bedce839b2f83b4146060ddaa5875aa, CI34340328283 all ten
SUCCESS; final11:42:39. Fresh11:44 manifest, login label, release-keyedmain.js
(HTTP200/19736bytes) and healthy database-ready server exactly matched56/31c7d9f;
manifest/backend rechecked11:48. Total74m54s, predeploy43m43s, final live11m20s.

**57 PUSHED**, clean **8af54f2744fa206abba0e49f76fee50b9c8f6363** from canonical
`/tmp/eidolon-resource-persistence-c6E17J`.72892normalpushTERMINAL0; remoteHEAD
independently matched8af54f2. **CI34347504351 ACTIVE**, clientalreadypassed/server
running. Final57carries tested frame/pointer/navigation QA plus fresh-hover
prerequisite51c9bf7; onlytests/scripts/docs differ from prior1f8c7be, no runtime,
schema or version changes.20254clean fullclientPASS244suites/3461tests/69.222+lint:
`/tmp/eidolon-release57-final-pointer-full-{client,lint}-r2.log`.
Initial43179failed because the shell continued into tests after a cherry-pick
conflict; its log is retained without a pass claim at
`/tmp/eidolon-release57-final-pointer-full-client.log`. Conflicts resolved before
20254; subsequent mutation/test command sequences use fail-fast guards.

**70313 completed PASS** on cbb158c:253/3570/80.203+lint, all7dungeon cases6.3m,
Verdant4.3m with actual RootboundWarden/BriarMatron deaths. Archive
`/tmp/eidolon-rest58-dungeon-input-proof-eu9B5K`, scan0/exact cleanup. No interception
or no-input diagnostic fired here; unit regressions, not this run, exercise those
branches. Prior failures remain failed.58docclosure9ea7213 records scope.

Final57merged into58 as clean/frozen **e73be3acb195dbd87c20108fc1619f9457c4c5df**.
Resolved duplicate QA/doc conflicts preserving58's loot observer and latest
closure. Tree119453175a0a3235b37dadfb9ecdcf1d6d9d249a matches9ea7213 EXACTLY;
no source changes from the accepted replay except the already-recorded doc.
**19624 fullall ACTIVE**, only owned local browser, runrest58-all24-r13-0909-1149,
API18560/Mongo18561/web41960, Node24.18.0, log
`/tmp/eidolon-rest58-all-node24-rerun-1149.log`. Do not edit/restart over19624.
58must await fullall plus57's complete CI/deploy/backup receipt/final live and
fresh public identities before publishing. New-schema backup remains mandatory.

Primary QA carried as3aa13fb/ed16753/6d38ad7/ce7160d, preserving its existing
ranged defense/crowd-control, force-ground option, intent diagnostics and Jest
mocks when resolving conflicts. Currentclean **ce7160d**, idle.49546focused
PASS50tests/7suites/.921+lint, logs
`/tmp/eidolon-primary-pointer-carried-{focused,lint}.log`. Fullprimaryserver
regression for crystal-ready resume and fullintegratedclient remain due; no
Maelin/story/curve/visual work was imported into58. No other local test is active.

## Previous checkpoint — September 9, 11:39 UTC

Previous turn made PROGRESS on strict pointer evidence. This turn retained a
new exact-batch failure, corrected its no-input navigation caller and completed
full client regression. Whole roadmap and recovery production gate stay open.

**56 reached production**: predeploy completed11:30:10, server deploy11:30:46,
Pages also completed and **Live Release and Character QA remains ACTIVE** in
four-class/remote-animation checks. Fresh11:31 public manifest and healthy backend
both31c7d9f/Alpha1.0.56. Final whole-CI success plus fresh exact login/runtime/
manifest/server proof still required before normally pushing57/1f8c7be. Do not
treat the current live56identity as completion of its final acceptance gate.

**33035 exact dungeon replay TERMINAL1/FAILED**,6passed/1failed5.2m. Both previous
portal/wall cases passed. Verdant cleared RootboundWarden and later enemies, then
found no exposed ground for navigation: attempts[], no click, initialMOVING and
laterIDLE roughly10units away, pendingnull. This is GroundInputUnavailableError,
not the original unproven clicked-retreat failure. Archive
`/tmp/eidolon-rest58-pointer-replay-failure-7QbgHX`; sanitized2files/exact cleanup.

58nowclean/frozen **cbb158c3927b17c80c703cbaeba48a926502cfb8** adds navigation
caller policy only: unavailable/intercepted ground rereads the world on its
existing loop, without a successful-step claim, new retries, extended deadline,
jump or direct movement. Other errors still throw.5347focusedPASS38/.665+lint.
**70313 composite ACTIVE**: full client already PASSED253suites/3570tests/80.203s
plus lint on cbb158c/Node24.18.0; now only owned browser runs exact seven-case
dungeon-inputs replay. Runrest58-nav-0909-1136/API18560/Mongo18561/web41960;
log `/tmp/eidolon-rest58-dungeon-navigation-replay.log`. Six cases passed so far;
Verdant still running. Client logs
`/tmp/eidolon-rest58-navigation-full-{client,lint}.log`, focused logs
`/tmp/eidolon-rest58-navigation-input-{focused,lint}.log`.
Do not edit/restart over70313. Preserve exact terminal evidence, then completeall
remains required. No57/58push or town-recovery-live claim.

Primary staysclean/idleed95214 with full server regression due. Carry8b9073b,
b5abc2a,cbb158c QA changes there after accepted replay evidence; these are not
currently in primary. Maelin, crystal-ready resume, visible restoration, earned
story/party pacing and other roadmap requirements remain distinct later work.

## Previous checkpoint — September 9, 11:27 UTC

Previous turn made PROGRESS on crystal-ready resume. This turn preserved a new
terminal recovery failure and corrected QA's distinction between a prior hover
and an actual fresh click. Full roadmap/recovery delivery remain open.

**2466 fullall TERMINAL1/FAILED** onc5e3204: first seven-test dungeon batch3failed/
4passed5.8m. Two portal clicks selected InfernoTitan; the actual fresh stack and
pending target agree, with zero portal requests. The prior hover was not a promise
of an unchanged click target. Verdant retreat had zero displacement/BriarMatron
pending, but lacks click-time evidence; its original cause remains unproven.
Archive `/tmp/eidolon-rest58-verdant-r12-failure-P1ap9x` retains log/HTML/test-results;
wrapper sanitized2files, exact r12API/Mongo/image/network/ports absent afterterminal.
No later all-route tests ran. Original failed run is not retrospectively passed.

58 **8b9073b** adds a strict observer/classifier: successful desktop canvas click,
same active hostileID first in fresh stack/selected/pending. Missing/mixed/ignored
or keyboard movement remains a hard failure. All-click interception is a distinct
error, never successful movement or no-input; combat caller keeps deadlines/death
bounds. Portal interception must issue zero requests; reacquisition uses the same
three-attempt bound and final actual menu/entry remains mandatory. No runtime,
raycast priority, grants, movement clock, retries or frame thresholds changed.
68828focusedPASS30/.686+lint;99520expandedPASS39/.736+lint.
**34455 fullclient/lint PASS252suites/3564tests/87.123s** on8b9073b/Node24.18.0.
Logs `/tmp/eidolon-rest58-pointer-evidence-{focused,expanded,lint,expanded-lint}.log`
and `/tmp/eidolon-rest58-pointer-full-{client,lint}.log`.

Current58clean/frozen **b5abc2a89f6172eea2b2efed1f3232b96a543f52** adds documented
optional dungeon-inputs route: exact seven-test batch from all, not a replacement
for complete acceptance. **33035 replay ACTIVE**, only owned local browser,
runrest58-pointer-0909-1126/API18560/Mongo18561/web41960, log
`/tmp/eidolon-rest58-dungeon-pointer-replay.log`. Finish/archive exact outcome,
then require completeall. Do not edit/restart over active33035.
56CI34340328283 stillpredeploy;57clean1f8c7be/unpublished. Primaryed95214 remains
clean/idle with full server regression due and these pointer QA changes not yet
carried; carry after replay evidence. Root remains ledger-only and must not push.

## Previous checkpoint — September 9, 11:13 UTC

Previous goal turn made PROGRESS on Maelin and preserved/replayed the Cleric
frame failure. This turn made PROGRESS on the later crystal-repair resume gate.
Full roadmap remains open; no new production claim or successor publication.

Primary clean **ed95214a6249d108b2135cb28d78c9c6ee28c83b** preserves an already
defended, ready/unclaimed crystal objective across a restored raid entry.
Original readiness recognized only claimed chapters and restarted completed
defenses before Ilyra's manual turn-in.55030 reproduced all four realms after
new-world dungeon snapshot restoration and JSON quest roundtrip.73457 focused
racePASS3.814s;87252 expanded racePASS4.948s adds five-member all-defended,
one-unfinished and one-missing cases. Accepted exact REPAIR target/positive count
required; incomplete/missing members still restart; rewards/next chapter/portal
still depend on manual turn-in. Logs
`/tmp/eidolon-crystal-ready-resume-{before,after,party}.log`.
Detailed scope in primary `docs/plans/2026-09-09-crystal-vigil-ready-resume.md`.
**Full server regression remains due**; avoid heavy local regression alongside
the remaining recovery browser acceptance. No causal host-load diagnosis claimed.
No client/schema/58 changes. Actual saved group/raid and visible crystal work
remain open, as do the pending Maelin/desktop-label rendered comparisons.

**2466 full58all remains ACTIVE**, frozen c5e3204, only owned browser, unchanged
r12run/ports/1107log below. Current Verdant route has reached RootboundWarden;
no full pass yet.56CI34340328283 is still in predeploy gameplay.57 stays clean
1f8c7be/unpublished. Only2466 and external56CI are active; primary is idle.

## Previous checkpoint — September 9, 11:05 UTC

11:08 follow-up:95652 TERMINAL0/PASS, complete Cleric matrix1.0m. Added evidence
records25frames, hardware AMD RADV, continuous MOVING and Spirit Guardians cast;
all later assertions passed. Original10-frame failure's cause remains unproven.
Archive `/tmp/eidolon-rest58-cleric-frame-proof-8ORFWQ`, scan0/exact cleanup.
58nowclean/frozen **c5e32047e34c1fcb548c5ef0952a4a731c52e6ba** (diagnostic plus
closure doc; no runtime change). **2466 fullall ACTIVE**, only owned local browser,
runrest58-all24-r12-0909-1107/API18560/Mongo18561/web41960, Node24.18.0, log
`/tmp/eidolon-rest58-all-node24-rerun-1107.log`. No reduced/replaced gate.56 remains
predeploy;57 remains unpublished1f8c7be. Primary0379fe3 is clean/idle, no other
local tests active. Do not edit the recovery candidate until2466 is terminal.

Previous turn was a VERIFIED WAIT on exact56CI and58browser handles. This turn
made PROGRESS on an independently reproduced Maelin model mismatch and retained
a newly terminal58 failure. The whole roadmap remains active and incomplete.

**49970 full58 gameplay TERMINAL1/FAILED** on028f23b. Earlier dungeon, resources,
phone, fresh collection, movement, all four duels and Fighter/Rogue/Wizard class
matrices passed. Cleric stopped12.6s into its matrix: moving-cast sample collected
10frames in650ms versus the unchanged requirement>10. Subsequent movement
assertions, remaining Cleric abilities and multiplayer/nameplate/native-rest
suffix did NOT run. This is not a complete gameplay pass or proof of its cause.
Archive `/tmp/eidolon-rest58-cleric-frame-failure-02mQPZ` contains original log,
test-results and HTML. Wrapper credential scan0; exact r11API/Mongo/image/network
and18560/18561/41960listeners absent after terminal cleanup. No cancellation.

58nowclean/frozen **e5d7bd434c3411bf7be96de255e760baff12e1f0** adds diagnostic JSON
frame timings/positions/renderer before the original assertion. No threshold,
sample duration, retry or game/runtime change. **95652 Cleric-only replay ACTIVE**,
runrest58-cleric-0909-1105/API18560/Mongo18561/web41960, routeanimations with
EIDOLON_ANIMATION_QA_CLASS=Cleric, Node24.18.0. Log
`/tmp/eidolon-rest58-cleric-frame-diagnostic.log`; lint passed at
`/tmp/eidolon-rest58-moving-cast-diagnostic-lint.log`. This is the only owned local
browser. Finish/preserve exact evidence before another run; fullall pass remains
required regardless of focused outcome.56CI34340328283 stillpredeploy; no57push.

Later primary **f3bbe43** fixes actual NPC/CrystalKeeper routing from AvengingSeraph
to a dedicated CrystalKeeper using the existing clothed Wizard rig, preserving
radius1.5 and server ownership without quest-marker/summon lifecycle inheritance.
True summons unchanged.91969red proved factory mismatch;29362PASS54tests/4suites/
2.727+lint. **63743 fullclientPASS270suites/3857tests/155.615+lint**. Logs
`/tmp/eidolon-maelin-model-{before,after,lint}.log` and
`/tmp/eidolon-primary-maelin-full-{client,lint}.log`.
Primary nowclean **0379fe3**, including diagnostic833b175 and documentation closure.
Actual rendered NPC comparison remains due; no server/58/live change. Source
review also found the visible crystal-restoration gate still open: active repair
messages drive callouts/Maelin state, not a durable authored crystal visual.
Required authoritative rejoin/restoration contract and bespoke art are recorded
in primary `docs/plans/2026-09-09-maelin-model-and-crystal-visuals.md`; the mage-rig
correction does not substitute for that full story/raid requirement.

## Previous checkpoint — September 9, 10:50 UTC

Previous user-status turn was a VERIFIED WAIT: exact CI34340328283 and local
browser49970 were polled live. This continuation rechecked both handles; neither
is terminal. No cancellation, restart, candidate edits or successor push.

56CI34340328283 now has successful server/client and all three browser shards;
predeploy character QA is active in its High/Low animation gallery. Complete
deployment and final live QA remain due. Fresh10:47 public manifest and healthy
backend still identify55/c5ce9dc, not town recovery.

58all-route49970 remains active on clean028f23b, same1028log/run/ports below.
Its ordinary fresh Wizard opening/collection passed4.7m with actual town HP/MP
refills and earned rest; subsequent talent/Seraph checks are underway. This is
partial gameplay evidence, not full-route or production acceptance.

Read-only deployment review reconfirmed schema-upgrade backup completion before
new-writer startup and58's mandatory native recovery/expiry/party live wrapper.
57 remains clean1f8c7be and unpublished;58 remains unpublished. The conditional
production estimate given to the user is September9 14:00–17:00UTC, contingent
on remaining gates, not a promise or permission to skip predecessor acceptance.
The broader roadmap remains active; next browser work retains recovery priority.

## Previous checkpoint — September 9, 10:42 UTC

Previous continuation completed final58client evidence and verified its active
gameplay/CI waits. This turn made PROGRESS on later visual polish without changing
the frozen recovery build: long desktop action labels now reuse the existing
bounded identity/action card. Full roadmap remains active and incomplete.

Primary **9b168be** changes only action-label dispatch plus regressions/visual QA.
The retained actual duel image showed a long QA name/action stretching across
combatants. Names in that fixture are unusually long, not evidence of universal
clutter. Labels>32UTF-16 units now use the existing192px/1.12-pop compact card;
complete source stays in DOM/accessibility text, visible source ellipsizes, local
long feedback omits redundant source row. Short desktop labels, phones, Seraphs,
numeric damage, event throttles/expiry, networking and gameplay remain unchanged.

47586 behavioral baseline FAILED four new dispatch cases,68 existing checks
passed.9427 corrected plus32/33boundary cases PASSED74tests/2suites/1.275s and
lint. Logs `/tmp/eidolon-desktop-long-action-{before,after,lint}.log`.
Prepared actual-component browser comparison at1280×720/1920×1080, with optional
exact2505b3baseline dispatch and bounds/screenshot attachments before assertions.
49710 lint/discovery PASSED2cases. **Browser baseline/fixed comparison NOT RUN**;
these fixtures do not establish live PvP/party/device quality.

**42844 primary full client/lint TERMINAL0/PASS** on9b168be:
269suites/3855tests/84.206s, Node24.18.0. Logs
`/tmp/eidolon-primary-desktop-action-full-{client,lint}.log`.
Primary now has a documentation-only closure commit and is clean/idle; refer to
its HEAD and `docs/plans/2026-09-09-desktop-action-width.md`. This change is NOT in
58 or live; inherited1.0.57metadata is not publication permission.

**49970 complete58 gameplay remains ACTIVE**, frozen028f23b, only owned local
browser, same run/ports/log below. Dungeon and spell batches passed; phone combat,
party and inventory flows are progressing. Do not restart/edit on elapsed time.
56CI34340328283 server/client passed; browser2 passed and1/3still running. No57
push until complete56CI/deploy/finalLiveQA and fresh exact public identities.
57 stays1f8c7be and58 stays028f23b. Town recovery is not live yet. Next free
browser work must retain recovery acceptance first, then the pending ordinary
earned-story readiness and scoped visual comparisons; no goal scope is closed.

## Previous checkpoint — September 9, 10:29 UTC

10:34 follow-up: **93957 TERMINAL0/PASS**, final frozen028f23b client251suites/
3539tests/117.45s plus lint. Logs
`/tmp/eidolon-rest58-final-scenery-full-{client,lint}.log`.
**49970 remains ACTIVE** on that same source; initial auth and beam/ground checks
passed, current Verdant route has reached actual RootboundWarden combat.
56CI34340328283 client passed, server still active. No successor push or live58
claim. Primary2505b3 remains clean/idle. Rechecked the next `fresh-story-ready`
route: all seven pre-Earth chapters, no accepted dailies/grants, actual earned
level30, accepted uncleared dungeon and sealed raid are required; the existing
one-hour route budget is not proof that the new progression fits or is balanced.
It remains unrun and must wait for recovery's owned browser invocation to finish.

This goal turn made PROGRESS: completed the recovery-tail rehearsal, reproduced
and fixed the56scenery-clock failure, passed its real CI-mode browser replay and
full client regression, pushed corrected56, carried final ancestry, and started
the complete58 rerun. Whole roadmap/recovery production acceptance remain open.

**69623 recovery tail TERMINAL0/PASS** on5cc8849. Four duels1.9m, four class
animation matrices, multiplayer2.2m, three town nameplates23.8s, native recovery/
expiry2tests1.2m, phone-party1test24.5s (test22.8s). High19/Low10meshes per actual
party member; joystick and readable status checks passed. Original82037 full run
remains FAILED; this suffix does not replace it. Credential scan0 and exact
runrest58-tail-0909-1012API/Mongo/image/network/ports absent after terminal cleanup.
Archive **`/tmp/eidolon-rest58-corrected-tail-proof-J7LHvs`**, full log
`/tmp/eidolon-rest58-corrected-tail.log`. Standalone73515cb records closure and
fixes a documentation typo only; no runtime change from that evidence source.

**24706 corrected56 full client/lint TERMINAL0** on56cfc79:
240suites/3413tests/116.552s. **64638 actual bundled Chromium CI-mode browser
TERMINAL0/PASS1/47.3s**: original MoltenCore/High/1280×720 test, unchanged15second
predicate and zero retries. Same0→74/76hero pixels, outside changes0, unchanged
camera/bounds, all original materials restored. Owned process confirmed bundled
chromium_headless_shell-1228. Viewed before/revealed captures: actual Wizard
reappears through a localized dither window; no final-device performance claim.
Archive **`/tmp/eidolon-release56-scenery-clock-proof-mdne4o`** (current test-results
and logs, not a stale prior HTML report). Log
`/tmp/eidolon-release56-scenery-browser-ci-r2.log`. Port41956 free after terminal.
Earlier5147 CLI invocation selected no tests due an over-anchored grep, exited1;
corrected CLI first discovered exactly one case. Not a browser failure/pass.

Corrected56 **31c7d9fc3bedce839b2f83b4146060ddaa5875aa PUSHED**, normal fast-forward
77408 TERMINAL0; remote master independently matches. Before push,55CI34328735856
rechecked TERMINAL SUCCESS and fresh10:27:14 public manifest/login/runtime/server
all exactly matched55/c5ce9dc, statusok/databaseready. New **CI34340328283 ACTIVE**,
server/client running. Original56CI34337271486 remains failed; no deployment was
made by that run. Wait for complete corrected56CI/deploy/live and fresh matching
public identities before pushing57. Root remains ledger-only/unpushed.

Clean final56 ancestry/runtime/notes merge through:

- 57 `/tmp/eidolon-resource-persistence-c6E17J`: **1f8c7be21bc8a2699c69417347abd51e2ff513dd**;
- 58 `/tmp/eidolon-standalone-town-recovery-QJ6Drv`: **028f23b737210d4db0e467429e376bbc8f4dda77**;
- primary `/tmp/eidolon-primary-town-recovery-lAKY3k`: **2505b36918ab0e2cc4b0dc788efd3c65ae27bb62**.

Each merge changed only the shared visual clock, its tests/notes and evidence
document; no server/gameplay/persistence changes and versions retained.
**58087/61861 focused final57/primary PASSED246tests/2suites1.333s/1.624s plus lint**;
logs `/tmp/eidolon-{release57,primary}-final-scenery-{focused,lint}.log`.

**49970 complete58 all-route ACTIVE**, frozen028f23b, only owned local browser.
Runrest58-all24-r11-0909-1028, ports18560/18561/41960, log
`/tmp/eidolon-rest58-all-node24-rerun-1028.log`. **93957 full client/lint ACTIVE**,
same frozen source, Node24.18.0,
`/tmp/eidolon-rest58-final-scenery-full-{client,lint}.log`.
Do not edit/restart while active; preserve failure evidence and exact cleanup.
Primary is clean/idle with expanded-story earned readiness still due. Separate
raid fixes/campaign labels remain out of58. Production recovery is NOT yet live.

## Previous checkpoint — September 9, 10:23 UTC

Previous turn made PROGRESS (diagnosed/corrected duel mana expectations). This
turn made PROGRESS: corrected58 full client passed, its tail progressed through
all duels/class matrices/multiplayer/nameplates, and failed56CI exposed a real
visual clock issue which was reproduced and corrected. Production recovery and
the full roadmap remain incomplete, with concrete work active.

**56CI34337271486 TERMINAL FAILURE**, browser shard1 failed; server/client and
browser2/3 passed. Predeploy/deployment/live jobs SKIPPED. No deployment occurred;
last verified live remains55/c5ce9dc. DO NOT push57 through this failed release.
`gh --log` returned empty files, so retained artifact10098975954 was downloaded
to **`/tmp/eidolon-release56-browser-failure-inyorR`** and its embedded report JSON
and actual trace inspected. One initial guessed job-ID lookup returned404; the
correct failed job102421053977 was subsequently resolved from authoritative job
metadata. No missing/empty-log result was treated as proof of cause.

Both MoltenCore/High/1280×720 attempts failed the unchanged material-restoration
predicate after15seconds,107.130s/105.982s total. Attempt0 trace proves hero
reveal74/76pixels, outside-cutaway changed pixels0, camera/bounds unchanged.
Focus clear ended305902.292ms, restore polls311161.482false/316449.956false/
321670.666true: restoration happened too late, not a permanent material leak.
Individual JS evaluations cost roughly3.4s. Visual SceneryVisibility elapsed
time was capped at0.1 PER RENDER, stretching a roughly0.67s fade over slow frames.

Canonical56 WT switched to **release/56-scenery-wall-clock** from clean9f41111.
19058 four slow-frame0.25/0.5/1/2s unit cases all FAILED on old code; original ten
passed. Fix uses nonnegative actual elapsed time in the exponential visual fade;
no physics/combat clock, collider, shader, threshold, retry or timeout change.
Added player-facing "Scenery settles promptly" note to still-unreleased1.0.56.
**8952 focused PASSED245tests/2suites/1.349s plus lint**. Logs
`/tmp/eidolon-release56-scenery-wall-clock-{before,after,lint}.log`.
Current clean/frozen **56cfc79a18cf8074a5e1876639316076eba269ca**;
**24706 full client/lint ACTIVE**, Node24,
`/tmp/eidolon-release56-scenery-full-{client,lint}.log`.
Next available browser must replay MoltenCore/High in bundled Chromium CI-mode
without additional retries/timeouts, before corrected56 push and a fresh CI.

Recovery **98816 full client/lint TERMINAL0** on frozen5cc8849:
251suites/3535tests/157.667s plus lint. Logs
`/tmp/eidolon-rest58-duel-corrected-full-{client,lint}.log`.
**69623 tail remains ACTIVE**, same source/run/ports/log below and only owned
local browser. Four actual duels passed1.9m with current-max mana, full scene
return/forfeit and no ranked/economic rewards. Fighter53.3s/Rogue1.1m/Wizard56.2s/
Cleric57.4s animation matrices passed, followed by multiplayer and three actual
town nameplate/NPC checks23.8s. Native rest suffix currently active; expiry35.3s
passed14.323→0bank/110→100maxima/aura off, then normal town recovery restored them.
Not a terminal tail pass or full all-route pass. Original82037 remains failed.

Next: finish/archive/clean69623, replay56 correction, complete24706, then normal
corrected56push with fresh55public identity checks. Carry its final ancestry/
scenery fix/notes through57–58 and primary after active tests are terminal; do
not lose their versions or unrelated campaign work. Complete58 all-route rerun
is still required. Primary23a4df2 idle; earned Earth readiness remains due.

## Previous checkpoint — September 9, 10:13 UTC

Previous goal turn made PROGRESS (integrated raid fixes and campaign labels).
This turn made PROGRESS: primary full client/server finished successfully;
recovery's full gameplay failed a stale mana assertion, which was independently
reproduced/diagnosed and corrected. Full roadmap and production recovery stay open.

**82037 full58 TERMINAL1/FAILED** on1fd0d35. Earlier dungeon, phone, resources,
collection and movement batches passed, including the actual31.68speed/2-update
movement boundary. Then all four normal practice-duel cases failed: expected
town mana110, observed arena100. These four tests were PvP cadence, NOT the class
animation matrix; the subsequent animation/multiplayer/nameplate/rest suffix did
not execute. Earlier commentary describing animations underway was premature.
Full log `/tmp/eidolon-rest58-all-node24-rerun-0935.log`; archived report/results
at **`/tmp/eidolon-rest58-duel-mana-failure-BMUpaP`**. Scan0 and exact API/Mongo/
image/network cleanup and free18560/18561/41960 verified after terminal failure.
No production or user data was removed; diagnostic evidence retained.

Diagnostic-only standalone **f3b944f** captures maxima/rest clocks before the
unchanged assertion. **16108 TERMINAL1**, all four reproduced: every side showed
mana110/max110 with2.28–6.60s bank before, then mana100/max100/bank0 during combat.
This establishes intended expiry/clamping, not a basic-attack mana cost. Log
`/tmp/eidolon-rest58-duel-diagnostic.log`; archive
**`/tmp/eidolon-rest58-duel-expiry-proof-SeqVF5`**. Scan0/exact cleanup verified.
Viewed original fighter arena-combat image: actual fight and100/100 mana visible;
85FPS snapshot is not sustained performance or final visual sign-off.

Primary2079ac4 imports diagnostics; **23a4df2** fixes the assertion to require full
mana before combat, current max100/110 matching level-one rested state, and full
current mana during the duel. All attack-count/interval/hit/scene/forfeit/rating/
economy checks remain; no runtime/time/retry change.98009 lint/discovery PASS,
four real tests discovered. Standalone cherry-pick is **d96ab83**.

Standalone **4c2654e** adds optional `recovery-tail`, the exact final five steps of
the unchanged full route (PvP, all class animations, multiplayer, nameplates,
native rest/expiry/party). It is diagnostic preparation, NOT full acceptance.
**58502 harness PASSED18tests/4suites/0.889s**, lint/shell syntax passed;
`/tmp/eidolon-rest58-duel-tail-{harness,lint}.log`. Evidence doc5cc8849; current
clean/frozen **5cc8849**. **69623 corrected tail ACTIVE**, only owned local browser,
runrest58-tail-0909-1012, ports18560/18561/41960,
`/tmp/eidolon-rest58-corrected-tail.log`.
**98816 full client/lint ACTIVE** underNode24.18.0,
`/tmp/eidolon-rest58-duel-corrected-full-{client,lint}.log`. Do not edit until both
terminal; archive/sanitize/verify exact cleanup before any successor browser.
Complete all-route repeat remains due even if this focused suffix succeeds.

Primary full checks on **8b863b7** both PASSED:
**81309 client269suites/3845tests/122.093s plus lint**;
**12028 Go1.24.5race root22.474s/game354.017s**, other tested packages cached.
Logs `/tmp/eidolon-primary-raid-integrated-full-{client,lint,server}.log`.
Primary is now clean/idle23a4df2 (subsequent changes are duel QA only). Expanded
Earth earned readiness remains unrun and cannot displace urgent recovery closure.
56CI34337271486 server/client and browser2/3 passed; browser1 still active.
57 remains clean6babef5/unpublished; no successor push until complete56livegate.

## Previous checkpoint — September 9, 10:03 UTC

The previous goal turn made PROGRESS (verified55, pushed56, fixed explosive kill
deadlock). This turn also made PROGRESS: final57 client regression and separate
complete explosion race finished successfully; integrated the raid fixes into
the primary campaign candidate and corrected misleading campaign callout labels.
The full roadmap and production recovery remain open, not blocked or complete.

**59024 canonical57 full client/lint TERMINAL0**, clean6babef5:241suites/
3420tests/115.32s, Node24.18.0. Logs
`/tmp/eidolon-release57-final-queue-full-{client,lint}.log`.57 remains unpublished
and must wait for all56CI/deployment/live gates and fresh public identities.
56CI34337271486 server/client passed; browser shards are running (shard2 passed).

**51326 separate explosion full Go1.24.5race TERMINAL0** on ce6780e:root24.632s,
game354.984s; database/lifecycle/loadtest cached passes, remaining packages no
tests. Log `/tmp/eidolon-dark-king-explosion-full-race.log`. Separate worktree
now clean d3e2120 after documenting this result. No actual browser raid/phase
pacing proof or production publication is inferred.

Primary516a4cf corrects story callouts that described already-applied Eidolon aid
as "Incoming in8s"/Boss Telegraph, marked phase4 as victory before the kill, and
labeled Neris/Aeral dialogue as Dark King. Added explicit phase/element and aid
labels, live Vigil wave/restored-crystal return-to-Ilyra metadata, and confirmed
manual turn-in metadata; normal threat countdowns/timers remain unchanged.
78695 initial regression failed6/73; three were valid original semantics failures,
three were incomplete new fixtures lacking player identity.25966 after code fix
still failed those three fixtures; corrected80664 PASSED73/2/1.22s plus lint.
Logs `/tmp/eidolon-campaign-callout-labels-{before,after,fixed-fixture,lint}.log`.
No rendered phone/group-readability claim: secondary metadata is already hidden
by the existing phone layout; full visual acceptance remains open.

Primary then cleanly cherry-picked ca662fd/a5405fa/ce6780e/d3e2120 as6995bb1/
e6af6c4/dd888dc/**8b863b7**. This preserves eec5db9's manual Vigil hint and all
expanded Chronicle/balance work. **81309 full client/lint ACTIVE**, Node24,
`/tmp/eidolon-primary-raid-integrated-full-{client,lint}.log`;
**12028 full Go1.24.5race ACTIVE**,
`/tmp/eidolon-primary-raid-integrated-full-server.log`. Freeze primary8b863b7
until both terminal. Inherited1.0.57metadata is NOT permission to publish; choose
the later coordinated version/notes only after urgent58 delivery and its gates.

**82037 recovery58 full gameplay remains ACTIVE**, frozen1fd0d35, same exact
run/ports/log. Fresh Wizard collection and subsequent Seraph/shield/phone quest
and build cases passed so far; remaining gameplay still running. This is the
only owned local browser invocation. Do not restart/edit on elapsed time or
launch another.58 excludes all the new raid/callout work and is NOT live.
Next free browser priority remains recovery closure, then ordinary earned
primary story-only Earth readiness; prepared raid fixtures and aura batching
cannot substitute for those proofs.14:00–17:00UTC recovery ETA stays conditional.

## Previous checkpoint — September 9, 09:54 UTC

09:56 follow-up:56CI34337271486 client PASSED, server ACTIVE. Recovery82037
remains active in fresh Wizard collection, with repeated actual town mana
refills/rest-bank growth and resumed fighting; no complete-run claim.
Canonical57 already includes exact56 ancestry: clean/frozen
**6babef5fd131da38fd9a0b0360bc6cdee863dfee**. **59024 final merged full-client/lint
ACTIVE** under Node24.18.0, logs
`/tmp/eidolon-release57-final-queue-full-{client,lint}.log`. No57browser or push.
Its schema8 deployment preflight/consistent backup/unsupported downgrade guards
were reread; no production data change made. Separate51326 full server race
still ACTIVE on ce6780e; do not edit that worktree until terminal. Next: finish
these exact invocations, preserve any failure evidence, and advance57 only after
complete56 release/live acceptance. Recovery58 remains the delivery priority.

The preceding status turn was a VERIFIED WAIT:34328735856 was live, as was the
owned recovery gameplay process. This turn made PROGRESS:55 passed its complete
live gate, fresh public identity was independently verified, and canonical56 was
normally pushed. Separate actual combat tests exposed and corrected an explosion
deadlock; the full roadmap remains active and town recovery is not live yet.

**55CI34328735856 TERMINAL SUCCESS**, all ten jobs. Final live QA finished09:52:34
(15m50s); first job08:22:20→completion **90m14s**. At09:53:39 fresh no-cache public
manifest, login label, release-keyed main.js and backend health all matched
**c5ce9dc25a9554da55ef1e823e0d63ff04b6676d / Alpha1.0.55**, database ready.

**56/9f41111133b4a9aaafa4d4c9a1674ec443a4652c PUSHED**, normal fast-forward from
canonical `/tmp/eidolon-schema-compatibility-bridge-ehsEZY` only, after confirming
clean state, exact predecessor ancestry and remote55. Push81380 TERMINAL0;
independent remote master matches. New **CI34337271486 ACTIVE**. No57push until
all56CI/deployment/live checks and fresh public identities pass. Root stays
ledger-only and was not pushed. Prepush79982 full client PASSED240suites/
3409tests/173.072s plus lint; logs
`/tmp/eidolon-release56-final-queue-full-{client,lint}.log`.

**82037 complete recovery58 gameplay remains ACTIVE**, frozen1fd0d35, same
run/ports/log as below. Dungeon, ability, phone combat/inventory/stash and earned
equipment recovery batches have passed so far; ordinary fresh Wizard collection
is underway. Partial successes are not a full-run pass or live recovery claim.

Separate Dark King candidate **ce6780e** fixes a newly reproduced explosive-gear
deadlock. Actual impact tests15137 hung because handleDeath held its corpse mutex
then the explosion loop locked that same corpse before checking identity.
SIGQUIT to verified owned test PID2209338 captured the exact self-lock stack;
original run TERMINAL1/102.930s, log
`/tmp/eidolon-dark-king-actual-damage-paths.log`. This was focused lock diagnosis,
not cancellation of a recovery/CI/soak job. The fix finishes each death before
propagating without ancestor corpse locks, restoring the caller's lock afterward.

Three actual reflection/shield/gear impact tests passed2.014s. Expanded **19725
focused race PASSED25.608s**, five tests repeated20times, adding a three-death
chain, exact single explosions, instance isolation, and eight simultaneous
killing attempts. Logs `...actual-damage-paths-after.log` and
`/tmp/eidolon-dark-king-explosion-chain-race.log`. New **51326 full Go1.24.5 race
ACTIVE**, clean/frozen ce6780e, log
`/tmp/eidolon-dark-king-explosion-full-race.log`; root package passed24.632s,
game still running. This separate work is NOT in58 or production, and server
fixtures do not prove real-group raid pacing/presentation.

## Previous checkpoint — September 9, 09:39 UTC

This turn made PROGRESS:55 deployed and fresh public identities matched; a
terminated owned recovery probe was preserved/cleaned and restarted unchanged;
the separate Dark King full race passed, and misleading Vigil turn-in copy was
reproduced/corrected. The full roadmap and town recovery live gate remain open.

**1035 TERMINAL143**, not a gameplay pass: recovery r9 stopped during the dungeon
batch after several passing beam/wall/input cases. Its signal sender is unknown.
The wrapper/Playwright processes were absent; orphan web PID2091538 and its parent
serve shells remained, together with the exact r9API/Mongo. Using `sg render`,
verified PID cwd, inherited exact run ID, WS18560 and scan credentials without
printing them; credential scan0. Partial artifacts/log archived at
**`/tmp/eidolon-rest58-interrupted-r9-S6GCe7`**. The isolated API/Mongo reported
no OOM, and accessible kernel logs did not establish a cause. Repository search
found no broad pkill/killall command explaining it. No unrelated host/network
workload was modified and no attribution is claimed.

Only verified orphan2091538 receivedTERM; its parent shells exited. Exact
rest58-all24-r9-0909-0928API/Mongo were stopped and removed with their temporary
data, and that run's tagged image removed. Cleanup29138 TERMINAL0; process family,
containers/image and18560/18561/41960absence independently confirmed. Evidence is
retained; no production data removed. **82037 complete58 unchanged repeat ACTIVE**,
clean/frozen **1fd0d35683d973e99dc01c7fadbcbfe9f47e1202**, only owned local browser,
runrest58-all24-r10-0909-0935 (actual start09:34), same ports, log
`/tmp/eidolon-rest58-all-node24-rerun-0935.log`. No ignored signals, extra retries,
test removal or candidate edit. Current dungeon batch is actively progressing.

**55CI34328735856** predeploy PASSED09:35:51 (50m58s); Pages/server deployments
PASSED09:36:42/09:36:27 (42s/28s). **FinalLiveQA ACTIVE since09:36:44**. Independent
public manifest/login/runtime URL/serverhealth at09:38 all match
**c5ce9dc25a9554da55ef1e823e0d63ff04b6676d / Alpha1.0.55**, database ready.55 is
deployed, but its complete live gate is not yet finished. DO NOT push56 until
terminal55success and another fresh exact public check.

Canonical56 clean **9f41111133b4a9aaafa4d4c9a1674ec443a4652c**, verified exact55
ancestry and package/login/notes/server/deployment1.0.56 with schema7. **79982 full
client/lint ACTIVE**, Node24, logs
`/tmp/eidolon-release56-final-queue-full-{client,lint}.log`. No56push yet.

Separate Dark King **28054 full race TERMINAL0**, clean **a5405fa**;
game390.582s, other packages passed/cached. Log
`/tmp/eidolon-dark-king-phase-integrity-full-race-r2.log`. The prior four contact
fixture failures remain retained, not retrospectively relabeled. Actual
player-controlled burst/reflection/explosion/party and presentation gates remain
open; this is NOT included in58 or a published campaign milestone.

Primary **eec5db9** corrects the Vigil event hint: it said the next realm chapter
had begun even though server progression correctly awaited manual Ilyra turn-in.
Behavioral baseline46708 FAILED that exact hint after correcting an initial
wrong test field name. **82464 focused Go1.24.5race PASSED1.946s**; logs
`/tmp/eidolon-vigil-manual-copy-{before,after}.log`. The existing regression still
requires ready/not-completed state, no pre-turn-in XP/gold, successful manual
completion, and an offered/not-auto-accepted next Vigil. Only copy/test changed;
not imported into58. Primary idle/clean; previous full client evidence on d7cd47f
remains as below. Conditional production-recovery ETA14:00–17:00UTC unchanged.

## Previous checkpoint — September 9, 09:30 UTC

**58189 exact live-wrapper rehearsal TERMINAL0/PASS** on frozen standalone58
**1fd0d35683d973e99dc01c7fadbcbfe9f47e1202**: native expiry/journey2tests1.3m,
real party1test27.9s. The wrapper's success text says "Live", but these endpoints
were disposable loopback services; this is NOT production verification.
Expiry14.851s→0 outside changed strength11→10/max110→100/aura off; Recall earned
rest and restored stats/aura. Journey recorded real2hostile damage and accepted
30mana Fireball, returned at110HP/93MP, recovered both110, and rejoined110/110
with earned bank retained. Two real party members rendered19visible parts atHigh,
10atLow, with actual joystick movement and portrait/landscape status checks.
Both artifact scans0; exact API/Mongo/image absent and portsfree before successor.
Archive **`/tmp/eidolon-rest58-live-rehearsal-proof-8GN3fo`**, full log
`/tmp/eidolon-rest58-live-recovery-rehearsal-0925.log`. Inspected portrait390High
status and short568Low world captures: readable buff text, visible golden auras,
no enclosing opaque box.49/52FPS in those captures is not sustained/device QA.

**1035 complete58 gameplay ACTIVE**, same clean/frozen1fd0d35, only owned local
browser, runrest58-all24-r9-0909-0928, API18560/Mongo18561/web41960. Log
`/tmp/eidolon-rest58-all-node24-rerun-0928.log`. Initial3authentication/UI/loot/
portal/persistence checks PASSED54.8s; seven-test dungeon batch underway.
Do not edit/restart until terminal evidence. Earlier complete-run failures remain
failed even though the exact movement cause is now explained and focused replay
passes. Full current recovery client/lint251/3534 passed as below.

Primary **10766 full client/lint TERMINAL0**, clean d7cd47f,
269suites/3840tests/171.517s, Node24; logs
`/tmp/eidolon-primary-speed-budget-full-{client,lint}.log`. Primary now idle.

Separate Dark King **23814 full race TERMINAL1/FAILED**, game435.855s, only four
UmbraPrime body-contact fixtures failed because they never ran the world phase
hook before attacking phase0. Root38.966s/database1.206s/lifecycle1.075s passed;
no race warning found. Original full log retained. Candidate **a5405fa** initializes
the real phase hook in those contact-only fixtures and asserts phase1, retaining
actual accepted attacks/health reduction for all four classes; no forced phase
assignment or relaxed damage test. Focused dark-king/contact race PASSED1.855s,
`/tmp/eidolon-dark-king-contact-phase-tests.log`. **28054 full race repeat ACTIVE**,
`/tmp/eidolon-dark-king-phase-integrity-full-race-r2.log`, clean/frozen separate
worktree. This code is NOT in58 and is not a completed raid-quality/live gate.

**55CI34328735856 remains ACTIVE**, predeploy full-character gameplay. No56push
until full55 deployment/finalLive and fresh exact identities. Production recovery
is still unproven; conditional14:00–17:00UTC estimate unchanged. Whole roadmap
remains active; next browser work follows1035 terminal/archive/cleanup.

## Previous checkpoint — September 9, 09:26 UTC

**49283 maximum-speed movement TERMINAL0/PASS1/25.2s** (test22.7) on clean
standalone58 **1fd0d35683d973e99dc01c7fadbcbfe9f47e1202**. Actual speed31.68,
sustained106frames/outside83frames; max2updates, raw maxstep1.056 in both,
distance excess1.55e-15/0, no invalid frames/backtracking/camera gaps/corrections.
All arrival and acknowledgement checks passed. Archive
`/tmp/eidolon-rest58-fast-movement-proof-XGR9zy`; log
`/tmp/eidolon-rest58-fast-movement-0921.log`. This is explicitly prepared
level100 QA, not earned progression or a physical-phone performance claim.

**68919 ordinary fresh movement TERMINAL0/PASS1/24.9s** (test22.1), same source,
speed10.56, max2updates/maxstep0.352/maxexcess3.33e-16, no corrections or camera
errors. Archive `/tmp/eidolon-rest58-fresh-movement-proof-a1St1J`; log
`/tmp/eidolon-rest58-fresh-movement-0923.log`. Both scans0; exact respective
API/Mongo/images independently absent and18560/18561/41960free before successors.

**26873 full recovery client/lint TERMINAL0**,251suites/3534tests/172.663s,
Node24. Logs `/tmp/eidolon-rest58-speed-budget-full-{client,lint}.log`.
**58189 exact live-wrapper rehearsal ACTIVE**, frozen1fd0d35, only owned browser,
runrest58-live24-r1-0909-0925, API18560/Mongo18561/web41960, route
`live-recovery-rehearsal`, log
`/tmp/eidolon-rest58-live-recovery-rehearsal-0925.log`. Native expiry started.
After terminal evidence/archive/cleanup, run complete58 again; do not infer
whole-game or production success from the two focused movement passes.

Primaryd7cd47f **10766 full client/lint ACTIVE**, logs
`/tmp/eidolon-primary-speed-budget-full-{client,lint}.log`. Separate Dark King
ca662fd **23814 full server race ACTIVE** as below. Keep both candidates frozen.
55CI34328735856 still in predeploy gameplay; no successor push or new live claim.

## Previous checkpoint — September 9, 09:21 UTC

The preceding turn was a VERIFIED WAIT. This turn made PROGRESS: completed58
run52270 reached a reproducible movement failure with retained frame evidence,
diagnosed the obsolete speed assumption, integrated the prepared live-recovery
gate, and started targeted high-speed/full-client verification. A separate Dark
King phase defect was also reproduced and fixed for later campaign work.

**52270 TERMINAL1/FAILED** on45797ee. The full route passed the dungeon batch,
spell/phone/Forge/guide, fresh Wizard collection, talent, death-resource and
direct-target stages before failing movement's original `<1` world-unit step
assertion. Fresh Wizard collection took281s (whole test5.5m),27 observed target
deaths,0 player deaths,8 collected seeds, manual8000XP/100gold claim to17 and
saved progress. These legacy payouts remain a separate balance issue. Later
movement assertions/PvP/animations/final native rest routes did not execute.
Full log `/tmp/eidolon-rest58-all-node24-rerun-0843.log`; scanned evidence archive
**`/tmp/eidolon-rest58-movement-speed-failure-rlccng`**. Exact r8API/Mongo/image
absence and free18560/18561/41960 verified after terminal evidence. No live or
unrelated resources were removed.

The75-frame attachment proves speed31.68000030517578, maximum step
1.0560000101725278, and exactly TWO simulation updates at each largest step.
Server speed caps at28.8 before the requested1.10 rested multiplier;2/60 seconds
at31.68 is1.056. The original fixed-distance QA assumption no longer matches
intended boosted speed. This is evidence unavailable for the earlier failure,
not a conjectured GPU/network cause. No runtime movement/recovery/timing changes.

Primary **d7cd47f** (standalone **1fd0d35683d973e99dc01c7fadbcbfe9f47e1202**)
replaces only that distance bound with actual-speed/actual-update distance budget,
at most2updates, numeric excess<1e-5 and valid evidence. All other movement,
camera, backtracking, correction, arrival and acknowledgement checks remain.
Retained frames replay at2updates,0invalid,1.7763568394002505e-15maximum excess.
Synthetic cases reject0.7unit at10.56 (which old<1allowed),1.2at31.68, extra ticks
and malformed evidence. A Jest array-table mistake initially failed6fixtures;
corrected, focused36checks/3suites/1.261s plus lint passed in primary.
Details in candidate `docs/plans/2026-09-09-rested-movement-budget.md`.

Standalone imported **05c3bb0/dc757d5/fe41722** for the mandatory live native
recovery gate and exact disposable rehearsal. The one wrapper cherry-pick
conflict was resolved by preserving BOTH existing`well-rested-all` and new
`live-recovery-rehearsal`; the full gate was not shortened. Dark King/expanded
campaign changes were NOT imported. Current standalone1fd0d35 is clean/frozen.
**26873 full client/lint ACTIVE**, logs
`/tmp/eidolon-rest58-speed-budget-{tests,lint,full-client,full-lint}.log`.
**49283 focused maximum-speed browser ACTIVE**, runrest58-fast24-r1-0909-0921,
API18560/Mongo18561/web41960, route`movement-fast`, log
`/tmp/eidolon-rest58-fast-movement-0921.log`. This uses existing authorized QA
level100 preparation and explicitly requires31.68speed; it is not earned-level
evidence. Only owned local browser. Next: archive/clean after terminal, ordinary
fresh-speed movement, exact live-recovery rehearsal, then complete58 rerun.

Separate campaign worktree **`/tmp/eidolon-dark-king-phase-integrity-QL6Zl4`**,
branchwork/dark-king-phase-integrity-20260909, clean **ca662fd**, based4172dfa.
Regression38428 failed:600damage skipped Neris;800skipped Neris/Pyralis entirely.
Candidate gates incoming burst/DoT/explosion/reflection damage at each active
quarter until its handoff, advances overshot snapshots in order, follows announced
modifiers and excludes dead/disconnected/nonplayer aid recipients. Focused
9224Go1.24.5race PASSED1.299s, including32concurrent hits. Original/after logs
`/tmp/eidolon-dark-king-phase-integrity-{before,after}.log`.
**23814 full server race ACTIVE**, `/tmp/eidolon-dark-king-phase-integrity-full-race.log`.
Full ordinary combat, actual burst raid presentation/party and release gates
remain open. Inherited1.0.57 metadata is NOT publish permission; do not import
this fix into urgent58. Primaryd7cd47f remains clean/idle separately.

**55CI34328735856 ACTIVE in predeploy full-character gameplay**; earlier unit/
browser jobs passed.54 remains last independently verified production. No56push
until complete55/finalLive plus fresh exact identities. Town recovery is not
live; conditional14:00–17:00UTC estimate and full roadmap scope remain unchanged.

## Previous checkpoint — September 9, 09:01 UTC

This goal turn made PROGRESS: retained completed regressions and implemented a
missing publication-specific recovery gate in the separate primary candidate.
It also verified ongoing canonical58 gameplay52270 and55CI34328735856; neither
is terminal, and no newer release was pushed.

Read-only workflow review showed the existing final-live gate did not execute
the native town recovery/expiry/party tests. Primary **6226fc1** adds a mandatory
post-identity-check live step and `scripts/run-live-recovery-qa.sh`. The wrapper
uses four ordinary fresh accounts under a dedicated QA prefix with a random
48-bit suffix, no grants/deletion, no test retry on a now-nonfresh character,
separate screenshot roots, and EXIT sanitation preserving failure status.
It reuses actual combat depletion/Recall/full HP+MP/rejoin, natural buff expiry,
and real two-player High/Low phone aura/status routes. It does not claim physical
phone performance. No wrapper browser rehearsal or live pass has happened yet.

**9fa4638** adds the opt-in isolated `live-recovery-rehearsal` route. It invokes
the exact wrapper against loopback services without altering the default full
gate or granting the random accounts QA privileges. Focused26tests/3suites/
1.476s plus lint passed; full **26774 TERMINAL0**,268suites/3818tests/170.675s
plus lint, Node24. Logs
`/tmp/eidolon-live-recovery-rehearsal-{tests,lint}.log` and
`/tmp/eidolon-primary-live-recovery-full-{client,lint}.log`.

Further source review found the rest party observer omitted the validated
backend-origin routing used by the primary browser/other live multiplayer tests.
Primary **4172dfa** applies the same existing policy; empty configuration still
means no override. A source guard failed on the older launch, and focused
**55135 TERMINAL0**,20tests/2suites/1.15s plus lint passed. Logs
`/tmp/eidolon-live-recovery-origin-{before,after,lint}.log`. The earlier initial
wrapper harness syntax error ran zero tests and was fixed before these proofs.
This is preventive QA wiring, not an observed production network diagnosis.
Primary4172dfa is clean/idle, unpublished. Detailed acceptance is in that
worktree's `docs/plans/2026-09-09-live-town-recovery-gate.md`.

**NEXT:** keep standalone58 **45797ee** unchanged until **52270** completes.
Then retain/sanitize/archive its full results and verify exact cleanup. After
that, import the three isolated live-gate commits6226fc1,9fa4638,4172dfa into58
(check conflicts; do not import expanded campaign/balance), verify wiring/lint,
and run the exact `live-recovery-rehearsal` against disposable services before
publication. Full runtime regression evidence must remain tied to source; no
pass may be inferred from this wrapper's shell mocks.

At09:01 **52270 is ACTIVE**, log
`/tmp/eidolon-rest58-all-node24-rerun-0843.log`. Authentication3 and dungeon7
passed; spell/Guardian/Spirit/phone party/inventory/quest routes have continued
passing. Fresh Wizard collection is actively fighting and making ordinary town
mana-rest stops. Later full-chain stages and final native rest routes remain
unproven. This is still the only owned local browser invocation.

**55CI34328735856 ACTIVE in disposable full-character predeploy QA**; all preceding
unit/browser jobs passed. No56push until complete55/finalLive and fresh exact
public identities.54 remains last independently verified production;56–58 are
not delivered. The whole roadmap remains open, with town recovery priority and
the conditional14:00–17:00UTC estimate unchanged.

## Previous checkpoint — September 9, 08:50 UTC

The preceding status turn was a VERIFIED WAIT on gameplay52270 and CI34328735856;
it also established primary regression45785 terminal success. Recovery is still
unpublished. The user's ETA remains conditional September9 14:00–17:00UTC.

Earlier full recovery53012 TERMINAL1: inventory ownership/tracking assertions
passed, but raw reconnect navigation recorded state_pb.js/three.core.js
ERR_NETWORK_CHANGED. Six other dungeon-batch tests passed; this is not a full
gameplay pass. Original evidence remains at
`/tmp/eidolon-rest58-reconnect-network-failure-MDj0Il`, with full log
`/tmp/eidolon-rest58-all-node24-rerun-0828.log`; scan0 and exact cleanup were
verified before the successor started. No host-network cause is established.

Canonical58 is now clean/frozen **45797ee24167071312e53bc9d015394fc39e4391**.
QA removes34 redundant raw reloads immediately preceding same-page login; login
already owns a fresh document navigation and bounded runtime readiness. Primary
61e18de made the corresponding37 removals. Existing reconnect ownership/resource
assertions remain, with no production change, new error filter or retry budget.
A seven-case source guard rejects this adjacent double-navigation pattern.

Real browser fault proof84624 PASSED4/1m, including a failing raw-reload control,
fresh-document recovery, persistent failure retention and preservation of earlier
unrelated errors. It deliberately injects CONNECTION_RESET, not a claim to
reproduce the host's NETWORK_CHANGED cause. Log
`/tmp/eidolon-rest58-reconnect-fault-browser.log`; archive
`/tmp/eidolon-rest58-reconnect-fault-proof-ah0ADD`.
Actual inventory48756 PASSED1/19.3s, manual drop/pickup and saved ownership/
tracking/reconnect, log `/tmp/eidolon-rest58-single-navigation-inventory.log`,
archive `/tmp/eidolon-rest58-single-navigation-inventory-proof-k2dH4a`; scan0,
exact disposable resources removed. Full client1520 PASSED249suites/3499tests/
123.612s plus lint, Node24, logs
`/tmp/eidolon-rest58-single-navigation-full-{client,lint}.log`.

**52270 complete58 gameplay ACTIVE**, frozen45797ee, run
rest58-all24-r8-0909-0843 (actual start08:41:57), API18560/Mongo18561/web41960.
Log `/tmp/eidolon-rest58-all-node24-rerun-0843.log`. Authentication3tests passed
44.6s; dungeon batch is actively fighting bosses. Only owned local browser;
do not edit/restart this candidate while active. Full-game/rest gate remains open.

Primary36559 full regression failed only two stale checkpoint mock expectations
for the now-removed redundant reload (266suites/3803tests passed). Follow-up
**f8723bcf9f1af0b8886163603478a62cbb5d4da9** preserves login invocation and saved
progress assertions while expecting no extra raw reload. Focused17 passed;
**45785 full rerun TERMINAL0**,267suites/3805tests/107.828s plus lint, logs
`/tmp/eidolon-primary-single-navigation-r2-full-{client,lint}.log`.
Primary remains clean, unpublished, and separate from standalone58.

**55CI34328735856 ACTIVE**: client/server/all3browser shards passed; predeploy
character QA started08:44:53.54 remains last independently verified production.
No56push until complete55 deployment/final live QA and fresh exact identities.
Whole1.1–1.10 roadmap remains active, with no completion claim.

## Previous checkpoint — September 9, 08:29 UTC

This turn made PROGRESS: **55264 focused beam replay TERMINAL0/PASS1/53.1s**
(test51.6) on canonical58 **07283d077757ce42ba6d07ba1c8768ef7f822ce5**. All eight
rank0/5 × High/Low × wall/open casts matched authoritative endpoints; saved
rank/reconnect checks passed. The2unit approach tolerance,45s budget, actual
input and beam geometry checks stayed unchanged. Scan0; exact probe API/Mongo/
image absent and18560/18561/41960 free. Archive
**`/tmp/eidolon-rest58-beam-settled-proof-ls2Jmp`**, log
`/tmp/eidolon-rest58-beam-settled-0825.log`. Prior complete-run failure stays failed.

**46700 current full client/lint TERMINAL0**, Node24.18.0,248suites/3492tests/
112.724s, logs `/tmp/eidolon-rest58-settled-full-{client,lint}.log`. Exact source
07283d0 remained unchanged during this check. Server runtime remains unchanged
from the earlier full Go race proof; no new server/full-game pass is implied.

**53012 complete58 gameplay ACTIVE**, same frozen07283d0, only owned local
browser. Runrest58-all24-r7-0909-0828 (actual start08:27), API18560/Mongo18561/
web41960, log `/tmp/eidolon-rest58-all-node24-rerun-0828.log`. All three actual
authentication/UI/loot/portal checks passed53.7s; dungeon batch underway.
Do not edit/restart or start another owned browser until terminal evidence.

**55CI34328735856 ACTIVE**, client/server PASS and all3browser shards running.
Public54 fully verified below. No56push until complete55CI/deploy/finalLiveQA
and fresh exact public identities. Whole roadmap still open;58 not live.

## Previous checkpoint — September 9, 08:25 UTC

**70373 complete58 TERMINAL1/FAILED**: seven-test dungeon batch finished with
the one pre-cast beam-position failure and6passes/6.1m. Scan0; exact
rest58-all24-r6-0909-0817 API/Mongo/image absent and all three ports free.
Archive **`/tmp/eidolon-rest58-beam-approach-failure-qY89aQ`** includes report,
error context and full log. The later full-chain stages did not execute.
Only after terminal evidence/cleanup, canonical58 cherry-picked the prepared
settled-approach QA fix as **07283d0**, now frozen/clean. **55264 focused actual
beam replay ACTIVE**, routebeam-walls, runrest58-beam24-r1-0909-0825,
API18560/Mongo18561/web41960, log `/tmp/eidolon-rest58-beam-settled-0825.log`.
No success claim yet, no threshold/deadline or production-runtime change.

**55CI34328735856 ACTIVE**, client tests passed, server tests running. Public54
fully verified as below; do not push56 until complete55/live gate. Primary1389f7e
and aura59be536 remain clean, idle and unpublished. Whole roadmap active.

## Previous checkpoint — September 9, 08:23 UTC

This continuation made PROGRESS:54 fully delivered/verified,55 pushed, observer
readiness corrected and tested, a separate build-cache fix proved with real
images, and a later beam-approach QA correction prepared. Full roadmap remains
active/unfulfilled; none of these closes the recovery or expanded-story gates.

**54CI34320477081 TERMINAL SUCCESS**, all10jobs, exact5e22b74701ecfca474132cf952c0d6725c25091b.
Predeploy completed08:06:24; Pages/server deployments08:07:25/08:07:08;
finalLiveQA08:21:18. Independent08:22 public manifest/login/main.js release URL/
serverhealth all matchAlpha1.0.54/5e22b747; database ready. **27820 normal55push
TERMINAL0**, cleancanonical `/tmp/eidolon-release55-final54-UVV7t3`,
**c5ce9dc25a9554da55ef1e823e0d63ff04b6676d**, remote/master exact verified.
New **55CI34328735856 ACTIVE**. No56push until complete55CI/deploy/finalLiveQA
plus fresh exact public identities.56/9f41111 and57/6babef5 remain clean queued.

**88641 complete58 TERMINAL1/FAILED** onf6f420d: Guardian Embrace's late observer
loaded many modules with `net::ERR_NETWORK_CHANGED`. Its preceding real cast/
healing/radius/late snapshot/expiry checks passed, then the request-failure gate
failed. Full log `/tmp/eidolon-rest58-all-node24-rerun-0755.log`; archive
**`/tmp/eidolon-rest58-network-failure-3SgGce`**, including report and three primary
cast pictures. Scan0, exact run API/Mongo/image absent, ports18560/18561/41960 free.
The rank5High picture was inspected; it is not a picture of the failing observer.
No network-cause attribution to another workload is established.

**d2ceb0e QA correction:** Guardian/Spirit second-browser contexts now have
explicitbaseURL and warm up through existing bounded `openGame`, not extra raw
`goto(baseURL)`. Source inspection showed that extra warm-up preceded login's
failure scope and bypassed runtime readiness. Existing navigation recovery,
failure assertions, counts, timeouts and gameplay thresholds are unchanged.
No new ignored network error and no production code modification.

**60593 Guardian TERMINAL0/PASS1/48.7s** (test46.9),
`/tmp/eidolon-rest58-observer-guardian-0811.log`, archive
**`/tmp/eidolon-rest58-observer-guardian-proof-ybAGaz`**.
**88066 Spirit TERMINAL0/PASS1/52.3s** (test50.9),
`/tmp/eidolon-rest58-observer-spirit-0813.log`, archive
**`/tmp/eidolon-rest58-observer-spirit-proof-DCIubN`**.
Both retained actual late rank-private reconstruction and natural expiry;
Guardian radius10/11.5 and healing280, Spirit16/18.4/27.6/34.5 and3/5cherubs.
Both scans0/exact cleanup independently verified. GuardianLow and boosted
SpiritLow pictures inspected: phone range/effect presentation, not physical-phone
or sustained-FPS approval (the captures show49/22FPS under current conditions).

**78044 fault-injection browser TERMINAL0/PASS2/38.3s**, current
**d5d04cc5e128616982d97b0f8d0997b6c3e7798b**, Node24/lint passed. New anonymous
`runtime-readiness-recovery.spec.js` intentionally aborts Actor.js with
CONNECTION_RESET: a later successful runtime recovers within2attempts while an
earlier unrelated error remains; a persistent failure with1attempt remains
reported/not ready. This validates existing readiness behavior, not the origin
of host NETWORK_CHANGED or a production outage fix. Log
`/tmp/eidolon-rest58-readiness-fault-browser.log`, archive
**`/tmp/eidolon-rest58-readiness-fault-proof-dzSTVv`**, free web port confirmed.

**70373 complete58 rerun ACTIVE**, frozen cleand5d04cc, only owned local browser.
Runrest58-all24-r6-0909-0817/API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0817.log`. Actual start08:16.
Authentication passed. The first test of the subsequent seven-test batch,
Scorch Beam, FAILED after13s *before casting*: pre-cast position error2.1826155
versus<2units. Error details in active `test-results/dungeon-beam-.../error-context.md`
were read without input values. The other tests are still running; preserve them
and collect terminal evidence/cleanup before editing or restarting the candidate.
Ground/movement/projectile/inventory/Water routes passed; Verdant currently active.
This run cannot be counted as a full pass even if those later routes pass.

Primary now **1389f7e** (clean), precedingde3a6be includes all17movement-diagnostic
lines plus observer/fault-test cherry-picks. **89981 focusedNode24 PASS257/3/3.402s
+lint**, logs `/tmp/eidolon-primary-observer-build-{tests,lint}.log`.
Separate **cea4a9b build cache fix** moves BUILD_COMMIT/VERSION after dependency
installation/sourcecopy, retains exact linker metadata and version defaults.
83571 baseline ordering test FAILED both old declarations;85935 corrected
Go1.24.5 race cache/preflight PASS1.367s. **17816 two real Docker builds PASS**;
second reuses APK/mod/source layers but relinks21.4s. Distinct extracted binaries
contain their own probe commit/version strings, Go metadata confirms target/toolchain.
Archive **`/tmp/eidolon-docker-cache-proof-tjeq3D`**, logs
`/tmp/eidolon-docker-cache-{before,after,build-a,build-b}.log`. Exact two never-started
extraction containers and probe image tags inspected/removed/absence confirmed;
binaries/logs retained. No shared cache/server/database/unrelated cleanup.
This build-only fix is NOT in55–58 and is not an hour-scale CI speedup claim.

Primary **1389f7e** prepares a minimal beam QA fix: wait for IDLE/no target before
each approach-distance observation, retaining45s approach budget,12unit input
steps and2unit tolerance. The old loop could break while passing through the
band, before motion settled. That is a source-confirmed race opportunity, not
captured proof of the failed actor's exact state. **42046 lint/discovery/diff
TERMINAL0**, logs `/tmp/eidolon-primary-beam-settled-{lint,discovery}.log`.
No actual replay yet. After70373 terminal/archive/scan/cleanup, cherry-pick1389f7e
into canonical58 and run **EIDOLON_ISOLATED_QA_ROUTE=beam-walls** before a full rerun.
Keep movement's earlier unproven failure and all thresholds/diagnostics intact.

Primary earned Earth/four-class/party readiness and aura59be536's initial GPU
comparison remain outstanding. Root is ledger-only and was NOT pushed.

## Previous checkpoint — September 9, 08:06 UTC

The preceding continuation and this turn are VERIFIED WAITS, with safe release
preflight checks; no new production fix is claimed. Exact **88641 complete58
rerun remains ACTIVE** on frozenf6f420d and the same run/ports/log below. It has
passed authentication, all seven dungeon/inventory routes and moved into ability
shape/support checks. No source edit, restart or second owned browser.

**54CI34320477081 predeploy remains ACTIVE**. Read-only process inspection found
the current `tests/e2e/multiplayer.spec.js` process1369492, then traced its parent
chain through the full-QA wrapper/npm/sg to **Runner.Worker877604**. This is the
late multiplayer stage, not evidence of a queued idle runner. The longer elapsed
time is not a completed timing baseline or proof of a hang. No cancellation or
runner/workflow change. Process cwd links were unavailable; the process ancestry,
not those links, established runner ownership. No environment values were read
or printed. The unrelated local dungeon/ability tests remained separate.

Preflight reconfirmed clean55/c5ce9dc,56/9f41111,57/6babef5, each with the exact
preceding canonical ancestor and matching login/history/backend/deployment
version labels. Existing55 focused275tests/lint logs retained; no new full pass
claimed.57's deployment still checks schema compatibility and invokes the
pre-upgrade backup for a format increase. Remote/master remains54/5e22b74.
None of55–58 is pushed. After54 full success, recheck public client/login/runtime/
server exact54 identity before pushing55 from its canonical worktree, never root.

Primary4519c0c and aura59be536 remain clean, with outstanding earned-story and
GPU/device checks. Whole roadmap active; town recovery still not delivered.

## Previous checkpoint — September 9, 07:56 UTC

Previous turn made PROGRESS (committed separate aura comparison). This turn
also made PROGRESS: a primary story-budget audit exposed concrete handoff risks;
the complete58 gameplay failure was retained, its strict focused replay passed,
and movement diagnostics were added before assertions without changing runtime.

**65093 complete58 TERMINAL1/FAILED** on ee8a713. It passed the earlier listed
routes plus phone build/settings/adventure, dungeon wipe/reconnect recovery,
death resource recovery and all four direct-target class tests, then failed
`movement-smoothness.spec.js` sustained `largestRenderStep < 1`: received
1.0560000101725315. This is not a complete pass and later PvP/animation/nameplate/
native rest gates did not execute. Log
`/tmp/eidolon-rest58-all-node24-rerun-0718.log`, retained failure archive
**`/tmp/eidolon-rest58-movement-rest-failure-2Qxe5U`**. Artifact scan0; exact
rest58-all24-r4-0909-0718 API/Mongo/image absent and18560/18561/41960 free.
The original test attached movement data only after all assertions and had
video/screenshots disabled, so its failing frames are unavailable. Do not infer
a proven speed-buff, renderer or host-load cause from the single step value.

**98426 focused movement diagnostic TERMINAL0/PASS1/17.1s** (test15.9) on40aca4f.
This QA-only commit adds speed/rest/timestamps and attaches frames BEFORE the
sustained/outside assertions. All original limits and authority/acknowledgement
checks remain unchanged. Both sustained/outside largest step0.17600000699 at
actual replicated speed10.5600004196;148/151samples, zero backtracks, camera or
render-logical gaps and correction frames. Actual renderer AMD RADV RENOIR.
Sample pairs were read from the embedded report: ordinary16.6–16.7ms movement,
rest earns in town and spends outside. This focused pass does not explain the
earlier failure or establish sustained performance. Log
`/tmp/eidolon-rest58-movement-diagnostic-0753.log`, archive
**`/tmp/eidolon-rest58-movement-diagnostic-proof-okYxGO`** includes report/samples.
Scan0 and exact diagnostic-run cleanup/free ports independently confirmed.

Canonical58 now clean **f6f420d6f5f3f03665c075042160e20c1c2acf07**: second QA-only
commit adds simulation frame/time/accumulator observations to correlate a future
step anomaly. Only17 lines added to the movement browser spec since ee8a713;
production runtime, all assertions, release metadata, server and reward rules
unchanged. Node24 lint/diff passed before each commit. **88641 complete58 rerun
ACTIVE**, runrest58-all24-r5-0909-0755/API18560/Mongo18561/web41960, log
`/tmp/eidolon-rest58-all-node24-rerun-0755.log`. Initial actual login passed.
Only owned local browser; do not edit/restart this candidate while active.

Primary story clean **4519c0c** adds
`chronicle_readiness_budget_audit_test.go` and diagnostic notes. **7980
Go1.24.5 race PASS12scenarios/3.348s**, log
`/tmp/eidolon-primary-earth-budget-audit.log`. Production helpers reconcile
seven pre-dungeon chapter payouts25,979XP/800gold plus150 authored hunt kills,
three tutorial kills and8/20 modeled collection kills. Omitted incidental combat;
minimum eligible Skeleton levels; rest scenarios are none/every kill, not measured
uptime. Solo ends29 without rest (8,461/8,221XP shortfall),31 with every kill rested;
two-player ends25/27 and five-player22/23 for none/all rest. These are diagnostic
bounds, NOT actual victories, a complete party campaign or balanced approval.
Do not insert optional dailies/grants to hide an earned-readiness failure.
Primary full actual Earth/four-class/party routes remain due; no production
reward change was made from the diagnostic and recovery58 is separate.

**54CI34320477081 predeploy still ACTIVE** at07:56 with all prior checks passed.
No55push until complete54CI/deploy/finalLiveQA+fresh exact public identities.
Public last verified53 at07:44;58 NOT LIVE. Separate aura59be536 still awaits
its first GPU run. Whole roadmap remains active; no root push or status closure.

## Previous checkpoint — September 9, 07:47 UTC

Previous status turn was a VERIFIED WAIT: exact54CI34320477081 was confirmed
in progress and the current58 gameplay log was advancing. This continuation
made PROGRESS by committing the separate controlled GPU-comparison fixture;
it did not modify or restart canonical58.

Separate aura prototype is clean **59be536**, in the existing
`/tmp/eidolon-rest-aura-batching-k1vBvU`. New comparison helper, seven unit cases
and one prepared browser test compare visible aura pixels and incremental actual
draw calls at identical phases. The expanded GPU reference is not an independent
copy of the original production effect; authored-formula unit parity remains
required alongside it. Pixel metrics normalize against aura contribution, so
removing detail cannot pass because most scenery pixels are unchanged.
Final focused log confirms12tests/2suites/1.791s, lint and one-test discovery.
Handle77576 is absent; no GPU/browser execution or frame-rate gain is claimed.
Logs `/tmp/eidolon-rest-aura-pixel-final-{tests,lint,discovery}.log`.
Its inherited58 version remains non-publishable; this is later visual work only.

**65093 complete58 gameplay confirmed ACTIVE**, frozen ee8a713, same isolated
run/ports/log below. It has now passed gem/Forge, ordinary quest collection,
talent mana/healing/duration, Seraph combat/lifetime, shield absorption/expiry,
entrance visibility/Recall and phone manual quest turn-in. Later routes and
native rest gates remain; do not count the complete run as passed yet. No second
local browser was started, and no source was edited in its worktree.

**54CI34320477081 predeploy still ACTIVE**, all client/server/browser checks
passed; no successor push. Fresh public client/server reads at07:44 both report
**Alpha1.0.53/ce330b3**, server healthy/database ready. Town recovery is NOT LIVE.
User ETA remains a conditional September9 14:00–17:00UTC, based on the ordered
queue and observed roughly80-minute pipelines, not a promised completion time.
Candidate58 login/history notes were inspected and describe10% pool recovery,
1:1 rest up to two hours,10% stats/25% enemy-kill XP, online/death/stealth rules,
and unchanged outside0.01 regeneration and separate future balancing work.

Next: retain the active58 run uninterrupted through terminal evidence and exact
cleanup; advance55 only after complete54CI/deploy/finalLiveQA and exact fresh
public identities. Primary story-only Earth readiness and the whole roadmap
remain open. No root push, no goal completion or blocked status.

## Previous checkpoint — September 9, 07:34 UTC

This turn made PROGRESS: primary client full pass and a separately committed
rendering optimization with focused/full client evidence. It did not change
canonical58 or its required recovery/gameplay checks.

**10604 aura prototype prepare/full-client/lint TERMINAL0**, exacte21a098,
Node24.18.0:249suites/3497tests/146.96s. Existing prepare-client generated vendor
assets; no dependency/global-toolchain change. Logs
`/tmp/eidolon-rest-aura-batching-{prepare,full-client,full-lint}.log`.
Prototype now clean **7b383be3d776dbe1e4306d7a0ed314d83f49441b** (documentation-only
closure after tested e21a098) in `/tmp/eidolon-rest-aura-batching-k1vBvU`.
No prototype process/browser active. Still requires rendered visual parity,
actual WebGL/frame-time/device measurements and native transitions before
promotion. Do not put it into recovery58 or claim FPS gains from mesh counts.

**65093 complete58 gameplay re-polled ACTIVE**, same frozen ee8a713/run/ports/log
below, only owned local browser. It is through dungeon/shape/support/Whirlwind
and phone movement/combat, now party/inventory progression. Do not edit/restart
or begin another local browser until terminal and exact cleanup/artifact review.
**54CI34320477081 rechecked predeploy ACTIVE**, all prior tests passed.
No55push until full54CI/deploy/finalLiveQA+fresh exact public identities. Public
last verified53; recovery58 remains not live. Whole roadmap active/unfulfilled.

## Previous checkpoint — September 9, 07:31 UTC

Previous turn made PROGRESS: stronger actual HP/MP recovery proof passed and
complete58 restarted after a diagnosed/corrected duration failure. This turn
also made PROGRESS: primary full regression closed and a separate substantive
aura-rendering optimization was implemented/tested without altering recovery58.

**73598 primary full client/lint TERMINAL0**, clean640c9ce/Node24.18.0:
266suites/3798tests/170.031s, logs
`/tmp/eidolon-primary-public-proof-full-{client,lint}.log`. This exact source
includes Construct navigation, public-ready observation and shield/rest fixes.
No primary process/browser active; actual earned full Earth/four-class readiness
still due. Server unchanged from full-race-passedd9cc0ed.

Separate visual/performance prototype worktree
**`/tmp/eidolon-rest-aura-batching-k1vBvU`**, branch
work/rest-aura-batching-20260909, clean **e21a0989adf4249382d418fc9b9f23fa2eec4255**,
based on58/ee8a713. This is NOT canonical58 and must NOT be pushed as58 or added
to its current release gate. Actor-owned InstancedMeshes batch all16/8 sparks
into two opacity groups while preserving colors/phases/positions/fade/scales.
Including existing rings: visible meshes19→5 High and10→4 Low; this is NOT a
measured draw-call or FPS improvement. Fixed full-cycle bounds retain culling;
per-actor matrices remain independent; disposal frees instance buffers once,
not cached geometry/materials. No stat/clock/reward/authority change.

Baseline21996 reproduced3fail/2pass (old motion/color parity still passed).
Corrected25638 passed33tests/3suites2.214s/lint/diff: all authored motes across
six phases and both qualities, vertex bounds, shared resources, independent
matrices and disposal. Logs `/tmp/eidolon-rest-aura-batching-{before,after,lint}.log`.
Candidate requirements in `2026-09-09-rest-aura-batching.md`; controlled rendered
comparison, actual device/frame-time measurements and native transitions still
required before future versioning/promotion. No new browser launched for it.
**10604 prototype prepare-client/full-client/lint ACTIVE**, frozene21a098,
logs `/tmp/eidolon-rest-aura-batching-{prepare,full-client,full-lint}.log`.

**65093 complete58 gameplay ACTIVE**, unchangedee8a713/project/ports/log below,
only owned local browser. **54CI34320477081 predeploy ACTIVE**, all prior checks
passed; no deployment/finalLiveQA yet, no55push. Public last verified53.
Keep actual recovery delivery first; whole roadmap remains active/unfulfilled.

## Previous checkpoint — September 9, 07:18 UTC

This continuation made PROGRESS: full58 duration failure diagnosed/corrected,
stronger public-ready recovery journey implemented and actually passed,
client regression closed, complete gameplay restarted only after terminal
failure, corrections, focused passes, retained artifacts and exact cleanup.

**48279 duration replay TERMINAL0/PASS1/1.1m** on ee8a713, Node24.18.0:
baseline20s, trained25s/natural expiry, persistent Well Rested row, saved
landscape25s and ordinary touch casts all pass. Scan0/exact owned API/Mongo/
image absence+free ports. Archive `/tmp/eidolon-rest58-duration24-proof-Sei3x7`;
log `/tmp/eidolon-rest58-duration-rest-browser-0713.log`.

**37941 full58client/lint TERMINAL0**, sameee8a713:248suites/3492tests/157.555s,
logs `/tmp/eidolon-rest58-public-proof-full-{client,lint}.log`.

**99620 strengthened ordinary recovery journey TERMINAL0/PASS1/38.7s**
(test36.5s), same source/Node24. Actual hostile dealt2damage:HP110→108;
accepted FireballMP110→80, actual42spell damage plus2basic. Normal Recall
returnedHP110/110 MP95/110; before reconnect both110/110, then both retained
full after reconnect. Rest bank5.280start/13.860departure/9.560beforecast/
10.167return/12.177beforelogin/13.202rejoin, aura19meshes visible. All/tests
requests blocked during this successful browser route; no unpublished module
or shared localhost clock needed. This is still an isolated run, NOT production.
**Scope correction:** route `well-rested` runs only journey; this invocation did
not run expiry/party. `well-rested-all` or complete `all` runs all three; older
81669 remains their supported native evidence pending the current complete run.
Scan0/exact cleanup confirmed. Archive
`/tmp/eidolon-rest58-public-recovery-proof-HWZkIN`; log
`/tmp/eidolon-rest58-public-proof-browser-0716.log`. Rejoined screenshot viewed:
full bars/aura, FPS11 under concurrent work. Not sustained performance acceptance
or proof of aura-caused slowness; physical-phone/performance gates remain open.

**65093 COMPLETE58 GAMEPLAY ACTIVE — only owned local browser**, frozen clean
ee8a713d6d6daef1caa5d319c63c2089fdf37771, Node24 inside sg render,
projectrest58-all24-r4-0909-0718 (label; actual start07:17),
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0718.log`. Every existing stage plus native
journey/expiry/party retained. No source edit/restart/second local browser while
active; preserve artifacts and verify exact cleanup when terminal. Primary640c9ce
clean/idle with the same QA corrections. Whole roadmap active/unfulfilled.
54CI34320477081 remains predeploy-active; no55push, public last verified53.

## Previous checkpoint — September 9, 07:14 UTC

Previous goal turn was PROGRESS (Construct search fixed,54 entered predeploy).
This continuation is also PROGRESS: full58 failure diagnosed, shield/rest
expectation corrected, and public recovery evidence strengthened without
changing production runtime. Whole roadmap remains active/unfulfilled.

**1416 complete58 gameplay TERMINAL1/FAILED** on6e85547. Opening/collection,
equipment/Forge/Guide and talent economy/healing passed, then duration expected
the phone panel empty after Arcane Shield expired. Server expiry/HP/mesh/badge
checks had passed; error context shows one legitimate resting Well Rested row.
Log `/tmp/eidolon-rest58-all-node24-rerun-0650.log`, archive
`/tmp/eidolon-rest58-duration-rest-failure-ATQ2N9`. Scan0, exact run-specific
API/Mongo/image absence and free18560/18561/41960 confirmed. Trained portrait
viewed; do not claim full-run success or confuse the older shield snapshot
with the later error-context-only expired state.

Fresh Wizard within that full run: opening65s, zero deaths, manual500XP/100gold;
collection248s,21observed target deaths, zero player deaths, eight seeds,
manual8000XP/100gold,7→17, locked30Guide. Actual town recovery logs include
MP14→192/192, positive earned rest, full unchanged maxima and resumed expedition.
Eight equipment pieces130unsold vendor value; not sale income or full kill census.

58 **3ec3112** corrects only shield-expiry QA: expired shield must disappear,
earned resting row remain, and empty placeholder remain hidden. New actual
PhoneStatusUI coexistence regression. Initial80993 used nonexistent
WellRestedStats filename;50285 omitted normalized remainingSeconds in fixture.
Both failures retained, not production failures. Corrected37500 passed19tests/
2suites1.333s plus lint. Logs `/tmp/eidolon-rest58-duration-rest-{tests,
corrected-tests,final-tests,final-lint}.log`; candidate document
`2026-09-09-rested-shield-expiry-panel.md`.

Public proof review: Pages does not publish/tests, but native journey's combat
observer imported/tests/collectionCombatReceipts.js. Primary0da1d65 injects the
trusted self-contained read-only counter instead. Native journey blocks/tests
requests, requires real hostile damage+living HP deficit (not a changed maximum),
accepted Fireball/spent mana, normal Recall/full HP and MP, earned rest/aura and
reconnect. No localhost/shared-wall-clock predicate, grants or timeout extension.
25663 passed26tests1.565s/lint/Playwright discovery. Actual stronger browser
proof still due; discovery is not gameplay. Documentation
`2026-09-09-public-town-recovery-proof.md`, logs
`/tmp/eidolon-primary-public-rest-{tests,lint,discovery}.log`.

58 now clean **ee8a713d6d6daef1caa5d319c63c2089fdf37771** after cherry-picking
0da1d65 onto3ec3112; independent diff confirms runtime/server/version/scripts/
workflow unchanged from6e85547. Primary clean **640c9cea4ad5ff63a15a17fdb482367dfa0b775d**
after carrying the shield correction. No primary process active.

**48279 focused58 duration browser ACTIVE — only owned local browser** on
ee8a713, Node24 inside sg render, projectrest58-duration24-0909-0713,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-duration-rest-browser-0713.log`. **37941 same-source
full58client/lint ACTIVE**, logs `/tmp/eidolon-rest58-public-proof-full-{client,lint}.log`.
Freeze source until terminal; preserve artifacts/
exact cleanup, then run stronger native proof and resume complete58 gameplay.
54CI34320477081 still predeploy-active; public last verified53, no55push.

## Previous checkpoint — September 9, 07:05 UTC

Previous goal turn made PROGRESS (primary full server race and corrected54
browser3 completed). This continuation also made PROGRESS: fixed a concrete
later-campaign QA search error, and verified54 advanced into predeploy.

**54CI34320477081 ACTIVE: client/server and ALL THREE browser shards PASSED**;
Predeploy Character QA now running. No deployment/finalLiveQA yet, no55push.
The earlier failed54 run remains failed. Last public identity verified53/ce330b3.

**1416 complete58 gameplay ACTIVE**, unchanged6e85547, same project/ports/log
below, only owned local browser. Phone combat/party/inventory passed; legacy gem
recovery passed12.6s within the full chain (base/rested distinction, exact18+5,
full-bag rejection and saved reconnect retained). Forge/Guide passed21.1s.
Fresh ordinary Wizard opening manually paid500XP/100gold at65s with zero deaths;
collection still running with real town-recovery loop. Do not count partial
stages as a full pass or edit/restart this active source.

Primary now clean **b692a24cbe6e13cf1e9a08035c87ac93fc029448**. Source inspection
found the generic Earth search fallback sent Constructs east toDemonOrcs(x300),
despite production placing level40Constructs in x[-1000,-600]. Explicit Earth
search helper now usesx-800,z200 for them, preserves other existing anchors,
and fails unsupported enemies/realms instead of silently going east. Actual
generated missing-ferry chapter test distinguishes storyrealmWater from
huntingrealmEarth. No gameplay/runtime/requirements/deadlines/grants changed;
Water/Fire/Air earned travel still not implemented or claimed by this helper.
Baseline98385 reproduced3fail/11pass; corrected7305 passed63tests/3suites0.998s,
lint/diff. Actual Playwright route discovery27460 terminal0; not browser play.
Logs `/tmp/eidolon-primary-construct-search-{before,after,lint,discovery}.log`;
candidate document `docs/plans/2026-09-09-earth-expedition-search.md`.
No primary process/browser active. Parentd9cc0ed full server race remains valid
for unchanged production server; exact new helper has focused evidence above.
Next earned primary work waits for the owned58 browser to close and artifacts/
exact cleanup verification, not for an invented blocker. Whole roadmap active.

## Previous checkpoint — September 9, 07:00 UTC

This continuation made PROGRESS: primary daily diagnostics corrected, full client
and full server race completed, latest successful pipeline timing measured.
**95459 full primary Go race TERMINAL0** on cleand9cc0ed/Go1.24.5:
root29.646s, game352.006s, database1.133s, lifecycle1.040s. Log
`/tmp/eidolon-primary-current-daily-full-server.log`. No primary process/browser
active. Client full21409/3789tests is parent4e9cad5; subsequentd9cc0ed test-only
correction passed focused61tests/lint and targeted Go budget race, as below.

**54CI34320477081 ACTIVE: client/server and browser shards2/3 PASSED**;
only browser1 still running before predeploy. The previously failing shard3
now succeeds on5e22b74. Entire CI/deploy/finalLiveQA still outstanding; do not
push55 or claim54live from this intermediate result. Public last verified53.

**1416 complete58 gameplay ACTIVE**, frozen6e85547, only owned local browser,
same project/ports/log below. All7 dungeon/inventory checks passed, including
Verdant ordinary encounters/firstboss/later spawns4.5m and Water recall/reentry;
shape/support areas/Spirit Guardians/Whirlwind passed, now phone combat. Still
not a full-chain pass. No source edits/restarts/second local browser while active.
Preserve final artifacts, verify scan/exact cleanup when terminal, then continue
remaining earned primary first-hour/full Earth/four-class story-readiness work.

Latest successful53CI measured independently from exact GitHub job timestamps:
first job04:46:47 to final live06:08:15 =81m28s. Predeploy48m25s,
browserstage13m17s, finalLive12m17s, deployments32/36s. Recorded in
`2026-09-09-release-pipeline-timing.md`; not an SLA or reason to weaken gates.
Whole roadmap active/unfulfilled; standalone recovery58 remains not live.

## Previous checkpoint — September 9, 06:55 UTC

Previous goal turn was PROGRESS: pushed corrected54 and carried ancestry;
current turn also PROGRESS: primary full client closed, production reward audits
completed, obsolete optional-daily diagnostic expectations corrected/committed.

**21409 primary full client/lint TERMINAL0**, exact4e9cad5/Node24.18.0:
266suites/3789tests/144.949s, logs
`/tmp/eidolon-primary-finalclock-full-{client,lint}.log`.
**16755 production progression audits TERMINAL0**, Go1.24.5/1.305s on4e9cad5;
log `/tmp/eidolon-primary-finalclock-progression-audits.log`. Each realm's
2000 seeded eight-fragment simulations: mean20.08 eligible ordinary kills,
p9026 (simulation, not actual travel/combat or four-realm acceptance).
Prepared four-boss+overlapping-daily reward accounting passed Normal/Heroic/
Mythic; duplicate claim rejection and combined dailyXP<=25%bossXP retained.
Excludes trash, rooms, story and sales; do not call it full-run income.

Primary now clean **d9cc0edecd8c96a15e6d0c630661c9714281312f**: optional
Skeleton/Imp diagnostic expected XP4250/18250 replaces obsolete50000/150000;
gold now exact100/200. Go content-budget test adds explicit Imp case. Production
rewards/legacy quotes/requirements/runtime/versions/scripts unchanged. Diagnostic
readiness explicitly labeled optional-daily comparison, never story-only proof.
Actual full Earth story-only/four-class route remains due; do not claim these
corrected expectations constitute a passing100-kill browser diagnostic.
68709 lint+61tests/3suites1.009s and16702 two Go budget tests/race1.038s passed.
Logs `/tmp/eidolon-primary-daily-diagnostics-{tests,lint,server}.log`.
Candidate documentation `docs/plans/2026-09-09-current-daily-diagnostics.md`.

**95459 PRIMARY FULL SERVER RACE ACTIVE**, exactd9cc0ed, Go1.24.5,
log `/tmp/eidolon-primary-current-daily-full-server.log`. Freeze primary until
terminal; no primary browser. **1416 complete58 gameplay ACTIVE**, frozen
6e85547, same isolated project/ports/log below, only owned local browser.
54CI34320477081 has client/server tests passed, all three browser shards
running. No55push until complete54CI/deploy/finalLiveQA+fresh exact identities.
Last verified live53;58 not live; whole roadmap remains active and unfulfilled.

## Previous checkpoint — September 9, 06:50 UTC

This goal continuation made PROGRESS: corrected54 pushed/new CI active, final
ancestry merged cleanly into55–58 and primary, fresh58 full client/lint passed.
**81287 TERMINAL0: 248suites/3490tests/125.305s plus lint** on frozen6e85547,
Node24.18.0. Logs `/tmp/eidolon-rest58-finalclock-full-{client,lint}.log`.
**1416 complete58 gameplay still ACTIVE** (same source/run/ports/log below),
only owned local browser; initial3authenticated tests passed56.5s and current
dungeon wall/beam/movement checks passing. This is not a full-chain pass.

Final-ancestry prepush client/version/clock regressions plus lint/diff all passed:
55/c5ce9dc handle40751: 275tests/4suites/4.987s;
56/9f41111 handle45349: 240tests/2suites/2.082s;
57/6babef5 handle24273: 241tests/2suites/1.994s.
Logs `/tmp/eidolon-release{55,56,57}-finalclock-{prepush,lint}.log`.
These do not replace their backend persistence evidence or release/live gates.

54CI34320477081 rechecked active: client job passed, server job running.
No55push yet; public last verified53. **21409 primary full client/lint ACTIVE** on
clean4e9cad5, logs `/tmp/eidolon-primary-finalclock-full-{client,lint}.log`.
No primary browser, source frozen until
terminal. Actual earned story-only readiness remains unproven.

## Previous checkpoint — September 9, 06:47 UTC

Previous status turn produced new evidence: public client/server still53/ce330b3,
and both owned54 corrections had passed. This continuation is PROGRESS:
54 correction committed/pushed and canonical ancestry carried forward.

**54 new CI34320477081 ACTIVE**, exact pushed/remote
`5e22b74701ecfca474132cf952c0d6725c25091b`; prior34317808528 remains failed.
89804 TERMINAL0: actual bundled Chromium CI-mode respawn passed1/1.4m;
renderer reported ANGLE/Vulkan SwiftShader. Screenshot viewed: no enclosing box.
37920 TERMINAL0: full240suites/3398tests/131.848s plus lint, explicit Node24.
Archive `/tmp/eidolon-release54-clock-proof-UqjXiD`; candidate closure in
`docs/plans/2026-09-09-respawn-fixture-clock.md`. No production clock change.
Before push: predecessor53 CI34312290353 terminal success; exact public client/
server53 at06:43, remote805ba0d. Push97873 terminal0; remote5e22b74 verified.
Do not push55 until new54 full CI/deploy/finalLiveQA and fresh public identities.

Clean merges carry the final54 test-only correction and ancestry through:

- 55 `/tmp/eidolon-release55-final54-UVV7t3`: c5ce9dc25a9554da55ef1e823e0d63ff04b6676d.
- 56 `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`: 9f41111133b4a9aaafa4d4c9a1674ec443a4652c.
- 57 `/tmp/eidolon-resource-persistence-c6E17J`: 6babef5fd131da38fd9a0b0360bc6cdee863dfee.
- 58 `/tmp/eidolon-standalone-town-recovery-QJ6Drv`: 6e855470ee01cd16d69fcc6cd2e005dbd3f4ba0f.
- Primary `/tmp/eidolon-primary-town-recovery-lAKY3k`: 4e9cad5a920040e9b55ef222e9429678e5886198
  (merged final57, not standalone58 metadata).

Each merge independently showed zero runtime/server/version/workflow/script
changes. All55–58 unpublished. Primary remains expanded-story work, not58.

**1416 complete58 gameplay ACTIVE — only owned local browser**, frozen6e85547,
explicit Node24 inside sg render. Run suffixrest58-all24-r3-0909-0650 (label;
actual start06:45), API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0650.log`. Exact ports were free before
start. Full chain unchanged, with corrected legacy gem expectation and native
rest/expiry/party stages retained. No edits/restarts/second local browser while
active. **81287 full58client/lint ACTIVE**, logs
`/tmp/eidolon-rest58-finalclock-full-{client,lint}.log`, same frozen source.
After terminal preserve artifacts, verify credential scan and exact cleanup;
do not claim a complete pass from intermediate stages.

Primary catalog audit confirms current Skeleton daily4250XP and Imp18250XP,
not the old50000/150000 quoted in optional fresh-hunt/fresh-ready diagnostics.
Those diagnostics are not the new story-only gate. Actual full Earth and
four-class story-only readiness remain required; no new primary browser run.

## Previous checkpoint — September 9, 06:38 UTC

**54CI34317808528 TERMINAL FAILURE** before deployment. Server/Client/browser1/2
passed; browser3 failed twice in respawn-appearance's0.6s stealth-expiry wait at
the120s total test deadline (timer0.2/0.35). All three respawn opacity/colorWrite
assertions passed before that wait. Deploy/predeploy/finalLiveQA were skipped;
production remains last-verified53. Original job102359036241 log
`/tmp/eidolon-release54-browser3-failure.log`; downloaded original screenshots/
videos/traces in `/tmp/eidolon-release54-browser3-proof-OtLhz9`. Failed screenshot
was viewed and showed no enclosing cube. Do not claim the failed run passed.

Source fixture discarded elapsed time with Math.min(.05, frameDelta). A prepared
visual-clock helper reproduced6fail/3pass39186; fixed249tests/4suites1.726s plus
lint5203, including real ActorStealthAppearance and version/sharding. The helper
consumes elapsed time in <=.05s actor substeps, settles time before button actions,
and ignores duplicate/backward RAF timestamps without rewinding the clock. It
does not change any production timer or extend120s/relax the invisible-box checks.

Canonical54 `/tmp/eidolon-release54-final53-oZ3nK4` has owned UNCOMMITTED QA-only
changes (respawn spec, new visualLifecycleClock.js and its tests). Freeze while
**89804 bundled-Chromium CI-mode respawn browser ACTIVE — only owned browser**,
web41960, log`/tmp/eidolon-release54-respawn-software-browser.log`, and **37920
full54client/lint ACTIVE**, log`/tmp/eidolon-release54-visual-clock-full-client.log`.
Both explicit Node24.18.0. Validate actual renderer output before claiming a
software-rendering result. Do not edit/restart/launch another browser while active.
After terminal evidence/cleanup and checks, commit/resubmit failed54 normally,
then carry its final ancestry through55–58/primary. Never push root or skip55gate.

Standalone58 **97572 focused legacy gem recovery TERMINAL0/PASS1/13.3s**
(test11.7s) on7f066a4: base10/rested11, full-bag rejection, legal sword equip,
exact18+5=23, rejected loose-gem equip, actual saved Mongo and reconnect all pass.
Scan0/exact container/image absence. Log`/tmp/eidolon-rest58-gem-rest-browser-0630.log`,
result metadata archive`/tmp/eidolon-rest58-gem24-proof-wjeDn3/test-results`.
No58process/browser active now. Complete58 gameplay still needs a fresh full
rerun after this correction; prior complete failure12130 remains retained.

Primary now **e9c837602d3583ce3cfc94577b47256834f26986**, clean cherry-pick of
gem QA correction after full76262 closed. Runtime unchanged; prior265/3780
full pass is exact01eef1d evidence. Story-only readiness still required before
coordinated activation, not proven by first40-hunt passes. Production catalog
audit26771 TERMINAL0 under Go1.24.5, log
`/tmp/eidolon-primary-story-quest-budget-audit.log`: current Seed chapter1200XP,
first Watch1593, Walking Ink6843, Borrowed Oath15843. Do not use legacy50000/
150000 daily quotes as current-budget acceptance. No new primary gameplay run.

Whole roadmap remains active/unfulfilled. Both the temporary CI failure and
ordinary local test corrections admit concrete next actions; not a blocked goal.

## Previous checkpoint — September 9, 06:30 UTC

Previous goal turn was PROGRESS: verified live53 after complete CI, pushed54,
fixed/verified two QA pointer observations, and started the exact58 full run.

**12130 complete58 gameplay TERMINAL1** on a7ef83c: initial3authenticated,
seven dungeon/inventory routes, area/shape casts and phone movement/combat/party/
inventory passed, then legacy gem recovery failed its old Intelligence10 check
because earned Well Rested correctly produced11 in town. It is a failed full run,
not acceptance. Scan0/exact temporary containers/image absence confirmed; original
log`/tmp/eidolon-rest58-all-node24-rerun-0610.log`, failure archive
`/tmp/eidolon-rest58-gem-rest-failure-e5EF2M/test-results`.

QA-only fix **7f066a4768d8695d4a696db7edf2c8e602fa664b** in standalone58 asserts
base Intelligence10, rested total11, positive earned bank and Lanternhold both
before recovery and after reconnect. Unsupported gem's+999 remains invalid;
full-bag rejection, legal equip, exact18+5=23, actual Mongo save and reconnect
checks unchanged. Lint20494 terminal0 and diff pass, no production change.
**97572 focused actual equipment-recovery ACTIVE — only owned local browser**,
same source, Node24.18.0, projectrest58-gem24-0909-0630,
API18560/Mongo18561/web41960; log`/tmp/eidolon-rest58-gem-rest-browser-0630.log`.
After terminal archive/exact cleanup, resume complete58 gameplay; do not edit
the active candidate or start another local browser meanwhile.

Parallel main-goal progress: primary **01eef1dc8285223a26f8b50a604deacb26749c18**
adds a story-only readiness gate. Old fresh-ready diagnostics use daily contracts
and obsolete quoted rewards; they cannot prove the optional-daily requirement.
The stronger release stage runs the whole existing Earth route, requires all7
pre-dungeon chapters manually complete, no accepted/completed daily, actually
earned level30 and Normal30 Guide entry enabled, with raid access still sealed.
It fails an underlevel authored route instead of filling it with a legacy daily.
Same35 stage positions; the collection slot calls the stronger wrapper. All35
failure positions retain status/scan/EXIT tests; four actual shell-wrapper tests
verify class/mode flags and propagated19. Existing focused diagnostics remain
available but are not current readiness acceptance.

Primary93563 PASS326tests1.995s; final27802 PASS330/5suites2.538s/lint/shell/diff.
Full76262 **TERMINAL0/PASS265suites3780tests116.667s plus lint**, Node24.18.0,
frozen01eef1d. Logs`/tmp/eidolon-primary-story-readiness-{final-tests,final-lint,full-client,full-lint}.log`.
Actual full Earth/readiness still unverified: older Wizard/Fighter runs proved
only opening/diary/first40-hunt. New source does not make the campaign balanced
or live. Primary production gameplay/rewards unchanged by this gate.

54CI34317808528 remains active; Server/Client and browser2 passed, browser1/3
still running at06:25. Do not push55 until complete54CI/finalLiveQA and exact
public identities. Last verified live53. Full roadmap remains active/unfulfilled.

## Previous checkpoint — September 9, 06:14 UTC

PROGRESS: **33950 full58 client/lint TERMINAL0** on frozen
a7ef83c287d828af51f68ee4d32821d00b45a015/Node24.18.0:
247suites/3481tests/121.961s plus lint. Full output retained in
`/tmp/eidolon-rest58-loot-observation-full-client.log` and corresponding-lint.
Independent git diff confirms no production src/server/index/package/release/
workflow/script change from the four-class/native-tested5a17be1; the two newer
commits only correct QA observations and document evidence. Clean candidate.

**12130 complete58 gameplay remains ACTIVE — only owned local process/browser**,
same frozena7ef83c, projectrest58-all24-r2-0909-0610,
API18560/Mongo18561/web41960. All3 initial authenticated tests PASS55.3s,
including actual manual item quantity0→1 persisted across reconnect (this run
selected the originally intended drop), real portal/reentry/jump-Recall. The
seven-test dungeon batch has passed Scorch Beam48.4s and three ground-spell
wall/reachable-floor placements15.9s. Log
`/tmp/eidolon-rest58-all-node24-rerun-0610.log`. This is not a complete-route pass.
Poll exact handle; no edit/restart/second local browser while active. Archive
evidence and independently verify exact cleanup after terminal, preserve failures.

Primary42a6082 focused70815 TERMINAL0:258tests/4suites/2.474s plus lint/diff;
logs`/tmp/eidolon-primary-loot-observation-{tests,lint}.log`. No primary process
remains active. Its prior full3731 run remains older-source evidence; a future
full regression must include both new observer test suites. Expanded story/
balance/timing still preserved and required, no new runtime change frome1c4132.

54CI34317808528 ACTIVE at06:13 on805ba0d: Client Tests PASS, Server Tests running.
Live53 was independently verified after complete53CI at06:08. No55push until
entire54CI/deployment/finalLiveQA and fresh public identities. Canonical55–57
unchanged. Root ledger commits must never be pushed. Recovery58notlive; entire
roadmap remains active/unfulfilled, not blocked.

## Previous checkpoint — September 9, 06:11 UTC

PROGRESS: **53CI34312290353 TERMINAL SUCCESS**, all10jobs including finalLiveQA.
Independent06:08 public manifest, login53, loaded main.js release query and
healthy/database-ready server all matchedce330b3e2a576d07d159b964563f12f031dff3d5.
Only then canonical54/805ba0daf14f34cd59097a9b14efaa6a3d7b5c91 was pushed from
`/tmp/eidolon-release54-final53-oZ3nK4`;34782 terminal0, remote/master independently
matched805. Clean worktree, ce330 ancestry, diff and earlier supported24 preflight
252tests/4.063s revalidated. **54CI34317808528 ACTIVE**. Do not push55 until all54
CI/deployment/finalLiveQA and fresh exact public identities. Root is ledger only.

58's first complete route57389 TERMINAL1: two authenticated tests passed, third
clicked InfernoTitan rather than the entrance. Source showed a stale-hover test
gap when new pointer sampling was deferred. Four-failure/two-pass deterministic
baseline reproduced it; QA-only51c9bf7 requires completed on-canvas sampling,
retains15s deadline/real click/portal assertions and logs mismatches. No runtime
priority changes. Supported full12405 PASS246/3472/136.825s plus lint; actual
focused portal97047 PASS1/20.1s, real reentry/jump-Recall included, scan0/exact
cleanup. Original failed evidence remains retained.

Full rerun92856 TERMINAL1 failed a different manual-loot assertion: two drops
shared the ray and the helper insisted on the covered drop. Login/portal passed.
QA-onlya7ef83c explicit general-pickup opt-in follows the actual active front
drop only in that same ray stack, preserving strict specific-item defaults and
actual selected-item quantity/reconnect receipts. Six-failure/three-pass baseline;
22244 corrected26tests/3suites/1.112s/lint;62614 actual geometry/input2tests/8.3s
retains hostile priority and proves coincident-front selection. No server-pickup
claim from that fixture. All failure logs/artifacts and exact cleanup are in
[58 acceptance](2026-09-09-town-recovery-release-acceptance.md).

**33950 full client/lint ACTIVE**, frozen58/a7ef83c287d828af51f68ee4d32821d00b45a015,
log`/tmp/eidolon-rest58-loot-observation-full-client.log` and corresponding-lint.
**12130 complete58 gameplay ACTIVE — only owned local browser**, same source,
Node24.18.0 inside sg, projectrest58-all24-r2-0909-0610,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0610.log`. No edits/restarts/second browser
while active. Poll exact handles; retain artifacts and independently verify exact
cleanup after terminal. The earlier four-class/native passes remain exact5a17be1
evidence; production runtime and metadata have not changed since that source.

Both QA corrections also cleanly cherry-picked into primary expanded-story
candidate, now42a60824219a4607b8b902c52580d9d6dcb44159 (via5d84838), no production
change. First primary focused93686 PASS249tests/3suites/3.197s and lint; latest
loot-inclusive focused check active, log`/tmp/eidolon-primary-loot-observation-tests.log`.
Expanded story/balance/timing remain intact and unpublished. Whole roadmap goal
is active, not complete or blocked. Current live53; recovery58notdelivered.

## Previous checkpoint — September 9, 05:55 UTC

PROGRESS: all four58 ordinary earned-class routes now pass on frozen5a17be1
under explicit Node24.18.0. Rogue34088 TERMINAL0/PASS1/4.2m: opening38s,
collection212s/23observed target deaths/8seeds/zero player deaths. Three normal
full-pool town stops63.975s including travel; actual15mana Rogue cost. Manual
8000XP100gold, level8→17,10gear items/360unsold value/17bag slots retained across
reconnect; level30 dungeon still locked. Preclaim656gold. Scan0/exact cleanup
confirmed, 8/8 ready screenshot inspected. Archive
`/tmp/eidolon-rest58-rogue24-proof-mvJ29A/test-results`; log
`/tmp/eidolon-rest58-rogue-node24-0545.log`.

Native32952 TERMINAL143 after passing expiry37.3s, not a complete pass. Original
log and scanned partial captures retained; orphan web process248702's candidate
cwd/start/ancestry were verified before stopping only it, then exact disposable
API/Mongo/volume/image cleaned. Process family/port/resources confirmed absent.
No matching OOM event found in accessible kernel log; cause still unknown. No
CI/production/unrelated workload altered. Details and archives in new
[58 acceptance evidence](2026-09-09-town-recovery-release-acceptance.md).

Unchanged native repeat81669 TERMINAL0: expiry36.3s and journey31.0s (2tests1.1m),
party24.1s (1test25.9s). Actual Wizard42damage/30mana hit, Recall/rejoin recovery,
natural14.617s→0 expiry removes stats/icon/aura, ordinary reentry restores them.
Real two-player party/native joystick, High19/Low10visible aura parts each.
Scan0/exact cleanup; both output folders archived at
`/tmp/eidolon-rest58-native24-proof-n1IyTo/`; selected desktop/portrait/short-
landscape captures inspected. One desktop capture16FPS is not sustained
performance approval; physical phones/performance remain open. Log
`/tmp/eidolon-rest58-native-node24-rerun-0552.log`.

**57389 complete58 isolated gameplay ACTIVE — only owned local process/browser**,
frozen5a17be147ce527bae556663cc452ecae10e87785, Node24.18.0,
projectrest58-all24-0909-0554/API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-0554.log`. Full inherited command chain plus rest,
not reduced coverage. Poll exact handle; no source edit/restart/second browser
while active. Preserve evidence and independently verify cleanup after terminal.

53CI34312290353 remains active in full predeploy gameplay (latest05:53 check).
Current last verified live52. No54push until all53CI/deployment/finalLiveQA and
fresh exact public identities. Root commits are ledger only, never push root.
Standalone58 not delivered; primary expanded story/balance still preserved at
e1c4132; entire roadmap goal remains active, neither complete nor blocked.

## Previous checkpoint — September 9, 05:44 UTC

Previous goal turn was a verified wait: exact53CI and Fighter58871 were polled;
fresh public client/server identities both remained52/a36d1e7 at05:42.

PROGRESS: Fighter58871 is now terminal: complete wrapper log reports PASS1/6.7m,
credential scan0 and normal cleanup. The old handle is missing; exact owned
containers/image are absent, not a reason to restart. Frozen58/5a17be1 with
Node24.18.0: opening110s/zero deaths; collection289s/17observed target deaths,
8earned seeds/zero player deaths. Four normal town stops86.038s including travel,
all full pools; first HP162/200 and MP1/160 recovered to rested220/220 and176/176.
Manual8000XP100gold produced level17; reconnect and locked level30 dungeon passed.
Six earned gear items/90unsold value/9occupied slots, preclaim426gold. This is
unchanged legacy reward evidence, NOT a completed balance pass. The 8/8 ready
claim image was inspected and all artifacts archived before another run:
`/tmp/eidolon-rest58-fighter24-proof-h4p5PS/test-results`. Log
`/tmp/eidolon-rest58-fighter-node24-0535.log` retains the complete result.

**34088 Rogue Node24 ACTIVE**, only owned local browser/process; frozen5a17be1,
projectrest58-rogue24-0909-0545 (suffix is an identifier, not actual start time),
API18560/Mongo18561/web41960. Log
`/tmp/eidolon-rest58-rogue-node24-0545.log`; ordinary opening has reached two
kills/zero deaths. After terminal, archive/inspect/exact cleanup then run native
well-rested-all24 on this unchanged candidate. No source edits during the run.

53CI34312290353 remains active in full predeploy gameplay. No successor push
before whole53CI/final live QA plus fresh exact public identities. Standalone58
remains unpublished; expanded story/balance and the full roadmap remain required.

## Previous checkpoint — September 9, 05:36 UTC

PROGRESS: **69597 unchanged Wizard Node24 repeat TERMINAL PASS1/4.7m** on
5a17be147ce527bae556663cc452ecae10e87785. Opening68s/3retreats/zero deaths,
collection213s/19observed target deaths/8earned seeds/zero deaths; manual
8000XP100gold, level7→17,9gear items/230unsold value retained across reconnect,
level30 dungeon still locked. Four normal town recoveries83.664s including
travel, all observed stops full pools. Preclaim462gold/17occupied bag slots.
Final console/network assertion passed without filtering, weakening or changed
input policy. Scan0 and exact owned container/image absence confirmed. Ready-
claim8/8 capture inspected; archive
`/tmp/eidolon-rest58-wizard24-proof-c7jLU7/test-results`, log
`/tmp/eidolon-rest58-wizard-node24-rerun-0528.log`. Preserve failed97055 and its
archive as separate evidence; this repeat does not establish the earlier cause.

Network monitor captured214lines of virtual-interface/link/route activity during
the passing repeat, including interface creation on two bridges around05:30.
Exact bridge IDs resolve to unrelated `seo-tool_backend`/`seo-tool_renderer`
networks. Their workloads/configuration were NOT inspected beyond network-name
resolution and NOT changed/stopped. This is a concrete environmental lead, not
proof that those events caused the earlier failure; that window had no monitor.
Docker's queried network event history was empty despite observed netlink events.
Keep `/tmp/eidolon-rest58-network-watch-0528.log` for the evidence distinction.

**32071 monitor TERMINAL143**, intentionally stopped after browser completion.
Ctrl-C did not end it; exact process names/start times/parent were revalidated
(timeout76214/ip76215, both started05:28:08), then SIGTERM sent only to owned
ip76215. Handle closed and exact process-pattern absence confirmed. No lingering
monitor or owned regression process remains.

**58871 Fighter Node24 repeat ACTIVE — only owned local process/browser**,
same frozen5a17be1, fresh-collection, projectrest58-fighter24-0909-0535,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-fighter-node24-0535.log`. Baseline/first kill41s at05:36,
no completed collection result yet. Poll exact handle; no edits/restart/cleanup
while active. After terminal archive/review/exact cleanup, complete Rogue24 and
native rest/expiry/party24, retaining the original supplementary evidence.

53CI34312290353 remains ACTIVE in full disposable gameplay at05:35. Do not
push54 before all53CI/finalLiveQA and fresh public identities. Last verified
live52; standalone58notpublished. Whole roadmap goal remains active/unfulfilled.

## Previous checkpoint — September 9, 05:30 UTC

PROGRESS: **97055 Wizard Node24 repeat TERMINAL FAILED** after complete earned
gameplay:23observed deaths/8seeds/zero player deaths, manual8000XP100gold,
collection244s/level17/dungeon30gate/reconnect all reached. Final unchanged
console/network assertion failed on numerous localhost module requests reporting
`net::ERR_NETWORK_CHANGED`. Do not call the entire route passed or ignore those
errors. Credential scan0, exact owned containers/image absent; archive
`/tmp/eidolon-rest58-wizard-network-proof-8YseTj/test-results`, original log
`/tmp/eidolon-rest58-wizard-node24-0521.log` includes failure context and URLs.

Read-only Docker network events0520–0526 returned no entries. Runtime services
already use host networking; cause of Chrome's notification remains unconfirmed.
No network/workflow/runner mutation or assertion filtering was performed.
**69597 unchanged Wizard Node24 repeat ACTIVE**, same frozen5a17be1, fresh
projectrest58-wiz24-r1-0528/API18560/Mongo18561/web41960, log
`/tmp/eidolon-rest58-wizard-node24-rerun-0528.log`. Opening68s/manual500XP100gold,
three retreats/zero deaths at05:29. Poll exact handle, no edits/restarts/cleanup.

**32071 read-only network monitor ACTIVE**, owned TTY running
`timeout 600s ip -ts monitor link address route`, log
`/tmp/eidolon-rest58-network-watch-0528.log` (zero lines at05:29). Monitor only;
does not reconfigure interfaces or alter browser behavior. Stop this exact owned
monitor with Ctrl-C after the browser finishes, or collect its normal600s timeout;
do not leave it running indefinitely. One browser and this monitor are the only
owned local processes. Preserve both logs and all failed evidence. No whole-goal
impasse; do not mark blocked for an expected CI wait or this investigable failure.

Additional supported preflights on clean canonical56/57:56/92386 PASS231version
tests2.216s;57/37743 PASS232version tests1.974s, Node24.18.0. Go56/21018 PASS
future-version rejection unit1.043s and57/4145 PASS3resource snapshot/validation/
max-clamping tests1.108s (four-class/three-level/five-cycle BSON coverage). No
skips in these selected tests. They do not replace the separate actual Mongo/
old-writer/crash acceptance documented earlier. Logs
`/tmp/eidolon-release56-prepush-{node24,schema}.log` and
`/tmp/eidolon-release57-prepush-{node24,resources}.log`. No queued source changed.

53CI34312290353 still ACTIVE in full disposable character gameplay at05:29.
Do not publish54 until whole53CI/finalLiveQA and fresh public identities pass.
Last verified live52; rest58candidate not live. Entire roadmap scope remains open.

## Previous checkpoint — September 9, 05:21 UTC

PROGRESS: supported **Node24.18.0** reruns completed: standalone58/57780
TERMINAL PASS245suites3466tests187.057s plus lint, exact frozen5a17be1; primary/
3409 TERMINAL PASS262suites3731tests200.053s plus lint, cleane1c4132 (runtime96a).
Logs `/tmp/eidolon-rest58-node24-{full-client,lint}.log` and
`/tmp/eidolon-primary-node24-{full-client,lint}.log`. These supersede the recent
Node18 runs for supported-toolchain acceptance; no source/assertions changed.
No owned full regression remains active. Go1.24.5 full75384 already passed.

**21402 Cleric TERMINAL PASS1/3.7m** on frozen5a17be1 with Node24.18.0 printed
in its log. Opening45s/manual500XP100gold, collection174s/20observed target
deaths/8earned seeds/zero player deaths. Two full-pool town recoveries39.157s
including travel, actual Cleric40mana primary cost. Manual8000XP100gold consumed
8seeds, level7→17,4gear items/170unsold value retained across reconnect; locked
level30 dungeon remained locked. Preclaim522gold/8occupied bag slots. Credential
scan0, exact owned containers/image absent, ready-claim8/8 image inspected.
Archive `/tmp/eidolon-rest58-cleric-proof-TKN8ET/test-results`, log
`/tmp/eidolon-rest58-cleric-collection-0515.log`. Other classes have passed real
Chrome/Go gameplay with Node18 controllers; do not relabel those as24 evidence.

**97055 Wizard Node24 repeat ACTIVE — only owned local process/browser**,
same5a17be1, fresh-collection, projectrest58-wizard24-0909-0521,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-wizard-node24-0521.log`. Prefix the Node24toolcache inside
sg render as above, and preserve the logged runtime. No grants/changed limits,
no source edits. Poll this exact handle; archive/review/exact-cleanup after
terminal, then repeat Fighter/Rogue and real-rest routes under24 for a consistent
supported-controller evidence set. Preserve original runs as supplementary data.

53CI34312290353 remains ACTIVE in full disposable gameplay; last inspected
05:19. Do not push54 before whole53CI/finalLiveQA and independent matching public
identities. Last fully verified live52; standalone58notpublished. Primary story
and all later roadmap requirements remain active, not dropped by the release split.

## Previous checkpoint — September 9, 05:18 UTC

PROGRESS: **35080 Rogue TERMINAL PASS1/3.2m**, standalone58frozen5a17be1.
Opening36s/manual500XP100gold, collection155s/20observed target deaths/8earned
seeds/zero deaths. Two normal town recoveries43.918s total including travel,
both pools full; correct Rogue15mana primary cost. Manual8000XP100gold consumed
8seeds, level7→17,9gear items/290unsold value retained across reconnect; dungeon
entry still correctly locked below30. Scan0, exact owned containers/image absent.
Ready-claim8/8 image inspected; archive
`/tmp/eidolon-rest58-rogue-proof-AQt3Ql/test-results`, log
`/tmp/eidolon-rest58-rogue-collection-0510.log`. A read-only summary parser had
an incorrect prefix-length literal; rerunning with prefix.length confirmed
preclaimgold461/9gear/290value/12slots. No gameplay rerun or source change.

Toolchain audit discovered that these recent local JS/Playwright invocations
used the login-shell Node18 default. Preserve their actual Chrome/Go gameplay
evidence, but do not label them Node24 acceptance. Reinstated the explicit existing
Node24.18.0 toolcache prefix above. No global installation or active test changed.
Go75384 result stands: verified go1.24.5 inside the actual server module.

**21402 Cleric ACTIVE — sole owned local browser**, frozen5a17be1 with explicit
Node24.18.0 recorded in log. fresh-collection, projectrest58-cleric-0909-0515,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-cleric-collection-0515.log`. Opening45s/zero deaths,5/8seeds
at05:17. Poll exact handle; no edits/restart/cleanup until terminal. Supported
Node24 repeats of the earlier class/recovery routes remain appropriate before
calling their controller/toolchain acceptance complete; retain original evidence.

**57780 standalone58 Node24 fullclient/lint ACTIVE**, same5a17be1, logs
`/tmp/eidolon-rest58-node24-{full-client,lint}.log`. **3409 primary Node24
fullclient/lint ACTIVE**, cleane1c4132 (production96a2236), logs
`/tmp/eidolon-primary-node24-{full-client,lint}.log`. These are the only other
owned local processes. Poll exact handles, no source edits while testing.

Supported Node24 preflights already pass:54/69531 PASS252tests4.063s and
55/33471 PASS266tests5.869s, logs `/tmp/eidolon-release{54,55}-prepush-node24.log`.
Canonical54/55 remain clean/unchanged. Earlier55/18839 passed266tests8.432s
under18 and is supplementary, not the supported-runtime result.
**53CI34312290353 ACTIVE**, full disposable character gameplay at05:17.
Do not push54 before all53CI/finalLiveQA and fresh public identities pass.
Last verified live52; recovery58NOTpublished. Full roadmap goal remains active.

## Previous checkpoint — September 9, 05:10 UTC

PROGRESS: **28852 Fighter TERMINAL PASS1/5.4m** on unchanged standalone58
5a17be147ce527bae556663cc452ecae10e87785. Opening91s/manual500XP100gold,
collection226s/17observed target deaths/8earned seeds/zero deaths. Three actual
town stops totaled65.460s including travel and restored both pools. First stop:
HP184/200 andMP21/160 outside→220/220HP and176/176MP in rested town, correct
Fighter20mana primary cost, real elapsed bank accrued and normal departure.
Manual8000XP100gold consumed8seeds, level7→17,7earned gear items/360unsold
vendor value survived reconnect, level30 dungeon gate remained locked. As with
Wizard, legacy rewards are explicitly not accepted as the finished balance pass.
Credential scan0, exact owned containers/image absent, ready-claim8/8 image
inspected. Archive `/tmp/eidolon-rest58-fighter-proof-LuU7Gn/test-results`, log
`/tmp/eidolon-rest58-fighter-collection-0503.log`. Two classes' full collection
routes now pass; this is not all-class/full-campaign or physical-device proof.

**35080 Rogue ACTIVE — only owned local browser/process**, same frozen5a17be1,
fresh-collection, EIDOLON_E2E_FRESH_CLASS=Rogue, projectrest58-rogue-0909-0510,
API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-rogue-collection-0510.log`. Poll the exact handle; do not
restart, edit the active candidate/runtime or clean its resources while live.
After terminal archive/review/exact-cleanup checks, continue Cleric. No owned
full regression remains active; their completed results stand as below.

Canonical54 prepush65184 PASS3suites252tests2.978s (VersionPresentation,
BasicAttackDamage, BrowserSmokeSharding); clean805ba0d remains unchanged and
descends from53ce330b3. Log `/tmp/eidolon-release54-prepush-checks.log`.
**53CI34312290353 ACTIVE**: all3browser shards passed; predeploy character QA
is running its deterministic High/Low gallery at05:09. Still no54push until
whole53CI/finalLiveQA and fresh public identities pass. Last verified live52.
Root ledger-only; whole roadmap goal remains active and unfulfilled.

## Previous checkpoint — September 9, 05:03 UTC

PROGRESS: standalone58 full **75384 Go race TERMINAL PASS** (root23.243s,
game327.779s) and **93155 client TERMINAL PASS245suites3466tests165.48s**, frozen
5a17be147ce527bae556663cc452ecae10e87785. Logs
`/tmp/eidolon-rest58-full-{server,client}.log`. These are current-source full
regressions, not replacements for live/class/physical-device acceptance.

**20280 Wizard normal collection TERMINAL PASS1/4.8m**, same5a17be1, actual
fresh registration/opening3kills/manual500XP100gold in36s, no grants. Collection
24observed target deaths/8earned seeds/zero player deaths, completed247s; manual
8000XP100gold retained existing level7→17 outcome and consumed8seeds. Five
ordinary town recoveries totaled99.724s including travel; every observed stop
restored both pools. First mana28→176, bank accrued inside and normal departure
resumed the hunt.5earned gear items/140unsold vendor value survived reconnect,
and level30 dungeon entry remained locked for the resulting17character.
The large existing reward remains a known balancing issue, not a reason to claim
balancing done or silently activate curve2 inside the recovery-only release.

Credential scan0, exact owned containers/image absent, ready-claim image inspected
(8/8,8000XP100gold, explicit Complete Quest). Archive
`/tmp/eidolon-rest58-wizard-proof-sp9Lku/test-results`; log
`/tmp/eidolon-rest58-wizard-collection-0457.log`. This is one class's collection
proof, not four-class/full-campaign acceptance. Both whole regressions are closed.

**28852 Fighter ACTIVE — only owned local process/browser**, fresh-collection
on frozen5a17be1, projectrest58-fighter-0909-0503/API18560/Mongo18561/web41960,
log `/tmp/eidolon-rest58-fighter-collection-0503.log`. Uses
EIDOLON_E2E_FRESH_CLASS=Fighter (the wrapper's actual collection-class selector),
normal recovery/no grants and unchanged bounds. Poll exact handle; no edits to
active candidate/runtime or restart/cleanup while running. After terminal,
archive/inspect/verify exact cleanup before Rogue then Cleric on the same source.

**53CI34312290353 ACTIVE**: initial client/server and browser shards2/3passed;
shard1 still running at05:03. Do not push54 before all53CI/finalLiveQA and fresh
public identity checks. Last fully accepted live release is52. Roadmap explicitly
records recovery58 as standalone without dropping later story/balancing work.
Root ledger-only, never push it. Full roadmap goal remains active.

## Previous checkpoint — September 9, 04:55 UTC

PROGRESS: standalone58 now clean **5a17be147ce527bae556663cc452ecae10e87785** in
`/tmp/eidolon-standalone-town-recovery-QJ6Drv`. First23579 native route passed
all3checks on1929d91, but its second CLI invocation replaced the first passing
journey/expiry screenshots. Retained functional logs, archived available party
images `/tmp/eidolon-rest58-first-proof-wCdgJI/test-results`, inspected portrait
High aura/buff text, independently verified exact owned containers/image absent.
Do not claim visual review of the overwritten first-run journey screenshots.

After23579 terminal, corrected output retention only: distinct
`test-results/well-rested-journey` and `test-results/well-rested-party` directories.
Focused83263 PASS234tests1.834s/lint/shell/diff; no gameplay assertions changed.
New **57869 TERMINAL PASS** on5a17be1: expiry36.6s, ordinary travel/combat/Recall/
reconnect30.5s (firstCLI2tests1.2m), native two-player phone party18.5s (21.1sCLI).
Rest14.686562s→0 outside, strength11→10/maxima110→100/aura removed; ordinary
Recall rebuilt1.684826s/strength11/maxima110/aura. Actual combat damage receipt
and30mana use observed (not every attempted projectile is claimed as a hit).
High19/Low10 visible aura parts on both party members, native joystick movement.
Credential scan0 and exact owned containers/image absence independently verified.

Only this run's two output subfolders archived at
`/tmp/eidolon-rest58-retained-proof-2P0A1G/{well-rested-journey,well-rested-party}`;
older top-level party artifacts were not relabelled. Inspected expiry, re-earned,
rejoined desktop and landscape Low phone buff captures: readable explanation,
golden ground aura, no enclosing cube. A rejoin screenshot has23FPS during
concurrent Go regression; these snapshots are not a sustained performance or
physical-phone approval. Log `/tmp/eidolon-rest58-real-rest-0452.log`.

**75384 full Go race ACTIVE** on frozen5a17be1, log
`/tmp/eidolon-rest58-full-server.log`; root passed23.243s, game package still
pending. **93155 full client ACTIVE**, log `/tmp/eidolon-rest58-full-client.log`.
Poll exact handles; do not restart/edit tested source. No owned local browser
currently running. Next run normal full collection across classes on this same
standalone feature baseline, preserving bounds/manual rewards and honest legacy
reward disclosure. Broader story/balance candidate remains preserved in primary.

**53CI34312290353 ACTIVE**: client and server passed, all3browser shards running
at04:54.52 remains the last verified live release. Do not push54 until whole53
CI/final live gate and fresh public identities pass. Root ledger-only; goal active.

## Previous checkpoint — September 9, 04:48 UTC

PROGRESS: **52CI34305897736 TERMINAL SUCCESS**, including full final live QA.
Independent04:45 public manifest/backend/login/versioned main all matched
a36d1e7d66333e8f6cf707ff115947b340c9a46c / Alpha1.0.52, backend healthOK/DBready.
Only then pushed canonical53 **ce330b3e2a576d07d159b964563f12f031dff3d5** from
its clean release worktree after predecessor/ancestry/remote checks. Push20414
completed and independent remote/master matched53. **53CI34312290353 ACTIVE**.
Do not push54 before complete53CI/finalQA and fresh exact public identity checks.
The cancelled34307306192 soak remains cancelled, not passed; no scheduling change.

Primary full95095 TERMINAL FAIL169.494s:261suites/3730tests passed, one old
VersionPresentation assertion expected the original inline nameplate command.
Its required route was retained and independently covered by the35-stage harness.
Corrected assertion only; focused54306 PASS269tests3.027s/lint/diff. Committed
**96a2236**; corrected40749 fullclient PASS262suites3731tests180.151s. Original
and corrected logs `/tmp/eidolon-primary-timing-full-client{,-fixed}.log`.
All primary local handles terminal. Story/campaign work remains required there.

Prepared standalone **Alpha1.0.58 candidate** to avoid making the essential town
recovery feature wait for the expanded story/reward rollout. Existing badd0cf
production implementation retained, canonical57 ancestry verified. New worktree
`/tmp/eidolon-standalone-town-recovery-QJ6Drv`, branch
`work/standalone-town-recovery-20260909`, clean
**1929d912bbf7125303076553a3114fbc00d8c747**. Main production changes after badd
are version metadata only; copy the read-only class-aware normal-rest QA policy,
retain explicit no-rest diagnostic, and add isolated real-rest/expiry/phone-party
routes after all previous full-gate commands. No expanded hunts/sites or curve2
activation; balancing remains a later coordinated release, not declared done.
All58login/package/manifest/backend/deploy versions and honest player notes are
synchronized;58is a candidate, NOT published. Existing history is intact.

Standalone policy36436 PASS36tests1.352s; version80525 PASS257tests2.787s;
final gate46459 PASS261tests2.197s, lint/shell/diff pass. Logs
`/tmp/eidolon-standalone-rest-*`; candidate contract
`docs/plans/2026-09-09-standalone-town-recovery.md`. Prior archived badd/d650 rest
evidence remains historical; full current-source regression and actual class
progression/real-rest verification still required before ordered58publication.

**23579 ACTIVE — only owned local browser project**, well-rested-all on frozen
1929d91, projectrest58-0909-0448/API18560/Mongo18561/web41960. Log
`/tmp/eidolon-rest58-real-rest-0448.log`; poll exact handle, no editing that
candidate's executing files/restarting/cleanup while live. Mainprimary has no
owned process running. After terminal, archive artifacts/inspect images/verify
exact owned-container/image absence; then full58client/Go race and class routes.
Root ledger-only; do not push. Whole roadmap goal active, no completion claim.

## Previous checkpoint — September 9, 04:35 UTC

PROGRESS: user explicitly approved cancelling the blocking soak. Revalidated exact
Nightly Multiplayer Soak34307306192 on a36d1e7 before cancellation; GitHub now
reports TERMINAL CANCELLED (not a passed24h soak). No schedule, runner or release
workflow was changed. **52CI34305897736 final live QA is now IN_PROGRESS**;
matching-release check passed and live anonymous/persistent-character QA is
running. Do not push53 until the entire final live gate passes and public
identities are independently rechecked. Remote/master remains exacta36d1e7.
The player's missing town healing/rest report was verified against live52:
the feature is absent from that deployed source, not a confirmed account bug.
Do not tell the player it is live or suggest relogging as its fix.

Fighter62895 TERMINAL PASS1/25.5m on original cleanf3f33e1 (gameplaydb3bbb7).
Opening105s/diary141s cumulative, Watch40/40 at1370s, manual claim/save1388s.
One counted death,17normal town stops totaling380.361s including travel, all
observed stops fully restored both pools. Claim1593XP/100gold: level6/301XP/
1566gold→level8/169XP/1666gold;17slots/560unsold gear value retained. Final
town reconnect HP302→302/MP189→203 is ongoing healing, not exact-zero save proof.
Console/network/credential scan passed. Exact owned containers/image absent.
Ready-claim screenshot inspected; archived before further browsers at
`/tmp/eidolon-primary-fighter-proof-TsBql3/test-results`; original log
`/tmp/eidolon-primary-fighter-story-0402.log`. Wizard and Fighter first-hunt passes
do not close all classes, full Earth, later realms or broader balancing.

After Fighter ended, wired35 safe timing stages into the existing full QA chain
on primary, clean **8b6b1d34d704fd3d1ce716c5fb6d8ee730010878**. Every prior command
and argument retained. New shell harness executes actual chain/final-scan logic
with harmless stubs, verifies complete command order and every35 failure position
preserving status/scan/EXIT-hook execution. Focused64142 PASS6suites80tests2.341s;
initial lint65347 caught literal regex spaces; corrected58516 PASS37tests1.513s,
final lint/shell/diff pass. Logs `/tmp/eidolon-qa-timing-wired-*`.
**95095 full client ACTIVE**, log `/tmp/eidolon-primary-timing-full-client.log`;
poll exact handle, do not restart or edit tested source. No owned local browser
currently running. Next: class coverage with Rogue/Cleric and full Earth under
normal rest, preserving deadlines and earned-play/manual-claim requirements.
Root remains ledger-only, never push it; canonical53–57 queue unchanged.

## Previous checkpoint — September 9, 04:23 UTC

PROGRESS: **52 deployed**, both public endpoints independently returned exact
**a36d1e7d66333e8f6cf707ff115947b340c9a46c / Alpha1.0.52** at04:17, backend
healthOK/databaseReady. CI34305897736 passed initial tests, predeploy, production
input validation and BOTH deployment jobs. **Final live QA is QUEUED, not passed**.
Do not push53 yet;51 remains the last release with complete final QA acceptance.

Confirmed queue cause: sole repo runner `eidolon-codex-chrome` online/busy with
scheduled **Nightly Multiplayer Soak34307306192**, started04:15:52,100-client
soak step ACTIVE. Its scheduled default is24h and it shares the required
`eidolon-live-browser` label. This is separate from the earlier~50m predeploy
runtime. At04:19 asked user via async input for permission to cancel this new
soak and fix future scheduling; **no reply/approval, cancellation, workflow or
runner change yet**. Rechecked04:23:52queued/soakrunning. Do not treat automatic
goal continuation as approval. Local roadmap work can continue; not a whole-goal
impasse. Detailed diagnosis appended to `2026-09-09-release-pipeline-timing.md`.

Added inactive timing helper/test/document in primary, now clean
**29d7feb9f48f1b12f0ec469e477c7d90b2a542aa**. It logs safe stage labels, elapsed
seconds and exact status without arguments/credentials. Initial30498 test setup
failed before discovery due Node override/canvas setup; corrected96999 PASS12
tests2.113s. Final lint95966, shell/diff checks pass. Logs
`/tmp/eidolon-qa-stage-timing-tests{,-fixed}.log` and
`/tmp/eidolon-qa-stage-timing-lint-final.log`. Not part of earlier full3682 count.
Helper NOT yet sourced: wait for active isolated runner to end before wiring
its AND-chain. No existing runtime/active wrapper changed; current Fighter still
records original cleanf3f33e1. Candidate doc `2026-09-09-qa-stage-timing.md`.

**62895 Fighter ACTIVE**, exact handle revalidated04:23:25/40 at957s hunt time,
1counted death/12rest stops, level5/345XP/1064gold,10slots/420 unsold gear value;
another real recovery followed. No weaker limits or full-class claim. Only owned
local handle running; poll62895, do not relaunch/cleanup. Logs/project as below.
Root is ledger-only; canonical53–57 queue unchanged. Whole goal remains active.

## Previous checkpoint — September 9, 04:13 UTC

PROGRESS / VERIFIED WAIT: exact62895 Fighter handle remains ACTIVE, confirmed
04:12. Opening105s and diary141s cumulative passed without intermediate logins.
Watch5/40 at272s with4town stops, then one counted death atcredit5: level4,
0HP/6MP, three nearby Skeletons(level2/19HP,level3/17HP,level4/4HP). Ordinary
Respawn restored192HP/159MP and2earned items were equipped. Continued to10/40
at425s,1death/5rest stops, level4/214XP/538gold. First recovery exercised health
80/165→165/165 and mana46/143→143/143; later stops use actual Fighter20mana
cost. No skipped death, changed limits or full-class pass. Runtime/source still
frozenf3f33e1; poll62895, do not restart or clean its owned project while active.

Measured the previous successful51 CI34300606161 from authoritative GitHub job
timestamps:78m53s total,49m41s predeploy QA,12m20s final live QA; deployment
jobs each under1m. New document `2026-09-09-release-pipeline-timing.md` in
rootec8c314 records evidence, limits and a scoped next step to profile individual
routes before changing concurrency. Filtered prior-job log read84070 ended with
no matching sub-route timings; do not invent an internal bottleneck. No pipeline
or queued-release mutation.52 CI34305897736 rechecked04:12 remains ACTIVE in
predeploy, initial Go/Jest/all3browsergroups passed. Its current duration alone
does not establish a hang or authorize skipping/restarting the gate.

Primaryf3f33e1 clean, Wizard1469/fullclient45516 terminalPASS as below. Root is
ledger-only; no53 push before entire52CI/deploy/finalLiveQA and fresh exact52.
The whole goal remains active with further class/realm/balance/release work.

## Previous checkpoint — September 9, 04:02 UTC

PROGRESS: actual default-rested Wizard1469 on cleandb3bbb7 terminatedPASS1/
11.2m, including final console/network error check. Opening52s/diary92s
cumulative, Watch40/40 at559s hunt time and manual1593XP/100gold plus final
saved progress at574s.0deaths/13real town visits,265.077s total including travel
(18.944–22.107s each); every observed visit fully recovered both actual pools.
Rest expired naturally outside and rebuilt in safety. Level6/270XP/1326gold
before claim→level8/138XP/1426gold;14occupied slots/320 unsold gear value retained.
No intermediate logins or grants. Ready-claim image inspected. This closes one
Wizard opening/diary/Watch gate, not full Earth/all-class/phone/raid balance.

Fullclient45516 PASS260suites/3682tests244.675s already recorded. Logs
`/tmp/eidolon-primary-recovery-{full-client,story-0348}.log`; sanitized images
archived `/tmp/eidolon-primary-wizard-proof-M7KhR6/test-results`. Scan passed;
exact primary-rest-0909-0348 containers/image independently absent. Earlier
53523 console-error failure and no-rest diagnostics are retained, not relabeled.

Player-facing draft `docs/plans/2026-09-09-chronicle-rest-release-notes.md`
created in rootca5f837 and carried into primaryad057b3. Evidence-only closure
**f3f33e1c606a461d1219d0c0ea3f55ede6a7bbfb** is current clean primary HEAD at
`/tmp/eidolon-primary-town-recovery-lAKY3k`; runtime unchanged fromdb3bbb7.
No release version assigned or advertised live. Main candidate evidence document
records the complete pass and wider remaining gates.

**62895 Fighter fresh-story-uninterrupted ACTIVE**, started04:02 on cleanf3f33e1,
same default recovery/quest/death/deadline rules, EIDOLON_E2E_CLASS=Fighter.
Owned projectprimary-fighter-0909-0402 API18560/web41960, log
`/tmp/eidolon-primary-fighter-story-0402.log`. Only owned local handle running.
Poll62895; never restart/cleanup while active. Old1469/45516 handles terminal.

**52 CI34305897736 ACTIVE** at04:02, predeploy full-character gameplay;
Go/Jest/all3browsergroups passed. No53 publication before complete52 deployment/
finalLiveQA and fresh exact public52.51 is last independently verified live.
Canonical53–57 unchanged; root is ledger-only, never a release publisher. Whole
roadmap still active, with concrete progress and no genuine blocker.

## Previous checkpoint — September 9, 03:54 UTC

PROGRESS: fullclient45516 on clean primarydb3bbb7 terminatedPASS260suites/
3682tests244.675s. Log `/tmp/eidolon-primary-recovery-full-client.log`.
No runtime changes. Actual1469 remains ACTIVE on that same frozen source:
opening52s and diary92s cumulative passed without deaths or intermediate logins;
Watch10/40 at134s,0deaths,3rest stops then a fourth real recovery. The final
console-error, reward and persistence checks remain pending; no full-route pass
claimed. Only owned local handle still running is1469; poll it, do not relaunch
or clean while active. Log/project as below. Preceding53523 failure retained.

52 CI34305897736 still ACTIVE at03:53 in predeploy full-character gameplay,
initial Go/Jest/all3browsergroups passed. No53 push; exact-live52 gate remains
mandatory. Last independently verified live51. Root remains ledger-only.
Previous turn was progress; this turn completed full corrected client regression
and revalidated the specific actual/CI waits, not a blocker or roadmap completion.

## Previous checkpoint — September 9, 03:48 UTC

PROGRESS:53523 on clean8564500 terminatedFAILED9.3m, but the entire managed
Watch completed:40/40 at468s, manual1593XP/100gold and final saved-progress
checks at483s hunt time,0deaths/11normal town stops (224.005s total including
travel). Level6/306XP/1395gold before claim→level8/174XP/1495gold after;
15 occupied slots/650 unsold equipment value retained. Opening33s/diary73s
cumulative passed with no checkpoint reconnects. Readable manual-claim capture
inspected. One earlier console error `Move closer to investigate` failed the
final error check; do not suppress it or call the full route green. Sanitized
artifacts `/tmp/eidolon-story-rest-managed-proof-C6uixz/test-results`; log
`/tmp/eidolon-story-rest-managed-0332.log`. Exact owned project containers/image
independently absent after cleanup. This supports one Wizard's intended recovery
loop, not all-class, all-realm or full-campaign balance approval.

New primary development tree **/tmp/eidolon-primary-town-recovery-lAKY3k**,
branchwork/primary-town-recovery-20260909 from8564500, clean committed
**db3bbb73b5b8ffba83a780c0faf46bc796635fda**. Old integration tree untouched
during actual run. Implements user clarification: normal collection/hunt QA
defaults to real town recovery; explicitly named no-rest diagnostics opt out.
All four classes use their configured primary cost and actual gear/talent
modifiers, including zero-cost builds; later hunts receive ordinary departure.
Policy94740 PASS6suites/68tests5.927s, lint/shell/diff pass. No production
regen, reward, count, timer or death-rule changes.

Also found a production ordering bug: Chronicle interaction executes before the
frame's movement send. New49807 regression FAILED2/3 with client4.95m/server
5.05m, both moving and just stopped. Inspection now flushes changed sequenced
movement before requesting inspection; server validation/range unchanged,
stationary rereads do not flood movement. Corrected70105 PASS66tests3.444s;
independent server dispatch4933 PASSrace1.734s proves before-move rejection /
after-move acknowledgement, no auto-completion. This proves a possible cause,
not the uniquely captured cause of the prior actual error. Logs
`/tmp/eidolon-chronicle-move-order-{before,after,server}.log`. Backend production
unchanged from prior full race pass; new dispatch test is separate evidence.

On frozendb3bbb7: **45516 fullclient ACTIVE**, log
`/tmp/eidolon-primary-recovery-full-client.log`; **1469 actual default-rested
fresh-story-uninterrupted ACTIVE**, owned projectprimary-rest-0909-0348,
API18560/web41960, log `/tmp/eidolon-primary-recovery-story-0348.log`.
Poll these exact handles; no restart/cleanup while live. Final prepare/lint90207
passed. These are the only owned local checks running. No further runtime edits
over them. Candidate detailed evidence: `docs/plans/2026-09-09-story-rest-integration.md`.

**52 CI34305897736 ACTIVE** at03:48: Go/Jest/all3browsergroups SUCCESS,
predeploy full-character gameplay running.51 remains last independently verified
live; no53 push before full52CI/deploy/finalLiveQA plus fresh exact public52.
Canonical53–57 unchanged; root is ledger-only, NEVER push it as a release.
Whole roadmap remains active; no blocker, no completion claim.

## Previous checkpoint — September 9, 03:37 UTC

USER CLARIFICATION: returning to town to replenish HP/MP and build Well Rested
is the intended normal loop. Adopt earned town recovery as the combined feature's
primary progression/CI policy after the frozen current run; do not make indefinite
no-rest sustainability a release requirement or raise .01 outside regeneration.
Retain actual resource timers, movement, combat deadlines, death accounting,
manual payouts and saved progress. Preserve failed no-rest evidence as diagnostic
comparison, NOT a standalone pacing blocker. Canonical51–57 gates unchanged.

Actual **53523 remains ACTIVE**, last confirmed via exact handle03:36, on clean
8564500. At144s hunt time:10/40,0deaths,3real recovery stops (~20s each), level4,
192HP/99MP,3bag slots/170 unsold equipment value. Town snapshots show genuine
24/40MP→159MP and184→192HP, with earned rest bank, no grants. Opening33s and
diary73s cumulative passed with no intermediate reconnects. Final hunt/payout/
persistence pending; poll53523 and keep its runtime frozen. Log and owned project
as below.52 CI34305897736 still in predeploy gameplay; no53 publication.

## Previous checkpoint — September 9, 03:33 UTC

PROGRESS: fresh uninterrupted24785 on clean0a3e1c0 terminatedFAILED4.8m.
Opening97s/diary136s cumulative passed without deaths/reconnects. Watch stalled
at2/40 against unchanged120s credit watchdog: level3,115/150HP,0/130MP,
level3 Skeleton14HP/20.43units away,39retreats/1crowdjump/18Fireballs. No
issued movement failure this run. Screenshot inspected; zero mana confirmed,
not proof of the complete cause. Sanitized evidence archived
`/tmp/eidolon-story-rest-move-proof-sI5HiW/test-results`; log
`/tmp/eidolon-story-rest-uninterrupted-0324.log`. Exact owned project containers/
image independently absent after normal cleanup. This no-rest gate remains failed.

Added explicitly separate `fresh-rested-story-uninterrupted` comparison on clean
**8564500b3ef0d872d0361befafc4f2c64b0fe175** in integrated worktree. After
credited encounters only, existing resource policy can perform ordinary Recall,
real town full-pool recovery and native departure. No extra first-encounter rest,
no mid-fight deadline reset, no grants, changed quotas/rewards, ignored failure
or replacement of default/CI no-rest route. Retains no intermediate logins and
mandatory final persistence check; reports rest-stop count. Production runtime
unchanged from0a3e1c0/fullclient3655. Initial63450 test-only Node/jsdom URL mismatch
fixed by explicit node:url import. Final97700 PASS4suites/41tests1.345s, lint,
shell/diff checks pass. Logs `/tmp/eidolon-rested-story-policy{,-final}.log`.

**53523 ACTIVE**, owned projectstory-rest-managed-0909-0332, API18560/web41960,
log `/tmp/eidolon-story-rest-managed-0332.log`. Revalidated actual handle03:32;
clean exact source build running. This is the only owned local check running.
Poll53523, do not relaunch or clean while active. Comparison is pending and
cannot be relabeled uninterrupted no-rest acceptance even if it passes.

**52 CI34305897736 ACTIVE**: server/client/all3browsergroups SUCCESS,
predeploy character QA running.51 is last independently verified live. No53
push before complete52CI/deploy/finalLiveQA plus fresh exact public52.53 prepush
239tests passed as recorded below; canonical53–57 unchanged. Whole roadmap and
earned balance gates remain open. Root is a ledger, NEVER a release publisher.

## Previous checkpoint — September 9, 03:24 UTC

PROGRESS: integrated17a4dba uninterrupted72341 terminatedFAILED5.2m. Opening
and diary passed; Watch3/40, level4/50HP/8MP, zero deaths. Issued retreat moved
2.46 of required6 units near New Growth. Hover/range evidence suggests marker
interception but lacks the click recipient; do not assert a unique cause.
Sanitized artifacts archived `/tmp/eidolon-story-rest-failure-dxIDjf/test-results`,
log `/tmp/eidolon-story-rest-uninterrupted-0303.log`. Owned services/image absent.

New production Shift-click move-only control resolves ground before interactions,
clears pending intent and retains ordinary collision/server walking. Visible help
updated. Real-input retreat helper uses Shift and now records read-only intent/
collision diagnostics; minimum6,2.5s deadline, clear path, no alternate paths,
no default jump, resource rules and quest counts unchanged. Baseline control
tests failed5/8, corrected focused39 and helper/policy23 passed. Native rendered
pointer fixture37171 PASS1/5.2s, screenshot inspected/archived; intent fixture is
not server displacement or combat acceptance. Full client73607 PASS257suites/
3655tests153.217s, final lint17253/diff checks pass. Backend unchanged from its
full race pass. Clean integrated commit **0a3e1c0889d518a2f25875165dd8f0a8016aea96**.

Fresh same-route **24785 ACTIVE**, projectstory-rest-20260909-0324 on
API18560/web41960. Log `/tmp/eidolon-story-rest-uninterrupted-0324.log`.
Poll this handle; do not relaunch or clean while active. Only owned local check
running. Detailed evidence in candidate `docs/plans/2026-09-09-story-rest-integration.md`.

**52 CI34305897736 ACTIVE**: Go/Jest and browser2/3,3/3 passed; browser1/3
running.51 remains last verified live. No53 push before entire52CI/deploy/final
live QA and fresh exact public52. Root remains ledger-only;53–57 canonical queue
unchanged. Rest/story candidate unversioned, not live, no full pacing approval.

03:26 follow-up:24785 remains ACTIVE. Opening passed97s,3 credited kills/zero
deaths/5retreats, manual100XP100gold. Diary passed136s cumulative, manual200XP/
25gold; no checkpoint reconnects. Watch starts level3/121XP/180gold,165HP143MP
with no equipped gear; hunt is pending. Fresh public client/backend both51/
55712b9 at03:25, healthOK/databaseReady. Canonical53 prepush77806 passed239
version/nameplate/sharding tests2.915s on cleance330b3; no push while52 is active.

## Previous checkpoint — September 9, 03:08 UTC

PROGRESS: **51 fully live and verified**. CI34300606161 terminalSUCCESS,
including final live four-class/remote QA. Fresh no-cache public client/backend
both51/55712b9c747056041b05fa4e475c4aee094028bc, healthOK/databaseReady.
Canonical52/a36d1e7 clean, exact51 ancestor and remote/master exact51 before
ordinary push; prepush version/recovery1062 PASS228tests4.128s. Push34885
succeeded; remote/master independently verified
**a36d1e7d66333e8f6cf707ff115947b340c9a46c**. **52 CI34305897736 ACTIVE**.
Do not push53/ce330b3 before complete52CI/finalLiveQA and fresh exact public52.
Root is a ledger, never a release publisher.53–57 canonical queue unchanged.

Combined-story production1816738 full Go23067 PASS(root27.543s/game437.789s)
and full client98874 PASS256 suites/3645tests240.706s. Handles confirmed terminal;
logs `/tmp/eidolon-story-rest-integrated-full-{server,client}.log`.
New combined-save26402 PASSrace7.460s:four classes living/dead,3 BSON/catalog/
snapshot/private-journal reload cycles each. Old curve1 level30/9890 becomes
curve2 level30/10561 once; legacy opening receipt500, accepted five-item8000XP
collection terms and explicit zero quoted diary remain exact, with counts,
evidence/optional state, base stats/gold, zero mana,1HP/dead0HP and fractional
123.456789rest preserved. This is a durable-data test, not actual socket play;
added after full tests began and verified separately. Log
`/tmp/eidolon-story-rest-combined-save.log`. Committed clean **17a4dba**.

Actual integrated `fresh-story-uninterrupted` **72341 ACTIVE** on frozen17a4dba,
owned projectstory-rest-20260909-0303 API18560/web41960. Log
`/tmp/eidolon-story-rest-uninterrupted-0303.log`. Opening passed133s,3 credited
kills/zero deaths/25retreats/manual100XP100gold tolevel2. Diary passed173s
cumulative, manual200XP25gold tolevel3. No checkpoint reconnects or added rest
stops/grants. Hunt begins level3/150XP/233gold,165HP143mana,0 equipped drops;
40-kill Watch is still running, not passed. Preserve120s credit watchdog,
two-respawn bound and30m route limit. Poll72341; do not relaunch or clean its
owned services while active. This is the only owned local check still running.
Feature/campaign still unversioned and NOT live; whole roadmap remains open.

## Previous checkpoint — September 9, 02:31 UTC

PROGRESS: Well Rested **badd0cf** fixes three old rectangle-based enemy AI checks
and delayed boss-slam sanctuary bypass. New regressions first FAILED inclusive
town fence/future shrine acquisition, dungeon-coordinate targeting and shrine
roaming. A separate real2s slam still caused10damage after entering safety.
Fixed acquisition/chase/roam use the scene registry; impact rechecks eligibility,
death/disconnect/scene under target lock. Final focused25833 PASSrace8.000s,
6 acquisition/4 movement/2 real impact cases plus existing target concurrency and
protection. Logs `/tmp/eidolon-safe-zone-{ai-before,slam-before,ai-final}.log`.
Older d650c72 actual-session results remain evidence of that older binary, not
fresh proof of this changed AI runtime. Rest branch clean; not versioned/live.

Created isolated **work/story-rest-integration-20260909** at
`/tmp/eidolon-story-rest-integration-yEVp9B`: merge28dd5a1 combines rest1c7537f
and story92d2bc7, then1816738 imports badd0cf. Includes31 authored chapters,
coordinated curve2/reward budgets, schema9 resource/rest/receipt persistence and
current movement/stealth protections. Canonical releases and root untouched by
runtime changes; curve2 is LOCAL ONLY. No direct candidate publication allowed.

Initial full client93503 FAILED4suites/3tests216.551s (252/3638passed): helper
import/evaluation/source-name assumptions. Corrected input20772 PASS77tests.
Initial full Go62050 FAILEDroot23.411s/game391.274s, two failures: old assertion
that curve1 remains active and now-known Earth records treated as unknown catalog
entries. Preserve legacy threshold/explicit2→1 rollback tests and full unknown
future round-trip with genuinely unknown IDs; corrected85228 PASSroot1.407s/
game10.894s. No race report. Full original failures retained, not relabeled green.

Generated Go/JS protocol output matches the merge byte-for-byte. Lint31593,
shell syntax/diff checks pass; prepare:client92314 finished. On frozen runtime
**1816738**, corrected full **Go23067 ACTIVE** and **client98874 ACTIVE** at02:30.
Logs `/tmp/eidolon-story-rest-integrated-full-{server,client}.log`. Poll these
exact handles; all other owned handles terminal. No owned browser currently
running. After full checks, run actual uninterrupted opening→diary→40-kill Watch
on this new combined source, preserving limits and prior failures. Detailed
merge/proof contract in candidate `docs/plans/2026-09-09-story-rest-integration.md`.

CI51/34300606161 remains ACTIVE at02:29 with Go/Jest/all3browser groups passing,
predeploy full-character QA running. No52 push. Last verified live50/51ec73e;
do not claim51 live. Full roadmap and earned balance/deployment gates remain open.

## Previous checkpoint — September 9, 02:14 UTC

Well Rested development **1c7537f** committed clean. New explicitly opt-in
`fresh-rested-collection` actual49772 PASS1/4.4m:8/8 fragments,14 observed target
deaths, zero player deaths, three ordinary town recovery stops between finished
encounters. No grants, fake clock, reduced objectives or extended combat limit.
Manual turn-in consumes8 and survives login. **Not a balance approval:** the
unchanged8000XP reward raises level6→17. Default no-rest47973 failure remains
open and the default CI route is unchanged. Log `/tmp/eidolon-rest-managed-0201.log`.

Native expiry90628 PASS1/40.4s: actual earned14.916003931 bank expires outside
the east gate; strength11→10 and maxima110→100, aura/icon removed. Ordinary
Recall earns rest again and restores bonus/aura. Both screenshots inspected:
no enclosing cube, golden foot-ring/motes only while active. Evidence
`/tmp/eidolon-rest-expiry-0206.log` and `/tmp/eidolon-rest-expiry-proof-sdOBHt`.
Both owned browser projects removed/independently absent; credential scans pass.
Full client10673 PASS243 suites/3449tests220.497s, policy9 tests pass, final
lint96797/shell syntax/diff checks pass. No production code changes this turn;
all owned local handles closed. Feature still unversioned and NOT live.

CI34300606161 for exact51/55712b9 remains ACTIVE at02:13: Go/Jest/all3 browser
groups successful; predeploy full-character QA running. No52 push and no51
live claim. Last verified live remains50/51ec73e. Root is ledger only.
Next: resolve default earned combat and rebalanced expanded-story integration,
then own feature version/notes/ordered CI/live gates. Story branch92d2bc7 was
read-only inspected; no curve2 activation or branch merge performed. The full
roadmap remains active/incomplete.

## Previous checkpoint — September 9, 01:56 UTC

PROGRESS: **50 is fully live and verified**. CI34295826450 completed SUCCESS,
including final live four-class/remote QA. Fresh no-cache public client/backend
both50/51ec73e, healthOK/databaseReady. Canonical51 worktree55712b9 clean,
descends from exact50, version/notes suite225tests PASS1.198s and remote master
was exact50 before ordinary push. Push9923 succeeded; remote master verified
**55712b9c747056041b05fa4e475c4aee094028bc**. **51 CI34300606161 ACTIVE**, Go/Jest
passed and all3 browser groups running at01:55. Do not push52/a36d1e7 until
complete51 CI/finalLiveQA and fresh exact public51.52–57 queue unchanged.
Root remains a ledger, never a release publisher.

Well Rested development **1d68888** clean (follows aa5ebf5). Phone talent31044
PASS1/14.4s: normal touch purchases, exact Fireball30→21 payment/cooldown and
fresh landscape login, using authoritative bank delta between fresh loopback
server snapshots rather than ordinary-regen/wall-clock guesses. Death/recovery
92590 PASS1/24.8s: living town login80→86MP with0.5343s bank delta over3.108s
wall time, actual hostile corpse0HP70MP retained across login, explicit Respawn
and live Recall separation, then73→79MP with0.5703s earned time.23 arithmetic
tests pass; full client88014 PASS242 suites/3,440 tests153.658s and lint pass.
Evidence `/tmp/eidolon-rest-{talent-0137,recovery-0143}.log` and
`/tmp/eidolon-rest-recovery-client-full.log`. Owned projects removed/absent.

Fresh no-grant opening/collection47973 **FAIL6.4m**. Opening passed62s,0 deaths,
manual500XP100gold. Collection reached12 observed target deaths,3/8 seeds,level6,
0 player deaths before the unchanged120-second combat timeout after low-mana
retreat/reacquisition. No reduced quantities, drop-rate change, grants or timeout
increase. Retained `/tmp/eidolon-rest-fresh-0146.log`, sanitized artifacts
`/tmp/eidolon-rest-fresh-failure-Q1oxlk`; owned project/data removed and absent.
This remains an earned-play failure. Investigate normal resource-management and
defensive input, including actual town rest between encounters, without hiding
the failed route or changing combat/drop bounds merely to pass.

Two-real-player phone party/aura final68967 **PASS1/13.4s**: ordinary party setup,
native joystick, local/remote ownership/following, High19→Low10 visible parts,
three viewport sizes, status panel and separate world screenshots. Camera proof
uses the layout-owned clear encounter region. Screenshots visually inspected
and retained `/tmp/eidolon-rest-party-final-CBdw9R`; log
`/tmp/eidolon-rest-party-0158.log`; final lint49376PASS. Earlier attempts exposed
test assumptions about already-closed menu, cached hidden meshes and viewport
versus encounter-region centering, not production defects. All owned local
handles closed; all disposable projects cleaned/absent and credential scans pass.
No production source changes this turn. This is two-player desktop Chrome phone
emulation, not full-raid/physical-phone performance. Remaining Well Rested gates:
native expiry, failed collection/broader rested-unrested earned balance, own
version/notes/ordered deployment. Full roadmap goal remains active/incomplete.

## Previous checkpoint — September 9, 01:30 UTC

PROGRESS: Well Rested development **4b407b3** committed clean. Actual schema
upgrade63337 **PASS12.916s**: exact schema7 bridge9aec835→schema8 resource7ab559
real Fireball/Fireball/Shield zero-mana depletion, two listings, failed escrow
save and intentional crash→schema9 restd650c72 recovery. Schema7 refuses8 and
schema8 refuses9 before writes/admission, with exact raw user BSON/journal/op
retained. Two fresh9 processes recover zero mana then allow only connected town
healing/earned rest; listings/deposits/receipts/gear/XP unchanged. All4 child logs
clean (1 explicit crash, legacy disconnect-save proof,2 normal9 drains). Owned
Mongo0122/volume removed and absent. `/tmp/eidolon-rest-schema-0122.log`.
Full root race29300 **PASS13.222s**, focused arithmetic1.041s, full lint88512PASS.

Actual fresh-character browser17880 **PASS1/32.3s**: earns5.346s rest in town,
ordinary Ctrl-click travel outside, observes countdown, selects/chases a real
enemy, records local damage30→28 and mana110→80, Recalls and logs in again with
bank and19-mesh aura intact. No progression/buff/encounter grants. Evidence
`/tmp/eidolon-rest-browser-0131.log`; screenshots retained/inspected in
`/tmp/eidolon-rest-browser-proof-nXFcKk`. Prior0126/0128 health-only observations
failed; final test recognizes DEAD snapshots and requires actual local damage
receipts. Those failures lack enough post-cast state to claim unique causation.
All3 owned browser projects cleaned, absent, credential scans passed. Production
source unchanged; browser built b409d83-dirty (test/docs changes only), backend
integration still exactd650c72. All owned local handles terminal/closed.

Remaining Well Rested gates: old browser assumptions in fresh-opening's .1 stat
regen, death-resource-recovery town login/Recall allowances and phone talent
castResourceBounds; integrated expiry, phone/group aura and rested/unrested earned
balance; own version/patch notes and ordered CI/live. Do not publish inherited57
metadata. Full roadmap remains active/incomplete.

50 CI34295826450 revalidated ACTIVE in disposable full-character predeploy QA
at01:29 after one transient GitHub timeout (no restart). Go/Jest/all3 browser
groups passed. Fresh public frontend/backend still49/0c6d0cc at01:30,
healthOK/databaseReady.51–57 queue unchanged; no successor push before complete
50 CI/finalLiveQA and exact public50 identity. Root remains ledger-only.

## Previous checkpoint — September 9, 01:16 UTC

PROGRESS: Well Rested development **b409d83** committed clean. Refund/refund-lifecycle actual30254 is terminal
**PASS43.100s**. Offline corpse/pending snapshot, recipient save/ack failures,
100-refund bounded backlog and unreadable-auction startup refusal retain exact
rest/resources plus original receipt/gold/gear invariants.16 normal child logs
clean with completed drains; separate expected startup-refusal evidence retained.
Owned Mongo0102 removed and absent. `/tmp/eidolon-rest-refunds-0102.log`.

Original live-handoff/cooldown15524 terminal **PASS8.066s**, including real
Fireball, two repeated joins, overlapping login, late prior-socket cleanup and
fresh final persistence. Initial0107/0115 test failures identified pre-first-tick
casts and intentional fractional-healing reset at disconnect. Final independent
oracle checks each side of the fresh durable handoff save exactly, with no
production change or relaxed cooldown/resource bounds. All3 child logs clean
and drained; owned Mongo/volumes removed and absent. Final evidence
`/tmp/eidolon-rest-handoff-0119.log`. Full root race7303 passed13.398s before
the final test-only handoff correction; final rerun2172 **PASS12.590s** in
`/tmp/eidolon-rest-refund-handoff-final-root.log`. All owned handles closed.

50 CI34295826450 still ACTIVE in predeploy character QA at01:15; Go/Jest/all3
browser groups passed. Fresh public client/backend remain exact49/0c6d0cc,
healthOK/databaseReady. No successor push or restart. Canonical51–57 hashes
unchanged. Feature is not versioned/staged/live. Remaining Well Rested work:
schema upgrade, integrated browser travel/reconnect/group aura, earned balance
and ordered notes/CI/live gates. Full roadmap goal remains active and incomplete.

## Previous checkpoint — September 9, 00:58 UTC

PROGRESS: Well Rested **fdf023b4fdaa8571a19122d166f6c0571ed7124b** committed
clean. Bid crash6-boundary acceptance79841 **PASS54.506s**, preserves both the
new bidder's durable bank/resources and displaced bidder's offline resources
with exact debit/refund receipts.18 child logs clean,12 normal drains/6 intended
kills; owned Mongo0053/volumes removed and absent. Log
`/tmp/eidolon-rest-bid-0053.log`.

Combined raises/competing bids and buyouts4784 **PASS105.677s**: bid14.40s,
normal/capacity buyout38.49s,6 crash boundaries44.46s, competing buyout7.31s.
Exact one-winner/one-item receipt, signed charges/refunds, stash/full-storage,
rejected requests, original equipment/inventory/progression and unchanged
offline previous-bidder state retained. Each new-process recovery compares exact
durable resources/rest before ordinary login and independently calculated town
recovery afterward.36 child logs clean,30 normal drains/6 intended kills;
owned Mongo0056/volumes removed and absent. Evidence
`/tmp/eidolon-rest-purchase-0056.log`. Root Go race61394 **PASS12.077s**.
No production server changes; exact d650c72 binary remains the exercised runtime.

Merged client66914 now terminal **PASS242 suites/3,425 tests93.429s**, lint also
passed. Logs `/tmp/eidolon-rested-merged-{client,lint}.log`. All owned local
handles closed. Source audit identifies remaining old assumptions in standalone
refund/refund-lifecycle and original live-handoff/cooldown integrations (not the
already-passing dedicated Well Rested live-handoff test). These plus schema
upgrade, integrated browser/aura and rested/unrested earned balance remain open.
Feature remains unversioned/not staged/live, full1.1–1.10 goal incomplete.

50 CI**34295826450** is ACTIVE in **Predeploy Character QA (System Chrome)**;
Go/Jest/all3 browser groups passed. No pipeline restart or successor push.
Before51/55712b9 publishes, require every50 job including finalLiveQA to pass and
fresh exact client/server50 identities.51–57 canonical hashes remain as00:40
below. Root/master remains a ledger, not a publisher.

## Previous checkpoint — September 9, 00:50 UTC

PROGRESS: previous turn published corrected50 and propagated/verified the ordered
queue. This continuation closes Well Rested listing and item-delivery recovery
acceptance, without changing production rules or the release order.

Well Rested **f2a6ad8423e4d12034d1b2858421223532b92122** committed clean in its
existing development tree. Listing9 normal/rejection cases,7 crash boundaries
and delayed-publication after an aged decision all retain exact town rest/resource
arithmetic and real Fireball cost alongside unchanged item/deposit/receipt,
legacy scaling, immutable identity and paid-duration checks. Actual54724
**PASS92.422s**:44.39s/41.41s/5.61s;42 child logs independently clean,34 normal
drains/8 explicit intentional kills. Owned Mongo0044/volumes removed and absent.
Evidence `/tmp/eidolon-rest-listing-0044.log`.

Item delivery5 ordinary/capacity cases and6 crash boundaries retain the complete
earned item (including Forge basis), one-copy/receipt counts, stash fallback,
full-storage rejection and original gold/equipment/progression. Before fresh
login, exact durable database/journal health/mana/rest must match; only subsequent
connected town time adds recovery. Initial78268 **PASS69.162s**,28 clean child
logs (22 normal drains/6 expected kills). Added explicit startup comparison to
original gold/equipment/progression, separate from the new resource baseline;
final crash91858 **PASS40.684s**,18 clean logs(12 normal/6 kills). Both owned
Mongo0047/0048/volumes removed and checked absent. Logs
`/tmp/eidolon-rest-item-0047.log`, `/tmp/eidolon-rest-item-final-0048.log`.
Final root Go race76334 **PASS11.365s**. Only tests/docs changed; production server
code remains the previously exercised exactd650c72 binary.

Full merged-feature client/lint66914 remains ACTIVE (log
`/tmp/eidolon-rested-merged-client.log`, then
`/tmp/eidolon-rested-merged-lint.log`). Poll this handle; do not replace it or edit
client/runtime while active. No other owned local process remains. Feature still
unversioned/not live. Remaining recovery work: bid/contention/refund and buyout
flows, schema upgrade; then integrated browser/aura and earned balance.

50 CI**34295826450** ACTIVE: Go/Jest and browser2/3 passed, browser1/3 and3/3
still running at00:49. No timeout/restart or successor push. Do not publish51
until every50 job, including final live QA, passes and fresh exact public50
identity is verified. Canonical51–57 hashes are unchanged from00:40 below;
only Well Rested development advanced. Root remains a ledger, not a publisher.
Full1.1–1.10 objective remains active and incomplete.

## Previous checkpoint — September 9, 00:40 UTC

PROGRESS: exact50 **51ec73edadcf38f59278eee76151257a86d47e68** fresh collection
7029 is terminal **PASS1/6.6m**. Ordinary opening/manual reward/relogin and all8
seeds/pickup/manual completion passed with0 deaths; collection observed16 target
deaths, finallevel6. Source unchanged during the run. Full client236/3,353 pass
remains valid; credential scan/owned container cleanup passed. Log
`/tmp/eidolon-release50-movement-collection-0029.log`. This proves this earned
route, not final pacing or a definitive attribution of the earlier missing-target
failure. The controlled stalled-movement reproduction and correction remain below.

Rendered login credit95918 PASS1/3.7s and actual release/notes99305 PASS1/4.1s;
the notes screenshot is inspected, showing50 and the movement fix. Evidence
`/tmp/eidolon-release50-rendered-notes-0037`. Exact public49/0c6d0cc and healthy
database verified before publishing; prior49 CI34284099182 terminalSUCCESS
rechecked, remote masterb7b86f5 and ancestry checked. Only
`release/50-with-final49:master` pushed,27296SUCCESS. Remote now exact51ec73e.
New CI**34295826450** is ACTIVE in Go/Jest at latest poll. Old failed50 run
34290705218 is historical, not the current gate. Do not push51 before the entire
new50 CI/deploy/finalLiveQA succeeds and fresh public identities match exact50.
Public frontend/backend at00:40 still exact49/0c6d0cc, health/database ready.

Merged the exact50 fix forward, preserving real ancestry and separate versions;
all trees were clean before merges, no conflicts or external pushes. Current
canonical queue (paths unchanged from preceding checkpoints):

- 51 `/tmp/eidolon-release51-final50-DizHn0`: **55712b9c747056041b05fa4e475c4aee094028bc**
- 52 `/tmp/eidolon-release52-final51-zuht4H`: **a36d1e7d66333e8f6cf707ff115947b340c9a46c**
- 53 `/tmp/eidolon-release53-final52-aGmk4j`: **ce330b3e2a576d07d159b964563f12f031dff3d5**
- 54 `/tmp/eidolon-release54-final53-oZ3nK4`: **805ba0daf14f34cd59097a9b14efaa6a3d7b5c91**
- 55 `/tmp/eidolon-release55-final54-UVV7t3`: **6d8f717d06ea92da0e8ae2624cd455c9bf6b81ea**
- 56 `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`: **67a73e00f1da1a09e90f51bd9e8ea2506f60b4f5**
- 57 `/tmp/eidolon-resource-persistence-c6E17J`: **cc6e419ed54b0331cbd218028d6ba0278e001857**
- Well Rested `/tmp/eidolon-well-rested-ZL0PZY`: **8e21d49af116573f5de110e6899e52a1df827de0**

Each predecessor ancestry/diff check passed. VersionPresentation, full/delta
state, movement and ground-input checks PASS on all8 trees:4 suites each,
308/309/311/312/313/314/315/315 tests respectively,2.084–2.492s. Logs
`/tmp/eidolon-propagated-{51,52,53,54,55,56,57,rested}-checks.log`; all8 handles
closed successfully. Prior backend evidence remains for unchanged backend code;
these new merge SHAs are not yet deployed/full-gate verified. Old auxiliary56
tree/head is stale, not the publisher. Root/master is still not a publisher.

All local handles closed. Only current external wait is50 CI34295826450.
Next useful local work remains other Well Rested auction flows/schema recovery,
browser-integrated/aura and earned balance, followed by its own versioning gate.
Full1.1–1.10 scope remains active and incomplete; no goal completion/block claim.

## Previous checkpoint — September 9, 00:36 UTC

PROGRESS: seller-payout recovery acceptance now committed in Well Rested
**3121fa4483834b2833408b157b6bcc26e315be6f**, clean development tree. Normal
acknowledgement/retry and all6 crash boundaries preserve exact bank/resources
alongside unchanged gold/receipt/claim/item/inventory/progression checks. Durable
database/journal snapshots are inspected before each intentional crash; both
new-process recoveries must preserve their exact rest/resources before login.
No accelerated clock or suppression of requested town healing. Added reusable
known-fixture real Fireball/probe arithmetic; market helper permits only gold
changes asserted separately by each transaction check.

55487 **PASS55.267s** (normal7.95s/crash46.29s), log
`/tmp/eidolon-rest-payout-0033.log`:20 child logs independently clean,14 normal
drains and6 explicit expected kills. Final ordinary locked-skill probe after
the cast also retained: follow-up9286 **PASS8.357s**, two clean normal drains,
log `/tmp/eidolon-rest-payout-probe-0034.log`. Both owned Mongo containers and
volumes removed and checked absent. Full server-package race34954 PASS13.757s.
Exact runtime remainsd650c72; this is test/docs development, not publication.
Other auction flows (listing,bids/contention,buyout,item delivery), schema upgrade,
integrated browser/aura and rested/unrested earned balance remain required.

50 candidate51ec73e full client20368 now terminal **PASS236 suites/3,353 tests,
131.517s**, log `/tmp/eidolon-release50-attack-move-full-client.log`. Actual
fresh collection7029 remains running from this exact clean candidate: latest
observed5/8 seeds,13 target deaths,0 player deaths, with retreating now observed.
This is progress, not yet route acceptance. Keep the same handle/log/project
from the previous checkpoint; do not restart or edit its source while active.
No push and no successor advanced. Remote50 CI34290705218 remains failed at
predeploy; public49 was last independently verified as recorded below.

## Previous checkpoint — September 9, 00:30 UTC

PROGRESS: previous turn changed authoritative code/evidence (not merely a wait).
This continuation reproduces and repairs a client attack-to-walk defect and
closes additional Well Rested resource acceptance. Full roadmap remains active.

50 exact6c5059e collection31536 FAILED with zero movement even on the sole checked
path, at(170.562,289.334), finalIDLE with target still set. This rules out calling
the helper-only fix sufficient. Failure log
`/tmp/eidolon-release50-fresh-collection-0023.log`; credential scan/owned cleanup
passed, no active old process remains. Acquisition failure was not reproduced.

Controlled full/delta snapshots reproduce a matching production defect: late
ATTACKING overwrites a new manual MOVING path, then IDLE strands its destination.
50 candidate **51ec73edadcf38f59278eee76151257a86d47e68** preserves manual paths
while respecting chase attacks, current-snapshot Charge, death and jump.4 red
regressions become4 suites/121 green tests1.831s, lint/diff pass.50 patch notes
include the fix; inherited50 version metadata remains correct. Actual earned
route acceptance is still required; this replay is not full gameplay proof.

Clean candidate51ec73e now frozen for full client20368 (log
`/tmp/eidolon-release50-attack-move-full-client.log`) and fresh collection7029
(log `/tmp/eidolon-release50-movement-collection-0029.log`, owned project
`move50-20260909-0029`, API18550/browser41950). Both launched, not yet terminal
at this checkpoint. Poll these handles rather than replacing them. No push;
remote CI34290705218 remains failed/predeploy, public49 last verified below.
51–57 and Well Rested will need this final50 fix propagated before publication.

Well Rested **10eb246** committed clean:8 actual PvP cases cover four classes,
ordinary duel/1v1/2v2 party/queue, repeatJoin, real cast, forfeit/shutdown and
fresh login with unchanged exact rating/honor/result assertions. Real-time expiry
uses lower current maxima; retained rest uses boosted maxima. Rejected Mongo
save/journal replay preserves exact bank/resources and real Fireball cost; an
already-committed dead-player journal retains123.456789 seconds and later gold.
Initial20960 FAIL79.651s: active-bank cases read admission before the first arena
rest tick (stale town label). Wait for an actual outside-rest frame using the
same20s deadline; runtime unchanged. Corrected1639 **PASS91.871s** (journal5.39s,
receipt2.60s,PvP82.86s). All19 child logs independently clean with normal drains;
owned Mongo/volumes removed and checked absent. Evidence
`/tmp/eidolon-rest-workflows-0025.log`. Full root Go race42419 PASS11.467s.
Feature runtime remains exact d650c72; these commits only change tests/docs.
Auction failpoints/schema-upgrade, integrated browser/aura and earned balance
remain open. None of this constitutes staged/live Well Rested or roadmap closure.

## Previous checkpoint — September 9, 00:23 UTC

PROGRESS: Well Rested development **cebd17fdf9d954b59bcea6e73285fca65e925988**
is committed and clean, still unversioned/unpublished. Actual dungeon restart
matrix passes52.653s:8 living/dead class cases,16 processes, exact resources
after real-time rest expiry, actual Wizard Fireball and preserved room/layout/
equipment/reward state. All16 logs clean with normal drains; owned loopback
Mongo0010 and volumes removed and checked absent. Client authority checks pass
2 suites/15 tests1.01s. The production client forces multiplayer; no playable
offline progression entry exists, so an independent client clock is unnecessary.
Feature evidence remains in its branch's implementation document. PvP actual
integration, journal/auction/schema failures, integrated browser visuals and
earned rested/unrested balance remain open.

50 CI**34290705218** is terminal **FAILURE** in predeploy character QA.
Go/Jest/all3 browser shards passed; every deployment/live job was SKIPPED.
Fresh public metadata and health at00:19 remain exact49/0c6d0cc, database ready.
No51 push and no successor release gate is satisfied.

50 candidate **6c5059eaf0926c8d631a26ddb4fe8d3555721933** fixes a proven test
helper mismatch: a collision-checked retreat could be replaced with an unchecked
sideways path.3 red regressions become5 suites/37 green tests1.177s; lint/diff
checks pass. Issued movement failure still fails, no-input remains no-input, and
ordinary travel alternatives are unchanged. Retry1's later target-acquisition
failure remains unexplained; screenshot shows Skeleton models but lacks their
selection-time active/hostile state. Added bounded read-only diagnostics. Original
log `/tmp/eidolon-release50-failure.log`, artifacts
`/tmp/eidolon-release50-predeploy-failure-0019`. Fresh isolated collection rerun
launched from exact clean6c5059e; log
`/tmp/eidolon-release50-fresh-collection-0023.log`, owned project
`rest50-20260909-0023`, API18550/browser41950. Freeze this candidate while running.
Do not call50 fixed or push it until its remaining failure is addressed with
actual acceptance.51–57 still descend from oldb7b86f5; propagate any final50 fix
through that ordered queue before future publishing. Root/master is not a
release publisher. Full1.1–1.10 goal remains active and incomplete.

## Previous checkpoint — September 9, 00:05 UTC

PROGRESS: Well Rested development **e9c5de560b81d33cf68dfa84188e86f38b1b334c**,
clean in `/tmp/eidolon-well-rested-ZL0PZY`. Adapted the existing four-class
token-resume/death-recovery and eight-live-socket shutdown tests to exact town
healing. Kept token replay rejection, dead Recall rejection, normal Respawn,
living Recall's no-mana-refill rule, an actual Wizard Fireball and exact final
saved bars after SIGINT/fresh login. Independent known-fixture arithmetic uses
the bank delta and enforces its limited build assumptions; response mana is
checked between independently validated fresh state frames. A loopback-only
server timestamp filter rejects queued pre-action snapshots, not legitimate
new healing. No production code or release metadata changed this turn.

Actual**25653 PASS47.589s**: recovery24.78s(all8 living/dead class cases), shutdown
and fresh process21.78s. Exact production race binary remainsd650c72 from below.
Logs1466942589,3161073359,1082969551 independently clean with normal character
drains. Owned Mongo `eidolon-rest-recovery-20260908-2359` and volumes removed and
checked absent. Evidence `/tmp/eidolon-rest-recovery.log`. New four-class PvP
forfeit regression confirms that outside expiry removes the bonus, match exit
uses current maxima, and town reactivation does not stack/refill. Focused87427
PASS(root1.421s/game1.910s), full server-package26178 PASS11.608s, independent
arithmetic32917 PASS1.017s. All owned local check handles closed.

50 CI**34290705218** remains live/ACTIVE at predeploy character QA; Go/Jest/all3
browser shards passed. No observation timeout or restart this turn. Fresh public
client/server at00:03 both still exact49/0c6d0cc, health/database ready. Do not
push51 until complete50 pipeline, final live QA and fresh identities pass. Queue
51–57 unchanged; root ledger commits must not be pushed wholesale.

Remaining Well Rested work: older dungeon/PvP resource integrations, journal/
auction failure paths and schema upgrade, browser-integrated scene/travel/
reconnect visuals, offline parity decision and earned rested/unrested balance.
The feature is not staged/live. Full1.1–1.10 goal is active, not complete.

## Previous checkpoint — September 8, 23:52 UTC

PROGRESS this continuation: Well Rested test/integration commit
**97977a9845aaf75491b5b44fffb532b2ac8ec243**, clean development tree
`/tmp/eidolon-well-rested-ZL0PZY`. No production feature changes or release push
this turn. Existing144-session resource matrix now retains town placement and
uses exact persisted rest-time delta/independent known maxima to expect only
requested recovery; rejects offline/pre-login credit, corpse accrual, altered
equipment/gold/level or permanent boosted base stats. **50838 PASS150.264s**, all
four classes/three levels/three fresh processes. New actual token resume/live
handoff **27724 PASS7.468s**: disconnected interval gives no credit, bars match
online recovery, replacing a live socket neither rewinds nor doubles the bank.
New actual north-gate sequenced movement **54493 PASS9.298s**: inclusive edge,
outside countdown/no town healing, living expiry, return/unstacked reactivation.
These are real server protocol tests with prepared starting saves, not browser
pointer/joystick or earned combat acceptance. They used exact d650c72 race binary
already documented below; only tests/docs changed.

All5 child logs independently clean with normal drains:854628412,3602368113,
2500519429(matrix),4181622292(resume),1447624681(boundary). Owned loopback Mongo
projects2346/2350/2353 and volumes removed, independently checked absent. Logs
`/tmp/eidolon-rest-resource-matrix.log`, `/tmp/eidolon-rest-resume.log`,
`/tmp/eidolon-rest-boundary.log`. All local check handles closed.

50 CI34290705218 now has Go/Jest/ALL3 browser shards PASS and **predeploy character
QA ACTIVE**. Browser1 was completing evidence upload, not a failed/stopped test.
Do not restart it or push51 before the whole50/liveQA/public identity gate passes.
Public remains verified49/0c6d0cc with healthy DB. Older resource cast/Recall/
Respawn, shutdown, journal/auction and schema-upgrade tests still need adaptation;
browser-integrated boundary/reconnect/scene presentation, offline parity decision
and earned rested/unrested balance also remain open. Well Rested is NOT staged
or live; full1.1–1.10 roadmap goal remains active and incomplete.

### Earlier September8 checkpoint context

PROGRESS: **49/0c6d0cc is fully verified live**. CI34284099182 completed SUCCESS,
including predeploy full gameplay, deployment and final live four-class/remote
animation QA. Fresh public client and server both reported exact
0c6d0cced85f3ebd0391eaac5f105b04e3b40be1/Alpha1.0.49; database ready. Only then
pushed the clean canonical50 tree `/tmp/eidolon-release50-final49-XhZNjw`,
**b7b86f51bf7a9ce64a426861846095d3e91aedb4** via normal fast-forward push46451.
50 CI**34290705218** ACTIVE: Go/Jest/browser2 PASS, browser1/3 still running.
Do not push51 until the complete50/liveQA/public identity gate passes.51–57
canonical queue below is unchanged; root master must never be pushed wholesale.

Well Rested now has a local development implementation in
`/tmp/eidolon-well-rested-ZL0PZY`, branch `work/well-rested-20260908`:
foundation af7ed63 and elapsed-clock correction d650c72. Authoritative scene
registry,10% max HP/MP/sec recovery,1:1 rest bank capped7200, paused inside and
offline, final10% stat bonus and enemy-kill-only25% XP, fractional save/journal
state/schema9, protobuf replication, readable buff text, and original golden/
elemental High/Low aura. Aura lifecycle includes expiry/death/respawn and hides
in stealth; no actor material/hitbox mutations. No release metadata changed and
this feature is NOT staged/live; it must follow57 under its own future version.

Foundation full Go race76164 PASS(root16.905s/game266.589s), full Jest44598 PASS
242suites/3415tests121.714s. Focused presentation61PASS and generated wire12PASS.
Initial actual78308 FAILED43.834s: fixed simulation steps made town recovery
slower than elapsed time on the loaded/race server. Do not extend its20s
full-recovery wait. Corrected production path uses a per-actor monotonic elapsed
clock independently of fixed physics, with fresh admission/disconnect/resume
baselines. Focused70080 PASS. Corrected exact d650c72 actual61870 **PASS31.984s**:
four-class recovery, cap/full healing, corpse pause/outside expiry, fractional
saved bank and unboosted base stats, fresh-process exact bank/death/zero MP.
Logs2749074430 and101665801 clean with normal drains; failed523788755 likewise
clean. Both owned Mongo2332 and2337/volumes removed and independently absent.
Proof binary `/tmp/eidolon-well-rested-clock-proof-q57aue/d650c72b2013434d393a350fb2197be25874ba25`.

Gallery81816 failed startup because new worktree lacked vendor runtime; after
existing prepare:client, corrected52814 PASS1/7.8s across High/local Low/remote
statuses, aura screenshot inspected. Phone69181 PASS3/8.0s did not catch ugly
vertical wrapping; screenshot inspection led to full-width named timer layout.
Corrected47419 PASS6/15.1s includes existing compact status screens, inspected
390x844/568x320 images. Final functional development commit **2d19834** is clean.
Final full Go12580 PASS(root14.545s/game238.808s; other unchanged packages cached),
lint26098 PASS, targeted client24492 PASS3suites/18tests1.397s. All owned local
check handles closed. Only50's remote CI remains active; do not restart it or
push the next release while it is running. Root ledger commits remain local.

Still required for Well Rested: adapt prior exact town-resource fixtures to the
new intentional recovery, actual safe-zone boundary travel and live reconnect
variations, offline behavior/parity decision, final rendered/live integration and
rested/unrested earned progression/balance. Existing future1.1–1.10, physical phone
and actual group-raid requirements remain open. Full goal is PROGRESS, not complete.

## Previous checkpoint — September 8, 22:54 UTC

PROGRESS: resource persistence now has its own staged **Alpha1.0.57** release,
versioned login/manifest/deployment metadata, cumulative player notes and an
automated, tested pre-upgrade recovery point. Candidate
**7ab559b02624f9b76f010bed2289849444911ea9**, clean in
`/tmp/eidolon-resource-persistence-c6E17J`. It must follow verified56/9aec835;
it is NOT live, and no ordered release was skipped or pushed this turn.

Deployment now holds a flock, rejects a URI pointing anywhere other than its
Compose Mongo service, and backs up only on a schema increase after read-only
preflight. Backup stops the exact preceding API, saves its immutable image,
the entire eidolon database, and private pending-journal/log bytes through a
narrow read-only mount; validates gzip and SHA256, synchronizes the filesystem,
then marks COMPLETE. Failed backup before migration attempts to restart the
unchanged prior API; partial archives stay unmarked and retained. Private
server/backups is git-ignored and no automatic retention deletion is introduced.
This is local recovery, NOT off-machine disaster recovery or a multi-writer
database fence. The legacy Mongo-only restore helper's false "no destructive
action" error was corrected, and paired-restore/data-loss instructions clarified.

Actual backup35696 FAILED13.652s before exercising backup: fixture health became
ready during Mongo's temporary initialization process. Test health now requires
final mongod as PID1. Corrected1476 PASS281.214s, two independent projects:
real archive restore retains zero mana/HP/gold/receipts/schema marker/indexes,
private journal bytes and UID65532; injected dump failure restarts the exact
preceding API. These first runs waited60s for the placeholder's default PID1
signal handling. The final fixture handles SIGTERM, keeping the real60s game
shutdown allowance unchanged. Final46416 **PASS55.742s**, two more independent
projects26.13s/28.56s, now also exercising no previous API container. This is a
placeholder/backup component proof, not a replacement for game shutdown tests.
All5 owned projects and volumes independently checked absent one by one. Logs:
`/tmp/eidolon-resource57-backup-{actual,corrected,final}.log`.
The final disposable backup/restore test is included in57's Go CI job.

Seven real-script/fake-command preflight scenarios4339 PASS1.370s, including
foreign Mongo, absent compatibility contract, rejected schema, unavailable DB,
failed backup, schema upgrade and same-format deployment. No whole Docker-stack
deployment claim from those mocked command tests. Bash syntax and diff checks
pass. Full server race54766 PASS23.997s; final98314 PASS21.250s root, other
accepted game/database/lifecycle packages cached. Full client77560 **PASS240
suites/3405tests216.457s**, lintPASS, final version232 checks40768 PASS2.625s.
Final rendered anonymous34960 **PASS2/12.4s**, local Chrome, desktop/mobile login
credit plus manifest/login/latest-notes agreement.57 note screenshot inspected at
`/tmp/eidolon-resource57-rendered-notes/anonymous-anonymous-releas-013fd-cies-and-server-are-healthy/patch-notes.png`.

Exact committed57 actual98198 **PASS14.834s**: schema7 saved character→schema8
casts/listings→rejected escrow save/pending journal→SIGKILL→refused7→two recovered8
sessions. Final race binary
`/tmp/eidolon-resource57-final-proof-DhDv22/7ab559b02624f9b76f010bed2289849444911ea9`,
bridge remains9aec835. Four logs independently clean:1 expected kill,1 legacy
saved normal exit,2 resource drains; refusal exits1 before writes/admission.
Log `/tmp/eidolon-resource57-final-actual.log`; exact owned Mongo2253/volumes
removed and independently absent. No owned local test handles remain active.

49 CI34284099182 on0c6d0cc remains ACTIVE: Go/Jest/all3 browser shards and
predeploy gallery PASS; full-character gameplay began22:29 and is still running.
This is a verified wait, not a failed/stopped job. Last fresh public manifest and
backend both48/546391c, healthy/database ready at22:51. No50 push until the entire
49/finalLiveQA/freshidentity gate.50–56 queue remains unchanged from22:30; only57
is newly packaged. Never push staged root. Next: continue the ordered release
gate;57 still requires preceding CI/live gates and its own live deployment backup
receipt/identity/gameplay acceptance. Well Rested and all major roadmap gates
remain open; the full objective stays active.

## Historical checkpoint — September 8, 22:30 UTC

PROGRESS: read-only predeployment schema checks, recovery instructions and an
actual-session join-race correction are implemented and verified locally.
Previous direct-request turn closed the live74006 test handle successfully;
its full resource client result is240 suites/3404 tests/183.641s, lintPASS.
That result covered ec9c7f7, before the following server-only work and note edits.

Bridge56 is now **9aec835f8b9950dfdb2391dce85d1dde5f90fb90** in the canonical
`/tmp/eidolon-schema-compatibility-bridge-ehsEZY` tree (fast-forwarded after its
prior frozen test completed). Auxiliary join-fix tree
`/tmp/eidolon-schema56-join-fix-IcrDyp` holds the same clean commit. Queued50–55
are unchanged from the22:12 list. Resource candidate now
**7886278c0f53483d42578a9c7a646c97ac11df48** in its existing tree, clean and still
unpublished with inherited56 metadata; give it its own version before packaging.

f5d70e4 adds `--check-schema` before logging/database initialization/journaling.
It reads compatibility without applying migrations. Deployment builds its target,
starts only Mongo if needed without recreating it, then checks the target before
replacing the live API. Startup still rechecks; this is not a deployment lock.
Real-script/fake-command tests prove rejection/database failure skip replacement;
they do not claim a real Docker replacement test. Actual binary/database tests
1502 PASS4.083s (schema7/future8),72690 PASS4.213s (schema8/future9) prove fresh/
compatible acceptance and future rejection without migration indexes, new
collections, changed protected BSON, log/journal files or admission. Owned Mongo
containers/volumes removed and independently absent. Deployment README and56
notes now explain preflight and supported roll-forward, not marker downgrades.

The first combined actual97400 FAILED16.810s: bridge phase170 raced its Join
playerID assignment with snapshot-recipient selection. Evidence
`/tmp/eidolon-compat-session-4002784332/server.log`; failure retained, not passed.
9aec835 publishes immutable character identity under sessionsMu, serializes rejoin
snapshot resets/broadcasts, and rejects switching accounts on a bound connection.
Repeated queue/binding/reset/preflight99117 PASS4.802s (10 repetitions). Resource
merge7886278 preserves account-work locks, current live entities, pending-save/
auction recovery, retired/transport flags and both distinct queue tests. Its only
new runtime differences from3c06314 are conditional username assignment and the
equivalent locked reset helper; no resource or auction behavior was removed.

Full race: preflight93164 PASS(game381.901s); corrected root48751 PASS20.279s;
final bridge85724 PASS(root21.787s/game cached); final resource44715 PASS(root
24.822s/game/database/lifecycle cached). Final231 version checks43219 PASS5.034s;
lint passed. Earlier45288 used plain Jest without the project's ESM wrapper and
failed to load; corrected `npm test`98375 and43219 pass. A dirty pre-commit binary
under `/tmp/eidolon-schema56-join-proof-5Etr4z` was NOT used as acceptance evidence.

Combined actual55609 **PASS twice**, two fresh Mongo databases,16.886s/18.133s:
schema7 save→8 casts/listings→rejected full escrow save/journal→SIGKILL→refused7→
two recovered8 sessions, with resources/gold/items/receipts preserved once.
Race binaries:
`/tmp/eidolon-schema56-fixed-join-proof-sRZ11L/9aec835f8b9950dfdb2391dce85d1dde5f90fb90`
and `/tmp/eidolon-resource-final-join-proof-VUOmF8/7886278c0f53483d42578a9c7a646c97ac11df48`.
Logs `/tmp/eidolon-resource-final-join-actual-{1,2}.log`; all8 child logs audited
clean:2 intended kills,2 verified legacy saves/normal exits,4 resource shutdown
drains. Both incompatible startups exit1 before admission. Owned Mongo2230 and
volumes removed/independently absent. No owned local test handles remain.

49 CI34284099182 on0c6d0cc remains ACTIVE: Go/Jest/all3 browser shards PASS,
predeploy animation gallery PASS and disposable full-character gameplay running.
Fresh public manifest/backend both48/546391c, healthy/database ready at22:30.
Do not push50 before whole49/finalLiveQA/freshidentity. Never push staged root.
Next: finish the ordered release gate and package resource separately, retaining
the documented pre-upgrade consistent Mongo/journal backup and compatible target
requirements before schema8 publication. Well Rested and full major roadmap
acceptance remain open; the entire goal stays active.

## Historical checkpoint — September 8, 22:12 UTC

PROGRESS continues: complete corrected49 ancestry is now carried through50–56
and integrated into the pending resource candidate.49 CI34284099182 on
0c6d0cc remains ACTIVE (clientPASS, server in progress). No50 push before the
entire49/finalLiveQA/freshidentity gate. Last verified live48; do not push root.

Final ordered queue, existing canonical paths unchanged:
50=b7b86f51bf7a9ce64a426861846095d3e91aedb4;
51=144b0eb7eb082b55c9926f92f74cbf2e237fe700;
52=beaee77c4d91872471efbdd8b50b8052d52565dc;
53=4797d8e73985cc5d28903a5dc0da28c23561194f;
54=8049332bdba7040a9a6543b24f53607eb789fcd4;
55=b887c7396fb6ca647870d8729c304bfc43660e85;
56=b2f81ad7eee2640f062b76fbe5fe1aa660948638 (bridge tree).
These now include final49's isolated Tripwire fixture.56 full merged client83306
CLOSED PASS0:239 suites/3394 tests169.27s, lintPASS; subsequent final49 ancestry
adds only the already-verified Go fixture, no client/runtime changes.

Resource tree nowec9c7f7f653a3c8236857f6735e544f3689eb7ce, merged final56 ancestry.
Still an unpublished persistence candidate, now carrying56 metadata, NOT another
approved56 release and not yet assigned its own future version. Resolve this
before packaging/publishing. Merge retains resource transportClosed/retired flags,
deferred character-work cleanup, bound identity, state locking, resource snapshots,
schema8 and durable auction protections. Both distinct queue concurrency tests
are retained. Anonymous CI keeps BOTH trading-selection and respawn-appearance.
Direct comparison against4321e69 confirms server runtime differs only in build
version: no behavior was lost in resolving the bridge queue conflicts.

Combined focused15380 PASS250 client checks; server full race91688 CLOSED PASS0:
root19.217s, game/database/lifecycle cached from the accepted runtime. Actual64223
CLOSED PASS0/14.628s against a fresh owned database, race binary
`/tmp/eidolon-resource-final56-proof-3tjsUy/ec9c7f7f653a3c8236857f6735e544f3689eb7ce`.
Entire schema7 save→schema8 casts/listings→pending escrow journal/SIGKILL→refused7→
two recovered8 sessions passed with preserved resources, gold, items and receipts.
Four child logs independently clean:1 intended kill,1 verified legacy save/normal
exit,2 resource drains; expected old-version refusal exits1 before admission.
Exact owned Mongo2211 and volumes removed/independently absent. Log
`/tmp/eidolon-resource-final56-actual.log`. Full merged client/lint74006 ACTIVE;
lint already passed and Jest progressing. Source frozen pending completion; log
`/tmp/eidolon-resource-final56-{client,lint}.log`. Supported recovery/deployment
documentation and ordered packaging remain before publishing the resource format.
Well Rested and all remaining major roadmap gates are still open.

## Historical checkpoint — September 8, 22:08 UTC

Previous turn was PROGRESS (respawn visual fix and expanded rest scope). This
turn is PROGRESS: real dungeon recovery and Rogue respawn acceptance completed,
49 republished with corrected QA, and fixes integrated through the later queue.
Full1.1–1.10 goal remains active/incomplete; Well Rested remains planned.

The navigation failure was the recovery driver continually evading slow melee
enemies while trying to click an occupied room center.49 test0c1bf8a stops only
inside the target room near a live hostile, then retains every real-damage/death/
explicit-respawn/same-seed/re-entry assertion and timeout. Focused approach/input
tests pass. Actual65495 CLOSED PASS0: THREE fresh Wizard layouts,52.5s/49.8s/42.6s;
seeds2759083004004298719,5312252406745334818,-7273661173164765657. No jump, damage,
kill, protection or position override; only the documented prepared level30.
Logs `/tmp/eidolon-recovery49-2154{a,b,c}.log`.

b576525 adds class selection to the isolated recovery runner and verifies the
real post-respawn hitbox remains invisible. Actual66614 CLOSED PASS0/43.4s,
Rogue seed6094580505815586236; ordinary dungeon death, rejected dead recall,
button respawn, unchanged unfinished run on re-entry. Town screenshot inspected:
normal Rogue, no cube. Logs `/tmp/eidolon-recovery49-rogue.log`; owned four Mongo/
API containers and volumes removed/independently absent. This strengthens the
earlier prepared-component proof of visual runtimee56b4c8; its full client39229
remains PASS235 suites/3339 tests. Final version/approach10749 PASS230 checks.

c3de669 cherry-picks the version-independent rendered manifest/login/latest-notes
check from56. Final anonymous78723 PASS2 cases25.1s and lintPASS; screenshot of
49 notes inspected including No glowing box after respawn. Normal push47083
succeeded; however CI34283592413 then FAILED coverage at
TestTripwireRootsForThreeSecondsAndRespectsCCImmunity/ordinary_enemy; client job
passed and deployments skipped. This is the previously diagnosed random-overworld
intruder in the single-use-trap fixture, not a Tripwire runtime change.

49 now0c6d0cced85f3ebd0391eaac5f105b04e3b40be1 in
`/tmp/eidolon-release49-navigation-dqbOBW`, branchwork/release49-navigation-20260908.
Only the already-verified resource candidate's isolated Tripwire test was carried
forward, retaining three-second duration/CC immunity and adding exact intended-
target hit/damage checks.19907 CLOSED PASS0:100 race repetitions33.717s. Normal
push24230 succeeded; remote independently matches0c6d0cc. New CI34284099182 is
ACTIVE. No50 push before whole49/finalLiveQA/fresh public identity. Live last
independently verified healthy48/546391c; root staged52 must not be pushed.

Later queue currently inherits49/c3de669, NOT yet the final0c6d0cc Tripwire test:
50=74ea6cd18710bc295e1b4a84c34d8724ff3455a2;
51=7a124997174daa262129834db7341269d7f2b295;
52=7baba4588a4b36fa76f234bc18fa85387d98a44c;
53=5bbec2752a9a6fd3910b48fb17552ff03599351a;
54=80ab8822520c250441ebde45956bc7b5d5ad871c;
55=92bc43104ab65bb7c2f3c800d81b8924dc29283a;
56=492ea722d0995358d9f5f8754b00e823e2b25640 (bridge tree).
Existing canonical50–55 paths unchanged. Merge conflicts resolved preserving52
death-only mana refill plus stealth cleanup,54 damage plus stealth imports, and
all53/55 named QA scripts plus the new anonymous respawn check. All seven queue
version/appearance/approach runs39402 CLOSED PASS0;52 combined death-resource/
appearance/version53761 PASS.56's server tree is identical to race-verifieddff080b;
its full merged client/lint83306 remains ACTIVE (lint passed, Jest progressing)
at `/tmp/eidolon-schema56-merged-{lint,client}.log`. Keep its inputs frozen until
completion. Carry final49 test ancestry through50–56 before publishing any of them.
Resource candidate remains4321e69, not yet merged with the updated final queue.

## Historical checkpoint — September 8, 21:52 UTC

PROGRESS: user-reported respawn cube reproduced and fixed in49 descendant
`/tmp/eidolon-release49-navigation-dqbOBW`, commit e56b4c8 (after diagnostic95acbd6).
Rogue.cancelAbilities previously made every material opaque, exposing the invisible
ActorInteractionHitbox after death. Regression48124 failed opacity0 vs1 before
the fix. Stealth now owns isolated temporary material copies, restores only its
changes on expiry/cancel/death/respawn/disposal/mesh replacement, and preserves
translucency/shared pooled originals. Interaction boxes also disable color writes
while retaining raycasting. Focused53282 PASS75 tests; final lint12975 PASS.
Rendered79896 PASS1/8.4s, prepared real Rogue/model lifecycle scene; screenshot
inspected without cube after repeated respawns and expiry. This is not multiplayer
earned-death proof. Full client39229 CLOSED PASS0:235 suites/3339 tests142.466s.
49 cumulative notes include the fix; anonymous CI now includes the visual test.
No release push yet because dungeon acceptance below still fails.

Navigation98013 CLOSED FAIL1 on first repetition (second never started): no
clear pointer candidate near the occupied encounter center, seed-1687759325318940866.
Further instrumented36130 CLOSED FAIL1, `/tmp/eidolon-route49-2145.log`,
seed-2357726041626336347. Actor repeatedly circles center because Skeleton
silhouettes cover intended destination; no hostile damage received. This does
not yet establish whether an AI or navigation/test defect is responsible.
Ground/input diagnostics remain uncommitted in49 tree, separate from the visual
fix. Both original CI seeds were replayed through production generation/validation
successfully via TestReportedDungeonSeed; valid geometry alone is not combat proof.
Fresh public client/server checks21:41 still match healthy48/546391c.

User's new safe-zone/Well Rested feature is recorded in its linked plan and both
main roadmap and balance plan (root952dff0):10% maximum HP/MP/sec in safe zones,
one buff second earned per second there, cap7200, countdown only outside,
10% all stats/25% enemy-kill XP and particle aura. Planned, not implemented/live.
Explicit stat mapping and offline policy remain implementation design decisions;
proposed offline pause earns/spends nothing. Outside .01 regen unchanged.
Full1.1–1.10 scope remains active. Root staged52 must not be pushed.

## Historical checkpoint — September 8, 21:40 UTC

The previous regen-only turn verified the already-implemented .01 rate without
roadmap implementation changes. This continuation is PROGRESS: bridge queue
race fixed, actual upgrade/crash/refused-old-writer/recovery acceptance closed,
and49's terminal CI failure identified. Full1.1–1.10 remains active/incomplete.

Bridge staged Alpha1.0.56 in `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`,
runtime dff080bfe03069d74748ed806cfe746f7b34acdf. Version93ddad5 and browser
checkc47257e synchronize package/server/deployment/login/notes. Actual roundtrip
exposed a bridge send/close race; dff080b locks all queue producers and closes,
with a concurrency test and Clean disconnects notes. Focused queue race passes;
full7903 CLOSED PASS0: root19.664s, game/database cached from earlier passing
full17140 (game378.604s). Final version231 checks/lint pass; full client21761
PASS237 suites/3379 tests before queue-only code/notes addition. Rendered92857
PASS2 cases6.4s and screenshot inspected. No56 publication yet.

Resource `/tmp/eidolon-resource-persistence-c6E17J` includes schema fence153fbcb;
288b623 fixes an actual AI reader racing World-owned cast state by snapshotting
under World→Entity locks before taking the enemy lock. Full9898 completed PASS:
root18.942/game298.014s. Test4321e69 preserves actual legacy HP1/MP100 baseline,
not an invented full-capacity login. Corrected actual60645 and48290 CLOSED PASS0
16.795s/12.545s on two fresh databases: schema7 ordinary save → schema8 gameplay,
two listings/zero mana → pending journal and SIGKILL → old-server refusal with
unchanged BSON/journal/operation → two resource recoveries. Exact gold1184,
XP17, level31, equipment, paired receipts, zero mana and two once-only listings;
first deadline unchanged. Eight child logs audited clean:2 kills,2 verified
legacy disconnect saves/normal exits,4 resource drains. Expected refused starts
exit1 before admission. Owned Mongo/volumes removed/absent. Logs
`/tmp/eidolon-schema-fixed-{actual,repeat}.log`. Earlier attempts5518/84072/81661/
40736 are failures, not proof: legacy-baseline assumptions, AI race, queue race.
Resource remains unpublished55 metadata; supported deployment restrictions and
ordered final ancestry still required before its format-changing release.

49 CI34274941211 CLOSED FAILURE21:26:59 on9342ac0. Earlier server/client/browser
smoke succeeded; Predeploy Character QA failed first-corridor navigation in
`dungeon-wipe-recovery-gameplay.spec.js` twice (seeds -4300462428721345317 and
6904159723364978605). Deployments/finalLiveQA skipped. No50 push. Evidence
downloaded `/tmp/eidolon-release49-failure-8rMABN`. Dedicated49 descendant
`/tmp/eidolon-release49-navigation-dqbOBW`,95acbd6, adds approach-coordinate
diagnostics only. Initial27440 PASS41.5s on seed2159278409556713907; this does
not disprove the CI defect. Two further fresh runs98013 ACTIVE. Do not simply
rerun failed CI or weaken corridor/death/respawn assertions without diagnosis.
Last independently verified live48; root staged52 must not be pushed.

## Historical checkpoint — September 8, 21:06 UTC

Previous goal turn was PROGRESS (stale selection). This turn is PROGRESS: paid
listing duration now starts at first publication, and an independent compatibility
bridge is implemented. Full1.1–1.10 scope remains active/incomplete.

Resource46ea06975f90a80423fd00d4ea3400e2ab6d1575 preserves the full listing
window after delayed publication while matching the first stored start/end on
replay. Original operation preparation times stay immutable. Existing earlier
publication timestamps remain recoverable; backwards clocks clamp to preparation.
Focused78922 PASS root1.451/database1.057/game1.042s. Full64867 CLOSED PASS0:
root22.355/database1.172/game417.161s. Actual32868 CLOSED PASS0/262.172s, TWO
repetitions of nine normal/rejected modes, seven crash boundaries and delayed
publication. The three-day outage is an explicitly prepared timestamp-age fixture
after a real request, escrow commit and SIGKILL, not three days of elapsed QA.
Ordinary market messages expose a fresh24-hour window; restart and lost-reply
recovery do not extend it. All84 child logs independently clean:16 deliberate
kills,68 normal drains. Owned Mongo2057/volumes removed/absent. Logs
`/tmp/eidolon-listing-publication-{full-race,sessions}.log`. Resource tree remains
unpublished55 metadata at `/tmp/eidolon-resource-persistence-c6E17J`.

Independent bridge `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`, branch
`work/schema-compatibility-bridge-20260908`, based on canonical55/9f92f98:
runtimef2238ce506c4961fbd8cc117b706a885ba45dc0f reads schema compatibility BEFORE
any migration/index write and refuses future versions before server admission.
Focused45306/72751 PASS. Actual52120 CLOSED PASS0/1.903s: two real schema7-server
processes refuse prepared schema8; raw character BSON with zero mana, gold1209,
receipt-25 and unknown future fields stays identical, no collections/indexes
added. Compatible fresh/repeated migration still works. Owned Mongo2103/volumes
removed/absent. Full17140 remains ACTIVE, log
`/tmp/eidolon-schema-bridge-full-race.log`; source frozen. Actual log
`/tmp/eidolon-schema-bridge-actual.log`. No new release number assigned yet.

Bridge must be verified/published after55 and BEFORE the resource format change,
then integrated into that candidate and tested across actual upgrade/refused-old-
writer/roll-forward recovery. This is not a distributed writer lease or retroactive
protection for unmodified55 or older; supported target restrictions remain required.

49 CI34274941211 on9342ac0 remains ACTIVE in Predeploy Character QA; preceding
server/client/browser smoke passed. Last independently verified live48. No50 push
before full49/finalLiveQA/fresh public identity. Root staged52 must not be pushed.

## Historical checkpoint — September 8, 20:52 UTC

This turn is PROGRESS: stale listing-slot protection and acceptance completed.
The full roadmap remains active/incomplete. Resource Go runtime57c97c1 full
race77182 CLOSED PASS0: root17.736/game415.255s, database/lifecycle cached.
Corrected actual31382 CLOSED PASS0/232.806s: two repetitions of nine normal/
rejected listing modes and seven SIGKILL boundaries. All78 child logs independently
clean:14 intended kills,64 normal completed drains. No skipped cases. Exact owned
Mongo2046 and volumes removed; container independently absent. Log
`/tmp/eidolon-listing-selection-sessions-corrected.log`. The initial55659 launcher
failure is retained and does not count as acceptance.

Client69597 PASS238 suites/3388 tests219.707s on57c97c1. Client-only1886cee
clears stale tooltips and adds the browser regression to the normal anonymous CI
script. Final lint16643 CLOSED PASS0; focused60 tests pass after that change.
Browser21690 failed a too-strict
hidden-tooltip assertion when the pointer legitimately hovered the NEW item;
41095 then failed because a negative text assertion required a visible element.
The final assertion requires zero visible OLD-item tooltips and verifies hiding
after an ordinary pointer move. Browser21323 CLOSED PASS0:4 cases32.6s, TWO
repetitions at1280x900 and390x844. Both resulting screenshots viewed: clear stale
selection, readable guidance, no stale tooltip, persistent chat. This is prepared
UI fixture evidence, not physical-phone/earned-inventory or full mobile signoff.
Logs `/tmp/eidolon-listing-selection-browser-{final,pointer,accepted}.log`.

49 CI34274941211 remains ACTIVE at20:52, Predeploy Character QA; all preceding
server/client/browser-smoke jobs succeeded. Last independently verified live48.
No50 push before the entire49/finalLiveQA/public-identity gate. Root staged52
must not be pushed. Resource candidate still has unpublished55 metadata, not a
release assignment. Next: publication-delay duration fairness, then enforced
compatible rollback before resource-candidate publication; broader roadmap gates
are unchanged. No server test process is left running for this slice.

## Historical checkpoint — September 8, 20:48 UTC

The preceding regeneration-only reply verified the existing .01 client/server
rate but made no roadmap implementation progress. This continuation is PROGRESS:
stale auction-slot protection is implemented and undergoing acceptance. The full
1.1–1.10 goal remains active; no major-version gate is being narrowed.

Listing0908438 full34429 CLOSED PASS0: root12.001/database1.088/game286.630s,
confirmed from `/tmp/eidolon-auction-listing-full-race.log`. Its prior actual
session acceptance remains closed. Resource candidate57c97c13ccf0a967bb7170b353d0549049963098
now sends frozen selected item ID/quantity and validates both under the seller
lock before reserving any listing or charging escrow. Missing expectations fail
closed. Inventory refresh/submit clear stale selections and require reselection.

Focused Go race9864 PASS0; initial client62423 PASS13 tests. Full client69597
CLOSED PASS0:238 suites/3388 tests,219.707s; lint passed. Browser48658 failed only
on prepared unknown-name icon404s after its selection assertions. Corrected
fixture33513 CLOSED PASS0:2 desktop/phone cases21.8s. Screenshots exposed a stale
tooltip; a client-only follow-up hides it when clearing selection. Final focused
60 tests pass; final browser21690 remains ACTIVE. Go source remains identical
to57c97c1 while its runs are active.

Full Go race77182 ACTIVE at `/tmp/eidolon-listing-selection-full-race.log`.
Initial actual55659 CLOSED FAIL1/158.414s: launcher named the binary `server`,
but the existing health gate requires its basename to equal the embedded commit;
crash cases also skipped because failpoint opt-in was omitted. No acceptance
claimed from that run. Exact owned Mongo2045 and volumes removed/absent.
Corrected actual31382 ACTIVE on the same binary renamed to57c97c1's full SHA,
with failpoint opt-in, two repetitions of nine normal/rejected cases and seven
SIGKILL boundaries. First nine normal cases passed; crashes are progressing.
Log `/tmp/eidolon-listing-selection-sessions-corrected.log`; owned Mongo is
`eidolon-listing-selection-proof-20260908-2046` with EXIT cleanup installed.

49 CI34274941211 on9342ac0 is still ACTIVE: server/client and all three browser
smoke shards passed, Predeploy Character QA running. No50 push until entire49
CI/finalLiveQA/fresh public identity succeeds. Last verified live remains48.
Root staged52 must not be pushed. Resource candidate remains unpublished55
metadata, not release-approved; delayed-publication duration fairness and enforced
compatible rollback remain next protections before publication.

## Historical checkpoint — September 8, 20:30 UTC

Previous turn was PROGRESS (atomic buyouts). This turn is PROGRESS: buyout
acceptance closed, listing escrow implemented,48 fully verified live and49
published to the ordered CI queue. Full1.1–1.10 goal remains active/incomplete.

48 CI34266379714 on546391c CLOSED SUCCESS across the entire pipeline, including
Live Release and Character QA. Fresh independent public checks20:27:25 confirm
release manifest, backend commit/version, healthy/database ready, versioned main
entry and login label all match48/546391c.49's clean canonical tree9342ac0 has
48 ancestry and matching package/server/workflow/login/patch notes. Normal
fast-forward push91492 CLOSED0; remote master independently confirmed9342ac0.
**49 CI34274941211 ACTIVE** on9342ac074a29831e9dea54a0e2ad6eff890b6a3f.
No50 push until the whole49 pipeline/finalLiveQA/freshidentity pass.50 remains
1e2eb11 in `/tmp/eidolon-release50-final49-XhZNjw`; later queue refs remain in
19:01 checkpoint. Root staged52 must not be pushed. Live last verified48.

Buyout481c3d0 full83710 CLOSED PASS0 (root26.628/database1.131/game379.886s).
Actual73205 CLOSED PASS0/329.789s, TWO combined repetitions; all88 child logs
independently clean (12 intended kills,76 normal drained shutdowns). Exact owned
Mongo eidolon-auction-buyout-proof-20260908-2007 and volumes removed/absent.
Logs `/tmp/eidolon-auction-buyout-{full-race,sessions}.log`.

Listing runtime0908438119e0fded426176b148f061b5c95b2f15 now saves current
ownership before the immutable listing decision, then journals item removal+
deposit debit+paired receipts before publishing under a unique auction ID.
Recovery permits a missing auction only for a valid listing decision and checks
an existing inserted listing matches exactly. Additional stack units remain in
the bag; changed/missing/ambiguous selected items and insufficient funds cannot
partially escrow. Replay checks receipt identity before current bag/balance.
Persistent legacy CreateAuction is blocked. The deposit is mathematically5%
(buyout/20, minimum1); listing terms/time remain frozen at request preparation.

Initial95070 focused PASS; race44437 PASS root5.134/database1.053/game1.437;
expanded99500 PASS2.927/1.059/1.503. Tests cover terms, duplicate requests,
invisibility before escrow, stack preservation, missing/changed/ambiguous items,
receipt replay after reacquisition/spending and journal failure/retry.

**Full34429 ACTIVE**, frozen0908438, log `/tmp/eidolon-auction-listing-full-race.log`.
**Actual39545 CLOSED PASS0/202.614s**, exact binary, TWO repetitions of six normal/rejected
listing modes, seven SIGKILL boundaries, competing buyouts and normal seller
payout. First normal set PASS32.08s; first seven crash cuts have passed. Tests
start with legacy inventory and a Fireball without an intervening disconnect
save, requiring durable normalization/current70mana, exact escrow and one
listing through restarts. All74 child logs independently clean:14 intended kills,
60 normal completed drains. Owned Mongo
eidolon-auction-listing-proof-20260908-2027 and volumes removed; exact container
independently absent. Actual log
`/tmp/eidolon-auction-listing-sessions.log`. Poll remaining full34429 before
editing source. Resource tree remains `/tmp/eidolon-resource-persistence-c6E17J`,
with evidence16deb7d after runtime; unpublished55 metadata, not release-approved.

Next after verification: bind client listing selection to expected item identity/
quantity (current wire payload has only slotIndex/prices/duration, allowing stale
slots to select replacements); review delayed-publication expiry fairness; enforce
compatible rollback/receipt handling before publication. These are open work,
not completed protections. Wider phone/campaign/raid/major-version gates persist.

## Historical checkpoint — September 8, 20:08 UTC

Previous goal turn was PROGRESS (durable item claims/returns). This continuation
is PROGRESS: that acceptance closed and atomic buyouts are implemented with
focused coverage and actual/full runs in progress. Full roadmap remains active.

Item runtime0c847a8: fullrace54188 CLOSED PASS0, root18.154/database1.136/
game336.821s. Actual85368 CLOSED PASS0/229.306s, TWO combined repetitions.
All68 child logs independently clean:12 intended SIGKILLs,56 normal completed
drains. Owned Mongo eidolon-auction-item-proof-20260908-1952 and volumes removed,
exact container independently absent. Logs `/tmp/eidolon-auction-item-{full-race,sessions}.log`.

Buyout runtime481c3d08c919fd062d368881233e03fe3c90ab05 now journals the exact
item, price and displaced escrow identity. Live/offline account-ordered purchase
commits debit+delivery and both receipts in one full character snapshot before
finalizing SOLD/BuyerID/SalePrice/ItemClaimed and one previous-bid refund. Pair
validation fails closed on an incomplete receipt pair or changed price/payload;
replay does not charge/grant after the player spends gold or moves the item.
Full capacity or insufficient funds changes neither side. Legacy persistent
buyouts are blocked, disabled buyout prices reject rather than grant for free,
and successful handlers send detached inventory/stash with no second item grant.

Initial37463 compile failed for a missing database import, fixed before tests.
Focusedrace71182 PASS root3.712/database1.047/game1.569; expanded24093 PASS
3.275/1.058/1.667; final47240 PASS4.372/1.041/1.628. Test-only redundant password
nonempty check removed before commit; real login/input assertions unchanged.
Logs `/tmp/eidolon-auction-buyout-{initial-focused,focused,expanded-focused,final-focused}.log`.

**Fullrace83710 ACTIVE** on frozen481c3d0,
`/tmp/eidolon-auction-buyout-full-race.log`. **Actual73205 ACTIVE** on exact
binary: TWO repetitions of ordinary/same-bidder/stash/full/insufficient/disabled
buyouts, six purchase SIGKILL cuts, two simultaneous buyers, previous item
claims/returns/capacity and normal seller payouts. First six ordinary modes
PASS58.97s; whole run not terminal. Log `/tmp/eidolon-auction-buyout-sessions.log`.
Owned Mongo eidolon-auction-buyout-proof-20260908-2007 with EXIT cleanup. Poll
the same handles before editing source. Resource candidate at
`/tmp/eidolon-resource-persistence-c6E17J` has only evidence commit3a2b3f5 after
the tested runtime, remains unreleased55 metadata and is not publication-ready.
Next: close actual/full buyout acceptance, implement durable listing item/deposit
escrow, enforce compatible rollback, then wider campaign/instance/device gates.

48 CI34266379714 freshly ACTIVE in predeploy full-character gameplay, with
client/server/all smoke shards PASS. Fresh public manifest/health20:08 still
match healthy47/6925c51/database ready. No push this turn.49 stays gated on the
whole48 pipeline/finalLiveQA/freshidentity; root staged52 must not be pushed.
Queue49–55 references remain in19:01 checkpoint. Full1.1–1.10 scope unchanged.

## Historical checkpoint — September 8, 19:54 UTC

Previous turn was PROGRESS (full race closure and normal seller payout evidence).
This turn is PROGRESS: durable exact buyer item claims and expired/cancelled
seller returns implemented. Full roadmap remains active and incomplete.

Resource runtime0c847a81f4bf39c0b2c213fcc648a58988d0a756 introduces item_claim
operations with immutable JSON payload/original claim status. Authorization and
complete capacity are checked before reserving. Account-ordered recovery first
flushes the latest pending snapshot, then atomically grants the item plus private
SHA256 receipt and pins the entity until its full character save is journaled.
Only after delivery commit does the guarded auction update mark ItemClaimed (and
SellerClaimed for returns). Offline conversion preserves unrelated legacy gear;
all save/hydration/snapshot paths retain and privately copy the new receipt map.

Detached placement preserves every item property and only merges stacks whose
properties match apart from ID/quantity. Insufficient inventory+stash capacity
does not partially change stacks or drop ground loot; the unapplied reservation
is released and collection can be retried after freeing space. A matching receipt
is checked before capacity, so recovery cannot duplicate an item already moved
or consumed. Persistent legacy direct item claims are blocked; the handler does
not perform a second grant and serializes detached final inventory/stash state.
Buyouts/listing escrow are NOT converted yet; compatible rollback remains open.

Focused63426 PASS; initial73366 test compilation FAILED (Entity.GetCopy does
not exist), corrected to World.GetEntityCopy. Corrected57785/expanded85095/
capacity52907 PASS under race detection; final root2.243s/game1.221s. Database
package compiled with no matching tests in those filtered runs; item-operation
validation runs in the new game tests. Journal failure/retry, private receipts,
exact metadata, partial stack rejection, capacity changed after reservation,
retry after freeing space and non-rescaling offline conversion are covered.
Candidate docs contain logs and limitations, and no acceptance assertion removed.

**Fullrace54188 ACTIVE**, frozen0c847a8, log
`/tmp/eidolon-auction-item-full-race.log`. **Actual85368 ACTIVE**, exact built
commit, TWO repetitions, log `/tmp/eidolon-auction-item-sessions.log`. First
normal buyer/expired/cancelled/stash/full-capacity set PASS31.30s; first six
SIGKILL boundaries PASS49.18s. Whole run not yet terminal. Also includes prior
normal seller payout and same-bidder/competing requests. Owned Mongo
eidolon-auction-item-proof-20260908-1952 has EXIT cleanup. Poll the same handles;
do not edit candidate source until terminal. Resource branch stays
work/resource-persistence-20260908 at `/tmp/eidolon-resource-persistence-c6E17J`,
with only evidence commits after tested runtime. No release number assigned.

48 CI34266379714 freshly ACTIVE in predeployment full-character gameplay;
client/server/three smoke shards PASS. No push this turn.49 remains gated on
the complete48 pipeline/finalLiveQA/fresh exact public identity. Last public
client/backend47/6925c51 healthy/ready at19:33:44. Root staged52 must not be
pushed; ordered49–55 queue remains in19:01 checkpoint. Next: audit item actual/
full results, then combined durable buyout debit+item and listing escrow; broader
phone/campaign/raid/rollback milestones remain open.

## Historical checkpoint — September 8, 19:39 UTC

Previous goal turn was PROGRESS (auction snapshots and observed Tripwire fixture
correction). This turn is PROGRESS: full verification closed and ordinary seller
payout acknowledgement/latest-cast persistence acceptance added. Full roadmap
remains active, with no release push or major-version completion claim.

Fullrace70943 CLOSED PASS0 on frozen8a5dc32: root19.160s/game402.487s, unchanged
database/lifecycle cached. Actual6487 CLOSED PASS0/155.808s on the same runtime:
two repetitions of seller crash boundaries and ordinary bid raises/contention,
44 independently clean logs (12 intended kills,32 normal completed drains).
Owned Mongo eidolon-auction-snapshot-proof-20260908-1930/volumes removed;
exact container independently absent. Logs
`/tmp/eidolon-auction-payout-corrected-full-race.log` and
`/tmp/eidolon-auction-snapshot-sessions.log`.

Separate test-only tree `/tmp/eidolon-auction-claim-next-7DZgQ3`, branch
work/auction-claim-next-20260908, was created from frozen8a5dc32. aad0229 adds
normal seller collection with an unsaved ordinary Fireball immediately before
the collection input. Actual64864 FAILED16.446s because its later locked-skill
probe landed inside the valid500ms global cooldown; immediate durable payout
and70mana assertions had passed.2b80416 delays only that later probe to550ms
after cast acknowledgement, preserving the immediate durability check. No
runtime or acceptance assertion weakened. Initial wrong-directory format/stage
commands were corrected;30251 compiled but skipped the opt-in session body.

Corrected91065 CLOSED PASS0/26.968s THREE repetitions: Collected100gold means
Mongo already holds1334gold/17HP/70mana/one receipt plus SellerClaimed and no
operation. Same-connection/restarted claims reject duplicates; exact gear/XP/
inventory and the buyer's unclaimed item remain unchanged. All six normal child
logs clean/completed drains; three initial failed-run logs also clean/drained.
Owned Mongo auction-payout-normal-20260908-1936/1938 (eidolon- prefix) and volumes
removed, exact containers independently absent. Logs
`/tmp/eidolon-auction-payout-{normal,normal-corrected}-sessions.log`.
Test continuation merged into resource candidate59c0338, followed by evidence
docs; no runtime change since accepted8a5dc32. No owned local test handles remain.

Next implementation: durable exact item receipt/full-character delivery for
buyer claims and seller returns, then combined buyout debit/item and listing
escrow. Inspection confirms current item claims finalize before the handler's
grant, and full bag/stash can drop nonpersistent ground loot. These are known
unfinished paths, not covered by accepted seller-gold recovery. Preserve whole
item metadata/quantity, make full-capacity failure all-or-nothing, replay receipt
before capacity checks, and guard old-writer rollback before release. Details in
the candidate operation-recovery plan. Wider dungeon/raid/device/campaign gates
are unchanged and remain open.

48 CI34266379714 freshly ACTIVE: client/server/three smoke shards PASS,
predeployment disposable full-character gameplay running. Fresh public release
and health19:33:44 both match47/6925c51, healthy/database ready. No49 push until
whole48 CI/final live QA and fresh exact public identity pass. Root staged52
must not be pushed; queued49–55 references remain in19:01 checkpoint.

## Historical checkpoint — September 8, 19:29 UTC

This turn is PROGRESS: payout crash evidence closed, auction response aliasing
fixed, and an observed unrelated full-suite fixture failure corrected. Full
roadmap remains active/incomplete; no new release published in this turn.

Resource candidate8a5dc32 (work/resource-persistence-20260908 in
`/tmp/eidolon-resource-persistence-c6E17J`) is committed and clean. Auction list
responses now detach scalar state and nested item stats/gems/forge basis/refunds
under the trading read lock before network serialization. Three old-path tests
80715 failed as expected. Concurrent serialization and detached mutation tests
now cover search, seller and buyer results.

Original fullrace65216 FAILED334.950s; unchanged100-repetition Tripwire76053
also FAILED31.371s. Diagnostic41843 FAILED35.987s explicitly recorded
Skeleton-159:true rather than the intended enemy: a random overworld enemy
consumed the single-use trap. The fixture now isolates its actors in a scene,
requires an intended-target hit receipt/damage, and retains the same three-second
root/immunity assertions. Corrected10978 PASS36.891s/100 repetitions of all
three snapshot/Tripwire tests under race detection; no runtime trap change.

**Fullrace70943 ACTIVE** on frozen8a5dc32, log
`/tmp/eidolon-auction-payout-corrected-full-race.log`.
**Actual6487 ACTIVE** on the same exact binary, two repetitions of seller payout
crash boundaries plus ordinary bid raises/contention, log
`/tmp/eidolon-auction-snapshot-sessions.log`. Owned disposable Mongo
eidolon-auction-snapshot-proof-20260908-1930 with EXIT cleanup. Poll these exact
handles; do not edit candidate source until terminal. Prior3bd5df4 actual78070
PASS337.931s/98 clean child logs remains separately scoped evidence, not an
assumed pass for this changed candidate. Seller normal success acknowledgement,
actual expiry faults, buyout/item/listing recovery and rollback guard remain open.

48 CI34266379714 freshly ACTIVE at predeploy character QA; client/server/three
smoke shards PASS. No49 push until whole48 CI and fresh exact public identity.
Root remains staged52 and must not be pushed. Queue refs in19:01 remain current.

## Historical checkpoint — September 8, 19:24 UTC

The preceding direct-request turn verified the existing0.01 regeneration rate
with61 selected client tests and the server regeneration tests; no runtime edit
was needed. This continuation closes the pending payout evidence and investigates
the full-suite failure. Full roadmap remains active; no release gate waived.

Actual78070 is CLOSED PASS0/337.931s on3bd5df4: two repetitions of seller and
bid crash boundaries, ordinary raises/contention and prior refund-save/ack cases.
All98 child server logs independently scanned:24 expected SIGKILLs,74 normal
shutdowns with completed drains, no race/panic/fatal. Owned Mongo
eidolon-auction-payout-proof-20260908-1915 and volumes were removed by the normal
EXIT trap; exact container independently absent. This does not prove durable
buyout/item claims/listing deposits or compatible rollback, which remain open.

Fullrace65216 CLOSED FAIL1/game334.950s: Tripwire ordinary-enemy root assertion
failed (rooted=false), with no race report. Preserve
`/tmp/eidolon-auction-payout-full-race.log`; this is not a full-suite pass.
Unchanged focused20 repetitions91667 PASS; unchanged100 repetitions76053 ACTIVE,
log `/tmp/eidolon-tripwire-reproduction-100.log`. Source inspection finds this
test uses a populated random overworld for a single-target trap assertion;
interception is a lead, not yet an observed cause. Do not edit candidate sources
until this exact handle is terminal.

48 CI34266379714 freshly ACTIVE: client/server/all three browser shards PASS,
predeployment character QA running. No49 push until the complete48 pipeline and
fresh client/server identity checks pass. Candidate/root are not release refs.

## Historical checkpoint — September 8, 19:16 UTC

Previous goal turn was PROGRESS (accepted Seraph correction and ordered48 push).
This turn is PROGRESS: durable seller payout and confirmed-expiry ordering
implemented in the separate resource candidate. Full roadmap remains active.

Runtime3bd5df48ce0e104c638590fab54e5d26614b9cc1 adds an explicit seller_payout
kind and frozen fee/amount to the existing unique-per-auction operation record.
Ordinary seller collection reserves/persists its decision, commits a complete
character credit plus private seller-payout receipt under account ordering, then
marks the auction claimed. Startup/command recovery reuses the same ID. Persistent
seller collection can no longer use the old direct gold increment. Buyer item
state/escrow are not modified; fully settled auctions are eligible for later
cleanup only after no operation/refund remains. Unknown new kinds fail closed
in the new reader. Older unpublished readers are NOT compatible rollback targets;
an enforced bridge/roll-forward guard is still required before release.

Expiry now publishes SOLD/EXPIRED in memory only after its update is confirmed.
A failed save retains an expired-by-time ACTIVE record, rejecting bids/buyouts
and allowing a later expiry retry. An expired buyout request no longer changes
it to EXPIRED and discards a legitimate winning bidder. Unit injection checks
that unconfirmed expiry cannot enable a seller payout; successful retry can.

Focusedrace57922 PASS root3.827/database1.057/game1.124; expanded73151 PASS
2.970/1.040/1.165; final expiry54090 PASS2.233/1.085/1.208. Logs
`/tmp/eidolon-auction-payout-{focused,expanded-focused,expiry-focused}.log`.
The first Go invocation used the repository root rather than the server module
and failed immediately; corrected before these passes. No assertion removed.

Frozen-source **fullrace65216 ACTIVE**, log
`/tmp/eidolon-auction-payout-full-race.log`; **actual78070 ACTIVE**, log
`/tmp/eidolon-auction-payout-sessions.log`. Actual suite repeats six new seller
SIGKILL boundaries, six previous bid boundaries, same-bidder/contention/repeat
requests and prior offline/refund-save/refund-ack cases twice. Prepared sale100,
fee5/deposit5 owes100gold; ordinary saved Fireball/reconnect/collect then intended
kill/restarts must preserve1334gold,70mana,17HP, one receipt and the unclaimed
buyer item. These are assertions under test, not yet whole-run passes. Exact
owned Mongo eidolon-auction-payout-proof-20260908-1915; do not edit tested sources
until both exact handles are terminal. Candidate remains unreleased55 metadata.

48 CI34266379714 on546391c is freshly ACTIVE: client/server/smoke shards2 and3
PASS, shard1 running. No further push this turn, no48 live claim;49 stays gated
on the entire48 CI/finalLiveQA/freshidentity. Queue refs remain in19:01 checkpoint.
Public client/server last match healthy47. Next: close payout acceptance,
address remaining durable item/listing operations and rollback; auction list
snapshot detachment also needs review. Broader campaign/phone/raid gates remain.

## Historical checkpoint — September 8, 19:01 UTC

Previous goal turn was PROGRESS (bid acceptance and48 failure diagnosis).
This turn is PROGRESS: accepted Seraph route correction, fresh-world verification,
ordered inheritance through49–55 and normal fast-forward48 correction push.
Full1.1–1.10 remains active/incomplete. No milestone gate was reduced.

Actual19295 CLOSED FAIL1 on9dedb2a: the service menu could open during movement,
before readiness. f28e797c3babc3d8a16da66aea98dde55b819a6a now closes the
confirmed menu via its visible control around navigation, retrying only a
GroundInputUnavailableError with no attempted input and a confirmed modal.
Issued movement failures still fail. Existing ordinary zoom and proved facade
exit/observed-Titan navigation are retained; no runtime/gameplay changes.

Actual69668 CLOSED PASS0/1.7m; fresh-world repeat1 normal script completion1.8m
(set-e wrapper proceeds and archives evidence). Repeat2 also passes rendered
assertions1.9m, but outer67120 ends143 afterward before archiving it. Do not
count that whole wrapper as a normal success or infer the signal's cause.
Additional standalone57904 CLOSED PASS0, explicit QA_SCRIPT_EXIT=0/1.7m.
These preserve15/16.5s lifetimes,288 baseline and345 trained/saved smites,
talent persistence and ordinary dungeon recall cleanup. Full lint61600 PASS0.
All owned Seraph containers/data cleaned, independently absent; scans pass.
No owned local test handle remains active.

Logs `/tmp/eidolon-release48-seraph-{walk,repeat-1,repeat-2,final}.log`.
Reviewed evidence `/tmp/eidolon-seraph48-walk-evidence-VUj5lP/{first,repeat-1}`;
additional evidence `/tmp/eidolon-seraph48-third-evidence-s4Mf9e/{rendered-pass-wrapper143,final-normal}`.
Source acceptance document `docs/plans/2026-09-08-release48-seraph-recovery.md`
retains earlier failures and the pacing watchdog qualification.

Recovery546391c5af5193ba6456db9f4802d4c8f58208c9 was fast-forward carried to
canonical48 WT, then sequentially merged into49–55 without conflicts. Every
merge changes ONLY Seraph QA and its evidence document; identical test blob
210ee51b56bfefe7a21d6e07738e3a3940a28409, own version/login/patch notes verified.
Earlier release runtime and functional acceptance evidence remains unchanged.

| Release | Current queued SHA |
|---|---|
|48|546391c5af5193ba6456db9f4802d4c8f58208c9|
|49|9342ac074a29831e9dea54a0e2ad6eff890b6a3f|
|50|1e2eb11f85dc37cb50940d122a5431d21eb9c10e|
|51|5db01591b81bf2b248cf7130377a7ea71bf2fd6e|
|52|59621797fd39e4322b4df057883579943081dafd|
|53|882b96cc22f957b245bd54d49f7cd50f6ea06319|
|54|60a42b60179f8192f33f73aeac7e21538e88b695|
|55|9f92f985e6857edcdb99863b99d823af9196b4af|

Clean source, exact head, remote still7a9869d and ancestry checked before normal
push8658 CLOSED0 published ONLY48/546391c to master. Remote SHA independently
confirmed. **48 CI34266379714 ACTIVE** on this exact SHA; prior34257070035 remains
failed. Fresh public release/health still match healthy47/6925c5113ee6acdf698713f3332f80dcf546bd76,
database ready. No48 live/pass claim;49 waits on the entire new48 CI/finalLiveQA
and fresh client/server identity. Root staged52/ledger was NOT pushed.

Resource candidate37e01a1 remains separate/unreleased55 metadata, fullrace and
actual bid acceptance closed below. It has not yet inherited the new55 QA-only
merge. Next resource work: durable buyout/item, listing deposit and seller
payout/return operations with enforced rollback compatibility. Full campaign,
first-hour pacing, physical phones, dungeon/raid groups and remaining roadmap
milestones are still open. No56 approval or goal completion implied.

## Historical checkpoint — September 8, 18:45 UTC

Previous regeneration-only turn was NO ROADMAP PROGRESS; this resumed turn is
PROGRESS (actual bid acceptance, test corrections, committed evidence and48
deployment-failure diagnosis). Full1.1–1.10 remains active and incomplete.
No push this turn, no live48 or49 advancement. Remote master independently
remains7a9869d639659cd6f6173dca16c12ba2487e3221; healthy public client/server
remain47/6925c5113ee6acdf698713f3332f80dcf546bd76.48 CI34257070035 is terminal
failure, not a wait; all deployment jobs were skipped.

Resource acceptance closed as detailed below: runtime030ec67, testsa09ac66,
docs37e01a1. Fullrace1501 PASS; corrected actual37895 PASS439.525s, three
repetitions,115 clean server logs plus three expected startup failures. No local
resource handle/service remains. Candidate unreleased55 metadata; buyout items,
listing deposits, seller payouts/returns, rollback and wider acceptance open.

48 route88533 CLOSED FAIL1 on6a4ed8e, after baseline288 smites and15s/16.5s
lifetime checks. The actual call log identifies dungeon-menu-backdrop intercepting
the readiness chat click during trained combat, consuming the240s test budget.
The baseline screenshot was reviewed and showed visible combat outside the
facade. No trained/saved route pass is claimed. Log
`/tmp/eidolon-release48-seraph-zoom.log`; owned previous API/Mongo cleaned up.

Latest test-only9dedb2adf69773f833bf309f20d6255a0480d730 dismisses an opened
dungeon menu via its visible Close button before chat readiness, waits for the
backdrop to hide and bounds that chat click5s. This is ordinary menu recovery,
not forced pointer input or a relaxed summon assertion. Focused ESLint/diff
check passed. **Actual19295 ACTIVE**, freshly polled while building this exact
source; `/tmp/eidolon-release48-seraph-menu.log`. Worktree
`/tmp/eidolon-release48-seraph-recovery-Pjflp1`, branch
work/release48-seraph-recovery-20260908. Owned run48-seraph-menu-1844, API18931,
Mongo18932, web4293. Freeze this source until the exact handle is terminal;
observation expiry is not permission to restart. No other owned local run active.

Next: close19295, inspect screenshots and repeat the entire Seraph route on
fresh randomized populations before accepting48 correction. Preserve15/16.5s
lifetimes,288/345 actual smites, saved talents and ordinary dungeon cleanup.
Then propagate accepted48 QA changes through ordered49–55 and normal-FF publish
only48 correction, with its existing patch notes/version intact. Never push root
or resource over that queue. Keep the first-opening120s/two-respawn watchdog
failure in pacing work; a retry pass did not close its root cause. Full campaign,
phone, dungeon/raid and remaining roadmap requirements remain open.

## Historical checkpoint — September 8, 18:40 UTC

This turn is PROGRESS: durable bid acceptance closed and48 predeploy failure
diagnosed with a corrected browser route under test. Full roadmap remains active.

Resource corrected actual37895 CLOSED PASS0/439.525s, THREE combined repetitions
on a09ac66: six precise SIGKILL boundaries, same-bidder43→50→60 raises,
simultaneous equal bids, repeated requests, offline pending-save/refund ordering,
refund-save/ack failures and delayed backlog/unreadable-auction startup cases.
All115 normal/crash server logs independently clean (18 intended kills/97 normal
shutdowns), plus three expected startup rejection logs. Owned Mongo and anonymous
volumes removed/independently absent. No owned resource test handle remains.
Fullrace1501 PASS on runtime030ec67 as recorded below. Candidate37e01a1 commits
updated architecture and acceptance docs; no56 assignment/release approval.
Auction items/listing deposits/seller payouts and rollback remain open.

48 corrected-route93472 CLOSED FAIL1 on2054707: leaving the entrance now proves
Z242.73 and a visible Titan is found, but its backward approach point and both
alternatives project outside available canvas (GroundInputUnavailableError,
zero attempted clicks and zero displacement). This is a stronger, different
failure than the original no-target search and is not counted as a pass.
Test-only6a4ed8e82ef298871e36ee41557ac190a6d31085 uses the existing normal-wheel
zoom helper before the approach; no damage/lifetime/persistence or movement
assertion removed. Focused ESLint/diff check passed. Actual88533 ACTIVE, frozen
source, log `/tmp/eidolon-release48-seraph-zoom.log`; baseline288 smites currently
pass. No release correction pushed.49 stays gated; public release/health last
freshly verified healthy47. Next close/repeat this route and inspect rendered
combat, then propagate any accepted48 correction through queued49–55 before
ordered publication. Fresh-opening encounter watchdog failure also remains in
the pacing/route backlog; do not remove120s/two-respawn limits to clear CI.

## Historical checkpoint — September 8, 18:36 UTC

This goal turn remains PROGRESS.48 CI34257070035 is now terminal FAILURE:
client/server/three smoke shards passed, Predeploy Character QA failed both
Seraph attempts at acquisition of a visible InfernoTitan, before summon combat.
The fresh-opening collection also exceeded its120s encounter bound on its first
attempt, then passed retry (27 target deaths, zero player deaths,561s collection).
Neither deployment ran;49 cannot advance. Fresh public release/health remain
exact47/6925c5113ee6acdf698713f3332f80dcf546bd76, database ready.
Failure log `/tmp/eidolon-release48-ci34257070035-failed.log`.

New isolated48 recovery WT `/tmp/eidolon-release48-seraph-recovery-Pjflp1`,
branch work/release48-seraph-recovery-20260908, starts at exact7a9869d.
Diagnostic-only8d5f281 actual93423 CLOSED PASS0/1.6m:15s/16.5s lifetimes,
baseline288 and trained/saved345 smites, ordinary dungeon recall cleanup. The
reviewed trained-combat screenshot still puts combat beside the entrance facade.
Inspection confirms moveByGroundClick returns after initial >1-unit movement,
not arrival at its nominal20-unit destination; counting clicks does not prove
exit or meaningful search through a randomized population. This is a route
defect/inference from code and image, not proof of the exact failed CI world seed.
Diagnostic Mongo/API cleaned and independently absent.

Test-only2054707665ea6373d10e7de2dca3a3a3ca87aa08 now proves Z>=240 before
combat and navigates toward observed live Titans, retaining rendered acquisition
and unchanged damage/lifetime/persistence assertions. Focused ESLint/diff check
passed. Actual93472 ACTIVE, log `/tmp/eidolon-release48-seraph-route.log`.
Do not change this source until terminal. No correction pushed or48 pass claimed.

Resource fullrace1501 CLOSED PASS0 on030ec67: root20.900/database1.129/
game367.539s. Combined repeat15368 CLOSED FAIL1/252.707s: one final-reply fault
hit a character save rather than the required auction boundary. All66 server
logs independently clean (12 deliberate kills/54 normal shutdowns) plus two
expected startup rejection logs; that does NOT make the run pass. Owned Mongo
and volumes removed/absent. Test-onlya09ac6684f24be5347ef72e2d1918abfb1c1d160
replaces global skip-two-update targeting with Mongo7's namespace filter and
adds ordinary same-bidder raises, repeated requests and simultaneous equal bids,
with exact funds/receipts/resources/gear/XP and fresh-process recovery assertions.
No production runtime change from030ec67. Focusedrace37287 PASS1.312s before
formatting; initial gofmt command used wrong relative paths and was corrected.

Corrected actual37895 ACTIVE on frozena09ac66, THREE combined repetitions:
log `/tmp/eidolon-auction-bid-corrected-sessions.log`, binary
`/tmp/eidolon-auction-bid-corrected-proof-8Qkotn/a09ac6684f24be5347ef72e2d1918abfb1c1d160`.
Owned disposable Mongo eidolon-auction-bid-corrected-20260908-1829. Earlier
repetitions currently pass; wait for whole-run terminal result and log audit.
Buyout/item/payout operations, rollback and broader roadmap acceptance remain open.

## Historical checkpoint — September 8, 18:23 UTC

The intervening regeneration-only turn was NO ROADMAP PROGRESS: existing .01
rates and focused tests were reconfirmed, without implementation or release
changes. This resumed turn is PROGRESS: recovered the authoritative completed
bid crash-test result and independently audited all18 server logs. Full roadmap
scope stays active; no release gate is reduced.

Resource candidate030ec6769353d3f4e71409e9d371499375ae1b80 implements a durable
bid decision before a receipted character debit, then an atomic auction advance
and previous-bid refund append. Schema8 uses a separate auction_bid_operations
collection with a unique active operation per auction, not the earlier proposed
auction-local field. Reservations block competing mutations; account-ordered
recovery runs before startup admission and affected gameplay commands. Lost
write replies retain the same operation ID rather than rolling back blindly.

Actual4216 handle is now absent, but its authoritative completed log
`/tmp/eidolon-auction-bid-sessions.log` ends PASS/root73.117s. Six observed
boundaries: rejected decision, committed decision with failed reply, before
debit, journaled debit with rejected Mongo save, committed debit before rejected
auction finalization, and committed auction finalization with failed reply.
Each deliberately SIGKILLs its owned process, then verifies two fresh-process
ordinary logins, exact funds/receipts/resources/equipment and refund recovery.
All18 server logs independently clean: six expected kills and12 normal shutdowns.
Owned Mongo/volumes cleanup recorded and independently absent. This does not
prove durability of unsaved combat ticks, buyout items or seller payouts.

Frozen-source full Go race1501 and combined actual repeat15368 are ACTIVE;
logs `/tmp/eidolon-auction-bid-{full-race,repeat-sessions}.log`. The latter repeats
all six bid boundaries plus existing offline/refund-save/refund-ack/backlog/load
failure cases twice against owned disposable Mongo. Do not edit tested sources
until their exact handles are terminal. Candidate remains55 metadata/unreleased.

48 CI34257070035 freshly remains Predeploy Character QA ACTIVE; client/server
and all three smoke shards passed.49 still waits on the entire48 CI/final live
QA and fresh public identity. No push this turn; root is never a release source.
Next: close these checks, add actual same-bidder/competing-bid acceptance, then
durable item/payout operations and enforced rollback compatibility. Broader
campaign, dungeon/raid, phone and remaining1.1–1.10 acceptance remain open.

## Historical checkpoint — September 8, 17:47 UTC

Previous goal turn was PROGRESS (durable refund implementation, verified47 live
gate and ordered48 push). This turn is PROGRESS: bounded/coalesced outage retries,
shutdown admission and explicit auction-load startup failure implemented and
tested against real delayed Mongo writes/restarts. Full1.1–1.10 stays active and
incomplete; no gate/scope reduced. No push this turn.48 CI34257070035 on exact
7a9869d639659cd6f6173dca16c12ba2487e3221 freshly has client/server/all3 browser
shards PASS; Predeploy Character QA ACTIVE. No48 deployment/pass claim;49 waits on the entire48
CI/finalLiveQA/freshpublicidentity gate. Root staged52/ledger is local only.

Resource WT `/tmp/eidolon-resource-persistence-c6E17J`, runtime
8b68f5610a9b382efd6be82c130523213e66ac2c. One automatic worker coalesces bursts,
backs off10s after errors, skips overlap, caps passes32 items/2s soft budget
between IO calls, and stops at the first error. Round-robin cursor prevents a
permanently bad recipient starving later refunds. Periodic10s work is separate
from autosave. Shutdown seals new delivery before joining commands/loops and
finishes only in-flight work; durable intents survive. Failed auction loading
now refuses startup before HTTP admission rather than exposing an empty market.

Focused race35917 PASS root2.378/game1.834; expanded17477 PASS2.332/2.151;
final10726 PASS2.018/1.731. Includes1000-intent outage/backoff/fairness,
100-item healthy batch recovery,100 concurrent scheduling requests and an
in-flight shutdown barrier. Prior actual ack-failure test now waits for the
saved payment/receipt before stopping, preserving that precise fault boundary.

Actual53929 CLOSED PASS normal0/96.202s on8b68f56: two repetitions of previous
offline/failed-save/failed-ack recovery plus new100-refund delayed-write backlog
and corrupt-auction startup refusal/recovery. Mongo test failpoint blocks updates
500ms then rejects: exactly ONE attempted update before readiness under5s;
normal stop keeps100 intents and1235gold/one-receipt journal over1234gold Mongo.
Four healthy bounded startup passes recover1334gold/100receipts/17HP/100mana.
Malformed disposable auction produces expected exit1/load-guard message; only
that fixture is removed, then independent valid43gold refund recovers normally.
Backlog cases12.18s/17.07s; corrupt-load3.36s/3.29s. Not power-loss/full-auction
atomicity proof. All32 normal server logs strict normal exits and independent
clean scans/shutdown completion; two intentional startup rejection logs likewise
clean and show expected guard. No production player data touched.
Binary `/tmp/eidolon-refund-lifecycle-proof-fvmjUz/8b68f5610a9b382efd6be82c130523213e66ac2c`;
log `/tmp/eidolon-refund-lifecycle-sessions.log`. Owned Mongo
`eidolon-refund-lifecycle-proof-20260908-1736` and volumes removed/independently
absent; test failpoints enabled only on that disposable loopback container.

**Full race4474 CLOSED PASS normal0** on frozen8b68f56, log
`/tmp/eidolon-refund-lifecycle-full-race.log`: root14.226s/game245.257s, other
packages cached/no tests. No owned local test/browser/Mongo handle remains.
48 CI34257070035 is the external wait. Candidate remains55 metadata, no56 approval.

Next: durable pending bid decision, atomic
character debit receipt, then auction/refund transition with interruption tests.
Candidate `docs/plans/2026-09-08-auction-operation-recovery.md` records concrete
cut points and lock ownership. Whole-auction debit/item/payout/ambiguous writes,
enforced rollback compatibility, broader instance/device play,31chapter earned
campaign, full phone gate and remaining1.1–1.10 milestones stay open.

## Historical checkpoint — September 8, 17:26 UTC

Previous goal turn was PROGRESS (verified dungeon/2v2 recovery and documentation).
This turn is PROGRESS: durable refund outbox/character receipt implementation,
actual fault/restart acceptance and a newly exposed Fireball snapshot race fix.
Full1.1–1.10 remains active/incomplete; no scope or release gate reduced.

47 CI34248491147 on6925c5113ee6acdf698713f3332f80dcf546bd76 completed SUCCESS,
including final Live Release and Character QA at17:23:30. Fresh checks AFTER
completion confirmed release.json/healthz exact47 commit/version/database ready,
plus index login/patch notes/exact main.js identity. Clean48 worktree, ancestry,
own48 patch notes/login/version and remote master still47 were checked. Normal
fast-forward push97594 CLOSED0 published
**7a9869d639659cd6f6173dca16c12ba2487e3221** to master; independently confirmed
remote SHA. **48 CI34257070035 is now freshly ACTIVE**, Client Tests and Server
Tests running. No48 deployment/pass claimed.49 remains gated on the entire48
CI/finalLiveQA/freshpublicidentity pass.49–55 refs/validation unchanged below.
Never push root's local staged52/ledger branch or resource over the release queue.

Resource WT `/tmp/eidolon-resource-persistence-c6E17J`: implementation
d1e2839661e6b51ed44c6cbb093dbe35cb7c24dd persists refund IDs/amounts/recipients
inside the auction update that displaces escrow. Outbid/buyout/cancel/final-claim
paths retain unpaid intents. Serialized delivery/retry acknowledges only after
gold and a private idempotency receipt commit together. Startup/periodic retry,
per-account pending-save-before-credit ordering and an atomic live-credit/expiry
pin close the identified one-shot refund gap. Full snapshots/login retain
receipts; same-ID retries do not pay twice. Overflow/conflicting credits reject.
Offline delivery uses the journal, not an increment under a stale pending save.

Focused98138 PASS2.869/1.058/15.724; expanded89762 PASS3.357/1.047/15.514;
final57054 PASS3.508/1.051/15.344 for root/database/game. Compile errors (existing
guild credit method name collision, then missing fmt import) were corrected and
are not counted as passing checks. Tests cover expiry pin, failed filesystem
write/retry, receipt detachment, outbox retention and idempotence.

Actual29305 CLOSED FAIL normal1/72.457s on d1e2839: gold/receipt/resource
assertions pass in both repetitions, but one of18 server logs reports three
Fireball mana/state/time races against GetEntityCopy. Evidence
`/tmp/eidolon-compat-session-1663948313/server.log`, actual log
`/tmp/eidolon-resource-refund-sessions.log`. Initial owned Mongo/volumes removed
and independently absent. Do not count this as a whole-run pass.

Correction09b56932b5482b50a8d45da83eec3e6358203b7c holds World.RLock then
Entity.RLock throughout detached copying; previously the early World unlock
allowed world-locked abilities to race the copy. Focused26034 PASS3.628/1.122/
16.079 with200 real prepared Fireball dispatches against concurrent snapshots.
Corrected actual18314 CLOSED PASS normal0/118.569s, THREE repetitions: offline
never-committed pending900gold/dead0/0 snapshot then43refund yields943; ordinary
outbid with real Fireball and either rejected user save or rejected auction
acknowledgement recovers1234gold/17HP/70mana/one43receipt across two fresh server
logins, exact gear preserved, new bidder debit1184 preserved. Controlled SIGINT
and Mongo validators, not network/power-loss/atomic whole-auction proof.
Binary `/tmp/eidolon-resource-refund-corrected-proof-smCf6M/09b56932b5482b50a8d45da83eec3e6358203b7c`;
log `/tmp/eidolon-resource-refund-repeat-sessions.log`. All27 server logs strict
normal exits and independently clean race/panic/fatal/credential markers, all
with shutdown completion. Owned Mongo
`eidolon-resource-refund-repeat-20260908-1720` and volumes removed/independently
absent. No production data touched. Candidate still55 metadata; no56 approval.

**Full Go race83776 CLOSED PASS normal0** on frozen09b5693, log
`/tmp/eidolon-resource-refund-full-race.log`: root22.691s/database1.156s/
game365.813s, other packages cached/no tests. No local owned test/browser/Mongo
handle remains.48 CI34257070035 is the verified external wait. No resource56
assignment or release approval follows from these narrower recovery tests.

Next: whole-auction interruption/ambiguous
write ordering (bidder debit, item delivery and seller payout still cross docs),
bounded/coalesced refund retries under outages and shutdown grace, failed auction
load recovery and compatible rollback.55's old full-character replacement drops
unknown resources/receipts, so rollback is not safe without a bridge or enforced
restriction. Broader raid/device play,31chapter earned campaign and full phone/
1.1–1.10 scope remain open. Full details in candidate implementation document.

## Historical checkpoint — September 8, 17:05 UTC

The intervening regeneration-only turn was NO ROADMAP PROGRESS: existing .01
client/server coefficients and focused tests were reconfirmed without changing
the implementation or release state. This resumed turn is PROGRESS: exact
pending actual dungeon/PvP and full-race handles closed successfully, and new
ordinary four-player 2v2 recovery/restart coverage passed three times. Full
1.1–1.10 remains active and incomplete; no release gate or scope is reduced.

47 CI34248491147 on6925c5113ee6acdf698713f3332f80dcf546bd76 still has client,
server and all3 browser smoke shards PASS; Predeploy Character QA freshly ACTIVE.
Fresh release.json/healthz both report healthy/database-ready Alpha1.0.46 at
6f7e4a72a774a9d2106c26fc6a98f81a1e535c7c. No47 deployment/pass claimed. No push
this turn;48 remains gated on entire47 CI/finalLiveQA/freshpublicidentity. Never
push root's local staged52/ledger branch.48–55 refs/validation unchanged below.

Resource worktree `/tmp/eidolon-resource-persistence-c6E17J`: actual dungeon/PvP
testscbc79758a0ca097f13846bb5884d590114a03321 exposed two genuine races missed by
earlier green unit suites. Runtime fixbb11f9bf1da174371fb27d3c75c50f0620ad2b92
locks entity party writes and enemy/player scene reads, rechecking disconnected/
dead players in stale tick lists. Focused53093 PASS11.636s. Initialactual16263
FAILED110.162s with six abnormal/race child exits despite passing gameplay
assertions. Log `/tmp/eidolon-resource-instance-actual-sessions.log`; exact bad
dirs recorded in the candidate implementation document, not a whole-run pass.

Corrected51943 CLOSED PASS normal0/254.335s onbb11f9b, two complete repetitions
of8 four-class alive/dead dungeon cases plus6 practice/ranked1v1 exit/shutdown
cases. Fullrace26408 CLOSED PASS normal0 root22.706/game413.453s. Logs
`/tmp/eidolon-resource-instance-repeat-sessions.log` and
`/tmp/eidolon-resource-instance-full-race.log`. All56 actual child server logs
independently clean of race/panic/fatal/credential markers and contain shutdown
completion; strict normal exits enforced. Owned disposable Mongo/volumes removed
and independently absent. Dungeon layout/seed/full saved progress, resources,
manual town recovery, gold/XP/gear and nonduplicated arena profiles checked.
Room clearance/death are explicit post-stop prepared fixtures, NOT earned
dungeon-clear/party-wipe proof. Other dungeon families and raid events remain open.

Test-onlyf064c197297c533eb049c0c4eab288c5f6e13afd adds ordinary invite/acceptance
two-party 2v2 queue/scene entry, repeated Join, real Wizard mana consumption,
team forfeit/maintenance exit and fresh-process logins. Focused90032 PASS1.046s
(opt-in actual tests skipped; corrected an initial wrong-cwd invocation).
Actual91101 CLOSED PASS normal0/111.671s, three repetitions36.55/37.01/37.07s:
all four recover145HP/445mana/originaltown/gold/gear; each forfeit team member
gets exactly one correct ranked result; maintenance awards none. Binary
`/tmp/eidolon-resource-2v2-proof-o6uBQX/f064c197297c533eb049c0c4eab288c5f6e13afd`;
log `/tmp/eidolon-resource-2v2-sessions.log`. All12 server logs independently
clean including shutdown completion and strict normal exits. Owned Mongo
`eidolon-resource-2v2-proof-20260908-1705` and volumes removed/independently absent.
No production player data touched. All local owned test/browser handles closed.
47 CI is the verified external wait. No56 assignment or resource release approval.

Next: implement pending-save/offline-auction-refund/expiry ordering and durable
idempotent refund delivery. Existing trading handler can mutate a disconnected
entity after its save or increment Mongo underneath an older pending snapshot.
Audit auction/user cross-document failure windows, delayed IO and compatible
rollback. Broader raid/device play,31chapter earned campaign, complete phone
baseline and remaining1.1–1.10 milestones still open. Recovery tests do not
substitute for complete earned combat or a released milestone.

## Historical checkpoint — September 8, 16:40 UTC

Previous goal turn was PROGRESS (47 publication plus durable journal implementation
and real recovery evidence). This turn is PROGRESS: shutdown admission/timer/
earned-work draining and journal-all final snapshots implemented, focused/full
race suites pass, and the real matrix passes; the new live-socket shutdown test
needed a cooldown-aware test correction and then passed three consecutive runs.
Full1.1–1.10 remains active and incomplete. No version scope has been reduced.

47 CI **34248491147**, exact6925c5113ee6acdf698713f3332f80dcf546bd76, now PASSES
client/server/all3 browser-smoke shards. Predeploy Character QA is freshly ACTIVE.
No deployment/live47 success claimed and no new push this turn.48 remains gated
on the complete47 CI/live/public-identity pass.48–55 refs and prior validation
unchanged in earlier checkpoints. Never push root's staged52/ledger branch.

Resource candidate `/tmp/eidolon-resource-persistence-c6E17J`, branch
work/resource-persistence-20260908: runtime **3efad53dbf4a26622c137a2ed066b84fd425697b**,
test correction **a837acb9d9c35f082f3c93e32f76608648290015**, clean docs closure
**ac53b2cb06c9d409773b6d9407b244b07daa818f**. Still no56 metadata or release approval.
New lifecycle group closes external admission before waiting; earned task trees
can finish nested completions before atomically sealing at idle. Main joins
gameplay/save/expiry ticks, cancels pending attacks/aftershocks/meteors/slams/PvP
timers/vigils, drains world rewards/refunds, settles decided PvP results and cancels
unfinished matches without maintenance forfeits/deserter penalties using existing
exit recovery, then retires hub clients and drains server completion/save workers.
Every final player, including disconnected late-reward recipients, is journaled
BEFORE any final Mongo attempt. Stop further final DB attempts after one failure,
retaining all pending files for startup. Local journal failure keeps admission
closed and retries rather than falsely reporting safe exit. HTTP closes after
drain; normal main return closes DB/logging. Compose grace60s. Forced kill,
permanent storage loss and cross-document reward transactions are not guaranteed.

Focused40384 PASS root0.245/lifecycle0.009/game0.032; race67491 PASS1.459/1.030/1.566;
expanded54309 PASS1.917/1.038/1.703; final43001 PASS2.171/1.041/1.650. Last log
`/tmp/eidolon-shutdown-final-focused.log`. Full race **21550 CLOSED PASS normal0**:
root20.592s/game403.942s/lifecycle1.069s/databasecached. Log
`/tmp/eidolon-resource-shutdown-full-race.log`. Covers new admission races, active
tick drain, nested reward completion, real delayed-attack/vigil cancellation,
decided/unfinished PvP results, disconnected late rewards, unwritable journal and
all8 journals preceding the first database call.

Actual **90112 CLOSED FAIL normal1/275.094s**, not a whole-run pass. On3efad53:
handoff6.33s, real rejected-save/restart6.70s, committed receipt/later gold3.46s,
all8 class/death tokens28.62s, and144 real saved sessions217.47s PASSED. The new
live-socket shutdown test FAILED12.46s before its intended8-socket SIGINT step:
after accepted Fireball/70mana, an immediate unknown-skill probe expected locked
but correctly received global_cooldown. Test correctiona837acb uses the accepted
cast acknowledgement itself for that living Wizard; other probes and all final
snapshot/restart/death assertions remain unchanged. No runtime change or extra
grants/waits. Focused92471 CLOSED PASS1.705s; log
`/tmp/eidolon-shutdown-cast-ack-focused.log`.

Initial actual log `/tmp/eidolon-resource-shutdown-actual-sessions.log`, binary
`/tmp/eidolon-resource-shutdown-proof-ruYRdB/3efad53dbf4a26622c137a2ed066b84fd425697b`.
Nine strict/independently clean normal-exit/race/panic/fatal/credential log dirs
1303028052/1993578100/494283604/2329653674/3054342950/1409691725/2034676435/1967588618/
1707152549 in `/tmp/eidolon-compat-session-*`. The failed test's cleanup reached
the explicit shutdown-drain-complete log, but that is not the missing8-case pass.
Exact original owned Mongo/volumes removed and independently absent; no production
data touched.

**49137 CLOSED PASS normal0/82.378s**: three consecutive corrected eight-live-socket
shutdown/restart tests28.20s/27.25s/25.89s on race-built a837acb. Four classes each
alive/dead; living Wizard real cast100→70mana, others0mana, exact17HP/0HP/gold1234/
level30. Every final Mongo snapshot was fresh after shutdown began, healthy final
journals empty, and ordinary fresh-process logins retained all exact bars/death.
Log `/tmp/eidolon-resource-shutdown-repeat-sessions.log`, binary
`/tmp/eidolon-resource-shutdown-corrected-proof-F8f5F1/a837acb9d9c35f082f3c93e32f76608648290015`.
Six server evidence dirs4027541671/3472769833/322527122/3880982149/3016411499/
2985687568 have strict normal exits, explicit drain-complete logs and independent
clean race/panic/fatal/credential scans. Exact owned Mongo
`eidolon-resource-shutdown-repeat-20260908-1636` and its disposable volumes removed,
independently absent; production data untouched. All owned local test/browser
handles closed.47 CI is the only verified external wait. Do not restart any
handle because of an observation timeout.

Next: actual unfinished dungeon/PvP resource recovery and
remaining pending-save/offline-credit/expiry ordering, delayed IO, rollback and
broader browser/device acceptance.31chapter earned campaign and complete phone
gate remain open; neither this shutdown work nor47 closes1.1 or the full roadmap.

## Historical checkpoint — September 8, 16:13 UTC

Previous focused regeneration turn was NO ROADMAP PROGRESS: it reconfirmed the
already implemented .01 health/mana coefficient and passing focused tests, but
changed no release or roadmap state. This resumed goal turn is PROGRESS:46 final
live gate passed,47 was published in order, and durable failed-save recovery was
implemented and verified through real Mongo/server restarts. Full1.1–1.10 remains
active and incomplete; no milestone scope has been reduced.

46 CI34238194283 on6f7e4a7 completed SUCCESS including final Live Release and
Character QA at15:49:01. Fresh checks after that completion confirmed public
release.json and backend healthz exact6f7e4a72a774a9d2106c26fc6a98f81a1e535c7c /
Alpha1.0.46, database ready, and index login/patch notes/exact main.js identity.
Remote master was still6f7e4a7 and ancestry/clean47 worktree were checked before
normal fast-forward push65956 CLOSED0: **6925c5113ee6acdf698713f3332f80dcf546bd76**
to master.47 retains its own patch notes/login version. CI **34248491147** now
PASSES Client/Server and Browser Smoke2/3; Browser Smoke1/3 and3/3 ACTIVE. No47 deployment/live-pass
claim yet. Do not publish48 until the full47 gate and fresh public identity pass.
Root staged52/ledger branch remains local only; never push it.

Resource worktree `/tmp/eidolon-resource-persistence-c6E17J` now clean docs closure
**3a7d756755e272426c2913b58a6b56a60f2236bc**, tested runtime/source
**5cf6acb794785ede185a7187e5ea53516c76e6e6**, still no56 assignment or release
approval. One private per-account BSON journal retains the newest attempted
complete snapshot before Mongo IO; atomic Mongo receipt prevents duplicate replay
from overwriting later gold-only credits. Startup replays before accepting logins;
autosave retries and expired-character login refuses stale hydration while a save
is pending. Local journal failure pins the live entity against resume expiry;
durable journal success permits normal expiry even if Mongo remains unavailable.
The journal defaults to logs/character-saves, within the existing persistent
Compose logs bind mount. This is single-writer per-account ordering, NOT a general
multi-server monotonic/CAS protocol or protection against every trading race.

Recovered previous focused command had no live process and terminal log PASS
root0.024s/database0.300s. New focused97355 CLOSED PASS root1.533s/database1.114s;
expanded9285 CLOSED PASS root1.700s/database1.139s, log
`/tmp/eidolon-journal-expanded-focused.log`. These include durable reopen,
detachment, stale acknowledgement protection, corruption preservation, failed
database retry, newest-live snapshot preference, real filesystem-path failure,
expiry pin/unpin and fail-closed missing-state checks.

Actual race-built33010 CLOSED PASS45.783s on exact5cf6acb: ordinary handoff5.53s;
real Fireball/disconnect with Mongo validator rejecting the save, retained file
through shutdown, fresh-server replay and ordinary login6.67s; precommitted
unacknowledged receipt plus later43gold credit/dead0HP0mana login3.58s; all8
four-class alive/dead token/resume/recovery cases28.95s. Failure injection is a
real rejected Mongo write, NOT a network outage or disk-full process crash.
Exact complete pending snapshot matched Mongo before recovered server readiness.
Log `/tmp/eidolon-resource-journal-actual-sessions.log`; binary
`/tmp/eidolon-resource-journal-proof-qcfth6/5cf6acb794785ede185a7187e5ea53516c76e6e6`.
Five server evidence dirs3793709616/795464650/168276058/2545814512/3148458027 under
`/tmp/eidolon-compat-session-*` have normal exits and independent clean race/panic/
fatal and credential-marker scans. Exact owned journal-proof Mongo container and
its disposable volumes removed; independently absent. Production data untouched.

Full Go race **75477 CLOSED PASS normal0**, log
`/tmp/eidolon-resource-journal-full-race.log`: root17.115s/database1.149s/
game342.717s.144 actual saved-session matrix **30872 CLOSED PASS normal0/210.581s**
(test209.55s), log `/tmp/eidolon-resource-journal-matrix-sessions.log`; four classes,
levels1/30/100 and partial/full/zero/dead bars across three fresh server processes.
Evidence dirs4089778075/1507303130/1092665031 have strict and independent clean
normal-exit/race/panic/fatal/credential scans. Exact owned disposable Mongo
`eidolon-resource-journal-matrix-20260908-1608` and volumes removed and independently
absent. No owned local test/browser handles remain active.47 CI is the verified
external wait; re-poll its exact handle without restarting on observation timeout.

Open resource acceptance: shutdown must stop admission/game mutations before
final save/drain (existing WaitGroup admission race not fixed); interrupted
dungeon/PvP recovery; compatible rollback and broader browser/device acceptance;
delayed network/storage failures and pending-save versus offline auction-credit
ordering. Do not claim arbitrary crash durability or deploy this slice alone.
48–55 refs/validation unchanged below;31chapter campaign and full phone gate
remain incomplete. Next actions are shutdown admission/drain and outstanding
resource boundaries while47 proceeds through its own release pipeline.

## Historical checkpoint — September 8, 15:44 UTC

Previous turn was PROGRESS (real races fixed, stricter harness and47 fixture
correction). This turn is PROGRESS:47 local acceptance completed, its QA fix
propagated through48–55, four-class token/death saved sessions and actual desktop
browser resource/death logins passed. Full1.1–1.10 remains active/incomplete.

46 CI34238194283 on6f7e4a7 now PASSES client/server/browser/predeploy/QA-inputs/
both deployment jobs; **final Live Release and Character QA remains ACTIVE**.
Fresh public release.json and backend healthz both identify
**6f7e4a72a774a9d2106c26fc6a98f81a1e535c7c / Alpha1.0.46**, backend DBready.
Public index also has Alpha1.0.46 login/patch notes and exact versioned main.js
entry. These checks were15:39; repeat them AFTER final live QA passes before
publishing47. No push this turn. Never push root's staged52/ledger branch.

47 actual79912 on3551c66 CLOSED PASS2/5.2m, normal0: corrected server-confirmed
cast/reuse36.3s and Verdant4.5m, seed4222344601024940264/gen2/normal30/Wizard100;
both bosses/later enemies/rooms/town. Last Matron2749HP/player2037HP/548mana before
kill. Full client76579 CLOSED PASS232suites/3314tests/281.705s. Lint/focused checks
as below; credential scan0/exact-container/image absence PASS. Clean closure47
**6925c5113ee6acdf698713f3332f80dcf546bd76**. Logs
`/tmp/eidolon-release47-server-cast-{gameplay,client}.log`.

Validated-clean, no-conflict sequential merges propagate ONLY two QA/evidence
files; no runtime/version/patch-note changes:48 **7a9869d**,49 **bb41de0**,
50 **79f458c**,51 **e2fbd2b**,52 **10c0fb6**,53 **cc2a99b**,54 **cb3fe45**,
55 **8df7dd472bf890f101104b124fa241a17420dd35**. Same worktrees/branches as below.
Each still needs its own sequential CI/deployment/live gate. Old refs/evidence
remain recoverable in ancestry. Resource branch merged55 as2e61665, same2files.

Resource candidate `/tmp/eidolon-resource-persistence-c6E17J`, branch
work/resource-persistence-20260908, clean **431d7613f96e32e5fce5cae34f168a60d7ac6e83**
(docs closure of tested28ebabc), still no56 version or publication approval.
New four-class alive/dead token test verifies initial login/zero mana, fresh
disconnect persistence, token resume/rotation, rejection of old-token replay,
continued authority of legitimate resumed socket, unchanged saved death/HP/mana,
subsequent password login and normal Recall/Respawn. Prepared level30 with zero
Vitality/Wisdom isolates exact bars using145HP/245mana level-based maxima.

Focused26959 PASS1.308s. Initial actual58400/b2478ab CLOSED FAILED20.121s:
handoff6.29s passed; token cases expected an object but existing error wire payload
is a string. Corrected test retains specific rejection assertions. Actual95842/
ea5d539 CLOSED PASS25.988s: handoff4.79s plus all8token/death cases21.18s, race-built
server, strict normal-exit/log checks. Independently clean logs
`/tmp/eidolon-compat-session-{834156718,867286699}/server.log`;
`/tmp/eidolon-resource-token-corrected-sessions.log`. Binary
`/tmp/eidolon-resource-token-corrected-proof-0vZpDN/ea5d539612d651b93c310968bcdf8473702a4641`.
Both explicit disposable token-proof Mongo containers/volumes removed and absent.

Browser test28ebabc extends existing death-resources route, no gameplay change.
Full lint70508 PASS, full Go race71467 PASS root16.156s/other packages cached.
First launch stopped at preflight because vendor assets were missing; no services
created. Existing prepare:client86528 PASS generated ignored dependencies only.
Corrected11931 CLOSED PASS1/34.3s (test29.6s), normal0. Actual Wizard town cast:
100HP/70mana survives login4.505s exactly. Real hostile death:0HP/70mana/DEAD
survives login3.877s exactly, visible death screen. Normal death button returns
100HP/100mana. Another cast, living Recall and login5.211s retain100HP/70mana.
HUD matches current stats. Living assertions allow only elapsed regen plus one
fractional-boundary point; dead values exact. Explicit near-death fixture before
the hostile hit is not earned-death/class-balance proof. Credential scan0 and
exact owned-container/image absence PASS. Log
`/tmp/eidolon-resource-login-death-prepared-gameplay.log`; first preflight log
`/tmp/eidolon-resource-login-death-gameplay.log`.

NO owned local test/browser handles remain active. Final46 CI is the only
verified external wait. Resource remaining work includes shutdown admission/
worker drain, save-failure/expiry behavior, actual unfinished dungeon/PvP resource
handoff, compatible rollback and broader device/class browser acceptance. Current
PvP code explicitly refills on entry/exit; preserve that existing policy while
checking saved state, do not reinterpret normal match recovery as reconnect regen.
The stalled31chapter story run remains at its21/40 failure described below; no
story success, pacing acceptance, physical-phone sign-off or1.1 closure implied.

## Historical checkpoint — September 8, 15:29 UTC

Previous goal turn was PROGRESS (session ownership implementation and actual
handoff checks). This turn is also PROGRESS: the broader real race matrix found
two missed races, both were fixed, the harness now rejects bad server exits/logs,
and corrected real sessions pass. Whole1.1–1.10 remains active and incomplete.
46 CI34238194283 on6f7e4a7 remains freshly ACTIVE Predeploy Character QA; client,
server and Browser Smoke PASS. No push or new live identity claim this turn.
Never publish47 until the whole46 final Live QA/public-identity gate passes.

Resource `/tmp/eidolon-resource-persistence-c6E17J`, work/resource-persistence-20260908,
clean **4390f30** (docs closure; tested source69d7978, runtimea9f5960), still has
no56 metadata or publication approval. Actual matrix77433 on603cd588 returned
process0/176.281s but was FAILED race acceptance: server logs found close/send
races in all three phases and Join's playerID write versus broadcast read in
phase1. Evidence `/tmp/eidolon-resource-matrix-race-sessions.log` and
`/tmp/eidolon-compat-session-{3776921393,4283576186,2711711528}/server.log`.
Full unit race92756 nonetheless PASSED root24.822s/database1.065s/game450.687s;
this demonstrates why unit green alone was insufficient. Both handles terminal.

Correctiona9f5960 serializes every output producer against queue closure,
publishes a write-once player binding under sessionsMu, guards state-cache resets,
and rechecks closed transport after credential/account-lock delays. Priority
traffic stays nonblocking and state/time stays lossy. The actual-session harness
now fails on abnormal/forced child exit and race/panic/fatal log markers.
Focused70558 PASS1.502s; full race67975 PASS root15.786s/other packages cached.
Log `/tmp/eidolon-resource-queue-full-race.log`. No game-runtime change in this
follow-up, so the game-package cache is valid evidence at that scope.

Actual corrected race22795 CLOSED FAIL213.857s: separate144session matrix PASSED
199.30s with clean exits/logs, but handoff freshness assertion FAILED14.55s.
Read-only disposable Mongo inspection found correct17HP/70mana/alive,1277gold,
LastLogout15:17:47.104Z. The BSON driver stores milliseconds, while this immediate
disconnect test compared nanoseconds.69d7978 now requires both a strictly newer
save than its pre-close DB baseline AND closure time at BSON precision; tests
reject unchanged, earlier and missing saves. Focused18465 PASS1.111s.
22795 evidence `/tmp/eidolon-resource-queue-race-sessions.log`, server dirs
`/tmp/eidolon-compat-session-{1242217804,2876537283,3948687136,2628873907}`;
all four independently scanned clean of race/panic/fatal markers.

Corrected actual13939 CLOSED PASS **five consecutive race-built handoffs/23.314s**,
normal0, strict server log/exit checks enabled. Binary
`/tmp/eidolon-resource-freshness-proof-6rWCkw/69d7978a4022822467451214c9676dd6532c81c3`;
log `/tmp/eidolon-resource-freshness-sessions.log`, server dirs
`/tmp/eidolon-compat-session-{3660727112,3316864897,770392881,341862235,4179048338}`.
All three resource proof containers used this turn were explicitly disposable,
removed with owned volumes by trap, independently absent; no player data removed.
No resource tests remain running. Still open: token resume/death/browser/instance/
PvP, shutdown admission/drain, delayed-save failures, compatible rollback. Full
roadmap resource acceptance is NOT closed by this matrix or five handoffs.

Story66825 CLOSED FAILED25.1m at21/40 Watch credits, zero deaths. Opening68s and
diary118s uninterrupted passed. Last player level5/75HP at x20.68/z328.59;
original level6 Skeleton15HP103.62units away, hovered Skeleton-28;314retreats,
two jumps/12Fireballs. Near20credits immediate threats were three level1 Skeletons
below the hunt's3minimum. Credential scan0, exact-container/image absence PASS.
Log `/tmp/eidolon-story-opening-reacquire-gameplay.log`. Story branch now
**92d2bc7**, docs-only closure after tested5959689. Do not reduce counts, extend
watchdogs or claim pacing approval. Further diagnosis must separate non-credit
threats, retreat/leash resets and travel; preserve artifacts before the next run.

47 actual12646 on93ab09c CLOSED FAILED overall6.2m, QA_SCRIPT_EXIT=1: first reuse
test FAILED36.9s, following Verdant PASSED5.4m (both bosses/later enemies/rooms/
town; last Matron663HP, player1672HP/420mana before confirmed kill). I initially
misread transition to the second test as the first passing and promptly corrected
the user update. No combined-pass claim. Credential scan0, independent exact
container/image absence PASS. Log `/tmp/eidolon-release47-inherited-fixture-gameplay.log`;
archived test-results `/tmp/eidolon-release47-inherited-fixture-evidence-f1QAHR/`.

The reuse test polled a local predicted mana dip, then its separate `depleted`
read returned full1685 before the initializer observed1664. Reset correctly
returned1685, failing1685>1685. QA-only successor observes Fireball ability_result,
requires accepted=true and server-reported mana reduction, then compares that
authoritative value after explicit setup. No extra casts/grants/rank/rune changes;
observer restored in finally. Focused84841 PASS25tests/4.667s and full lint/diff.

Current47 clean **3551c66cc8b4843ea77db487249314d44b27500d**, same worktree/branch,
has TWO owned live handles: **79912** sole browser, runIDrelease47-server-cast,
hostAPI18635/Mongo18636/web18637, routeprepared-dungeon-fixture, log
`/tmp/eidolon-release47-server-cast-gameplay.log`; **76579** full client regression,
log `/tmp/eidolon-release47-server-cast-client.log`. Keep source frozen until both
exact handles are terminal. No resource runs or other owned browser remains live.
After validation this correction MUST propagate through48–55 and the resource
candidate before sequential publication; queued refs below still predate3551c66.

## Historical checkpoint — September 8, 15:09 UTC

This turn is PROGRESS: implemented per-account session/save ordering and proved
real Fireball/repeated-Join/duplicate-login resource preservation against Mongo,
including a race-built server. The preceding regeneration-only reply confirmed
an already-existing change; it did not advance roadmap implementation. Current
state was revalidated before proceeding. Full1.1–1.10 remains active, not closed.

46 CI34238194283 on6f7e4a7 is freshly ACTIVE in Predeploy Character QA. Client,
server and Browser Smoke PASS. No push this turn.47/93ab09c stays next only after
the entire46 pipeline including final Live QA passes and fresh exact public
release.json/healthz/login/runtime identities agree.48–55 retain the sequential
refs recorded below; never push root's staged52/ledger branch over this queue.

Resource candidate `/tmp/eidolon-resource-persistence-c6E17J`, branch
work/resource-persistence-20260908, clean **603cd588430269321980d70b01b5fcfbbd6f9c8d**,
has no56 metadata or publication approval. Per-account locks serialize commands,
login/resume, cleanup and snapshots; global hub schedules IO outside its loop.
Retired sockets cannot affect newer owners. Repeated Join/ordinary login reuse
the live entity, disconnect freezes before capture, and queued saves capture
only under ownership. Level-command saves use a complete snapshot; offline
trading refunds update only gold and cannot replace resources/equipment.

Initial snapshot corrected full race53548 CLOSED PASS root16.082s/game359.606s/
database cached. Prior handoff focused handle77475 was missing on revisit and is
not claimed; fresh74977 CLOSED PASS1.440s. Further focused7298 PASS0.180s after
adding the actual-handoff test. A wrong-directory gofmt invocation was corrected
from the worktree root before603cd588 commit; diff check passed.

**57781 CLOSED PASS**, normal0: actual handoff3.32s plus144saved sessions26.86s,
total30.197s. Fireball costs30 from100mana; two repeated Joins retain70mana and
active cooldown, replacement login retains70, late old disconnect does not retire
the new owner, subsequent command works, and final fresh Mongo save retains70.
Prepared fixture uses zero Wisdom to separate this from elapsed regeneration;
HP remains within its separately allowed single-point recovery. Gold-only
credit1277 and exact equipped chest also persist. These are prepared fixtures,
not earned progression/browser/device evidence. Binary
`/tmp/eidolon-resource-handoff-proof-YHy9RO/603cd588430269321980d70b01b5fcfbbd6f9c8d`;
log `/tmp/eidolon-resource-handoff-real-sessions.log`; server evidence dirs
`/tmp/eidolon-compat-session-{1006656768,2220074175,3716352015,2546734315}`.

**78650 CLOSED PASS** actual same handoff against race-built server5.65s, total
5.676s. Independent scan of its server log finds no WARNING: DATA RACE, panic,
fatal error or race summary. Binary
`/tmp/eidolon-resource-handoff-race-proof-X1Ktwh/603cd588430269321980d70b01b5fcfbbd6f9c8d`;
log `/tmp/eidolon-resource-handoff-race-sessions.log`; server log
`/tmp/eidolon-compat-session-2152415797/server.log`. Both explicitly owned Mongo
containers eidolon-resource-handoff-proof / eidolon-resource-handoff-race-proof
removed by trap and independently absent. Their disposable volumes were removed;
no persistent player data involved. Evidence/binaries retained.

**92756 ACTIVE** full `go test -race ./...` on603cd588, log
`/tmp/eidolon-resource-handoff-full-race.log`; root24.822s and database1.065s PASS,
game still pending. Freeze candidate source until this exact handle is terminal.
Remaining work: shutdown admission/drain (WaitGroup alone is insufficient),
recheck transport closure after credential validation/account-lock acquisition,
late/delayed-save failure tests, actual token resume/death/dungeon/PvP/browser,
and compatible rollback. Old55 full-character replacement still discards unknown
resource snapshots. Do not publish until a tested compatible rollback path is
defined; no rollback automation or live schema mutation was performed here.

Sole owned browser **66825 remains ACTIVE**, source5959689 frozen in
`/tmp/eidolon-story-target-input-ATbtXC`; same runID/ports/log as below. Actual
uninterrupted opening68s/zero deaths, diary118s, Earth Watch now20/40kills with
zero deaths at1178s; level5/236XP,134/200HP,23/160mana,5occupied bag slots and
350unsold equipment value. No reconnect or reward/grant shortcut. This is not a
completed hunt/campaign or pacing approval. Preserve30minute whole-route limit,
120second target watchdog,40kills and death cap; do not restart for observation
timeout. No other owned local handles remain active besides92756 and66825.

## Historical checkpoint — September 8, 14:46 UTC

This turn is PROGRESS: all queued48–55 inherit46's verified prepared fixture/rune
fix, the resource-persistence implementation passes144actual saved sessions,
and story input follow-ups are tested against concrete failures. Full roadmap
remains active, no1.1/1.10 completion or new runtime deployment claim.

46 CI34238194283 on6f7e4a7 remains freshly ACTIVE Browser Smoke; client/server
PASS. No push this turn.47/93ab09c remains next only after complete46 CI/live
gate and fresh matching public identities. Clean sequential no-conflict QA-only
merges:48 **5438ada**,49 **f869909**,50 **f64b38d**,51 **51b3b4c**,52 **e2a3d8b**,
53 **e58e814**,54 **37c9a78**,55 **600991719addf7c00d2263cac798f65a490c28d2**.
Each adds the same eight QA/evidence files, no runtime/version/three-shard
changes. All previous branches/evidence retained. Latest inherited280client
tests PASS3.663s on the new resource branch based on55; each release still needs
its own exact final deployment/live gate, never publish root's staged52 ledger.

New `/tmp/eidolon-resource-persistence-c6E17J`, work/resource-persistence-20260908,
clean **6cba1eb5fe30133980ecedcf95e4ea460d744d43** is an UNRELEASED initial slice
based on55, no56 version assigned. Optional version1 BSON currentHP/mana/death
snapshot from the same detached entity; restore after complete build/maxima;
zero != legacy, clamp real capacity reductions, reject invalid/future versions,
preserve old baseline once for legacy data. Disconnected actors stop passive
regen/fraction banking; dead state survives disconnect/resume under entity locks.
Full implementation/remaining work in its `2026-09-08-resource-persistence-implementation.md`.

First scoped87396 PASS. Full server race85670 CLOSED FAIL300.843s game with ONE
failure: old alive-session fixture had zeroHP and assertedIDLE. Root17.364s and
database1.039s passed, no race warning. Test fixture now explicitly alive100HP;
new zero/dead tests retained. Corrected scoped race91755 PASS root1.187s/game
14.827s. Corrected full race **53548 ACTIVE**, source frozen, log
`/tmp/eidolon-resource-persistence-server-race-corrected.log`. First full log
`/tmp/eidolon-resource-persistence-server-race.log`. Inherited client53881 initially
failed a nonexistent HUD test path; corrected97234 CLOSED PASS280tests/3.663s,
log `/tmp/eidolon-resource-persistence-inherited-client-corrected.log`.

Actual resource harness **92435 CLOSED PASS144sessions /19.09s**, normal0 on
6cba1eb: four classes×levels1/30/100×partial/full/zero/dead×three fresh server
processes; real Mongo, ordinary WebSocketlogin/join/disconnect and verified
persistence, exact resource snapshots plus unchanged gold/level/equipped gear.
Source gear modifies maxima. Loopback Mongo18651 owned container
eidolon-resource-session-proof removed by trap; independent absence confirmed.
Binary `/tmp/eidolon-resource-session-proof-FVsFu3/6cba1eb5fe30133980ecedcf95e4ea460d744d43`.
Log `/tmp/eidolon-resource-persistence-sessions.log`; server evidence dirs
`/tmp/eidolon-compat-session-{1528739573,671743272,4215027106}`.
This does NOT close immediate/concurrent login, delayed disconnect-save ordering,
duplicate/repeated Join, PvP/instance/death-browser or rollback. Existing
asynchronous cleanup can write stale state; repeatedJoin removes live entity
before DBload; older binaries overwrite the whole record and lose unknown
resources. Resolve these BEFORE release/version/patch-note assignment. Do not
block the global hub on Mongo IO while repairing ordering. No browser proof of
resource persistence yet, and no claim this narrow session matrix closes1.1.

Story42789 on2ae3849 CLOSED FAILED5.3m: opening113s/one death, diary165s, Watch
2/40 then player150HP while original Skeleton27HP70.44units away.18retreats,
two crowd jumps/noFireballs; scan0/cleanup verified. Follow-up a4632b5 allows
healthy ranged basic combat until below80%HP (same verified collection strategy),
retains other caller defaults/shields, and reacquires distant disengaged targets
within samewatchdog;68tests/lint PASS. Actual60075 CLOSED FAILED2.5m in the
opening BEFORE Watch: two kills25s, then85HP/22mana vsSkeleton22HP29.76units away.
Scan0/owned-container absence confirmed. Logs
`/tmp/eidolon-story-{retained-target,healthy-combat}-gameplay.log`.

Story current clean **5959689** in `/tmp/eidolon-story-target-input-ATbtXC` also
uses verified collection-style reacquisition in the opening, sharing its existing
deadline.72focused tests PASS1.959s/lint/diff (18213closed0). Sole owned browser
**66825 ACTIVE**, log `/tmp/eidolon-story-opening-reacquire-gameplay.log`, host
API18635/Mongo18636/web18637, runIDstory-opening-reacquire. Keep source frozen;
currently building. Still31chapters/curve2/.01regen, all counts/rewards/death
limits unchanged. Do not replace this with old15chapter release or publish its
historical experimentalAlpha1.0.50 metadata. No other owned handles remain live
besides53548 and66825; poll exact handles, never restart for observation timeout.

## Historical checkpoint — September 8, 14:27 UTC

This turn is PROGRESS: corrected/reproduced prepared fixture and rune reuse,
published the46 QA correction to the normal deployment pipeline, preserved the
next release ancestry, and produced a story-target successor and a confirmed
resource-login defect. Full1.1–1.10 remains active; no milestone completion claim.

46 actual22302 CLOSED PASS2/4.5m, QA_SCRIPT_EXIT=0, normal0 on45df969. Fixture
reuse29.2s includes real mana spend and unchanged equipped rune/ranks/points
after repeated setup; following Verdant3.9m, seed3243300853383481175/gen2normal30
Wizard100, bothbosses/laterenemies/clearedrooms/gold/town PASS. Last Matron953HP,
player2450HP/483mana before confirmed death. No in-run refill. Scan0/exact owned
container/network/image absence PASS. Full client10846 CLOSED PASS223suites/
3251tests/174.985s, normal0; focused race60849/1.508s and25tests/lint as below.
Closure46 **6f7e4a72a774a9d2106c26fc6a98f81a1e535c7c** was normalFFpushed
ed5f64a→6f7e4a7 (69982 closed0). CI **34238194283 freshly ACTIVE**, client/server
running. Current public deployment is NOT verified as this new SHA yet; do not
push47 until entire CI including final live QA and fresh independent public
release.json/healthz/login/runtime-entry exact identity PASS.

47 clean **93ab09c** merges6f7e4a7 into prior ea213c6 with no conflicts, only
the eight QA/evidence files changed.251focused version/preparation/entry tests
PASS2.805s plus full lint/bash/diff (6911 closed0). No runtime/version/cadence/
three-shard change. Earlier full/runtime/browser evidence remains in its docs;
this exact new inherited fixture has not yet had an actual47 browser run.
48–55 still have their older refs and MUST inherit the new47 QA correction
sequentially before their own publication. Never push root's staged52 ledger.

Sole owned local live handle **42789**, actual uninterrupted story on clean
2ae384924b27f09cff0305b9a60f2fbbf682d72a in
`/tmp/eidolon-story-target-input-ATbtXC`; host API18635/Mongo18636/web18637.
Log `/tmp/eidolon-story-retained-target-gameplay.log`. Prepared client/vendor
generator76730 completed0; gameplay is building at this checkpoint. Keep source
frozen and poll this exact handle; do not restart for an observation timeout.
Prior85183 failure/31chapter curve2 evidence below remains authoritative.

Resource deficit diagnosis is refined: actual second login returned2080/2575HP
and1190/1685mana, both495short, exactly the level100 flat bonus. client_dispatch
reconstructs current bars from base stats×10; Character persists no HP/mana.
This is NOT merely preceding tests casting. New confirmed defect/acceptance
contract `2026-09-08-resource-reconnect-contract.md` is linked into the1.1roadmap
by7df16e0. It remains unimplemented. Preserve real depleted/zero/dead resources,
legacy migration, same-snapshot save locking and rollback; do not simply fill
bars on each login and claim the .01-regeneration or persistence issue resolved.
This gameplay defect is a better next runtime priority than cosmetic fake
ability-preview multipliers; neither has a56 implementation yet.

## Historical checkpoint — September 8, 14:22 UTC

Previous goal work made progress (local47–55 closures); the intervening regen
request reconfirmed both .01-per-stat formulas with11client tests and all four
server passive-regeneration tests. This continuation produces new failure
evidence and two QA corrections. The full1.1–1.10 goal remains active/incomplete.

46 CI34232562890 oned5f64a is terminal FAILED before either deployment. Server,
client/Browser Smoke passed; predeploy6/7, Verdant failed. Actual seed
-2919309235239002724 entered with1216/1685mana after preceding independent tests.
Warden died; Matron16800→1995 at last sample, player1338HP/2mana, then the
120-second encounter deadline. Retry clicked the already-equipped Empowered
rune OFF and failed its authoritative selection check. Log
`/tmp/eidolon-release46-predeploy-failure.log`. Do not rerun unchanged or push47.

46 successor **45df969247e8694554f84202605e8fe92002b684**, same recovery worktree:
explicit existing allowlisted level100 fixture at prepared-route start, fresh
system acknowledgement/full bars, no refill during the dungeon; canonical QA
base stats/XP/points reset is intentional and recorded, never used on earned
routes. Wizard/Fighter rune setup skips an already selected rune and otherwise
retains real input plus acknowledgement.25focused tests/lint/bash/diff PASS
(93404,1.053s), server TestSetPlayerLevel RACE PASS1.508s(60849). Sole owned
browser **22302 ACTIVE**, prepared-fixture reuse followed by Verdant on the same
QA character, hostAPI18645/Mongo18646/web18647; source frozen. Log
`/tmp/eidolon-release46-prepared-fixture-gameplay.log`. Full client **10846 ACTIVE**,
log `/tmp/eidolon-release46-prepared-fixture-client.log`. Actual browser has
confirmed its first level1→100 fixture but no completed test yet at this entry.
No push this turn;47–55 must later inherit this QA-only correction and retain
their own separate deployment gates. Ability preview investigation found the
old arbitrary multipliers but produced no56 implementation or release claim.

Expanded-story85183 on6c81285 is CLOSED FAILED11.9m, QA_SCRIPT_EXIT=1. Important
source clarification: it ALREADY uses progression version2,100XPopening,
200XPdiary and31chapters. Do not replace it with curve1/15chapter candidates.
Opening passed67s/no deaths; diary120s, neither reconnected/refilled mana. Watch
reached6/40 with one death; last state alive175HP atx-278/z187, original Skeleton
no longer streamed, hovered Imp;178retreats/14acceptedFireballs. No credit within
120s caused failure. Scan0 and independent exact-container/network absence PASS.
Log `/tmp/eidolon-story-pursuit-current-gameplay.log`. Pacing/campaign not approved.

New isolated successor `/tmp/eidolon-story-target-input-ATbtXC`, branch
work/story-target-input-20260908, clean **2ae3849**: retain ordinary click-owned
attack and observe actual ray-selected actors; prioritize immediate defense;
reacquire lost targets through real movement within the SAME watchdog. No
requirements/rewards/regen/runtime changes. Final16selection/target tests
PASS1.199s plus full lint/diff;31660 closed normally. Actual browser pending
after22302 closes. It remains experimental Alpha1.0.50 metadata, not the queued
release50 or a55 successor, and must not be published wholesale.

## Historical checkpoint — September 8, 14:00 UTC

Previous turn was progress:52/53 inherited suites passed. This turn closes the
long50 earned route, actual52 recovery,53 rendered/town and55 HUD checks, and
integrates/verifies54/55. Full1.1–1.10 remains active and materially incomplete.
**All owned local test/build/browser handles are now terminal.**

49406 on50/77c1155 PASS1/14.5m, explicit QA_SCRIPT_EXIT=0, normal0. Opening76s;
collection/handoff792s,24 observed target deaths/exactly8seeds/0deaths. Combat
reached8, manual100gold/8000XP left17 with the30 guide correctly locked. Before
collection143gold/empty bag; after combat586gold/seven gear pieces/320 unsold
vendor value/12slots. Three Common/three Uncommon/one Rare, no weapon observed.
Exact item IDs/stats/rarities/values and completed quest survive reconnect. This
is functional evidence, not pleasant pacing or statistical loot-rate approval;
repeated retreat/travel remains visible. Scan0/independent cleanup PASS. Ready
capture inspected/archived `/tmp/eidolon-release50-carried-evidence-RPC8It/`.
50 clean **2eb7958**, new carried-earned-loot document;51 carries it at
**86723ddd51c0d797bd40f489d7946197ff86599b** without runtime change.

73905 on52/95abaae PASS1/10.0s (test7.9s), explicit QA_SCRIPT_EXIT=0, normal0.
Normal cast to70mana, deliberately prepared one-HP fixture, real hostile death,
ordinary death button gets100HP/100mana. Second cast/living Recall leaves mana
depleted. Scan0/independent cleanup PASS. Log
`/tmp/eidolon-release52-final51-gameplay.log`.52 now clean **5a0a2440eb8cb7befb8cbf74a809b15927743fd0**
with own complete carried-recovery document and50 closure. This is prepared
functional evidence, not an earned full campaign or phone check.

53's runtime888e4b2 was unchanged by52/50 doc carry at0b8b211.46660 rendered
PASS6/12.2s, normal0, High/Low desktop1280×720/portrait390×844/landscape844×390.
22CSS-pixel sprites, crowd overlap suppression, selected name/marker clearances
and unchanged actors remain asserted. Desktop before/after and both phone after
captures inspected.37911 actual town PASS3/21.3s (8.1/5.5/5.6s), explicit
QA_SCRIPT_EXIT=0/normal0. Fresh level1 ordinary mouse/joystick/tap Ilyra dialogue,
gold marker/readable labels/live frames; all three captures inspected. Scan0 and
independent cleanup PASS. World captures intentionally hide DOM/account labels;
they do not approve the complete phone HUD or physical ergonomics. Archive
`/tmp/eidolon-names53-carried-evidence-bclDwb/{rendered,town}/`, logs
`/tmp/eidolon-release53-final52-{rendered,world}.log`.53 current clean
**ebbde1815bb894f058f616aaf801a315a3e772d7**, carried-nameplates closure.

New54 `/tmp/eidolon-release54-final53-oZ3nK4`, release/54-with-final53, merges
retained8f7f60a and53 atb57bdcf32cfcdb8bd74b061ae0e54cc55ebe164f. Resolve the sole
Actor import conflict by retaining BOTH damage and cadence helpers; constructor/
recalculation and dead-only mana recovery preserved.54858 prepare/lint/full client
PASS236suites/3365tests/148.429s including four actual delayed offline hit callbacks;
20097 fullGo PASS root3.521s/database0.021s/game85.032s. Both normal0. Shared server
formula fixture remains; server damage unchanged. Later doc carries/current54
**b3c348ccb746b7f8065b7ced19a4a5a90c8fe991** contain complete inherited parity and53
visual closures, no runtime change. Logs `/tmp/eidolon-release54-final53-{client,server}.log`.

New55 `/tmp/eidolon-release55-final54-UVV7t3`, release/55-with-final54, merges
retained8df510a and54 at a019fc254b546e1681873627597ceabb55f1b4bb. Resolve CI conflict
by retaining three required anonymous shards and BOTH nameplate/resource rendered
suites once on shard1; regression asserts both.70624 prepare/lint/full client
PASS236suites/3375tests/124.165s;40694 fullGo PASS root3.541s/database0.009s/
game74.927s, normal0. Runtime only changes resource presentation, not stats/regen.
After doc-only carries,21633 on c62e42f PASS3rendered/7.1s, normal0. Desktop/
portrait/landscape show0/160 with no fill, later1mana updates in place. All three
images inspected/archived `/tmp/eidolon-hud55-carried-evidence-VUybnc/rendered/`.
Component fixture, not actual-cast/full-game/physical-phone evidence. Current55
clean **6116baacf9ddbdc6fd981e212a4bfd3ab121348c** carries53/54 closures and its own
inherited-HUD document. Logs `/tmp/eidolon-release55-final54-{client,server,rendered}.log`.

CI34232562890 on46/ed5f64a is freshly active: client/server/Browser Smoke PASS,
Predeploy Character QA running. No push this turn.47/ea213c6 remains the next
publishable candidate only AFTER complete46 CI and independently matching public
release/health/login/runtime identity; then each47–55 has its own release gate.
Root master is staged52 plus ledger, never the branch to push over this queue.

Next useful local work while CI runs: resume the expanded31-chapter earned story
in `/tmp/eidolon-earned-story-TZuGpp` (last6c81285), carrying necessary verified
QA/combat corrections without replacing its authored chapters/counts with the
old15-chapter catalog. Its uninterrupted route, coordinated XP/reward activation,
non-daily level gates and full realm/raid story remain unverified. The fake
ability-intent damage multipliers also remain open; no56 package exists yet.
Do not mistake the now locally validated47–55 hotfix queue for1.1 completion or
the rest of the1.1–1.10 roadmap, physical-phone/PvP/group/season scope.

## Historical checkpoint — September 8, 13:48 UTC

Previous turn was progress:51 save-bridge integration and100 actual save cycles
closed, with52 carried onto that baseline. This turn closes52 full suites and
integrates/verifies53's nameplate candidate. The full roadmap remains active.

52/95abaae2c72a56f351f477e57ca9459af7e8c863:2601 prepare/lint/full client closed
PASS234suites/3333tests/134.73s, normal0.63516 focused race PASS root1.216s/
game2.617s, then fullGo PASS root2.560s/database0.009s/game74.011s, normal0.
All52 source stayed frozen. Actual death-resource browser verification on this
inherited baseline remains due after the existing50 browser route closes.

New `/tmp/eidolon-release53-final52-aGmk4j`, release/53-with-final52, starts from
retained53/874b8fc and merges52/95abaae at1858629. Resolve conflicts by preserving
all three anonymous shards, running the six nameplate render tests once on shard1,
retaining the full AND-gated death-resource/PvP/nameplate-world routes, and keeping
both old/new isolation assertions. All three shards still gate predeployment;
no scene, recovery, visibility or version history is discarded. Runtime diff
from52 is the existing nameplate presentation/render integration; supporting
docs and an existing reward-stack audit test also carry, without activating
their proposed rewards/expanded campaign.

73517 initial focused run failed only the new CI regression's fs reference
(250PASS/1FAIL); the file already imports readFileSync directly. Corrected this
test-only name, no runtime/gate change.10147 passed251tests/2.289s plus lint,
bash syntax and diff. Committed **888e4b27cf564749ea739bc272e7ee8f56429303**.
Frozen74119 full client PASS235suites/3344tests/138.707s, normal0;77794 fullGo
PASS game77.137s/database0.023s and all packages, normal0. Logs
`/tmp/eidolon-release53-final52-{client,server}.log`. All53 handles closed.
Actual High/Low rendered nameplate comparisons and the three-size real-town
mouse/touch routes on this ancestry remain due after52 death recovery. Physical
phone/model/full-combat readability gates remain open, not implied by unit passes.

**49406 remains ACTIVE**, sole owned local browser in frozen50/77c1155,
runID release50-final49, API18635/Mongo18636/web18637, log
`/tmp/eidolon-release50-final49-gameplay.log`. Last17 observed target deaths/
6seeds/0deaths. Repeated retreats lengthen the earned route; preserve this as
pacing evidence, not a claim of pleasant balance or a reason to restart. Poll
this same handle until terminal, inspect/archive ready evidence, verify cleanup,
then run52 death recovery and53 rendered/town coverage in sequence.52/53 are
clean and have no running checks.54/55 still need inherited ancestry.

CI34232562890 on46/ed5f64a remains freshly active in Browser Smoke after green
client/server jobs. No push this turn. Keep its complete final-live gate before
47 publication, then the subsequent ordered releases with their own notes.

## Historical checkpoint — September 8, 13:42 UTC

Previous turn was progress:46 QA correction pushed and47 deployed-safe defense
implemented. This turn closes47 actual dungeon and51 full/save-cycle validation,
and carries the current ancestry into52. Full1.1–1.10 remains active/incomplete.

35359 closed PASS1/3.9m, test3.8m, explicit QA_SCRIPT_EXIT=0, normal0 on47/c2e8513.
Seed8562987465605148137/gen2/normalLv30Wizard100, all15 paced purchases/rune,
both bosses/later mobs/cleared-room/gold/town return passed. Last Matron190HP,
player2575HP/600mana before confirmed death. Scan0/independent cleanup passed.
47 clean **ea213c6**, new `2026-09-08-release47-live-planner.md` closure.
QA ancestry and that document now carried into48/3fcc1b7,49/79e9339,
50/77c1155 and51 below. No gameplay source was changed by those carries.

CI34232562890 on46/ed5f64a is freshly active: client/server jobs PASS, Browser
Smoke running. No further push.46/6e556c4 remains last independently checked
deployed identity, with its previous final-live QA failure documented. Require
the current complete CI/live gate before47's publication.

New51 `/tmp/eidolon-release51-final50-DizHn0`, release/51-with-final50,
frozen45593779f361175229c8f4d69503d11e524f474d includes current50 and c2e8513.
88588 prepare/lint/full client PASS233suites/3330tests/130.739s, normal0.
28965 fullGoRACE PASS root15.841s/database1.057s/game236.252s and all packages,
normal0. The inactive version1 save bridge and room-XP transition fix remain
its only runtime delta from50; this does not activate curve2 or31chapters.

Built the bridge from4559377 and rebuilt historical curve2 fixture762a46b in
detached `/tmp/eidolon-compat51-carried-gI9val/candidate-source`. Initial16664
actual sessions failed21.40s before login: supplied binary basenames bridge/
candidate did not equal their health build IDs, as the existing harness requires.
The server did start; identity checking correctly refused it. No source/assertion
change. Corrected binary names to45593779f361175229c8f4d69503d11e524f474d and
762a46b.29912 real sessions PASS28.46s/process29.488s, normal0,100 real login/
disconnect snapshots across4classes×5cases×5phases1→2→1→2→2. Tested progression,
stats/spent points, gold/Resonance, all gear containers/Forge basis, zero-reward
promises and future discoveries survived. Both owned Mongo attempts/fixture
data removed and exact absence confirmed. No production data was involved.
Logs `/tmp/eidolon-release51-final50-sessions{,-matched}.log`; binaries and
historical source remain in `/tmp/eidolon-compat51-carried-gI9val/`.
51 current clean **c13055c363136990130194be76f51242d704fe8b** adds complete
carried-save-verification evidence after doc-only47 closure merge7ea86d9.

**49406 ACTIVE**, sole owned browser, frozen50/77c1155024a09446a827f79419b0c99daee6f723
in `/tmp/eidolon-release50-final49-XhZNjw`. RunID release50-final49,
API18635/Mongo18636/web18637, fresh ordinary Wizard collection with actual
equipment receipt/saved-roll checks. Log `/tmp/eidolon-release50-final49-gameplay.log`;
explicit QA_SCRIPT_EXIT wrapper. Last5 observed kills/2seeds/0deaths, not PASS.
Poll same handle; preserve source. No owned database-session harness remains.

New52 `/tmp/eidolon-release52-final51-zuht4H`, release/52-with-final51,
merges retainede097cc4 and51 atb9894d1; sole conflict was full QA command list.
Keep BOTH death-resource and PvP-cadence routes. Actor retains new basic cadence
plus dead-only mana refill.51 evidence carried at frozen
**95abaae2c72a56f351f477e57ca9459af7e8c863**. No living Recall refill, XP curve
activation or regen change. **2601 ACTIVE** prepare/lint/full client; **63516
ACTIVE** focused race then fullGo. Focused race already reports game2.617s PASS;
full process not yet closed. Logs `/tmp/eidolon-release52-final51-{client,
focused-race,server}.log`. Freeze52, poll exact handles, then actual death-resource
route after50 browser closes.53–55 still need updated ancestry. No release
publication is implied by these local validations; broader balance/expanded
campaign/phone/PvP and remaining roadmap gates are unchanged.

## Historical checkpoint — September 8, 13:33 UTC

97726 closed PASS1/4.3m, explicit QA_SCRIPT_EXIT=0, normal0 on46/af8f88a.
Both bosses/later mobs/cleared-room/gold/town-return passed, final observed
Matron1629HP with player2408HP/484mana before its confirmed death. Scan0 and
independent exact-container absence passed. Detailed closure committed at
**ed5f64ab0f24441ed460e3de0d88165d6aea86c6**.45480 normal-fast-forward pushed
this QA-only46 correction from6e556c4 after exact-remote/clean/ancestry checks.
New **CI34232562890 is freshly in progress on ed5f64a**. Do not mistake failed
older34226360903 for the current run. Deployed identity remains6e556c4 until
new deployment is independently verified; full46 live acceptance still due.

9479 full client closed PASS231suites/3311tests/117.458s on frozen47/be38d69,
normal0.46's documentation closure merged into47 at
**c2e85137c798fc5f97352607b29e1644ccab0548**, no further runtime/QA change.
**35359 ACTIVE**, sole owned local browser route, frozen c2e8513 in
`/tmp/eidolon-starter-cadence-xCyOrR`, runID release47-live-planner,
API18635/Mongo18636/web18637, prepared Verdant using the import-free collision
planner. Log `/tmp/eidolon-release47-live-planner-gameplay.log`; explicit
QA_SCRIPT_EXIT wrapper. Poll this exact handle; keep source frozen until
terminal. All other owned local handles this turn are closed.

49/4996695 and50/61939da full validation/49 earned closure remain recorded
below, but48→49→50 still need c2e8513 ancestry and47's new QA evidence carried
after this run.50's new earned equipment comparison remains due.47 still needs
the full new46 CI/live gate before its own publication. This turn made concrete
progress in49/50 integration, final-live diagnosis, QA implementation and46 push;
the full1.1–1.10 objective remains materially incomplete and active.

## Historical checkpoint — September 8, 13:31 UTC

Previous turn was progress:49 inherited48 and passed its full suites while46
deployed. This turn closes49 gameplay, integrates/verifies50, and repairs the
confirmed final46 live-QA failure. Full1.1–1.10 scope remains active/incomplete.

51936 closed PASS1/5.9m, explicit QA_SCRIPT_EXIT=0, normal0 on49/7a6c8a7.
Opening42s; collection/handoff307s,14 observed target deaths/exactly8seeds/
one player death. Retreat led into a level30 DemonOrc group; ordinary respawn
kept mana11 rather than refilling. Manual100gold/8000XP, consumed items, saved
completion and correctly locked Lv30 guide passed. Scan0/independent exact
container absence passed. Ready8/8 screenshot inspected/archived at
`/tmp/eidolon-release49-carried-evidence-SXCsA6/earned-collection-ready.png`.
49 is now clean4996695, with detailed final48-inheritance closure. No publication.

New `/tmp/eidolon-release50-final49-XhZNjw`, release/50-with-final49, runtime
82c72b60050ebbc33c077ff2488393e355d9abad merges retained50/774d817 and49/7a6c8a7
without conflicts.49 doc closure carried at1af50c6; own evidence61939da, clean.
82580 prepare/lint and238 focused version/QA/shard tests PASS2.4s.35212 initial
race subset PASS10.185s omitted RoutineElite names; corrected14060 includes
Routine(Equipment|Elite), personal world drops/regen/cadence, three repetitions
PASS11.006s. Full11645 client PASS231suites/3324tests/141.617s;96545 fullGo
PASS root3.738s/database0.043s/game83.348s. All terminal0.50 actual earned route
on inherited cadence remains due, and all later candidates need the latest QA
corrections below before publication. Runtime balance scope remains unchanged.

CI34226360903 is terminal FAILURE, not still running. Both46 deployments and
all predeploy checks passed; final live anonymous/persistent QA had7PASS/1FAIL
in4.6m. Both Verdant attempts failed with no available retreat ground, attempts[]
and displacement0, live player alive at2281/2244HP. RootboundWarden was damaged
15000→6444 on retry before the helper threw. This is an unissued input, not a
server command failing to move. Logs `/tmp/eidolon-release46-final-live-failure.log`.
46/6e556c4 remains deployed with matching public identity, but final gameplay
acceptance failed.47 must not yet be published.

46 candidate **af8f88a6a475dba6aeb8ebc7ef9193890bfdcfb5** only changes QA:
typed GroundInputUnavailableError permits selecting combat when no click/key
was issued. Issued movement failure still throws; no successful retreat credit,
changed death bound, reward, resource or runtime change.89719 focused45tests/
0.948s plus lint/diff PASS. **97726 ACTIVE**, sole owned browser route, frozen
af8f88a in `/tmp/eidolon-release46-recovery-C5EHfe`, runID release46-live-ground,
API18635/Mongo18636/web18637, log `/tmp/eidolon-release46-live-ground-gameplay.log`.
Seed-4899557939214400244/gen2/normalLv30Wizard; first boss/later mobs defeated,
second boss last12271/16800, player2575HP/791mana. Intermediate, not PASS.
Poll this exact handle, preserve source until terminal, then record/push the
QA-only46 correction after the existing clean/ancestry checks and local closure.

Inspection also found47's defense helper imported `/tests/wizardHuntControls.js`
inside the browser, but Pages publishes only game assets; independent public
URL returns404.3572411 keeps strategy in Node and sends detached vectors to
one import-free browser collision-path query, preserving walls and selection.
Tests cover intermediate wall obstruction, no position mutation, all-blocked
paths and no unnecessary query for healthy collection.21400 focused32tests/
1.102s plus lint PASS.46 correction merged at **be38d69** with a sole import
conflict resolved to the new planner; new prepared test uses collision results.
75399 focused255tests/2.136s plus lint/diff PASS. **9479 ACTIVE** full client in
frozen47 `/tmp/eidolon-starter-cadence-xCyOrR`, log
`/tmp/eidolon-release47-live-ground-client.log`. No47 runtime changed. Actual
prepared dungeon on this planner remains due after46 closes.48/49/50 still
need this new47 QA ancestry carried after validation; do not push old candidates.

## Historical checkpoint — September 8, 13:21 UTC

This goal turn is progress:49 now inherits final48/47, with full client/server
and focused race validation. Publication46 also advanced through both deploys.
The full goal remains active; neither49 gameplay nor46's final live QA is closed.

CI34226360903 freshly reports success for client, server, anonymous browser,
predeploy character QA, production-input validation, Pages deploy and server
deploy. **Live Release and Character QA is in progress.** Independent no-cache
public checks now agree on46/6e556c4a67cb1fd901d93fe2c3a35a79c519b09d:
release.json, ready server healthz, login Alpha1.0.46 and the versioned main.js
import. This proves deployed identity, not final gameplay acceptance.47 remains
unpushed pending that final CI gate. Remote master is still exactly6e556c4;
clean47/3a68c03 is a verified descendant, with its own notes/defaults intact.

In frozen49/7a6c8a7,58358 prepare/lint closed0,76279 focused Chronicle/quest/
pickup/regen/Forge race closed0 (root2.344s/game14.309s). Full79297 client
closed0:231suites/3323tests/151.745s. Full91979 Go closed0:root3.396s/database
0.016s/game85.457s, all packages green. No source changes during these checks.

**51936 ACTIVE**, sole owned local browser route in
`/tmp/eidolon-release49-final48-0cNQN9`, branch release/49-with-final48, frozen
7a6c8a7b5825ec02af5d22596d904a0b18d0e436. Run ID release49-final48,
API18635/Mongo18636/web18637, system Chrome, ordinary fresh Wizard collection.
Log `/tmp/eidolon-release49-final48-gameplay.log`; wrapper prints QA_SCRIPT_EXIT.
Last observed opening manual turn-in42s, collection7 target deaths/4seeds/
0deaths, normal scarce mana/basic attacks. These are intermediate observations,
not a passing route. Preserve the exact required-fragment assertion and manual
turn-in/save/gate assertions. Poll this same handle until terminal and freeze
this worktree. Do not touch external CI containers or restart on observation
timeouts. After clean closure inspect/archive its ready capture, record49
evidence, then carry ancestry into50 or resume expanded earned story play.

## Historical checkpoint — September 8, 13:17 UTC

Previous goal turn made progress: the final duel repeat closed normally, full47
validation passed, and48 inherited final47 with full tests and actual Forge QA.
The intervening direct regeneration check reconfirmed0.01 on both sides with
six client and four server tests passing; no second reduction is needed.
The full1.1–1.10 goal remains active and incomplete.

90204 is terminal PASS4/1.5m, explicit QA_SCRIPT_EXIT=0, normal exit0 on8945856.
Credential scan and exact-container cleanup passed. PvP repair and its retained
full-predeploy route are merged into47. Current47 is clean3a68c03 in
`/tmp/eidolon-starter-cadence-xCyOrR`; runtime85296ee passed full17075 client
229suites/3306tests/128.203s and full50135 server race root10.867s/database1.025s/
game257.014s. Both closed exit0; later changes are documentation only.

Current48 is clean08e2071 in `/tmp/eidolon-release48-final47-Fl4I8Y`, branch
release/48-with-final47. Frozen merge3ab4b86 passed full89281 client230suites/
3317tests/137.178s, full30663 Go root4.441s/database0.016s/game80.683s, focused
83823 Forge race root1.488s/game7.829s, and55543 focused246tests plus lint.
Actual73465 Forge/guide PASS1/21.9s, explicit QA_SCRIPT_EXIT=0 and terminal0:
normal upgrades/potency update the open UI, accumulated damage46/preview50,
exact item/basis survive reconnect, and guide70+/60+ families are correct.
Credential scan and independently checked cleanup passed. Desktop screenshot
inspected and archived at `/tmp/eidolon-forge48-carried-evidence-1RCj6Y/`.
This prepared fixture does not prove earned economy or physical-phone play.
Detailed receipts are in the47/48 final-validation/inheritance documents.

CI34226360903 on46/6e556c4 is freshly active in Predeploy Character QA;
client/server/anonymous browser jobs PASS.45/83d8f08 remains last independently
verified live. Do not publish47 until46's complete CI and fresh live-identity
gates pass; preserve sequential47→48→49 publication afterward.

New isolated `/tmp/eidolon-release49-final48-0cNQN9`, branch
release/49-with-final48, merges retained49/2f03507 with current48/08e2071
without conflicts at **7a6c8a7b5825ec02af5d22596d904a0b18d0e436**. Its distinct
49 personal-fragment notes and all prior notes/version tests remain. Diff from
48 contains the existing personal-drop budget and inactive investigation
support, not an activated31-chapter campaign. Browser vendor dependencies are
prepared. Source is frozen for active checks:58358 prepare/lint,76279 focused
Chronicle/quest/pickup/regen/Forge race,79297 full client. Logs are
`/tmp/eidolon-release49-final48-{race,client}.log`. Poll these exact handles.
No owned local browser route is active yet.49–55 are not published;50 onward
still need this ancestry carried forward. Broader balance/story/PvP/phone
acceptance and the rest of the roadmap remain open.

## Historical checkpoint — September 8, 13:00 UTC

Previous turn was progress:6e556c4 was verified locally and pushed. This turn
confirms the actual duel scene bug and implements a production repair in an
isolated candidate. The full1.1–1.10 goal remains active/incomplete.

CI34226360903 on6e556c4 is freshly in progress: client/server/Browser Smoke jobs
PASS, Predeploy Character QA running.45 remains last independently verified live. Do not publish47
before46's complete CI and live-identity gates.

14835 closed exit1 on clean542870d: all four class pairs received active duel
state and own PvP-instance deltas but zero enter_instance messages; both clients
remained outside PvP. Scan0 and independent exact-container absence passed.
This confirms missing scene integration, not a test-property typo. Detailed
receipts: `/tmp/eidolon-starter-duel-scenes.log`.

New isolated `/tmp/eidolon-pvp-scenes-4TVWZ4`, work/pvp-scenes-20260908,
clean **d011b8a138ff612a6ec6062fa1c70c7a1cc14f34**, sends explicit initial arena
entry and authoritative departure positions on completion, without reloading
ordinary score updates. Only real active matches expose fresh arena layouts.
The low-walled court uses server center bounds plus standard body footprint;
client containment, scene generation and team spawns now agree. Existing damage,
rewards, match scoring, boundaries and disconnect-forfeit rules are unchanged.

50649 reproduced missing server scene/layout tests;34564 reproduced2 client
arena/return failures (17pass).29154 focused21PASS/1.197s plus lint;92326 focused
racePASS root1.484s/game14.346s. Full6505 serverPASS root1.698s/database0.006s/
game61.596s. Full39044 clientPASS228suites/3304tests/106.310s. All terminal.
Evidence: candidate `docs/plans/2026-09-08-pvp-scene-handoff.md` and
`/tmp/eidolon-pvp-scenes-{client,server}.log`.

59684 on d011b8a was explicitly interrupted (exit130) after a confirmed missing
vendor-runtime setup: local Three.js module HTTP404, first two cases timed out
in openGame before world entry. This is NOT arena/combat failure or proof of
a screenshot-step problem. Exact Playwright PID3583923 was checked before SIGINT;
scan0 and exact-container cleanup completed. Log `/tmp/eidolon-pvp-scenes-gameplay.log`.
Do not restart solely on timeouts: this interruption followed a concrete404.

634c20c adds an isolated-driver preflight that rejects missing vendor imports
before Docker/credentials, plus explicit world/arena milestones and the direct-body
canvas capture selector. Ran npm run prepare:client in this worktree.33 focused
checks/1.564s plus lint/bash/diff passed; missing-runtime test invokes the real
shell entrypoint with no external commands available. Runtime remains d011b8a.

65494 PASS4/1.5m, normal exit0 on clean634c20c: each side entered the rendered
arena, delivered5 positive one-damage hits with mean interval1.913–1.917s versus
1.90476s stats, retained mana, lost health, forfeited and returned within1unit
of the recorded departure, preserving ranked profile/XP/gold. Scan0 and exact
container absence passed. Both entry/combat captures inspected and archived at
`/tmp/eidolon-pvp-entry-evidence-bG4RCB/`. They include UI because element
screenshots clip rather than isolate DOM layers; no claim they exclude labels.

Inspection prompted a single-floor cobblestone material using existing procedural
Lanternhold paving. e9b1b2b also adds practice-duel notes to47 without claiming
ranked/party sign-off;243 focused/version checks/2.951s plus lint/diff passed.
60074 reports4PASS/1.7m on clean e9b1b2b (23.4/24.1/24.8/26.6s), same assertions,
scan0 and cleanup. However its tool handle returned143 after the complete success
log, not0. Retain the wrapper anomaly. Paved entry/combat captures inspected and
archived at `/tmp/eidolon-pvp-paving-evidence-jHAITJ/`. Existing oversized combat
labels remain a visual follow-up; this is not final visual/phone sign-off.

89458566d883566abc2c55444055c4cc78b33e6f retains the same four-class duel function
in the full predeploy route.68622 PASS236 tests/2.488s plus lint/bash/diff.
**90204 ACTIVE**, sole owned browser route, frozen8945856 in the PvP worktree,
run ID pvp-scenes-final, API18635/Mongo18636/web18637, log
`/tmp/eidolon-pvp-scenes-final-gameplay.log`. This wrapper explicitly prints
QA_SCRIPT_EXIT before returning it. Poll this exact handle and freeze source
until terminal. Candidate47 in the other worktree remains542870d; merge after
clean closure, then retain full versioned publication gates behind46. The repair
is not published. Ranked/party/disconnect/physical-phone acceptance and broader
balance remain open. CI34226360903 remains freshly active in predeploy gameplay.

## Historical checkpoint — September 8, 12:31 UTC

Previous goal work was progress: four-class collection evidence, CI shard
configuration and expanded-story pursuit verification changed the next actions.
The direct regeneration follow-up confirms both coefficients remain0.01, with
six client and four server tests passing; do not reduce them again. The full
1.1–1.10 goal remains active and incomplete.

### Release46 failed; a concrete talent-input cause is now reproduced

Fresh GitHub inspection confirms CI34220869395 on86609cd is terminal FAILED.
Server/client/anonymous browser jobs passed; predeploy character QA failed and
both deployments/live QA were skipped.45 /83d8f08 remains last verified live.
The first Verdant attempt stalled on a rank purchase; retry died against Briar
Matron after real damage reduced16800HP to the last sample962HP, mana7.
Failure log: `/tmp/eidolon-release46-recovery-ci-failure.log`.

In `/tmp/eidolon-release46-recovery-C5EHfe`,97a53ba adds prepared-Wizard normal
defensive inputs and scales retreat clearance to enemy melee reach (7.5 for the
observed large boss, previously fixed six-unit center threshold). All damage,
resources, survival assertions, walls and deadlines remain.38 focused tests/lint
passed. No game/server runtime changed.

Actual95930 failed before combat on clean97a53ba. New observation proves13
outgoing talent requests,12 accepted ranks,8points instead of7, and an explicit
rate-limit error. The10-per10s server policy is unchanged. Candidate8ac2e95 now
paces each normal purchase at1100ms, preserving individual authoritative point/
rank acknowledgement and never retrying rejected purchases.39 tests/lint passed
(an initial test-only jsdom/Node URL mismatch was corrected). Logs:
`/tmp/eidolon-release46-wizard-clearance.log`,
`/tmp/eidolon-release46-wizard-paced.log`.

**35020 PASS**, normal exit0 on clean8ac2e95:3.7minutes, generator2
seed1587624703800339911, all15 purchases, both bosses killed through actual
inputs, later mobs, cleared-room/gold assertions and town return. Periodic
combat HP remained2575/2575; last Matron sample613mana. No added combat refill
or reconnect. Scan0 and independent exact-container absence passed.44129
passed258 version/preparation/defense tests/1.470s plus bash/diff; lint passed.
All local46 handles are closed. This is prepared two-boss functional evidence,
not a full/fresh dungeon balance approval.

51809 normal-fast-forward pushed **6e556c4a67cb1fd901d93fe2c3a35a79c519b09d**
from the isolated46 branch after clean/ancestry/exact-remote checks. New
**CI34226360903 is in progress**, freshly observed client/server jobs running.
Existing46 patch notes/version retained; no game/server runtime changed from
86609cd. Latest independent public release.json and ready healthz still agree
on45 /83d8f083538fc92b03878c9eb7cb1a46c8847da7. Neither46 live nor47 release
approval is established.

### Four-class collection closes; duel integration needs repair

Fighter52647 PASS5.0m: opening95s, collection200s,13 observed kills,8seeds,0deaths.
Rogue92922 PASS7.8m: opening32s, collection435s,25kills,8seeds,0deaths.
Cleric30263 PASS5.7m: opening34s, collection303s,22kills,8seeds,1death.
All used a38b535 and retain ordinary manual turn-in, consumed quest items,
saved handoff and the correctly locked level30 entry. Credential scans and
cleanup passed. Together with Wizard76763 this closes the original-campaign
comparison, not an uninterrupted first hour or a class-DPS benchmark. The
8000XP reward/level17-to30 gap and expanded campaign remain open.

81208 on6881053 is terminal FAILED: all four mirror-duel cases timed out before
combat waiting for the shared instance. Scan0 completed. Source review finds
missing explicit PvP scene handoff/generation paths; candidate QA now observes
wire/scene receipts before changing production. Do not claim PvP cadence passed.
Log `/tmp/eidolon-starter-cadence-duels-gameplay.log`; details in the cadence
worktree's `docs/plans/2026-09-08-basic-attack-cadence.md`.

7a9f76f adds receipt observations only.542870d then merges the published46 QA
correction into47, preserving both its optional healthy-collection threshold/
ordinary collision checks and the new scaled enemy clearance.43 merged focused
tests/0.664s plus lint/diff passed. **14835 ACTIVE**, sole owned browser route,
frozen542870d5db669bee49974ca9ede7e7cc51771587, run ID starter-duel-scenes,
API18635/Mongo18636/web18637, log `/tmp/eidolon-starter-duel-scenes.log`.
Poll this exact handle; do not edit the cadence worktree until terminal. This
local diagnostic does not replace or interfere with CI34226360903.

57a762a adds three GitHub-hosted anonymous-browser shards and is merged into
47. Installed Playwright inventory proves an exact76-test union without duplicates
(28/23/25); all-shards-success remains required. Historical timing redistribution
suggests a shorter critical path but is NOT a measured CI speedup. No sharded
CI has run yet. See `/tmp/eidolon-browser-shards-dwDlTC/docs/plans/2026-09-08-browser-smoke-shards.md`.

Expanded31-chapter candidate in `/tmp/eidolon-earned-story-TZuGpp` is clean6c81285
(runtimecf6875c). Starter pursuit port passed focused race24805/3.696s and full
Go70191 (root2.264s/database0.015s/game66.308s). No15-chapter catalog, reward,
quest counts or curve copied over it. Uninterrupted actual story verification
remains due. Queued48–55 are unchanged; publish sequentially after46/47 gates,
never push staged root master over the release branch.

## Historical checkpoint — September 8, 11:45 UTC

Previous turn was progress: recovery repeat 63224 reached a normal exit, clearing
the next publication action. This continuation pushes that correction, completes
the first passing current-campaign cadence comparison, and implements a confirmed
empty-mana display bug. The full 1.1–1.10 objective remains active and incomplete.

### Release 46 pushed; deployment gates remain active

63224 completed with explicit shell exit 0: recovery gameplay passed in 38.5s,
generator 2 seed 3275436958928923678, clean 86609cd. Enemy-caused death, rejected
dead Recall, explicit Respawn and same unfinished-run re-entry all passed.
Credential scan 0 and independent exact-container absence passed. The earlier
34012 wrapper exit 143 is retained as an anomaly, not silently relabeled.

43506 pushed exact **86609cdc08f6cc032d6a40f1887242f88c96d4d6** as a normal
fast-forward to origin/master from `/tmp/eidolon-release46-recovery-C5EHfe`.
No root-master or later-release push occurred. New **CI 34220869395** is freshly
in progress: server and client jobs passed; Browser Smoke is running. Require
all jobs and exact independent public identity before declaring 46 live or
publishing 47. Alpha 1.0.45 / 83d8f08 remains the last verified live release.

### Current-campaign Wizard collection passed; Fighter comparison active

**76763 passed**, normal exit 0, on clean d72f7df in
`/tmp/eidolon-starter-cadence-xCyOrR`. Opening 32s, collection 470s, total test
8.4 minutes: 15 observed target deaths, 8/8 seeds, no player deaths. Manual Ilyra
turn-in consumed eight seeds and granted 100 gold / 8,000 XP. Saved completion,
next acceptance and the level-30 dungeon restriction survived login. Scan 0 and
independent exact-container absence passed. This does not establish a complete
first hour: opening reward/relogin remains, the handoff is level 17, and both
the excessive payout and level-30 gap remain open.

After closure, bfd2d7d merged only 46's recovery QA correction into the candidate.
**a38b535c3f3227cfcb0979e97020204854cb6f38** adds existing-haste and actual
four-class PvP impact/consent regressions, plus explicit four-class selection for
fresh collection (`EIDOLON_E2E_FRESH_CLASS`, Wizard default). 46510 passed 27
client tests / 0.913s plus lint/bash/diff; 32798 passed focused race / 2.624s.
Prior same-runtime 64716 race passed 2.999s. All are closed.

Source review preserves per-hit proc chances, one-second poison ticks and PvP's
65% scale / 35%-health per-hit cap; these do not prove sustained PvP balance.
The one-second Dexterity floor is unbuffed: existing Zeal/Time Warp apply after
it. No regen, resource, per-hit damage or enemy cadence changes were added.

**52647 ACTIVE**, the sole owned browser/test: frozen a38b535, run ID
`starter-cadence-fighter`, API 18635 / Mongo 18636 / web 18637, log
`/tmp/eidolon-starter-cadence-fighter-gameplay.log`. Actual baseline confirms
Fighter with 0.01-per-stat regeneration, not an accidentally repeated Wizard.
Poll this exact handle to terminal; do not edit that worktree during the run.
Rogue, Cleric and actual PvP/encounter pacing remain due before final selection.

### Alpha 1.0.55 queued: empty means empty

New clean **8df510ae4adbb61d465dd6b9f40997dbb203fe20** in
`/tmp/eidolon-resource-hud-N2fXGI`, work/resource-hud-20260908, also preserved as
release/55-honest-resource-hud. Runtime bfde53b fixes `mana || 100`, which really
displayed 100/160 when mana was zero. The initial 69063 reproduced eight boundary
failures. Shared presentation now preserves zero, bounds bar/text values and
does not mutate resources. Health/mana rounding and 0.01 regen remain intact.

24585 passed 42 focused tests / 2.540s plus lint. Full 65671 passed 225 suites /
3,302 tests / 108.318s. Versioned 22993 passed 260 tests / 2.331s plus lint/bash/
diff; 91989 server root passed 1.734s. 89061 rendered fixtures passed desktop,
portrait and landscape, 3 tests / 7.7s. Desktop and portrait images inspected;
all archived at `/tmp/eidolon-resource-hud-evidence-ZPk14d/`. These are explicit
presentation fixtures, not earned casts or physical-phone evidence. Final 55297
passed 229 version/history/default tests / 1.311s plus lint/diff. All closed.

55 has its own patch notes, aligned login/package/backend/deploy defaults and
retained rendered CI coverage. It is based on queued 54, not final 47; inherit
the final earlier releases and publish in order. It is not pushed or live.

New source-confirmed follow-up: the target-intent Fireball estimate uses an
arbitrary 1.5 × basic damage, showing about 5 versus the level-five base spell's
48. Other skills have similar placeholder estimates. Replace these with actual
formulas/modifiers; do not describe the current numbers as reliable. This is
recorded in the resource-HUD candidate document and remains unimplemented.

## Historical checkpoint — September 8, 11:23 UTC

Previous goal turn was progress (54 packaged, prior collection run closed).
This turn adds a level-appropriate preparation comparison, validates the isolated
cadence backport, and corrects46's newly observed deployment-gate failure. Full
1.1–1.10 remains active/incomplete, not blocked. No new release was pushed.

**46CI34215073108 TERMINAL FAILED** at Predeploy Character QA. Client/server/
anonymous browser PASS; validation, Pages/server deploy and live QA all skipped.
45 remains last independently verified live. Failure log
`/tmp/eidolon-release46-ci-failure.log` downloaded by5465 (closed): recovery test
failed both generator2 seeds214149699972850271/1425612774346219180, no new input
issued while an earlier move continued about10units. Earlier Verdant talent
purchase flake (expected1remaining, observed2) passed retry and is separately open.

New clean **86609cdc08f6cc032d6a40f1887242f88c96d4d6** in
`/tmp/eidolon-release46-recovery-C5EHfe`, work/release46-recovery-input, directly
on b2016ef. QA-only correction lets each movement settle before reprojecting and
ends approach on actual incoming damage. Death/Recall rejection/Respawn/same
unfinished-run assertions and all deadlines remain.73327 full lint/diff PASS.

Actual34012 reports **1PASS/38.2s** (test35.9s), seed4016897494389185029, exact
86609cd/clean; scan0 and independent exact-container absence PASS. However tool
terminal exit was143 after the complete success/cleanup log, not0. Do not silently
call that a normal script exit. **63224 ACTIVE** explicit-shell-status repeat on
same frozen86609cd, runIDrelease46-recovery-repeat, API18625/Mongo18626/web18627,
log `/tmp/eidolon-release46-recovery-repeat.log`. Only owned browser/test active.
Poll this exact handle; on clean success review/push this explicit46 branch as
normal FF, not root master; then require new all-job CI and exact live identity.

Prepared comparison0d05dcc used shared regular inventory inputs, preserving
unprepared/default route and advanced level10 specialization.44045 PASS48tests/
1.610s plus lint/bash/diff. Actual32039 **FAILED9.0m**, opening40s/no deaths;
preparation0gear/0allocatedpoints; collection6observedtarget deaths/2seeds/1death,
then120s encounter timeout. Scan0/cleanup/container absence PASS; image inspected
and archived `/tmp/eidolon-starter-prepared-evidence-Ob4X7M/failed-collection.png`.
Crucial source finding: online growth is automatic and manual attribute allocation
is intentionally hidden/disabled. Do not prescribe offline-only points as the
missing online preparation. Worktree now clean docs-closure9bf76b2, no active run.

Independent **9505325** backports ONLY0bbc945's existing player-only attack-cadence
prototype onto0d05dcc in `/tmp/eidolon-starter-cadence-xCyOrR`, branch
work/starter-cadence-20260908; docs closure **d72f7df1402f301531bb12b69c7efde2c8d5e75a**,
clean. No31-chapter story/futurecurve/death-mana/54damage-parity imports. .01regen,
per-hit damage and enemy cadence stay unchanged; player starting interval1.905s
instead of4.167s, same1s floor. This is not a released balance selection.
15042 PASS31focused/3.055s plus lint/diff.61045 full server PASSroot5.352s/
database0.024s/game88.516s.10812 full client PASS226suites/3292tests/153.923s.
All three handles closed; fresh actual comparison remains due after46 recovery.
On-hit/PvP/PvE pacing review remains required before shipping faster attacks.

53/874b8fc,54/8f7f60a and expanded31-chapter6c2a81a remain separate queued work.
Never push root master; propagate final46 correction and then final47 through
the queue only after their respective verification gates. Goal scope unchanged.

## Historical checkpoint — September 8, 11:06 UTC

Previous goal turn was progress (damage parity implemented, pursuit QA corrected).
This turn packages verified54 and closes the failed collection playthrough.
Full1.1–1.10 remains active/incomplete; no blocked or completion claim.

**46CI34215073108 freshly live/in_progress**: server/client/browser smoke PASS,
Predeploy Character QA running.45 is still last independently verified live;
no47 or later push, and never push root's staged master over the release queue.

**12730 PASS225suites/3288tests/203.525s**, terminal, damage-parity8dfd9a4.
Versioned **54 committed8f7f60aa19119bbe75c123f05150e2820c65b4ea**, clean in
`/tmp/eidolon-basic-damage-parity-kpmlMA`, preserved release/54-basic-damage-parity.
Own notes “know your strength”, matching login/package/backend/deploy defaults,
and all53/prior history retained.63440 PASS244tests/4.229s plus lint/bash/diff;
additional real delayed-hit callbacks for all four heroes verified by19848
PASS248tests/7.152s plus lint/diff.29318 server/root health0.031s and shared
fixture0.033s PASS. Runtime unchanged from full-suite8dfd9a4. All handles closed.
Queued54 requires final47 inheritance and sequential46–53 publication, not live.

**23203 FAILED4.0m**, terminal on3deaede: opening3kills/0deaths and manual
reward/relogin PASS45seconds, level5. Collection3observedtarget deaths/0seeds/
0deaths, then120s encounter timeout.34retreats spread basic damage across several
Skeletons; final receipt151HP/16mana with one level1 enemy nearby. Scan0, cleanup
and independent exact-container absence PASS. Failure image inspected/archive
`/tmp/eidolon-starter-reacquire-evidence-3d2EmT/failed-collection.png`.
Pursuit worktree has a docs-only closure atop3deaede; no new runtime or actual
rerun. This is an opening pass, not collection/first-hour acceptance.

Next compare normal use of eligible earned gear/stat points at level5 before
further enemy tuning. Existing prepareEarnedClass requires level10 and an open
dungeon menu, so do not call it blindly or grant a specialization. Preserve the
unprepared baseline and existing deadlines/rewards. All owned browser/test
handles are now closed; only external46CI remains running.53/874b8fc and the
expanded31-chapter6c2a81a remain separate and unchanged.

## Historical checkpoint — September 8, 10:59 UTC

Previous goal turn was progress (production pursuit implementation and tests).
This continuation commits that candidate, closes its real failure, corrects
disengaged-target QA, and implements reproduced four-class damage parity.
Full1.1–1.10 remains active/incomplete, not blocked.

**46CI34215073108 freshly in_progress**: client/server/browser smoke PASS,
Predeploy Character QA still live.45 is still last independently verified live
release; no47 or later push and no root-master push.

Starter full92956 **PASS**, terminal: root4.235s/database0.035s/game119.618s.
Actual38499 **FAILED2.5m** before collection: opening2kills/zero deaths,73HP/
22mana/36retreats at(185.88,142.46). Final receipt has no Orc/starter train, but
the watched level1Skeleton is idle47.19units away with28HP; pending/hovered null,
one level3Skeleton5.69units away. Do not infer overall pacing improvement from
this single run. Scan0 and independent exact-container absence PASS; both handles
closed. Production pursuit is committed **62791a50fe27142b73bccd7d5bcba387619e05b6**.

QA follow-up **3deaede81d43fe3821d35420936274eaebc26fa3**, clean/frozen in
`/tmp/eidolon-starter-pursuit-VB2m7S`, permits a currently visible Skeleton to be
acquired through normal input when the old living target is outside basic range+2
and no hostile auto-attack/chase remains. Active chases, missing/dead evidence and
the120-second/two-respawn bounds are retained. Collection rechecks delayed death.
44250 PASS35tests/lint; final79654 PASS36tests/1.986s plus lint/diff.
**23203 ACTIVE** actual fresh-collection on3deaede, runIDstarter-pursuit-reacquire,
API18635/Mongo18636/web18637; log `/tmp/eidolon-starter-pursuit-reacquire.log`.
Only owned browser; poll exact handle, keep source frozen until terminal.

Independent **8dfd9a4eaa705ac539fe8e283ec22e3184627c93** damage-parity candidate
in `/tmp/eidolon-basic-damage-parity-kpmlMA`, work/basic-damage-parity-20260908,
clean/frozen on queued53. Reproduced all four hero constructors using Strength×2
instead of the server's integer class-primary/4. Constructor/recalculation now
match existing authoritative hero scaling plus flat equipment damage; non-hero
actors retain Strength×2. No server formula/cadence/regen/save/reward change.
It does not fix online server pacing. Needs later versioning, not a53 live claim.

8044 reproduced4fail/8pass. Shared unequal-stat/equipment JSON runs in Go and
client;90787Go PASS0.007s. Initial62021 fixture reader failed on jsdom URL; fixed
repository-relative path.26852 PASS72tests/three suites/2.066s and full lint.
**12730 ACTIVE** full client regression on8dfd9a4; log
`/tmp/eidolon-basic-damage-parity-client.log`. No terminal result yet. Keep source
frozen and poll this handle, do not restart on observation timeout. This and23203
are the only owned running checks. All other named handles this checkpoint closed.

Queued53/874b8fc remains clean/verified and expanded31-chapter6c2a81a remains
separate, with actual all-class/campaign approval still due. Next close12730 and
23203; act on their evidence before publication/inheritance. Goal scope unchanged.

## Historical checkpoint — September 8, 10:50 UTC

Previous goal turn was progress (versioned53 committed; opening QA corrected).
This continuation closes the failed opening run and implements a production
starter-pursuit candidate. Full1.1–1.10 remains active, not achieved or blocked.

**46CI34215073108 freshly in_progress**: server/client/browser smoke PASS;
Predeploy Character QA running. No new publication or live approval;45 remains
last independently verified live release. Do not push47 until46 fully passes
and fresh public identity checks match its exact b2016ef commit.

**5909 TERMINAL FAILED2.7m** on ba5b7ae. Opening2kills/zero deaths, then120s
encounter deadline at(261,-26),37HP/22mana/53retreats. Receipts show damage spread
across Skeletons and level30DemonOrcs; starter Skeletons from the town gate still
followed the player. Scan0 and independent exact-container absence pass. No
collection result: the run never reached it. ba5b7ae stays clean and unapproved.

Inspection confirms no spawn-relative pursuit boundary and stale chase targets
retained during lost-target roaming. New independent candidate branch
**work/starter-pursuit-20260908**, `/tmp/eidolon-starter-pursuit-VB2m7S`, based
on ba5b7ae, has **owned uncommitted edits and is frozen during tests**. Level1–9
ordinary overworld Skeletons acquire targets within60units of home; when no
eligible target remains outside their10unit patrol, they walk home at ordinary
speed. No healing, immunity, teleport, player stat or reward change. Elites,
bosses, summons, other families/levels and instances are excluded.47candidate
patch notes explain the behavior. No claim that this alone fixes pacing.

16963 PASS6pursuit/spacing checks0.314s;36777 PASS7including continuous60-second
retreat regression0.273s.8406 PASS226version/regen tests3.857s.28200 full lint and
diff PASS. Candidate doc `2026-09-08-starter-pursuit.md` records scope/evidence.

**92956 ACTIVE** full server `go test ./...`, log
`/tmp/eidolon-starter-pursuit-server.log`: root4.235s/database0.035s already PASS;
game package remains running. **38499 ACTIVE** fresh actual collection, runID
starter-pursuit, API18635/Mongo18636/web18637; log
`/tmp/eidolon-starter-pursuit-gameplay.log`. Both use the same frozen candidate;
do not edit/commit its source until both terminate.38499 is the only owned
browser. Poll these exact handles, never restart due to observation timeout.
No source mutations or process interference with external46CI.

Queued53/874b8fc is unchanged, clean and locally verified as below; expanded31
chapters/all-class6c2a81a remains separately unapproved by actual campaign play.
Next inspect full server and fresh-play results before committing/inheriting
the pursuit change or moving47 forward. Root master stays unpushed.

## Historical checkpoint — September 8, 10:42 UTC

The preceding regeneration response reverified existing code (6client/4server
tests) but did not advance the roadmap. This continuation is concrete progress:
versioned53 is committed with release checks, and47's opening input is corrected.
The full1.1–1.10 goal remains active and incomplete.

**46CI34215073108 remains live/in_progress**, freshly queried: client/server
PASS, Browser Smoke running. No terminal/deployment approval; no47 push.45 remains
the last independently verified live release. Root's staged52 master is not pushed.

**13265 TERMINAL FAILED2.5m** on bb36a64: opening2kills/zero deaths then120s
encounter deadline, before collection. The opening still had old unconditional
retreat/repeated-click controls. Scan0 and independent container absence passed.
No collection pacing conclusion is supported by this failure.

New **ba5b7ae08cbfafbde26220ec48e9179b1408f371**, clean in
`/tmp/eidolon-release47-target-input-PKvcZq`, shares collection's ordinary
health-aware defense and retained target input through opening, with read-only
receipts and actual stats diagnostics. All quest/respawn/deadline gates remain.
48431 PASS35tests/four suites/1.004s;10527 full lint PASS.
**5909 ACTIVE** actual fresh-collection, same frozen ba5b7ae source, runID
release47-opening-input, API18635/Mongo18636/web18637; log
`/tmp/eidolon-release47-opening-input.log`. Poll this exact handle until terminal;
do not restart on observation timeout. Only owned browser currently active.

**53 packaged and committed874b8fc3851ff468e5d5b8bb2cf66b5c8bc9871b**, clean in
`/tmp/eidolon-nameplate-readability-HDHgN2`, also preserved as
release/53-readable-crowd-names. Login/manifest/package/backend/deploy versions
match53 and its own notes retain all prior history. Rendered name checks run in
browser CI; actual town checks are appended to the isolated all-route AND chain.
No53 push: inherit final47 and publish only after prior46–52 releases pass/live.

53focused92974 PASS291tests/four suites/3.117s;38775 PASS11HUDtests;63271 lint,
shell syntax and diff pass; server root48399 PASS1.893s. Initial67690 selected a
nonexistent HUD filename (291tests passed but suite failure); corrected38775 used
the actual file.86916 PASS6rendered/13.7s. Production still matches the previously
verified3270-test source; version/notes/CI packaging only changed this turn.
**7404 PASS3actual/22.8s** on frozen53 package: desktop9.0s, portrait5.7s,
landscape5.8s; scan0, cleanup and independent exact-container absence pass.
Both phone captures inspected; all three preserved under
`/tmp/eidolon-nameplate53-evidence-5EQBJt/`. These are town/browser checks, not
physical-phone or full-combat approval. Every53 test handle is closed.

Expanded31-chapter/all-class6c2a81a is unchanged and still needs actual earned
campaign pacing verification; do not conflate it with47's15-chapter/current-curve
runtime. Next: close5909, inspect actual combat receipts; continue46's exact CI
handle and independent public identity checks before the next sequential push.

## Historical checkpoint — September 8, 10:24 UTC

This turn is progress:45 now fully verified live,46 pushed separately, crowd-name
production candidate passes full client/rendered checks. Full1.1–1.10 remains
active and incomplete;47 collection and expanded first-hour balance remain open.

**45CI34208478475 all eight jobs PASS**, terminal. Fresh post-terminal public
manifest/login/versioned-main/backend checks exactly match
**83d8f083538fc92b03878c9eb7cb1a46c8847da7 / Alpha1.0.45 / ok / ready**.
Main bytes match the source transformed by the unchanged version-pages-runtime
rewriter; its two imports carry the expected release query. Raw Git/source hash
differs only due to this normal publication transform, not an unexplained build.
The public regeneration module confirms0.01. This is now live verification,
not merely observed deployment. Prior seven-job checkpoint is superseded.

Normal explicit push40357 **PASS**: remote83d8f08 →
**b2016ef0af471eeec8a1106f6c88ce144b1c77a7**, Alpha1.0.46 with its own login
label/patch notes. Independent remote head matches. New **CI34215073108 ACTIVE**,
client/server running. Do not push47 before all eight46 jobs and fresh exact
public checks pass. Root's staged52 master was not pushed.

Nameplate full25258 **PASS224suites/3270tests/170.666s**, closed, on899c957;
production remains89f690e. Six rendered cases90998 and75focused tests pass as
recorded below. Actual25513 on9b58245 **1PASS/2FAIL /2.4m**: desktop's ordinary
town interaction/label/marker/frame assertions pass10.0s. Its account-free image
viewed and archived `/tmp/eidolon-nameplate-town-evidence-gGh3DL/desktop-first-pass.png`.
Phone cases failed the desktop approach's mouse-hover prerequisite before label
assertions. Scan0 and cleanup/independent exact-container absence passed.

Corrected **f00814a** is clean in `/tmp/eidolon-nameplate-readability-HDHgN2`.
It uses proper touch/mobile contexts and the unchanged joystick/tap Ilyra route
extracted from mobile-quest-gameplay into a shared helper. Desktop retains mouse
interaction; phones no longer require hover. No production source changed.
Final40025 lint/diff and commit PASS; no full-client rerun needed for this purely
E2E helper extraction, but actual touch verification remains required.

**86108 subsequently PASS3/25.7s**, terminal, on frozen f00814a:
runID nameplate-town-touch, API18625/Mongo18626/web18627; log
`/tmp/eidolon-nameplate-world-touch.log`. Desktop9.0s, portrait6.7s and landscape
7.5s pass actual level-one town entry, mouse/joystick Ilyra dialogue,22px label,
gold marker and ongoing frames. Scan0, cleanup and independent exact-container
absence pass. Both phone images viewed; all three retained under
`/tmp/eidolon-nameplate-town-evidence-gGh3DL/`. No owned browser/test remains
active. Nameplate source is no longer frozen and has a docs-only closure commit.
The candidate remains unversioned on staged52; proper release packaging/CI
inclusion remains due. This is town/component verification, not physical-device,
full-combat or1.2 completion. Only external46 CI remains active.

## Historical checkpoint — September 8, 10:08 UTC

Previous goal turn was progress (tested actual-target input correction). This
turn closes its failing real run, implements and renders crowd-name readability,
and verifies that45 has deployed. Full roadmap and first-hour gates remain open.

**45CI34208478475: seven jobs PASS; Live Release and Character QA ACTIVE.**
Fresh public manifest/backend10:07 both report exact
**83d8f083538fc92b03878c9eb7cb1a46c8847da7 / Alpha1.0.45**, backend ok/database
ready. Login displays45, its versioned main URL points to that commit, and the
public versioned regeneration module contains0.01. Deployment is now observed;
final live gameplay approval remains pending. Do not push46/b2016ef until the
eighth job and fresh independent identity checks pass. Root remains staged52,
never push its master over the queue.

**82761 TERMINAL FAILED5.4m** on a47dc7d. Five observed target deaths,2/8 seeds,
zero player deaths; another120s encounter timeout. Actual-target tracking and
healthy trading did not establish collection pacing. Once below80% health,
retreats still carried the pack north; the final diagnostic shows50retreats,
131/200HP27/160mana and a selected level1 Skeleton with3HP. Scan0 and cleanup/
independent exact-container absence pass. Failure PNG viewed/archive:
`/tmp/eidolon-release47-input-evidence-pMenOr/failed-collection.png`.
47candidate a47dc7d remains clean and unapproved; no unchanged rerun. Its runtime
is still original15chapters/cadence, distinct from the expanded candidate.

New visual candidate **899c957** (runtime89f690e) in
`/tmp/eidolon-nameplate-readability-HDHgN2`, branch work/nameplate-readability-20260908,
is clean and unversioned on staged52. Production names have22CSS-pixel sprite
height independent of zoom/parent scale, bounded non-overlapping labels, selected
target tint/priority, NPC/party priority and quest-marker clearance. Only name
sprites change, not models, markers, collision or combat. World-only captures
suspend presentation while hiding account labels. Details in candidate
`2026-09-08-nameplate-readability.md`; no1.2/1.3 completion claim.

Focused46603 **PASS75tests/four suites/2.064s**, lint20387/59373 pass. First rendered
12443 failed all six because the prepared NPC's label overlapped the selected
target and was correctly suppressed. Test-only2a66ffa places the NPC outside
that overlap, retaining both-label/marker assertions. Corrected90998 **PASS6/
29.3s**, covering desktop1280x720 and both phone orientations in High/Low.
Desktop before/after and portrait/landscape after images viewed/archive
`/tmp/eidolon-nameplate-evidence-BunTb1/`; labels are readable, while deliberately
packed tiny models/empty ground remain a component fixture, not world approval.

**25258 ACTIVE — full nameplate client regression**, source899c957 frozen in
the nameplate worktree. Log `/tmp/eidolon-nameplate-client.log`. No owned browser
is currently running; every rendered/collection handle above is closed. Keep
that source frozen until25258 terminal; then inspect full result and plan proper
versioned packaging/full-world checks. Expanded6c2a81a still has its separate
231suite/3418test pass; actual all-class/uninterrupted campaign checks remain due.

## Historical checkpoint — September 8, 09:49 UTC

Previous goal turn was progress: full client closure and observed combat receipts.
This continuation implements a tested input correction. Full roadmap goal stays
active; no first-hour, major-version or live-release completion claim.

**40009 TERMINAL FAILED9.5m** on d31334a. Six selected-target deaths,3/8 fragments,
one death; next encounter exceeded120s. Receipts prove attacks spread across
Skeletons and level30DemonOrcs instead of the originally watched target. Scan0,
script cleanup and independent exact-container absence pass. Failure image viewed
and archived `/tmp/eidolon-release47-receipts-evidence-BjrG9Y/failed-collection.png`:
large overlapping mob pack with Demon Orc selected, level6 hero,3/8 tracker.
This proves test-strategy interference, not a fixed production targeting defect.

Correction **a47dc7d03909109a7f502385f7b501365aea678c** is clean in new worktree
`/tmp/eidolon-release47-target-input-PKvcZq`, branch work/release47-target-input.
Created from frozen d31334a while40009 ran; the old tree/source stayed unchanged.
Collection follows the actual hostile pending interaction after a normal click,
without assigning any runtime target or resetting the encounter deadline. It
opts into retreat only below80% health; default hunt/dungeon defense stays as-is.
Existing actual-death, loot, manual turn-in,120s encounter/two-respawn/20m route
checks remain. No src/server/index changes. Focused22496 **PASS30tests/four
suites/2.201s** plus full lint/diff. Client dependencies prepared57230, closed.
See candidate `2026-09-08-release47-collection-input.md` for scope/limitations.

**82761 ACTIVE — only owned browser**, frozen a47dc7d, fresh-collection,
runID release47-observed-input, API18595/Mongo18596/web18597. Log
`/tmp/eidolon-release47-observed-input-gameplay.log`. Poll same handle; no edits
in that worktree or second owned browser until terminal. No actual result yet.
Old starter tree d31334a and expanded6c2a81a remain clean; latter's full231/3418
client pass stands, actual all-class/campaign checks remain open.

External45CI34208478475 rechecked: client/server/browser PASS, predeploy gameplay
still ACTIVE. Do not publish46 until all eight45 jobs and fresh independent
manifest/login/versioned-main/backend identity checks pass. Queue46 remains
b2016ef; root staged52 must not be pushed. Last independently checked public
manifest/backend remain44/847d454 healthy/ready; no45 live assertion.

## Historical checkpoint — September 8, 09:38 UTC

The direct regeneration request was verified against current source: both
coefficients already0.01; client27636 passes six tests and server95457 passes
the four passive-regeneration tests. No further rate reduction was made.
This continuation makes progress through corrected full client verification and
an instrumented reproduction, not a claim that the roadmap or first hour is done.

45CI34208478475 remains ACTIVE at a fresh check: client/server/browser PASS,
predeploy gallery PASS and full-character gameplay running. Public manifest and
backend still44/847d454, healthy/database ready. No46 push until all eight45 jobs
and independent exact manifest/login/versioned-main/backend checks pass. Queued46
remains cleanb2016ef. Root stays staged52 and must not be pushed.

47 now inherits final46 through d2a8c98. Actual25621 FAILED3.2m because no clear
retreat input could be issued. Test-only acb8211 distinguishes unissued movement
from a failed issued click/key; only the former falls back to combat, not counted
as a successful retreat. Focused58906 passes31tests plus full lint.
Actual21067 onacb8211 FAILED5.0m at2/8fragments, seven selected-target deaths,
zero player deaths. Next target stayed alive past120s as107retreats carried the
player north into stronger mobs. Scan0 and owned cleanup passed. Image viewed:
the selected card shows a Demon Orc while the test still waits for a Skeleton.
Archive `/tmp/eidolon-release47-clear-input-evidence-K0vasm/failed-collection.png`.

47candidate **d31334a2c104f48f4c6de976e3bfd45354ef2601** adds read-only local
server attack/damage counters per target, pending/hovered IDs and nearby HP.
Focused38478 PASS13tests/four suites/1.666s plus full lint. **40009 ACTIVE** is
the only owned browser: fresh-collection, runID release47-combat-receipts,
API18585/Mongo18586/web18587, frozen work/release47-starter-spacing in
`/tmp/eidolon-release47-starter-FHKAMJ`. Poll the same handle; no edits there or
second owned browser until terminal. Log
`/tmp/eidolon-release47-combat-receipts-gameplay.log`. Opening currently42s,
zero deaths,500XP/level5; collection result not yet available. No production
change since enemy-impact fix, no faster cadence or expanded story in this47.

09:42 update:40009 remains live. Receipts prove attacks landing on other IDs
while the watchdog tracks Skeleton-95: its attacks stop at six while several
Skeletons and level30DemonOrcs receive later admitted attacks/damage. Retreats
leave the starter area; one death and normal respawn are observed. This now
supports correcting the playtest's target tracking/input strategy, not weakening
its120second encounter or two-respawn bounds. Do not claim a production targeting
fix from these observations. Let40009 close before modifying its source. External
45 predeploy remains in progress at the same fresh check.

Expanded candidate **6c2a81a** in `/tmp/eidolon-earned-story-TZuGpp` is clean.
ba4cc72 adds actual Rogue ranged defense and Cleric affordable/unlocked healing
inputs, class-specific earned preparation, and all-class investigation handling.
Full10683 failed one stale unit mock; d9af0d2 fixes that mock, retaining class,
target, input-order and death assertions. Focused64317 PASS82tests plus full lint.
Corrected full16810 **PASS231suites/3418tests/199.326s**, closed; docs6c2a81a.
Details in its `2026-09-08-four-class-earned-controls.md`. Actual Rogue/Cleric,
appropriate-level uninterrupted campaign and broad balance approval remain due.
It retains experimental player cadence and31chapters; do not conflate its
evidence with47's original15chapters/cadence. No production merge/publication.

## Historical checkpoint — September 8, 09:12 UTC

This continuation is progress, with all owned local handles now closed. The
full roadmap goal remains active; no first-hour or major-version completion claim.

**Corrected45 pushed83d8f083538fc92b03878c9eb7cb1a46c8847da7.** Push17090
terminal success, independent remote head matches. New CI **34208478475 ACTIVE**,
client/server running at latest check. Old34203281024 failed as documented below;
do not rerun it unchanged. Fresh public09:08 manifest/backend still44/847d454,
healthy/database ready; no45 live claim. Wait for all eight new CI jobs plus
independent exact manifest/login/versioned-main/backend checks before46 push.

Actual corrected shield43571 PASS40.6s/43.3s total on d864474. Observed enemy
started34.318units away, real movement reached under3, then actual hostile hit
absorbed310 of834shield, leaving524. Baseline695/trained834/saved expiry/town
return passed. Scan0sanitizations and owned cleanup/independent container absence
passed. Actual absorption PNG viewed: entrance architecture still occludes much
of the hero, an existing46 visibility issue; do not call this broad visual signoff.
Both45 worktrees now clean83d8f08 with docs closure. Runtime remains identical
to0ed54b2. No production buffs or weakened absorption checks were introduced.

**Queued46 nowb2016ef0af471eeec8a1106f6c88ce144b1c77a7**, clean. Mergeecd0600
inherits corrected45 and resolves a shield-test conflict by retaining both the
46cutaway assertion and observed approach. Initial1664 lint failed on conflict
markers; corrected29678 passes238tests/four suites/2.212s and full lint/diff.
No src/server/index differences versus ad16790; existing actual entrance evidence
remains applicable. Root merges this as1bd6892;236focused tests/three suites/
1.636s and diff checks pass76179. Root remains staged52: never push its master.

47candidate remains clean871926a (full server integration passed), and expanded
target-level candidate remains clean23ea926 (full client and three rendered cards
passed), as detailed below. Neither is published. Next owned browser can verify
47fresh-collection or the expanded appropriate-target uninterrupted route; keep
their evidence distinct. Original release47 and queued48–52 still need final
candidate/46 inheritance before their own publication. No owned browser or test
process is active now; only confirmed external CI34208478475 is being awaited.

## Historical checkpoint — September 8, 09:08 UTC

Previous goal turn was progress (reproduced and fixed enemy impact reach).
This continuation completes both server integrations, tests the real story
route, implements and renders target-level information, and corrects the newly
failed45 CI approach fixture. Full1.1–1.10 remains active and incomplete.

**45 CI34203281024 FAILED**, not still running. Client/server/browser/gallery
passed; corrected talent economy passed30→21mana and saved-login21mana. Shield
training passed695→834capacity and saved expiry, but both attempts failed to
find a projected Inferno Titan after fixed northward travel through random
spawns. All deployment/live jobs skipped. Earlier retry logs also contain
ERR_NETWORK_CHANGED; no claim that the approach fix resolves host networking.
Raw failed log `/tmp/eidolon-release45-ci34203281024-failed.log`.

45 correction worktree `/tmp/eidolon-release45-wizard-ZLnqjH` now clean
**d864474272983f85fdf0bfa598544268233c810a**, not pushed. First test-only change
2e45825 selects a real observed nearest living Inferno Titan instead of requiring
screen projection before approaching. Actual45665 FAILED42.5s: remaining21.77
units after15 calls. Generic movement waits for one unit by default; new d864474
waits for up to six actual units of each planned seven-unit step before replanning.
Same15-step/240s limits, explicit under3 contact, protection removal and real-hit
absorption assertions retained. No src/server/index change from0ed54b2.
Focused13178 passes12tests/1.123s; final34310 passes11tests/1.083s, full lint/diff
checks. Failed45665 scan0/cleanup/independent exact-container absence passed.

**43571 ACTIVE — only owned browser**, frozen d864474, route shield-training,
runID release45-shield-movement, API18555/Mongo18556/web18557. Log
`/tmp/eidolon-release45-shield-movement-gameplay.log`; earlier failed attempt
`/tmp/eidolon-release45-shield-approach-gameplay.log`. Poll43571; no source edits
or another owned browser until terminal. Only after actual absorption/cleanup
passes, carry this correction into release45, push its explicit fast-forward
commit, and monitor a new CI. Hold46 until all eight45 jobs and public identity
checks pass. Do not rerun unchanged failed CI or push root's staged52 master.

**47 impact backport now871926a59e3db5f53ad50d23ff7f9198fbee6b1d**, clean in
`/tmp/eidolon-release47-starter-FHKAMJ`, branch work/release47-starter-spacing.
Runtime8f4c452 copies only enemy reach correction/tests, not faster player cadence
or expanded story. Adds47 patch note. Focused server10861 PASS9.881s; client66704
PASS226tests/4.555s. Full server33511 PASSroot16.790s/game291.657s/all packages.
All handles closed. Needs actual47 collection play, then release-branch integration
and sequential48–52 inheritance. Original release47 branch remains a6a91dc.

**Expanded aa905ae full server69976 PASS**root18.490s/game417.772s/all packages.
Actual18050 FAILED6.1m at Watch2/40 on120s credit watchdog, with zero deaths.
Opening86s/zero deaths, diary138s, no reconnect; mana15/115 then21/130. Final
level3 player122/150HP19/130MP, selected level7 Skeleton26HP,92retreats/two
accepted Fireballs. All actual evidence closed, scan0/cleanup/container absence
passed. Viewed failure and diary PNGs archived at
`/tmp/eidolon-impact-reach-evidence-64LFWU/`. Survival is not first-hour approval.

Expanded worktree `/tmp/eidolon-earned-story-TZuGpp` now clean
**23ea926e8b5361d17cb9b5969b48462e534b576d**, docs closure of tested af82670.
Target cards now show real enemy levels (desktop metadata, phone title prefix).
Both caches update on level changes; invalid levels omitted. The earned driver
seeks quest-eligible targets no more than one level above the player (never below
the quest minimum) and returns toward starter territory for early Skeleton hunts;
immediate dangerous pursuers still permit defensive attacks. No server eligibility,
count, mana, damage, timing, respawn or grant changes. Wider pursuit/encounter and
Rogue/Cleric earned-driver coverage remain open.
Final14389 PASS24tests/2.238s +full lint/diff; full client35898 PASS230suites/
3401tests/151.663s. Render74979 PASS3cases/10.9s at1280x900/390x844/844x390;
all three actual card images viewed/archived in
`/tmp/eidolon-target-level-evidence-tBVMI9/`. Component rendering is not physical
phone or earned-play approval. All handles closed. Next actual uninterrupted
play must use this new selection/card source, not the failed aa905ae baseline.

## Historical checkpoint — September 8, 08:45 UTC

This goal continuation made progress: recovered and closed the cadence full
suites, completed an actual uninterrupted story test, reproduced an enemy-impact
bug with failing tests and implemented its bounded correction. Goal remains active.

**66259 is now terminal FAILED4.9m**, Watch5/40 on its third hunt death. Earlier
opening40s and diary95s remain valid limited evidence, not full first-hour signoff.
Third death: player at(1.36,108.11), four enemies12–16.6units away. Scan0 and
owned cleanup passed; independent container absence confirmed. Actual failure
image viewed, archived with diary PNG at
`/tmp/eidolon-basic-cadence-evidence-6bUo5T/`. No owned browser remains active.

The isolated candidate is now clean **aa905ae5e4274d0740f8ae3a498a88d0347b9b1d**.
New actual-impact test45201 FAILED four escaped-target cases before correction:
a Skeleton at15units still hit for10damage after wind-up. Enemy basic impact now
rechecks the same reach used at admission. Large bodies and DwarfSalesman reach
are retained; player basic attacks, projectile/telegraphed abilities, pursuit,
regen and rewards are unchanged. Focused race36341 PASS7.813s (new reach cases,
dungeon walls, shield absorption, cadence and regeneration). This fixes a concrete
combat defect; it does not yet prove the crowd-pressure or first-hour gate solved.
Candidate doc retains proposed patch notes and separate cadence/impact scope.

**69976 ACTIVE — full server race** on frozenaa905ae, log
`/tmp/eidolon-enemy-impact-reach-server.log`. Poll this handle before source edits
or declaring broad regression success. Client runtime unchanged from0bbc945's
full3397-test pass. After server closure, run the new actual uninterrupted route;
do not repeat the failed cadence-only source. Revisit pursuit/encounter separation
if still needed. No47 backport or release approval yet.

Fresh08:45 public release manifest and backend health both still match
44/847d454a94a7424ab303f6339c875ab170bff36e, healthy/database ready. Release45
CI34203281024 is confirmed ACTIVE in disposable full-character gameplay after
client/server/browser/gallery success. No later jobs yet. Hold46/ad16790 until
all eight45 jobs and independent public manifest/login/main/backend identity pass.
Root has only ledger changes this turn; never push its staged52 master.

## Historical checkpoint — September 8, 08:35 UTC

The preceding user turn freshly verified the requested0.01 regeneration on both
client (six tests/1.844s) and server (four focused tests/0.308s); it made no new
runtime change. This continuation recovers authoritative results rather than
restarting lost observation handles. Full1.1–1.10 remains incomplete.

Release45 CI34203281024 now has successful client, server and browser-smoke jobs.
Predeploy Character QA101991716325 is actively running its animation gallery.
Deployment and independent public verification remain due; do not push46 yet.

The prepared-assets47 starter-spacing run29343 is terminal FAILED after2.5m:
two opening kills, two deaths, then its unchanged120s credit watchdog. It never
reached fragment collection. Scan0sanitizations and script cleanup passed;
independent Docker inspection now confirms both exact owned containers absent.
Its worktree is clean1049d6e, including the retained failure report. Starter
spacing alone does not establish first-hour playability.

Isolated earned-story candidate is clean0bbc945 in
`/tmp/eidolon-earned-story-TZuGpp`. It prototypes player basic-attack intervals
of1.905s at starting Dexterity instead of4.167s, with the existing1s floor at
200Dexterity. Damage per hit, enemies, ability costs and0.01 regeneration are
unchanged. This is an experiment, not release approval. Full client result is
230suites/3397tests PASS/195.519s. Full server race PID1266996 has now finished:
all packages pass, root16.946s/game368.374s. The PID is independently absent.
Logs are
`/tmp/eidolon-basic-cadence-{client,server}.log`. Earned uninterrupted gameplay,
all-class pacing and wider combat-balance gates remain open.

08:41 follow-up: **66259 ACTIVE, only owned browser**, frozen0bbc945, route
fresh-story-uninterrupted, runID earned-basic-cadence, API18515/Mongo18516/web18517.
Log `/tmp/eidolon-earned-basic-cadence-gameplay.log`. Opening completed40s with
zero deaths/retreats; diary completed95s. No checkpoint reconnect; actual mana
was11/115 after opening and17/130 after diary. That is useful low-resource
evidence, not an isolated causal comparison of attack speed against random spawns.
Watch currently5/40 after two normal respawns. First death had seven nearby
Skeletons; second had six. Normal earned-item equipping succeeded after the second
death (maximum HP150→160, mana130→140 without filling the added capacity).
No hunt-clear or first-hour approval yet. Poll66259, preserving its source and
unchanged death bound until terminal. Source inspection finds generic enemy
pursuit gated by distance from the player but no spawn-distance leash while a
target stays in range. Review encounter separation/pursuit next if this run fails;
do not assume quicker attacks alone solve the observed crowd pressure.

## Historical checkpoint — September 8, 08:17 UTC

Previous goal turn was progress (collection diagnostics and actual uninterrupted
diary evidence). This continuation closes failed playtests, implements a starter
road correction, fixes and republishes45's CI observation failure, and carries
that verified correction into46/root. Full1.1–1.10 remains active and incomplete.

**Corrected45 is pushed: 0ed54b248fd37883cb20fdba5e2f97f377a31f44.** Push2430
finished successfully and independent remote-head lookup matches. New CI
**34203281024 ACTIVE**, client passed/server running at latest check. Old CI
34198772605 failed phone talent QA after the prepared Verdant bosses passed;
deploy/live jobs were skipped. The phone test wrongly waited30s for a full bar
after login, then reused purchased ranks on retry. Actual corrected route shows
1191/1685mana after login, making that full-bar deadline invalid at1.09/sec.
No production code or0.01 coefficient changed in this CI correction.

Tested45 source42522f0 passes full218client suites/3221tests/137.186s, full lint,
syntax and diff checks. Actual phone test11.6s/14.4s total proves30→21mana and
saved-login21mana cast using current-resource observations with bounded tick
allowance. Deliberate post-purchase retry probe fails once as designed and its
fresh untrained retry passes11.1s. Both scans0sanitizations/owned cleanup and
independent container absence pass. Targeted server talent/regen race3.992s;
runtime identical to64df5fb, whose server CI passed. Handles93578/72433/46965
closed. Logs `/tmp/eidolon-release45-cast-observation-{client,lint,gameplay,retry}.log`.
Both45 worktrees are clean0ed54b2. Do not rerun old failed CI or push46 before
every new45 job and independent exact public identity checks pass. Fresh public
checks this turn still show44/847d454a94a7424ab303f6339c875ab170bff36e, backend
healthy/database ready;45 is not confirmed live.

**46 now ad16790b27f9950b30d0fc6e4e060982bc1204dc**, clean queued release branch.
Merge55ea35b inherits corrected45; no src/server/index differences versus prior
verified87ed21c. Focused260tests/five suites/2.617s plus full lint pass21098.
Its existing actual entrance evidence remains applicable, not newly rerun.
Root merges this as **f14d28e**, preserving staged52 and both fresh-collection/
talent-retry contracts after resolving an additive test-file conflict. Root60346
passes250tests/five suites/1.740s and diff checks. Never push root's staged52.

**47 spacing-only test a6a91dc failed** actual23856/2.8m:5/8fragments, two deaths
with level30 enemies nearby, then a blocked retreat into the east town wall.
It previously passed219client suites/3231tests/168.981s and lint37593. Actual
failure image viewed/retained at
`/tmp/eidolon-release47-spacing-evidence-xOXgLv/failed-collection.png`; it shows
185/200HP,8/160mana and5/8 beside the wall. Scan2sanitizations/owned cleanup and
container absence passed. Both handles closed. The original release47 branch
and worktree `/tmp/eidolon-release47-runes-98cUsP` remain clean a6a91dc.

**New47 runtime candidate**, branch work/release47-starter-spacing, worktree
`/tmp/eidolon-release47-starter-FHKAMJ`: source6fd84af backports existing5398395
starter awareness and advanced-spawn spacing, adds explicit47 patch notes, and
makes the QA retreat planner check actual walking collisions. Initial Imp/DemonOrc
spawns stay160units outside town; low-level unprovoked Skeleton sight12+3*level,
normal45-unit retaliation retained. No stats, dungeon profiles, quest rules or
0.01 changes. It is not a leash or immunity throughout the neighboring sector.
Three repeated targeted server sets8.884s pass18559; full server race24430 passes
root11.573s/game260.976s/all packages. Full client28173 passes219suites/3234tests/
139.360s; focused250/2.666s and full lint91552 pass. All closed.

First browser30168 failed before gameplay because this new worktree lacked its
generated vendor assets; direct vendor URL returned404. Scan/cleanup passed.
`npm run prepare:client` now builds the pinned dependencies. Merge
**a45726277fe36b4b3d4b46131703ee053bcb29e6** then inherits final46/ad16790;
both additive QA contracts are preserved. No server/src/index changes versus
6fd84af; focused267tests/six suites/2.004s and full lint69551 pass. No runtime
approval inferred from the failed bootstrap or the integration-only checks.

**29343 ACTIVE — only owned browser**, frozen clean a457262, fresh-collection,
runID release47-starter-ready, API18505/Mongo18506/web18507. Log
`/tmp/eidolon-release47-starter-ready-gameplay.log`. The earlier bootstrap log is
`/tmp/eidolon-release47-starter-gameplay.log`. Poll29343; do not edit/restart or
launch another owned browser until it is terminal. If verified, merge this
candidate back to the release47 branch, then inherit47 sequentially through48–52.
Those later release refs and root's47 runtime remain unchanged for now.

**Expanded story bd16d5c failed** uninterrupted36108/7.1m at Watch4/40 on its
third hunt death. Diary had completed at153s/level3 with no checkpoint reconnect;
opening had one earlier actual death. Watch deaths at0/2/4credit show4–6nearby
Skeletons, including lower-level pursuers. Both permitted death-button recoveries
restore full bars. Scan0/cleanup/container absence passed; viewed diary/failure
PNGs retained in `/tmp/eidolon-diary-spacing-evidence-ufNDIa/`. Handle closed.

That isolated candidate is now clean **3420051**: test-only immediate-pursuer
selection (without changing server hunt eligibility) and normal equipping of
already-earned, level-eligible items into empty slots before the early hunt/after
respawn. No equipment purchases/grants, occupied-slot replacement, stat allocation,
Recall healing or checkpoint reconnects. Target/class/checkpoint24tests/1.346s
and equipment/target/checkpoint23tests/1.567s plus changed-file lint pass. No new
browser is started there; combined earned behavior remains unverified. Broader
first-hour balance, recovery policy, all-class, physical-phone and roadmap gates
remain open. Keep all existing saved assets and the user's0.01 rate intact.

## Historical checkpoint — September 8, 07:50 UTC

The previous user-triggered turn verified the requested 0.01 regeneration and
polled the active release45 CI; it did not deploy another release. This goal
continuation makes progress through final47 suite results, an actual collection
survival failure, bounded test-driver corrections and new uninterrupted diary
evidence. Full1.1–1.10 remains active and incomplete; no goal status change.

**45 CI34198772605 remains ACTIVE** for exact64df5fbd4fb7a1b66f1f9e5ccf5dc6a20911898e.
Client/server/browser smoke passed; predeploy has reached disposable full-character
gameplay. Neither deployment nor live QA is claimed. Fresh public manifest and
backend checks this turn still match44/847d454a94a7424ab303f6339c875ab170bff36e;
backend healthy/database ready.46 remains clean verified87ed21c and must wait for
all eight45 jobs and independent exact public verification before publication.
Do not alter CI's runner/browser/services or push root's staged52 master.

**47 combined full suites closed successfully:** handles95541/38409 both terminal0.
Source206fac5 passes218 client suites/3226 tests/199.594s and full server race
(root17.468s/database1.048s/game337.916s). Actual fresh collection26108 then
**FAILED4.7m**, exceeding the unchanged two-respawn bound. Opening43s/zero deaths/
four retreats, followed by the existing500XP claim and persistence reconnect.
Collection reached six of eight fragments at level6 after five observed target
deaths (not all incidental AoE kills); the third later death ends the test.
Scan0sanitizations and disposable cleanup passed; exact owned containers absent.
No completion/turn-in or failure screenshot exists for that first run. Failure
and constraints committed878e1c9 in47's collection plan. Logs
`/tmp/eidolon-release47-runes-{client,server,gameplay}.log`.

47's collection driver was missing the ordinary Wizard spacing used by hunts.
Test-only candidate **a6a91dc**, worktree `/tmp/eidolon-release47-runes-98cUsP`,
branch release/47-with-regen-and-soak-isolation, now connects that existing driver
and records read-only combat/resource/death/recovery diagnostics and an in-world
failure screenshot. No runtime, rewards, regeneration, target rules, grants,
skill purchases, reconnects, deadlines or allowed-death changes. Other classes
keep their existing inputs. Handle17883 terminalPASS247tests/four suites/3.216s,
changed-file lint and diff checks. **Revised47 gameplay has not started**; no
owned47 process is active. Wait for the one owned browser below, then run the
fresh-collection route on this clean candidate.47 is not ready to ship and is
not integrated into root.48–52 refs remain unchanged, awaiting final predecessor
inheritance and verification.

**Uninterrupted expanded story candidate bd16d5c**, isolated worktree
`/tmp/eidolon-earned-story-TZuGpp`, adds the same normal Wizard defense to its
formerly stationary diary combat helper. Tests preserve death checks and ensure
defensive casts do not issue extra attacks.26focused tests/2.356s plus41spacing/
input tests/1.966s and changed-file lint pass; handles24797/92757 are terminal.
An initial Jest/Playwright mock-message incompatibility was corrected, not a
runtime defect. No game coefficients or quest/count/reconnect changes.

**36108 ACTIVE — the only owned browser**, frozen bd16d5c, isolated route
fresh-story-uninterrupted, runID earned-diary-spacing, API18485/Mongo18486/web18487.
Log `/tmp/eidolon-earned-diary-spacing.log`. Actual opening100s/one death/44retreats;
real death-button recovery restores100HP/100mana. Opening checkpoint does not
reconnect and retains125HP/70mana. Diary approach engages two targets in4.719s;
actual lore inspection and manual25gold/200XP turn-in complete at153s/level3.
Diary checkpoint also does not reconnect and retains150HP/46mana. Watch starts
level3 with47/130mana and the unchanged0.01 rates; no hunt completion yet.
Latest poll observes one Watch death at0/40 credit with six nearby Skeletons
(levels1–4), followed by actual150HP/130mana death-button recovery. The handle
remains active; ordinary spacing has not established first-hunt survivability.
Do not edit, restart or launch another owned browser while36108 is live.

Actual earned-diary PNG viewed and copied to
`/tmp/eidolon-diary-spacing-evidence-ufNDIa/earned-mara_diary.png`. It shows the
authored record, manual ready objective and journal; it does not establish broad
visual/performance approval (the capture's overlay reads15FPS/2216calls). Opening
already needed one respawn, so this is not a zero-death first-hour pacing pass.
The candidate still retains the old curve/catalog until coordinated activation;
full earned progression, class/recovery balance, physical-phone and later-roadmap
gates remain open. Continue36108 rather than re-running the earlier failed diary
source or treating this partial success as final campaign verification.

## Historical checkpoint — September 8, 07:34 UTC

Previous goal turn was progress: corrected45 passed locally and was pushed. This
continuation integrates and revalidates46, integrates that verified source into
the main working copy, and starts combined47 checks. Full1.1–1.10 remains active
and incomplete. No new version is pushed this turn;45 still owns the live gate.

**45 CI34198772605 ACTIVE**, exact64df5fbd4fb7a1b66f1f9e5ccf5dc6a20911898e:
client and server jobs passed; browser smoke is running at the last check.
No deployment/live success yet. Do not push46 before all eight45 jobs and fresh
independent public client/backend identity checks succeed. Do not touch CI's
runner processes, browser or services. Current public verification remains the
07:20 exact44 result below, not evidence of45 deployment.

**46 locally reverified and closed:** branch release/46-with-regen-and-soak-isolation,
worktree `/tmp/eidolon-release46-runes-CEXpIs`, source merge
d9c64bbd197ba7cb5985dc7bc4b52d546dad47bd combines prior90e2a13 with actual45/64df5fb.
Documentation closure **87ed21c8063e6ea9eb88754b81db089a7bbbeeb7**. Its runtime/login/
package/deployment version remains46; the new45 rune notes and0.01 rates remain.
No src/ runtime change versus prior46. Game-server code is identical to verified45;
remaining server differences are46 version defaults. Focused19804 PASS254 tests/
four suites/3.147s, full lint/diff checks passed. Full client85309 PASS218 suites/
3224 tests/236.474s; full backend-root74775 race PASS19.365s. All handles closed.

46 browser41130 PASS10 rendered checks/1.2m, then PASS actual isolated gameplay/
one test53.6s/reported58.7s. Screenshots viewed for all four entrance families,
Verdant portrait before/after and landscape, plus the actual landscape gameplay
capture. The hero is revealed through a small bounded window; architecture,
camera and gameplay bounds remain unchanged. Actual Shield mastery is saved,
834capacity absorbs310damage with524remaining, expiry works, and ordinary town
recall restores original material identities. Scan/owned cleanup passed and
container absence independently confirmed. This is not physical-phone sign-off.
Logs `/tmp/eidolon-release46-runes-{client,server-root,rendered,gameplay}.log`;
rendered evidence `/tmp/eidolon-release46-runes-rendered-gBEWSD`.

**Main working copy integrated:** merge da6f351380e8f372aad50e1c17b35771f7d57e8c
brings verified46 ancestry/fixes into the existing locally staged52, without
reducing its version or losing death recovery/bridge changes. Root92129 PASS310
tests/five suites/7.021s covering version, prepared training, passive recovery,
dead-only resources and real client respawn handling. Root79536 race PASS2.400s
and game3.884s for base-rune receipts, respawn and regeneration/ability budgets.
Both closed. Main master is still a local staged52 and must never be pushed.

**47 combined source206fac5cf35408b87d251088267624e9228289d4**, branch
release/47-with-regen-and-soak-isolation, worktree
`/tmp/eidolon-release47-runes-98cUsP`: merges final46/87ed21c into priorbd03956.
Version47 and collection rules remain: new8fragments/35% plus fifth-miss guarantee;
accepted legacy count/rate/reward promises preserved. Focused99020 PASS253 tests/
four suites/4.743s, full lint/diff checks passed. Source is frozen for:

- **95541 ACTIVE:** full server race, log
  `/tmp/eidolon-release47-runes-server.log`; root17.468s/database1.048s already
  passed, game package still running. Partial output is not full success.
- **38409 ACTIVE:** full client suite, log
  `/tmp/eidolon-release47-runes-client.log`.

No owned browser is running or queued.47's fresh earned eight-fragment playtest
under the combined0.01 build remains required; old higher-regeneration evidence
does not cover it. Do not edit/restart47 until both handles are terminal.
Remaining48–52 release refs are unchanged and must inherit final47 sequentially
before their own verification/publication. The31-chapter candidate stays parked
at fa20e50 with the known uninterrupted diary failure; broader progression,
economy, all-class and roadmap gates remain open.

## Historical checkpoint — September 8, 07:20 UTC

Previous goal turn was progress: starting-ability rune authorization was corrected
and full checks launched. This continuation closes those checks, records actual
second-boss failure, improves the prepared build using existing efficiency talents,
and audits the distinct fresh/prepared stat profiles. Full1.1–1.10 remains active
and incomplete. Corrected45 is now pushed; final deployment gates are still due.

**c812eee full checks passed:** client28151 completed216 suites/3193 tests/
187.655s before launching its browser. Server57721 completed successfully:
root14.155s/database1.071s/game330.668s. Both old handles are now terminal.

**c812eee browser28151 FAILED5.0m:** actual normal UI bought five Mastery ranks
and successfully equipped Empowered without a specialization, proving the rune
correction. Rootbound Warden15000HP was defeated and later Skeletons spawned and
died. Briar Matron16800HP then outlasted the unchanged120s encounter limit. Last
periodic sample:1261boss HP, player300/2575HP and29mana (not an exact final sample).
Log `/tmp/eidolon-release45-base-runes-browser.log`. Artifact scan/owned cleanup
passed. This is not a completed functional run or a fresh-entry balance result.

**New frozen prepared candidate d176b62**, branch work/release45-wizard-preparation,
worktree `/tmp/eidolon-release45-wizard-ZLnqjH`: after Mastery, use existing
Efficient Casting and Fireball Technique (up to five ranks each), spending only
available points through actual UI/server acknowledgements. Pure planner guards
against overspending, malformed budgets/ranks and overwriting existing training.
At level100 this spends15/20points; it neither allocates offline-only attribute
points nor changes production combat coefficients. Real-dispatch test9238 passed
1.636s:618raw damage,21mana,2.125s cooldown, basic29, unchanged0.01 regeneration.
Client59067 passed236 tests/two suites/2.554s; final NaN guard rerun88089 passed
19 planner tests/1.030s and helper lint before commit/browser launch.

Source diff c812eee→d176b62 has only QA helpers/tests and documentation; production
server source is byte-identical to the passing full race build. The expanded Go
test passed separately. The latest full client/browser results now close successfully:

- **88089 PASS**, closed: corrected Verdant run, run ID
  release45-efficient, API/Mongo/web18465/18466/18467, log
  `/tmp/eidolon-release45-efficient-browser.log`. One test4.6m, reported run4.7m,
  seed1356581529728746808. Fifteen ordinary talent purchases and unbranched
  Empowered selection acknowledged. Rootbound Warden and Briar Matron defeated,
  later generated enemies spawned and died, both boss rooms cleared, gold
  increased and normal exit succeeded. Last Matron sample364HP, player1015/2575HP
  and336mana before confirmed death. Scan/owned cleanup passed; container absence
  independently checked. No new grants, reconnects or relaxed encounter gates.
- **46538 PASS**, closed:217 client suites/3212 tests/206.821s on d176b62, log
  `/tmp/eidolon-release45-efficient-client.log`.

All owned local handles are terminal; no owned browser remains.
Do not restore0.5 regeneration, alter deadlines, grant resources or call the fresh
campaign balanced because a prepared fixture passes. No potion/rest system added.

**45 correction published to source control, not yet verified live:** candidate
documentation closure64df5fbd4fb7a1b66f1f9e5ccf5dc6a20911898e was fast-forwarded
into release/45-with-regen-and-soak-isolation in
`/tmp/eidolon-release45-regen-tphNrl`. Explicit push83828 of that SHA→origin/master
succeeded; remote ref independently matches64df5fb. Root master was not pushed.
**CI34198772605 ACTIVE** for that exact SHA, verified07:20: client/server jobs
running. All eight pipeline jobs plus fresh independent public identity checks
remain required before declaring45 live or pushing46. Fresh public manifest and
healthy backend still match44/847d454a94a7424ab303f6339c875ab170bff36e.
Original failed45 CI34192659636 remains preserved evidence. Later46–52 refs are
unchanged and still await sequential inheritance of this fix.

**Integration preview only:** `git merge-tree --write-tree` succeeds without
conflicts for d176b62 into each staged46–52 and root. No branch refs were moved.
After45 is verified, merge sequentially (updated45→46→47→…→52) so each published
commit remains a fast-forward descendant of its actual predecessor, with its own
version/notes and checks. Do not push root master or push46 before all45 live gates.

New read-only [starting-stat audit](2026-09-08-starting-stat-baselines.md) separates
online all10 new saves, prepared class-primary20 fixtures and the third offline
distribution. No starting stats or existing saves were changed. The prepared
helper's name is not proof of the intended new-save balance. Online has no server
attribute-point allocation; the UI deliberately hides offline-only controls.
The balance plan now requires an explicit baseline/save-compatibility decision.
Earned31-chapter candidate fa20e50 remains parked with its real uninterrupted
diary failure; no claims of Watch completion or full first-hour approval.

## Historical checkpoint — September 8, 07:01 UTC

The prior short user turn reverified existing0.01 regeneration (six client tests
and focused server tests passed), but added no implementation. This continuation
makes progress: closes stale release/earned handles, fixes uninterrupted test
navigation, obtains a new earlier pacing failure, and starts a prepared Wizard
diagnostic. Full1.1–1.10 remains active/incomplete; no goal status change applies.

**45 failed, not live:** fresh `gh run view34192659636` confirms failure on exact
45b4b831a85c96992cd396344610cd1fb9175fd6. Client/server/anonymous browser passed;
predeploy Character QA failed, all four remaining jobs skipped. Public client
release.json freshly returns Alpha1.0.44 /847d454a94a7424ab303f6339c875ab170bff36e.
No push this turn. Do not retry unchanged CI or push46/root master. The existing
46–52 queue below remains locally staged, not published.

**Earned candidate terminal results:**51389 failed6.4m at9/40 Watch credit after
three deaths, exceeding the two-respawn bound; actual first two respawns restored
both bars. Its reconnecting opening/diary checkpoints cannot prove uninterrupted
resource pacing. New a26f7d1 uninterrupted mode skips those logins and retains
the final persistence check. Full43054 passed226 client suites/3361 tests/
160.389s; Go source remains identical to passing31046. Browser2755 failed37.9s
because the opening quest window blocked the next movement click. The old30895
handle is missing, so its result is not assumed. Fresh83836 passed ten checkpoint
tests and route lint.8855589 closes the window through its normal button before
travel, without changing gameplay, counts, deaths or deadlines.

**Corrected uninterrupted33414 FAILED2.0m, closed:** opening32s/no deaths/one
retreat; checkpoint retained125/125HP and11/115mana without reconnecting. Travel
passed the previously blocked click, then the level2 Wizard died clearing the
diary site before inspection. Viewed screenshot shows0/125HP and20/115mana;
archived `/tmp/eidolon-uninterrupted-diary-evidence-3mszUV/combat-failure-mara_diary.png`.
Log `/tmp/eidolon-earned-watch-close.log`. Scan/owned cleanup passed; no owned QA
containers remained before starting the separate dungeon run. Candidate now clean
fa20e50 in `/tmp/eidolon-earned-story-TZuGpp`. No Watch completion or fresh pacing
approval. Its investigation driver currently stands and fights nearby enemies;
unlike the Watch driver it does not use ordinary ranged retreats. This limits
any inference about all viable player strategies, but does not erase the failure.

**45 diagnostic candidate1af1ef0**, worktree
`/tmp/eidolon-release45-wizard-ZLnqjH`, branch work/release45-wizard-preparation.
The failed prepared fixture configured Fighter skills/runes but left Wizard
Fireball untrained. A new helper buys up to five Mastery ranks from already
available points and selects level-unlocked Empowered through the real build UI.
No gameplay damage changes, resource/gear grants, extra levels, reconnects,
deadline changes or weakened survival/spawn assertions.0.01 stays unchanged.
This is prepared functional coverage, not a substitute for earned-entry balance.
New actual-dispatch server test plus passive-regeneration race4500 passed3.063s;
preparation-policy15 tests/lint20741 passed. Untrained spell258 versus prepared618
raw damage both cost30mana, with1s versus2.5s effective cooldown. Canonical maximum
mana is1685; CI's1205 was current mana, not maximum. See candidate evidence doc.

**61816 FAILED20.8s, closed:** all five Mastery purchases acknowledged, but
Empowered remained unset before any dungeon combat. Scan/owned cleanup passed.
Log `/tmp/eidolon-release45-wizard.log`. This revealed an actual authorization
mismatch: the UI and cast admission permit the starting ability without a
specialization, while rune selection rejected it because UnlockedSkills was empty.

**Corrected frozen candidatec812eee:** shared IsBaseClassSkill now supplies the
same class-owned starting-ability rule to casting and rune selection. Other
skill unlocks, matching rune/skill and level requirements remain unchanged. No
unrequested resource or damage adjustment. Actual1.0.45 notes describe the fix;
version identity/history remain intact. New real-message tests cover all three
base runes per class, exact level boundaries, unequip, unselected branch skills
and foreign-class rejection. Initial27192 exhausted the normal transport burst
with many authorization cases; cases now use independent normal request clients,
without changing production limits. Corrected95910 PASS root race1.863s and
broader game ability/rune/passive-regeneration race37.052s. Client87099 PASS239
tests/three suites/2.338s plus full lint. All these handles closed.

Two owned checks now run on frozen clean c812eee in
`/tmp/eidolon-release45-wizard-ZLnqjH`:

- **28151 ACTIVE:** full client suite logs to
  `/tmp/eidolon-release45-base-runes-client.log`; only on success does this same
  handle start the corrected Verdant browser (run ID release45-base-runes,
  API/Mongo/web18465/18466/18467), logging separately to
  `/tmp/eidolon-release45-base-runes-browser.log`. A queued browser is not yet a
  running/passing browser. Do not launch another owned browser alongside it.
- **57721 ACTIVE:** full `go test -race ./...`, log
  `/tmp/eidolon-release45-base-runes-server.log`.

Do not edit/restart the frozen candidate until both handles are terminal.
Fresh07:00 remote master remains45b4b83; backend health isok/databaseready,
still exact44/847d454a94a7424ab303f6339c875ab170bff36e, matching the earlier
fresh client manifest. No publication/integration of this correction yet.
No new potion/rest mechanic or basic-attack multiplier was introduced; the
optional recovery preference remains unanswered. Broader roadmap gates stay open.

## Historical checkpoint — September 8, 06:30 UTC

Previous goal turn was progress (52 packaged and actual browser recovery passed).
This continuation closes all full checks, integrates verified52 locally, and
starts the earned Watch on the corrected combined candidate.
Full1.1–1.10 scope remains active/incomplete; no status change is justified.

**45 CI34192659636 still active:** client/server/anonymous browser jobs passed;
predeploy character QA running at06:28. No new push.45 is not yet verified live;46 must
wait for all eight45 jobs and a fresh exact independent public identity check.
Remote master was last confirmed45b4b831a85c96992cd396344610cd1fb9175fd6.

**Prior frozen5398395 checks closed:** full server26246 PASS root18.567s /
database1.040s /game276.898s. Browser82247 FAILED2.5m at the opening's third
kill: two kills, one death, then the unchanged120s deadline. It never reached
Watch. Log `/tmp/eidolon-earned-watch-spaced.log`; scan/owned cleanup passed.
That opening route disabled screenshots and its old failure diagnostic read
nonexistent player.health; no valid failure resource snapshot exists for it.
This is not earned pacing approval despite full server regression passing.

**Dead-only mana recovery implemented:** dedicated clean worktree
`/tmp/eidolon-death-mana-CtD3Wv`, branch work/death-mana-recovery-20260908,
commit7440ccd. Source inspection proves normal respawn restored health only,
leaving the mana depletion observed across prior Watch deaths intact. An
authoritative DEAD state or zero health now restores both bars; living unstuck
retains existing health behavior without a mana refill. Recall, rejected
contexts, PvP gates, cooldowns, training, assets and passive0.01 stay unchanged.
Offline/predicted respawn matches the dead-only rule. No new potions/rest system
was added; that optional preference remains unanswered. See its evidence doc.

Focused11998 PASS eight client tests/1.507s and lint; server62828 race PASS
5.108s; expanded37607 race PASS2.395s adds positive-health/dead-state and PvP
mana rejection checks. All handles closed. Verified52 integrates this source
into root as49ad2a8; it is not published. Full package checks are below.

Candidate cherry-pick6371b3c integrates this fix. QA commit
**653357c9fb35fc2279782880faadc9f26e804e1f** observes actual state/delta mana
after ordinary death-button clicks in the opening and Watch. It requires a full
server resource receipt, not only a predicted refill. Opening diagnostics read
real hp/mana fields. No grants, relaxed deadlines, deaths or counts. Lint97509
PASS. Combined server31046 PASS root22.084s/database cached/game366.158s.
Client65703 FAILED one of225 suites (3350 tests passed/one failed/225.515s):
ProgressionCurve fixture passed JSDOM's global URL to Node readFileSync. Both
handles closed. The test now imports Node's URL explicitly; no thresholds or
assertions changed. Focused98308 PASS13 tests/1.098s. Current clean candidate
**a584ec83b4261b73fbcc4b83cfd05707e0c7ee34** is frozen in
`/tmp/eidolon-earned-story-TZuGpp`: **75691 PASS**, all225 client suites/
3351 tests/227.420s, handle closed. Server source is identical to the passing
combined run. Fresh earned Watch51389 is active on this frozen source.

**52 verified locally, not pushed:** clean **e097cc4bc9a934c923e2a574a34fb328ea119991**
(documentation closure of tested31d13132fb02a53f37a173400df1e1e2cfd80d4f),
branch release/52-death-resource-recovery, worktree
`/tmp/eidolon-release52-death-recovery-Y5bRfW`. Base51/2ed3375 plus dead-only
recovery991c2bf (same7440ccd runtime). All login/package/build/deploy/QA
versions are52 and actual notes preserve51 history, unchanged0.01, no living
mana refill and no new potion/rest mechanic. Curve2/31 chapters/starter encounter
tuning are NOT included. Focused84093 PASS233 tests/three suites/2.935s and
lint; dependency preparation/lint/shell syntax42302 and final61619 PASS.

New death-resources browser regression uses a distinct disposable Wizard suffix,
not the existing dungeon-recovery character. Existing allowlisted readiness
sets one HP; an ordinary Fireball spends mana under waypoint protection, a
real hostile hit after protection is disabled causes death, the death button
must yield a full-mana server receipt, and another cast plus Recall must retain
depletion. Included in the full disposable predeploy route. This is functional
recovery QA, not earned campaign pacing. Actual result is below.

52 full server26858 **PASS** root25.527s/database1.046s/game411.844s;
full client79048 **PASS220 suites/3229 tests/208.394s**, both handles closed.
Browser2218 **PASS one/20.0s,
process25.6s**, closed: an ordinary cast depleted mana to70 before hostile
death; the server receipt restored100/100HP and100/100mana. A second cast plus
Recall retained depletion. Scan passed and owned containers/data were removed
(absence independently checked). Log `/tmp/eidolon-release52-death-resources.log`.
Root merge49ad2a8 integrates the verified52 package. Runtime/build/client source
matches52 exactly; only root's extra reward-stack audit differs. Root233
presentation/resource tests86967 PASS5.650s, death/context/PvP race75198 PASS
3.815s, exact extra audit22479 PASS2.138s. All handles closed. Root is locally
Alpha1.0.52; never push root master. Publication remains behind45–51.

**One owned browser51389 ACTIVE:** candidatea584ec8, route fresh-story-hunt,
run ID earned-watch-recovery, ports18465/18466/18467; log
`/tmp/eidolon-earned-watch-recovery.log`. Opening49s/no deaths, diary107s/
level3. First Watch death at3 credits/mana15; actual ordinary respawn receipt
restores150/150HP and130/130mana. At154s Watch is5/40, one death, level4,
175HP/70mana/301gold, one bag slot/20gold unsold equipment. No full result yet;
do not edit or restart this source until the handle is terminal.

Pacing limitation requiring follow-up: current opening/diary helpers reconnect
after each claim. `client_dispatch.go` initializes login health/mana from base
stats; the DB Character has no saved resource bars. These persistence checks
therefore restore resources and cannot prove uninterrupted adventure pacing.
After the active run closes, add an uninterrupted route while retaining separate
persistence assertions. No login behavior or resource-policy change is made here.
All broader campaign/economy/device/roadmap gates remain open.

## Historical checkpoint — September 8, 06:00 UTC

Previous goal turn was progress: first-hunt eligibility and regression coverage
changed. This continuation closes its failed playtest, implements measured
starter encounter spacing/awareness corrections, and advances the release queue.
The full1.1–1.10 roadmap remains active and incomplete.

**44 fully verified;45 pushed:** CI34187405437 completed successfully with all
eight jobs passed. Fresh independent public checks returned HTTP200 for client
manifest, login, versioned main module and backend health. Client/runtime/server
all matched exact847d454a94a7424ab303f6339c875ab170bff36e and Alpha1.0.44;
backend statusok/databaseready. Then explicit fast-forward push87217 succeeded
from release45 (not root master) to origin/master at exact
45b4b831a85c96992cd396344610cd1fb9175fd6. Remote ref independently confirmed.
**45 CI34192659636 active:** client tests passed; server tests running at05:59.
Requested0.01 regeneration/patch notes are in this release, but45 is not yet
verified live.46 requires all eight45 jobs and fresh exact public identity.
The unchanged46–51 queue below remains behind its sequential gates.

**Earned66228 FAILED /4.3m, closed:** source e74a658. Opening41s/no deaths;
diary100s/level4; Watch3/40 and three deaths. First death had level30 Demon Orcs
within16 units at(188.11,322.99); later deaths had eleven nearby Skeletons.
Final level4/169XP/493gold, health0/175, mana28/145, three bag slots/10gold
unsold equipment. Screenshot inspected/archived
`/tmp/eidolon-earned-watch-three-evidence-jvQixH/failed-watch.png`; log
`/tmp/eidolon-earned-watch-level-three.log`. Artifact scan/owned cleanup passed.
Neither lower eligibility nor the unchanged low regeneration is pacing-approved.

**Candidate5398395f1e42cc3e5ecfe9d963598c079ccdec9f:** new Imp/Demon Orc
spawns must stay160 units beyond town's rectangle, outside early roads plus
normal sight/idle-roam margin. Normal nearby spawns are omitted; their rare
sector elite is placed on the safe inner edge. Early overworld Skeletons now
acquire unprovoked targets at12+3×enemy-level units (15–39 at levels1–9), with
normal45-unit retaliation when attacked. Level10+, other families, dungeon
combat, stats, rewards and the requested0.01 recovery are unchanged. No hidden
immunity/leash or player grants were introduced. Diagnostics use actual hostile
target filtering, excluding friendly NPCs. Targeted server94476 race PASS4.190s
(including actual AI retaliation/constructor and fixed-grid failed-position
replay), lint57878 PASS. Both handles closed. Full checks remain pending.

Two owned handles on frozen clean candidate `/tmp/eidolon-earned-story-TZuGpp`:

- **26246 ACTIVE:** full `go test -race ./...`; root18.567s/database1.040s
  already pass, game package still running. Do not interpret partial output as
  full success or restart the process.
- **82247 ACTIVE:** fresh Wizard watch route, run ID earth-watch-spaced,
  API/Mongo/web18465/18466/18467; log `/tmp/eidolon-earned-watch-spaced.log`.
  Disposable server is ready and Playwright has started one test. No result yet.

Do not edit this candidate until both handles are terminal. The optional
recovery-system preference remains unanswered; no potions/rest mechanic was
added. There is no goal blocker and no full campaign/roadmap completion claim.

## Historical checkpoint — September 8, 05:50 UTC

The previous short regeneration-confirmation turn reverified existing code but
added no implementation. This continuation makes new progress: it closes the
failed earned run from authoritative output and changes the first expedition's
enemy eligibility in the isolated candidate, with regression coverage.
The full1.1–1.10 scope remains active and incomplete.

**44 deployed, final live gate active:** CI34187405437 at05:49 reports seven
jobs passed, including both deployments and predeploy character QA. Live Release
and Character QA is still in progress. Remote master remains exact
847d454a94a7424ab303f6339c875ab170bff36e.45 has not been pushed; all eight44
jobs plus a fresh independent exact public identity check remain its prerequisite.
The45–51 queue and local verification below are unchanged. Never push root master.

**Earned low-regeneration66368 FAILED and closed:** source dfd3cbd, opening48s
without deaths, diary109s/level3; Watch then produced three deaths at only1/40
credit, level4/97XP/283gold/no bag equipment. The inspected image shows0/175HP,
22/145mana and several Skeletons nearby. This is evidence of an early-story
playability failure, not proof that mana alone caused it. Artifact scan and owned
cleanup passed. Log `/tmp/eidolon-earned-earth-low-regen-crowd.log`; preserved
image `/tmp/eidolon-earned-low-regen-evidence-J2vCTX/failed-watch.png`.

**Candidate correction e74a6586f93016c779cf9c185664365e0d8b6691:** first hunt
now admits level3+ rather than8+ Skeletons, matching the actual level reached
through preceding chapters. Ilyra directs the player to near roads. Count40,
reward budget, manual claim, later gates and requested0.01 regeneration remain
unchanged; accepted progress and higher-level kill eligibility are preserved.
Server production-death regression now exercises level2 rejection/level3 credit;
client/server catalog tests verify the threshold and unchanged count/budget.
Client99987 PASS /two suites/16 tests/2.411s and lint PASS; server33384 race
PASS /5.469s. Both handles closed. This is not campaign pacing approval.

**One owned browser66228 ACTIVE:** frozen clean candidate above in
`/tmp/eidolon-earned-story-TZuGpp`; route fresh-story-hunt; run ID
earth-watch-level-three; API/Mongo/web18465/18466/18467. Log
`/tmp/eidolon-earned-watch-level-three.log`. Fresh Wizard starts at level1
with100HP and basic damage2. The driver now records volatile health/mana/rates
and nearby enemy levels separately from exact persisted-state assertions.
It still grants no gear, levels, recovery or objective credit, and permits
at most two ordinary deaths. Do not edit or restart this source while it runs.

An optional asynchronous user question asks whether longer-adventure recovery
should use limited dropped/purchased potions, interruptible out-of-combat rest,
or existing recovery only. No new recovery mechanic has been implemented and
the explicit0.01 passive rate will remain whichever option is chosen. There is
other in-scope work; this question is not a goal blocker.

## Historical checkpoint — September 8, 05:35 UTC

Previous goal turn was progress. This continuation packages the requested
regeneration fix into45, verifies actual progression/gear rollback sessions,
packages the save bridge as51, and integrates the verified runtime locally.
The full1.1–1.10 roadmap remains incomplete; no goal status change is justified.

**45 locally verified, not pushed:** `/tmp/eidolon-release45-regen-tphNrl`,
branch `release/45-with-regen-and-soak-isolation`, clean45b4b831a85c96992cd396344610cd1fb9175fd6.
Includes requested0.01 regeneration, compact phone status UI, owned nightly
soak isolation, exact45 identities and expanded actual patch notes. Full server
race40404 PASS /root22.153s /database1.144s /game437.640s. Fresh Wizard18393
PASS /one /4.7m: opening59s/500XP/100gold/level5/no deaths; four Seeds after8
observed target deaths/no deaths/216s; explicit8000XP/100gold handoff reaches17
and retains the level30 entry gate. This is current15-chapter/old-curve content,
not proof of the expanded campaign. Scan/owned cleanup pass. Full client22164
initially fails one stale patch-title expectation; corrected53736 PASS /216
suites/3193 tests/134.506s; lint96968 PASS. All45 handles closed, no runtime or
earned assertions changed after passing runs.

**Bridge actual sessions closed:** source38d4a9a35318 PASS /100 cycles/57.00s;
expanded source41d09ad23737 PASS /100 cycles/38.60s. Four classes/five save cases
use actual WebSocket login/join/disconnect and Mongo snapshots across1→2→1→2→2.
Expanded fixtures retain equipped/bag/stash/buyback gear and Forge basis as well
as progression, stats, spent points, gold, Resonance, zero-reward contracts and
unknown future discoveries. Owned Mongo fixture data cleaned up; logs/evidence
retained. Bridge worktree now cleand301047. See its evidence document.

**51 packaged and locally verified:** `/tmp/eidolon-release51-bridge-Tmu199`,
branch `release/51-progression-save-bridge`, clean2ed3375. Base50 inherits new
regen/soak; integrates immediate earned room-XP level-ups and version1 save
bridge, but NOT curve2/31-chapter activation. Actual51 login/patch/build/deploy
versions and notes are aligned. On frozenf929c33: full client39001 PASS /219
suites/3226 tests/178.082s; full server55684 PASS /root19.835s /database1.085s /
game422.193s; lint34233 PASS; packaged-server actual sessions9057 PASS /100
cycles/37.92s with full gear fixtures. All handles closed.51 remains behind the
45–50 release gates; it is not live. See release51 evidence.

Root merged the queue history asbeba703 and tested51 as6c321a6. Runtime/build/
client source exactly matches packaged51; the only code/test delta is root's
extra reward-stack audit. Root presentation/regeneration35069 PASS /230 tests,
extra stack race41593 PASS /2.162s. Root is localAlpha1.0.51, never push root
master. No new release was pushed this turn.44 CI34187405437 still reports
predeploy character QA active; server/client/anonymous browser pass.45 must
wait for all eight44 jobs AND fresh exact44 public identity before pushing.

Current sequential queue (old refs preserved):

- 45 `45b4b831a85c96992cd396344610cd1fb9175fd6`
- 46 `90e2a13f7af89221c93ab8190a1304a118625427`
- 47 `bd0395655c29974599ab85bdb32b5f3e25f8c0f2`
- 48 `f0cf612e78870f5322b855c2d732bb08990c0baf`
- 49 `2f0350770e13d7419729ba958e245525c5864c47`
- 50 `774d8176b6859357066449b6b65f50d5b6ae4874`
- 51 `2ed3375` (`release/51-progression-save-bridge`)

45–50 use `release/<number>-with-regen-and-soak-isolation`. Staging worktree
`/tmp/eidolon-release37-targeting-lT3Mdt` is clean50/774d817. One VersionPresentation
merge conflict was resolved retaining both46 history and revised45 assertions.
No old ref was reset or deleted; these unpushed descendants require their own gates.

**One owned browser66368 ACTIVE:** `/tmp/eidolon-earned-story-TZuGpp`, frozen
dfd3cbdc785aafd705a8ff919aae28ac568e5c26; log
`/tmp/eidolon-earned-earth-low-regen-crowd.log`. Candidate now includes requested
0.01 regen. Failed prior screenshot showed39/40 Watch and tight body crowd
(periodic log last36); auto-loot inspection does not show automatic travel.
Driver now uses ordinary Ctrl-click jumps when a proposed retreat crosses actor
bodies, while retaining static-wall/full-path checks, actual six-unit landing
distance and two-death bound. Strategy4570 PASS /63 tests, lint5850 PASS; prior
image inspected/archived `/tmp/eidolon-earned-watch-crowd-evidence-NFT1nJ/`.
No claim every old failure has the same cause. New full Earth run currently
earns opening100XP/100gold in48s, no deaths, and reaches diary investigation;
full result remains unproven. Do not edit or restart this active worktree.

## Historical checkpoint — September 8, 05:08 UTC

Requested regeneration fix closes full checks: **67493 PASS /219 client suites /
3,225 tests /182.603s** and **24799 PASS /server race /root21.275s /
database1.072s /game448.952s**, both handles closed on frozen8aa6ae0. Root
cherry-pick **2580ac2** integrates the exact runtime/tests; no root push.
See [regeneration change and release caveat](2026-09-08-passive-regeneration.md).
The base coefficient is0.01 on server/offline, fractional server ticks work,
and stat tooltips agree. The actual old coefficient was0.5, not its0.1 tooltip.
Broader economy/31-chapter pacing remains open and needs fresh validation with
this user-requested rate. No earned browser or regeneration checks remain active.

44 CI34187405437 still has predeploy character QA active at the latest read;
server/client/anonymous browser pass. No45 push, regen release packaging or
deployment claim. The next release should carry this verified requested fix
and the verified nightly-soak isolation, preserve old queue refs, update its
actual patch notes, and pass all normal gates. Do not push root master.
Bridge opt-in session harness is committeda2f9d1b but actual-session evidence
remains unverified. The full1.1–1.10 roadmap goal remains active and incomplete.

## Historical checkpoint — September 8, 05:04 UTC

User added an explicit health/mana regeneration fix: final per-stat0.01 rather
than the displayed0.1. Actual old authoritative/offline code was0.5; discrepancy
was explained to the user. Isolated `/tmp/eidolon-regen-rate-Jc7euj`, clean
**8aa6ae0**, now sets requested0.01 consistently, fixes integer server loss of
fractional ticks, and updates tooltips. Other healing/room/unique effects are
unchanged. Three focused client suites/62 tests45690 pass; lint23899 passes;
corrected server three-race46937 passes11.513s. Initial world-tick test had
invalid above-max health from empty base stats, corrected without relaxing checks.
Full server **24799 ACTIVE**, `/tmp/eidolon-regen-full-server.log`; full client
**67493 ACTIVE**, `/tmp/eidolon-regen-full-client.log`. Freeze regen source.
Not yet root-integrated, version-packaged or deployed. See candidate regen doc.

Prior full earned Earth rerun **75518 FAILED /8.8m**, frozen3f4d6d2, now closed
with scan/owned cleanup passed. It earned Watch36/40 with two deaths then another
six-unit retreat failed near(-15.87,-38.51); paths passed static collision queries
but ordinary clicks produced ATTACKING or under0.35 movement. Root cause is not
yet established; no movement/death assertion relaxed. No owned browser active.
This old-regen run cannot validate the new requested rate's campaign pacing.

Bridge has an opt-in actual-session integration harness draft.83002 confirms
compile/skip only, not actual Mongo/login/rollback success; that gate remains
open and work is paused while completing the requested regeneration change.
44 CI34187405437 passes server/client/anonymous browser; predeploy QA active.
No45 push. All prior full-roadmap and release gates remain in force.

## Historical checkpoint — September 8, 04:48 UTC

Release43 CI34182920134 closed with all eight jobs successful. Fresh public
manifest/login/runtime/versioned entry/backend all returned HTTP200 and exact
Alpha1.0.43/79a93b131b7192a3a3bc6b2ca355c257585d7d60; database ready.
Explicit44 branch push46461 succeeded to847d454a94a7424ab303f6339c875ab170bff36e.
CI34187405437 passes server/client; browser smoke is active. No45 push until
all eight44 jobs and a fresh exact public identity check pass. Root was not pushed.

Bridge full server18636 PASSED, clean8de4eb0 in its isolated worktree, no active
handles. Actual database/login/rollback sessions and release packaging remain
required. Curve2/31 chapters are still candidates, not live or merged to root.

Full earned Earth57004 FAILED /10.8m after Watch40/40, Seeds8/8, Walking Ink5/60.
The retreat driver hit the real west town wall, not a proven balance failure.
Owned cleanup/credential scan passed. Driver-only full-path collision queries
now pass67 focused tests26911 and lint93211; a fresh full Earth run is required.
No game collision, six-unit movement assertion or death bound was relaxed.

Separate scheduled soak34183672037 failed to bind occupied127.0.0.1:8080;
its artifact contains no completed100-client evidence. The unrelated listener
was left alone. Root's pending operational patch uses isolated Mongo port
mapping, unique binaries/evidence, OS-assigned server port, exact per-run health
identity and owned child cleanup. Two policy tests pass; lint40393 passes.
A bounded real100-client check is required, not a claim of24-hour stability.
That check subsequently closed **15821 PASS /70s /100 connected and joined /
62,872 frames /zero read and write errors**. The owned Mongo was cleaned up;
evidence is in `/tmp/eidolon-soak-92WVYQ/`. See
[soak isolation](2026-09-08-nightly-soak-isolation.md). The fresh earned Earth
rerun **75518 ACTIVE**, frozen source3f4d6d2; log
`/tmp/eidolon-earned-earth-wall-rerun.log`, one owned browser.
The previous checkpoint below is historical. Full roadmap and balance approval
remain unfinished; do not mark the goal complete or blocked.

## Historical checkpoint — September 8, 04:23 UTC

Previous goal turn was progress; this turn closes the full31-chapter regression,
earns the first new expedition in real play, implements a save-format bridge,
and observes the43 deployment advance. The full1.1–1.10 roadmap and balance
approval remain materially unfinished; do not mark the goal complete or blocked.

Combined story source **771c08c**: full server race **95004 PASS /root24.039s /
database1.049s /game498.132s**, handle closed. Full client49961 already passes
223 suites/3339 tests; no active handles remain in the hunt worktree.

New earned worktree `/tmp/eidolon-earned-story-TZuGpp`, branch
`work/earned-story-20260908`: source **906057e** fresh Wizard **49775 PASS /
one /8.9m**, scan/cleanup pass, handle closed. Opening manual100XP/100gold at
level2/46s; diary200XP/25gold at level4/107s. First new Watch earns40 qualifying
server credits with two deaths, retains credit, manually claims1593XP/100gold,
and reconnects at level11/2590XP/3512gold. Eight occupied slots/270gold unsold
equipment value. Watch426s including claim/reconnect. Ready image inspected
and archived at `/tmp/eidolon-earned-watch-evidence-kgJbKH/`. This is one class,
not all-class pacing approval. See [earned evidence](2026-09-08-earned-expedition-verification.md).

Current earned source **a7cbd99** adds ordinary earned build preparation for
level10+ expeditions, retaining the initial low-level Watch baseline. Full lint
**51712 PASS**. New full Earth browser **57004 ACTIVE**, single owned browser;
freeze the entire earned worktree. Log `/tmp/eidolon-earned-earth-expeditions.log`.
The route includes all three Earth hunts, collections, evidence, manual claims
and reconnect; its result remains unproven. Updated60m ceiling covers150 added
kills/travel, not an approved target time. A stale collection-gating test was
also corrected to select the actual collection by ID, not the new hunt's index;
expansion race check25352 passes.

New bridge worktree `/tmp/eidolon-progression-bridge-RluwqP`, branch
`work/progression-bridge-20260908`, clean **96143fc**. It keeps curve1 and
unchanged fresh budgets, understands0/1/2 saves, writes active versions, restores
pending levels once, and preserves quest quotes/requirements/optional records.
Initial17577 failed because the copied test oracle overflowed two large legacy
factors; runtime already returned correct identity. Corrected expanded **57208
PASS /three race repeats /root9.106s /database1.096s /game77.036s**. Full server
race **31499 FAIL /game336.059s**, handle closed. One old GenerateDaily fixture
expected an accepted10-kill/1XP contract to become100kills/50kXP. It now checks
the promised terms while still requiring repaired metadata/missing gold. Focused
three-race **80043 PASS /2.578s**. Corrected full server **18636 ACTIVE**, log
`/tmp/eidolon-progression-bridge-full-server-corrected.log`. Freeze bridge files.
The pre-run commit command used root-relative paths from the server directory
and failed before staging; this run is **96143fc plus exactly the test/doc
correction**, not a clean new commit. Do not start another run for that reason;
commit the unchanged correction after this check closes. Actual isolated database/login/
rollback sessions and release packaging remain required. See
[bridge scope and evidence](2026-09-08-progression-compatibility-bridge.md).

CI **34182920134 /43/79a93b1** now passes predeployment QA, production-input
validation and **both deployment jobs**. Final Live Release and Character QA
is active; exact public43 gate is not yet closed. Do not publish44 until all
eight jobs pass and a fresh exact manifest/login/versioned-entry/backend check
succeeds. Queue unchanged below. No balance runtime/root merge or51 package.

Fresh public read at this checkpoint returns HTTP200 for manifest, login,
versioned main entry and backend: exact **Alpha1.0.43 /
79a93b131b7192a3a3bc6b2ca355c257585d7d60** in manifest/login/runtime/backend;
backendstatus `ok`, database `ready`. This confirms deployed identity, not final
live-gameplay success. Recheck both final CI and public identity before44.

## Historical checkpoint — September 8, 03:59 UTC

This turn implements eight preparation expeditions and closes the earned23-
chapter reward route, not the entire balance or1.1–1.10 roadmap. All release
and migration gates remain in force. No balance runtime is merged to root or
published; no51 package exists.

Fresh browser80057 FAILED at a correctly positioned new-growth prop obscured
by Skeletons. Corrective **762e4de** adds deliberate nearby E inspection through
the existing server-validated path; attacks, damage, range and manual completion
are unchanged. Its real fresh Wizard rerun **PASS /one /5.2m**, with native
pointer diary, eight earned Seeds after14 observed collection-target deaths,
all scar records, manual claims and reconnect. Zero deaths; finallevel7 still
locks the level30 Bastion. Nine actual gear pieces remain unsold (170gold vendor
value), collection combat gold292→763. Image inspected and archived at
`/tmp/eidolon-balanced-earth-earned-RpmDV8/`. Full client **222 suites /3,329
tests /191.911s PASS**, artifact scan/cleanup pass. The output-truncated launch
handles were not recovered; terminal logs and exit of exact owned parent
2898447 were verified instead, without duplicate jobs. See
[inspection evidence](2026-09-08-nearby-story-inspection.md).

Reward worktree is clean **c9fcc98**, no active handles. New hunt worktree
`/tmp/eidolon-story-hunts-6VEzV6`, branch `work/story-hunts-20260908`, authored
**85995cb** then cherry-picks tested inspection/docs to clean **771c08c**.
It contains31 chapters, eight new minimum-level/regional hunts, authored Ilyra
handoffs and veteran optional catch-up protection. See
[expedition scope and limitations](2026-09-08-chronicle-preparation-hunts.md).

Scoped three-race compatibility **10372 PASS /game48.126s**; actual-death
party/solo hunt checks **17722 PASS /three /8.233s**. Corrected dialogue/UI
**43508 PASS /44 /1.796s**. Initial failures were retained and corrected:
old23-chapter indices, old handoff fixtures and dialogue assumptions. Final
lint **81312 PASS**. Combined full client **49961 PASS /223 suites /3,339
tests /163.232s**, handle closed. Full server race **95004 ACTIVE** on771c08c:
freeze that entire worktree until it exits.
Logs `/tmp/eidolon-story-hunts-full-client.log` and
`/tmp/eidolon-story-hunts-full-server.log`. No owned browser is active.

Next: close those full checks, adapt earned browser handoffs to31 chapters and
play the new hunts without grants. Their counts are not yet approved pacing.
Three new Earth hunts model189,879 solo XP at minimum enemy levels, before
opening/collections/exploration; level30 needs195,750 totalXP. That arithmetic
does not prove low-level survivability or party pacing. Gold/material sinks,
late-game progression and the rollback-compatible bridge remain open.

Latest CI read **34182920134 /43/79a93b1**: client, server and anonymous browser
pass; predeployment character QA remains active. No deployment/live43 approval
and no44 push. Exact queue and previous42 live evidence remain below. Root
changes in this checkpoint are docs only, not the isolated curve/story runtime.

## Historical checkpoint — September 8, 03:27 UTC

Current turn remains progress: coordinated quest/weekly budgets are implemented
and now pass full server race regression **95183 / root17.651s /
database1.042s / game336.997s** on clean **a14351b**. Handle closed. This is
still an isolated candidate, not a full earned campaign or release approval.

Fresh Wizard collection/investigation browser **55451 FAILED before login**
because the new worktree lacked generated browser `vendor/` dependencies;
runtime-readiness assertion remained intact, no character progression happened.
The missing directory was verified after owned cleanup, then the standard
`npm run prepare:client` populated dependencies. Source/tests unchanged.
Corrected same-route browser **80057 ACTIVE**, single owned browser, source
a14351b FROZEN at `/tmp/eidolon-reward-budgets-bBZvmD`. Log
`/tmp/eidolon-reward-budget-fresh-collection-prepared.log`. This route uses a
new Wizard, ordinary movement/combat/manual claims and reconnects, without
level/item/quest/encounter grants. Its outcome remains unproven. No edits until
it exits; inspect failures or screenshots/earned receipts before moving on.

CI **34182920134 /43/79a93b1** passes client and server; anonymous browser
was active at the latest API read. Deployment and exact live43 are NOT verified.
No44 publication. Queue/previous42 gate evidence remain as recorded below.
Next: close80057, then author and earned-test the main preparation hunts and
complete source/sink/migration bridge work. Do not replace the full goal with
only passing reward calculations; full1.1–1.10 and per-version release gates
remain required.

## Historical checkpoint — September 8, 03:19 UTC

Previous turn was progress; this turn closes the complete core server gate,
implements coordinated quest/weekly budgets with exact receipts, and advances
the diagnostic release attempt. Full roadmap and earned balance remain open.

Core **6076da6 / 78923 PASS** full server race: root15.726s/game334.140s,
database/loadtest cached. Core worktree clean **5dc79ec** with closure docs.
New reward worktree `/tmp/eidolon-reward-budgets-bBZvmD`, branch
`work/reward-budgets-20260908`, clean **a14351b**. All23 story and26 daily
offers now use explicit bounded XP/independent gold budgets; accepted promises
remain protected. Weekly cache uses1M Resonance XP/15k gold/unique, with5k
full-bag compensation; production chat formats the actual grant receipt.
Three race repeats **11135 PASS / root3.225s / database1.050s / game54.148s**
include all Chronicle/quest/daily/weekly checks, 15 solo/party boss scenarios
and all overlapping Verdant contracts. Normal boss+daily36,332XP gives30→31,
not old30→57. This excludes trash/rooms/story/sales and is not earned pacing.
See [budgets and limitations](2026-09-08-coordinated-reward-budgets.md).

Full reward server race **95183 ACTIVE** on frozena14351b, log
`/tmp/eidolon-reward-budget-full-server.log`. No owned browser. Do not modify
its source while the check runs. Runtime remains isolated/unpackaged: authored
hunts/full earned gates, independent economy/sink review, actual migration/
rollback sessions and the compatibility bridge still need work. Room gold/XP,
combat gold and material/boss drops are not blindly reduced by this pass.

**43/79a93b131b7192a3a3bc6b2ca355c257585d7d60 pushed**, normal descendant
push **71125 SUCCESS**, diagnostic-only; asserts/timeouts/gameplay unchanged.
This is a CI-side reproduction/evidence attempt after two local passing matrices,
not a claim of a diagnosed runtime fix. Old CI34178050891 rechecked terminal
predeploy failure. Previous42 CI34171247520 rechecked all eight jobsSUCCESS;
fresh public manifest/login/versioned-entry/backend all HTTP200 exact42/bfbbc,
backendok/ready immediately before push. New **CI34182920134 in progress**,
client/server jobs active at latest read; no deployment/live result yet.

Queue `with-presentation-diagnostics` (all older refs preserved):

| Version | Commit |
|---|---|
| 43, pushed | 79a93b131b7192a3a3bc6b2ca355c257585d7d60 |
| 44, next | 847d454a94a7424ab303f6339c875ab170bff36e |
| 45 | 2244325699d32c6f3c8db677c5476ff8172dd73e |
| 46 | 8aec8934af0521db3a03a5495d8a5cef23e5a5ac |
| 47 | acd461f24a83b61e65e48f1b80efeda897701d0c |
| 48 | 98fa8f62c256a8e5874da352c987486a200ac2f9 |
| 49 | 96abf00b2aa2aa8d4e739f23bfca409a479cb9eb |
| 50 | 186551e372bbcea2c1182213e835bca072a08588 |

Staging worktree clean186551e. Root merge **a89e7dc** integrates only the new
QA instrumentation (diagnostic doc already identical). Runtime/version/notes
unchanged in the diagnostic update. No44 until all43 CI/deploy/live gates and
fresh exact public identity pass. No51 package yet.

## Historical checkpoint — September 8, 03:03 UTC

Current turn progress: accepted quest promise/requirements protection, complete
first server regression (failed with specific findings), corrected migration
idempotence and repeated passing targeted checks. Goal remains active/open.

Candidate `/tmp/eidolon-coordinated-xp-RKNlYr` is clean **6076da6**. Full server
**55919 FAILED / game395.928s**, root24.722s/database1.093s passed. Failure
analysis identified newly inserted investigation quote flags changing on a
second refresh; catalogs now initialize them. Existing Chronicle migration
assertions remain intact. Four other tests expected old status XP, old curve
remainders or replacement of accepted quest terms; they now assert the new
exact contracts. All Chronicle/daily/status/quote checks pass three race repeats
**66300 / root6.286s / database1.035s / game28.670s**. See
[the failure/correction record](2026-09-08-accepted-quest-quotes.md).

Corrected full server race **78923 ACTIVE** on frozen6076da6, log
`/tmp/eidolon-coordinated-xp-quotes-full-server-corrected.log`. A preceding
invocation from the repo root exited without tests because the Go module is in
`server`;78923 uses the correct module. No full corrected server pass yet.
No owned browser is active. No balance/runtime merge to root or release.

Release43 diagnostics now clean **79a93b1**, QA-only descendant of39620a0, NOT
pushed/requeued. Wizard-only **18831 PASS / 1.3m** and full class sequence
**96050 PASS** (Fighter1.3m/Rogue1.7m/Wizard1.3m/Cleric1.4m), owned cleanup and
artifact scan pass. Final indentation-only cleanup plus targeted ESLint/diff
pass. See [diagnostic evidence](2026-09-08-release43-wizard-diagnostic.md).
CI34178050891 predeploy failure remains unresolved; local passes do not prove a
fix. No CI rerun, no44 publication, no live43 claim. Last exact public evidence
remains42/bfbbc. Current release queue still `with-smite-cadence`.

Next: close78923 without changing its source, then tune all remaining quest/
room/weekly/Vigil XP and independent gold budgets, authored preparation and
compatibility bridge before activation. New curve plus old million-XP catalog
is still explicitly not a playable result. Full earned campaign/group/device
and deployment gates remain open, as does the full1.1–1.10 roadmap.

## Historical checkpoint — September 8, 02:55 UTC

Substantive progress: isolated coordinated progression core and accepted quest
quote protection; release43 predeploy failure remains unresolved. Full roadmap
and earned balance approval are still materially incomplete.

**43/39620a0 / CI 34178050891 FAILED Predeploy Character QA**. Client, server
and anonymous browser passed; deployment/live jobs were skipped. First full
character attempt logged network-change asset failures; the retry failed the
Wizard real-input presentation matrix (Inferno Cataclysm then Dragonfire Lance
on its own retry). Do not attribute these to one cause without evidence. Last
exact public check remains42/bfbbc. No44 publication or gate bypass.

Release worktree `/tmp/eidolon-release43-timing-lYCtAm` has diagnostic-only
changes on39620a0; runtime/assertions/timeouts unchanged. Isolated Wizard
**18831 PASS / 1.3m**, sanitized artifacts and owned cleanup pass; this does not
reproduce or solve CI. Full four-class sequence **96050 active** on this frozen
worktree, log `/tmp/eidolon-release43-allclass-diagnostic.log`.

Candidate `/tmp/eidolon-coordinated-xp-RKNlYr`, branch
`work/coordinated-xp-20260908`, **0e8600f**: expanded23/opening100/room fix plus
bounded XP core, stored-curve migration, authoritative/offline thresholds and
content-level combat budgets. Core implementation **7dc401c**, login points/
pending-level healing **d1e02a3**. Full client **90196 PASS / 221 suites / 3318
tests / 142.350s** predates the server-only followups. See
[core evidence and limitations](2026-09-08-progression-core-implementation.md).

Accepted quest quote/kill requirement protection **0e8600f** uses actual BSON
field presence, preserves explicit zero, partial legacy saves and historical
receipts. Three race repeats **3728 PASS / root6.878s / database1.113s /
game6.922s**, including production claim/reload/duplicate checks. See
[quote evidence](2026-09-08-accepted-quest-quotes.md). Full server race suite
**55919 active** on frozen0e8600f, log
`/tmp/eidolon-coordinated-xp-quotes-full-server.log`. No candidate source changes
while running. Candidate is NOT root-merged, packaged or published: old million-XP
quest/weekly budgets remain incompatible with its new curve. Compatibility
bridge and actual login/earned campaign verification are still required.

## Historical checkpoint — September 8, 02:12 UTC

Previous goal turn was progress: fresh expanded Earth proof, stacked reward
measurement and corrected43 publication. This turn makes concrete progress by
fixing room-earned level transitions, verifying the complete server suite and
advancing the release gate. Full roadmap/balance completion remains unproven.

**43/39620a0 / CI 34178050891** now passes client, server and anonymous browser
smoke. **Predeploy Character QA is in progress**, confirmed by the current CI
API; deployment/live jobs are not complete. No 44 publication. Queue remains
`with-smite-cadence`, next **44/e3a349f** only after all43 jobs and fresh exact
public identity pass. Last exact public verification remains 42/bfbbc before
this43 push, not an assertion that43 has deployed.

Room XP now uses the complete shared level-up/cap path, with unchanged payouts.
All-class red **6966 FAIL / 1.239s** reproduces eight lower-level/cap-transition
failures. Expanded targeted checks first expose an outdated level-55 fixture
using a level-one threshold (**13099 FAIL / 3.501s**); six room fixtures now
use their canonical thresholds without weakening reward/resource assertions.
Four-class 29/39/99/100 immediate stats/skills/talents/healing/overflow and
duplicate checks, room hooks/final-enemy clear, cap and reward-stack checks pass
three race repetitions **24435 / 11.575s**. Full server **33425 PASS / root
17.500s / game 286.052s**, other packages pass, on **caf08cf**. These handles
are closed. See [the correction record](2026-09-08-room-xp-progression.md).

Isolated room branch `/tmp/eidolon-room-xp-bZib8R` clean **aa0f290**. Root merges
it as **ce41bef**, expanded investigation as **9d9b894**. Room correction is
unversioned; expanded23/opening100 remains isolated, no51 package. Combined
expanded room/Chronicle/investigation/stack checks **28456 PASS / three race
repetitions / 45.647s**, log `/tmp/eidolon-expanded-room-xp-integration.log`.
28456 is closed; all owned handles are terminal and the investigation worktree
is unfrozen. No owned browser is running. External CI browser is separate and
must not be disturbed.

Root **cae2770** records the next [coordinated progression candidate](2026-09-08-coordinated-progression-candidate.md):
bounded quadratic thresholds, content-level encounter budgets, coupled daily/
story payouts and authored preparation, existing entry levels and explicit
save-version/accepted-quote preservation. **Not active tuning or a playable
campaign**. The rejected 5%-kill arithmetic sketch still reaches only26 before
the30 gate even with two80-kill hunts; it is not evidence of acceptable pacing.
Next substantial implementation must change sources/curve/objectives together
and verify the whole earned path, not ship only another global multiplier.

## Historical checkpoint — September 8, 01:52 UTC

Current turn makes substantive progress: combined fresh Earth verification,
stacked reward measurements and a second tested release-43 QA correction.
The full balance/roadmap goal remains active and materially unfinished.

System/hardware summon **63682 PASS / four / 1.3m**, slow-case actual-smite
image inspected. Software/hardware evidence and exact cadence assertions are
recorded in [the repeated-smite correction](2026-09-08-release43-repeated-smites.md).
All owned browser/server/client handles are terminal. Full42 CI **34171247520**
is rechecked: all eight jobs succeed. Immediately before publication, fresh
manifest/login/versioned-main/backend checks all return HTTP 200, exact
**Alpha 1.0.42 / bfbbc87374682bb80c825ce96543012a08841735 / ok / ready**.

Normal descendant push **21004 SUCCESS**: ed5 → **39620a056c3405f8587b92a3b4ec0f7bc464288e**,
still Alpha 1.0.43, QA/docs only. New **CI 34178050891 in progress**. No 43
deployment or live approval yet; no 44 publication until all jobs and fresh exact
public identity pass. All old refs preserved. Current queue `with-smite-cadence`:

| Version | Commit |
|---|---|
| 43, pushed | 39620a056c3405f8587b92a3b4ec0f7bc464288e |
| 44, next | e3a349fa9fe7d5e3c4bf7c77243537bb53ae069b |
| 45 | b2b5bf1f1addedf96eefd1db25929bd9d491a1e1 |
| 46 | f4bbd230cb15b08105ba85283169356409211693 |
| 47 | 945fc218e367aa8add08b6e7bca10490412e0d27 |
| 48 | fb6a25f821a02d5e1e1eaf6671f945aee14613c4 |
| 49 | efcdd01c8b2ed5f0825e590493abfa2d460e9212 |
| 50 | 7fb3d74d04c9f0028b12dee30f264ef98e2701fb |

Root merges QA-only50 as **dd8ceee**; investigation as **c549192**. Expanded
23-chapter runtime/opening100 remains isolated; root retains its 15-chapter
runtime and local50. No 51 package. Next substantial balance work must address
the documented early gate gap and excessive stacked sources together, preserving
earned levels, accepted contracts and existing access. Prepared veteran touch
success and isolated payout probes do not establish a balanced full campaign.

## Historical checkpoint — September 8, fresh Earth and reward-stack verification

Fresh expanded Earth **26283 PASS / one / 3.1m** on **95faafc**. QA clears
nearby enemies with normal basic/class attacks before reading; runtime priority,
credit, ranges and enemy strength stay unchanged. Opening saves 100 XP/100 gold
at level 2 / 31s; diary completes manually at level 7; collection earns eight
seeds after 15 observed target deaths, zero deaths, three equipment pieces worth
80 gold **unsold**. All scar records/manual fresh handoffs and reconnect pass.
Collection pays its split 6,000 XP/50 gold. Final level 16 still locks the level-
30 Bastion. No full progression approval. Images preserved and diary/claim images
inspected at `/tmp/eidolon-fresh-investigations-earned-tOr1n8/`. Scan/cleanup pass.
Isolated investigation clean **29555b5**; no expansion/root merge or 51 package.

Root **221132f** adds a production [stacked reward audit](2026-09-08-stacked-dungeon-rewards.md):
Normal's four boss payouts plus two manual daily claims grant 16,001,240 XP,
prepared level 30 → 54 → 57; Heroic/Mythic at 100 grant 26,008,080 / 31,016,160
Resonance XP. Excludes trash, room clears, story and sales. Exact receipt/state
reconciliation and no automatic/duplicate claims pass. **59924 PASS / 1.548s**;
three race repeats **69408 PASS / 3.042s**. Both closed. No reward changes here.

43 software Chromium before correction **11275 PASS / four / 3.3m**, admitting
16.5 seconds in about 70 wall seconds. It reproduces slow rendering, not CI's
exact second-hit failure. QA **d1f182b** uses an 800×450 production-rendered
component view, captures the first real smite, then checks at least ten genuine
84-damage owner-attributed hits at 1.5–1.55 admitted-second intervals across the
unaltered lifetime. It removes the separate second-hit wall deadline without
dropping repeated-combat coverage. **80356 software PASS / four / 1.9m**;
native expiry 32.942 wall seconds, delayed-frame expiry 44.6385, both 16.5
admitted / 11 hits. Native system-Chrome **63682 active**, sole owned browser;
freeze the entire release43 timing worktree. All other owned handles closed.
Still no new push; remote ed5/failed CI and public 42/bfbbc remain current.

## Historical checkpoint — September 8, combined-check results

Corrected 43 **ed5b4e4 / CI 34175827810 FAIL**: client/server pass;
anonymous browser **61 pass / two fail / 10.2m**. Both native and 8fps summon
cases observe only one hit during the 15-second second-hit poll, including
retries. This is earlier than the previously repaired expiry assertion; its
cause is not yet established. Deployment/live jobs skip. Do not publish 44.
Failure log: `/tmp/eidolon-release43-corrected-ci-failed.log`.
An exact bundled-Chromium/software-path reproduction is running as **11275**,
the sole owned browser, in the release43 timing worktree. Freeze that worktree.

Combined expanded-story/opening source **3bf6a50**: full client **63890 PASS /
220 suites / 3,305 tests / 78.747s**; full server race **37061 PASS / root
11.362s / game 202.149s**, other packages pass. Fresh browser **66320 FAIL /
1.3m**: opening earns and saves exactly 100 XP/100 gold, reaches level 2 in
29s without deaths, then fails to hover Mara's diary. The actual hit stack
contains four Skeletons before the site; hostile priority prevents inspection.
No diary/collection success on this combined source is claimed. All three
handles are terminal; the investigation worktree is no longer frozen.
The earlier passing prepared-veteran touch routes remain valid but do not
establish fresh desktop interaction or full leveling balance.

## Historical checkpoint — September 8, 01:30 UTC

Air detour **32730 PASS / one / 2.5m** on clean ab95837: both quests, all four
records read in both orientations, actual manual retrospective replies/rewards,
saved masks 1/7 and full journal rereading. Six targets engaged at the horizon,
not an audited kill count. Both horizon images inspected; all eight preserved
at `/tmp/eidolon-phone-air-earned-NBRO3Y/`. Scan/cleanup pass; 32730 is closed.
Each realm now has a passing two-chapter touch route on its recorded source.
Prepared-veteran success does not prove fresh leveling, physical phones or raids.

The opening runtime and exact earned-receipt test cherry-pick cleanly into the
expanded branch as **50b7724 / 3f2cd1d**. Clean **3bf6a50** records integration.
Generated content/lint/diff pass. Combined full client **63890**, full server
race **37061**, and actual fresh Earth opening/diary/collection/evidence/handoff
browser **66320** are active; logs
`/tmp/eidolon-investigations-opening-combined-{client,server,earned}.log`.
**66320 is the sole owned browser; freeze the entire investigation worktree**
until all three checks are terminal. Other owned handles are closed. Root retains
the 15-chapter/local-50 runtime; no 51 package or expansion publication yet.
Corrected 43 **ed5b4e4 / CI 34175827810** still awaits its complete deployment/
live gate; next publisher remains **44/8694c19 with-seraph-clock** after all
jobs and fresh exact identity succeed. Full balance and roadmap remain open.

## Historical checkpoint — September 8, 01:24 UTC

Previous turn was progress: release 43 publication, Water/Fire phone proof and
fresh story handoff corrections. This turn repairs 43's failed browser gate,
implements/verifies a smaller opening reward, and identifies Air's obstructed
walking route. The complete 1.1–1.10 scope is still open.

43 **f955608 / CI 34174381235 FAIL**: client/server pass; browser **61 pass /
one fails / 8.2m**, including its retry; deployment/live jobs skip. The offline
fixture admits at most 50ms per frame but assumed 22 wall seconds was enough
for 16.5 simulated seconds. **69010 red / 27.6s** reproduces at 8fps: 25.88 wall,
9.70 admitted, 6.80 remaining, seven real smites. QA **c3264c3** checks actual
expiry boundaries and cleanup, with 90 wall seconds for slow rendering. Native,
8fps, wall and follow/departure checks **88992 PASS / four / 1.2m**; slow expiry
16.5 simulated / 43.8697 wall seconds. Image inspected. Full client **34919 PASS /
213 / 3,166 / 76.949s**, lint/diff pass. Runtime/server/version/notes unchanged.
See [the correction record](2026-09-08-release43-simulation-clock.md).

Fresh public manifest/login/main/backend remain **HTTP 200 / Alpha 1.0.42 /
bfbbc87374682bb80c825ce96543012a08841735 / ok / ready** before normal corrected-43
push **92167 SUCCESS**, f955 → **ed5b4e444a6746426d5032e2ee55578d3849ff16**.
New **CI 34175827810**: client/server pass, browser active; no 43 deployment/live
approval. All old refs are retained. Queue suffix is now **`with-seraph-clock`**:

| Version | Commit |
|---|---|
| 43, pushed | ed5b4e444a6746426d5032e2ee55578d3849ff16 |
| 44, next | 8694c193407555190d0075313831a908c5e70a34 |
| 45 | 1f020f7723d181a29250fb909edac35dd2574867 |
| 46 | 92e4103cd2ec4b2456996f791a45dd3cdecc1354 |
| 47 | e828d71c0c685a6ca87dccd55daf47c57536602d |
| 48 | d9601953274140a93216f42e66f38b6e70647a94 |
| 49 | 34dc949d6dffad778ef2d6b5d921cb2276e900cb |
| 50 | 35535e6034ca7832caaa0a7ed046cc17ba3b5b94 |

Publish 44 only after every corrected-43 job and fresh exact public identity
succeed. Root merges test-only 50 at **3c2c280**; investigation at **cee15fc**.

Independent [opening reward](2026-09-08-opening-reward.md), runtime **d911162**,
reduces new offers from 500 to 100 XP, retaining 100 gold and all accepted/ready/
completed quotes, including zero. Three repeated targeted server race passes;
full **82436 PASS / root 9.147s / game 211.826s**, other packages pass. Actual
fresh Wizard **89727 PASS / 1.8m** verifies displayed quote, exact manual payout,
saved receipt and subsequent eight-fragment collection with no grants/deaths.
Opening: level 2 in 30s. Collection: 12 observed target deaths / 76s, level 5
before unchanged 8,000 XP → level 16; Guide still locks level 30. The remaining
large reward jump is explicitly unresolved. Clean isolated **353e465**, worktree
`/tmp/eidolon-opening-reward-FinvXg`; docs copied to root, runtime not merged or
packaged. Integration with expanded story and broader pacing remain required.

Air **72801 FAIL / 6.0m** stays at full HP but drifts fighting toward (900,200).
**57049 FAIL / 57.7s** subsequently dies near (755.68,187.52) after accepted
Shield/Well/Fireballs. Image inspected; failures retained. Geometry proves the
old direct route crosses the real Bastion entrance at (800,200). QA **0296d48**
walks north around it; geometry red **one fail / four pass / 0.441s**, corrected
route/defense **36 / 0.524s PASS**, lint/diff pass. No world collision/strength
change. **32730 is the sole owned browser**, Air detour on clean **ab95837**, log
`/tmp/eidolon-investigations-phone-air-detour.log`; freeze that entire worktree.
All other owned handles above are closed. No Air/expansion success claimed.
Opening XP is a local isolated candidate, not full XP/gold/campaign approval.

## Historical checkpoint — September 8, 00:54 UTC

Previous goal turn made progress: phone reward rows/diary scrolling were verified
and the earned Water retry started. This turn closes Water **86161 PASS / 2.3m**
on a8f1e91 and Fire **64268 PASS / 2.4m** (2.3m test) on ae9d8a5. Each earns
both chapters/all four records through touch, reads both orientations, manually
claims retrospective replies/rewards and reopens saved masks 1/7/full text. Fire
observes actual anchor death after ash and before ember credit. Prepared veteran
fixtures are not earned leveling. Eight images each are preserved in
`/tmp/eidolon-phone-water-earned-sMAYIC/` and
`/tmp/eidolon-phone-fire-earned-MUBXxS/`; Water bell both orientations and Fire
ember portrait/anchor landscape are inspected. Scan/cleanup pass.

Story review fixes misleading handoffs in **cdfdcd5**: diaries introduce the
next collection, all four collection replies introduce their linked investigation
before the dungeon, and Air recognizes the learned pinion pattern rather than
implying consumed items remain in the bag. Optional replies/rewards/access stay
unchanged. Red **four fail / 21 pass / 0.654s**, focused green **28 / 0.730s**;
full client **10494 PASS / 219 / 3,299 / 82.376s**; Chronicle/investigation server
race checks three times **97734 PASS / root 2.277s / game 20.037s**. Generated
content/lint/diff pass.

Air **93402 FAIL / 50.1s** dies on outbound travel before the diary; the helper
ignores enemies between waypoints and lacks failure position/HP diagnostics.
QA **11e345d** now releases movement when threatened, uses normal touch combat,
then resumes travel. Failure diagnostics/image are added; the survival requirement,
kit, quest rules and enemy strength are unchanged. Lint/diff pass. **72801 is the
sole owned browser**, Air retry on clean 11e345d, log
`/tmp/eidolon-investigations-phone-air-defended.log`; freeze its entire worktree
until terminal. All other owned handles above are closed. Air, fresh campaign/
XP/gold, physical devices and expansion publication remain open; root retains
15 chapters/local 50, not a published story expansion.

Corrected 42 **bfbbc87 / CI 34171247520** passes every CI/deployment/live gate
with terminal SUCCESS. Fresh manifest/login/main/backend reads **36161 PASS**:
all HTTP 200, exact **Alpha 1.0.42 / bfbbc87374682bb80c825ce96543012a08841735**,
backend `ok`, DB `ready`. Clean staging, remote bfbbc and forward ancestry are
confirmed before explicit **release/43-with-portal-pointer / f9556081a533db4b74ae52f7428a3520c1263acb**
pushes normally to origin/master (**94818 SUCCESS**, closed), with Seraph patch
notes/login/package version present. New **CI 34174381235** passes client/server;
browser smoke is active. No 43 deployment/live approval yet. Next is explicit
**release/44-with-portal-pointer / 67a431566e2f476eb33dffb1ed9f4f0f107f02c2** only
after all 43 jobs and fresh exact public identity succeed. Full roadmap remains open.

## Historical checkpoint — September 8, 00:38 UTC

The requested balancing/story scope remains in the dedicated plan: coordinated
XP/gold/drop budgets, longer bounded collections, purposeful combat and two
authored investigations per realm. No replacement XP curve, gold budget or
dungeon-entry level change is selected here. Local 47/49/50 changes are queued,
not advertised as live; the 23-chapter expansion remains isolated.

Water phone **72001 FAIL / 2.8m**, closed: all four discoveries and portrait bell
reading succeed, then landscape ending visibility fails. Eleven targets are
engaged at the bell, not an audited kill count. The upward-only test lacks
failure geometry, so the cause is not established. QA **fea7b03 → 291bfe2** adds
bounded bidirectional native swipes, settled scrolling and failure geometry,
hit-testing, HP/state and image capture without relaxing final-text visibility.
Three layout-fixture setup failures are retained before the corrected actual
daily-ladder/offscreen-record case passes.

Independent phone reward UI **748711e**, worktree
`/tmp/eidolon-phone-journal-AH5VCv`, makes reward rows full-width/stacked and
humanizes enemy names. Rewards/status remain unchanged. Unit red seven fail /
33 pass; green **40 / 0.683s**. Standalone browser **18637 PASS / four / 11.6s**;
narrow/landscape images inspected. Cherry-pick **8318e55** integrates it only
into investigations. Combined full client **92909 PASS / 219 / 3,295 / 75.027s**,
lint/diff pass. Combined browser **35956 PASS / five / 25.2s**, including native
scroll recovery in both directions/orientations and held-touch journal refresh.
Both recovered-ending images inspected, preserved at
`/tmp/eidolon-readable-journal-proof-WhBThb/`. No Go runtime change.

Clean investigation **a8f1e91** records all evidence. **86161 is the sole owned
browser**, earned Water touch retry; log
`/tmp/eidolon-investigations-phone-water-readable.log`. Freeze its entire
worktree until terminal. All other owned handles are closed. Phone Water/Fire/
Air, fresh campaign pacing, physical devices and expansion release remain open.

Corrected 42 **bfbbc87 / CI 34171247520** now passes client/server/browser,
predeploy character QA, production input validation and both deployments;
**live release/character QA remains active**. No full live approval or 43 push.
Next publisher remains explicit **release/43-with-portal-pointer / f955608**
only after all corrected-42 jobs and fresh exact public identity succeed.

## Historical checkpoint — September 8, 00:16 UTC

Earth touch **47303 FAIL / 39.8s** reaches both manual quest completions and all
field-reading steps, then exposes a record detached during saved rereading. The
journal rebuilt its controls on updates. Runtime **4d1ad74** preserves actual
valid record nodes; removed evidence/session clearing still removes old nodes.
Regression before: **two fail / seven pass / 0.661s** (14626 closed). After:
journal/objective **40 / 0.824s PASS** (65125); actual landscape reading and
finger-held-across-refresh **33218 PASS / one / 4.5s**; full client **57553 PASS /
219 suites / 3,286 tests / 87.725s**. Lint/diff pass. Go runtime is unchanged.

Corrected Earth phone **25892 PASS / one / 42.7s** (41.4s test) on clean 4d1ad74:
two chapters, all four discoveries read in both orientations, actual manual
retrospective replies/rewards, saved masks 1/7 and complete journal rereading.
This run engages no nearby hostiles, so it is not a new combat-difficulty proof.
All eight earned images are preserved in `/tmp/eidolon-phone-earth-earned-Uw4xQ4/`;
marked stone portrait/landscape and new growth portrait are inspected. Credential
scan/cleanup pass. It also exposes cramped repeatable-ladder columns/joined enemy
labels on the max-level phone journal: retain that presentation follow-up.

Clean investigation **c6c569b** records the proof. **72001 is the sole owned
browser**, phone Water investigations on c6c569b, log
`/tmp/eidolon-investigations-phone-water.log`. Freeze its entire worktree until
terminal. All older owned handles are closed, including 47303; no failed run is
counted as success. Phone Water/Fire/Air and physical phones remain open.

Corrected 42 **bfbbc87 / CI 34171247520** remains predeploy-character-active after
client/server/browser success. No new deployment/live approval; next publisher
is still **release/43-with-portal-pointer / f955608**, gated on all corrected-42
jobs and fresh exact public identity. Root remains local 50/15 chapters; expanded
23-chapter source is isolated. XP/gold/realm pacing and full roadmap remain open.

## Historical checkpoint — September 8, 00:05 UTC

Corrected 42 **bfbbc87 / CI 34171247520** passes client, server and browser smoke;
predeploy character QA is active. Next remains explicit 43/f955608 only after all
42 deployment/live gates and fresh exact public identity. No 43 push or live
approval yet. Previous goal turn was progress: corrected 42 publication, preserved
queue integration and combined first-diary phone gameplay proof.

Investigation QA **f04d38e** adds opt-in two-chapter touch routes for all four
realms, sharing the original guarded empty-account veteran fixture. It uses
actual joystick travel, visible phone build/actions, target taps/Attack/Skill/
hotbar skills, bounded ordinary retreat, USE, both orientations' earned record
reading, explicit optional Ilyra replies/rewards and saved evidence. Fire retains
ash → live anchor/observed death → ember ordering; no investigation credit,
invulnerability, gear, travel or damage grant is added. The prepared level-100
common-staff fixture is not earned progression. Desktop fixture extraction is
mechanical. Lint, shell syntax, test discovery and diff checks pass (75191 closed).

First Earth phone **83848 FAIL / 31.7s** genuinely earns the diary and severed
root, then exposes a no-op movement cleanup error: CDP rejects TouchEnd when
the character already stands at the requested point and no TouchStart occurred.
Scan/cleanup pass; log `/tmp/eidolon-investigations-phone-earth.log`. QA-only
**2b5f073** releases a gesture only if started, always detaches the session, and
passes lint/diff (52450 closed). No runtime interaction or difficulty change.

**47303 is the sole owned browser**, same Earth phone route against clean
2b5f073, log `/tmp/eidolon-investigations-phone-earth-noop.log`. Freeze the entire
investigation worktree until terminal; other owned handles are closed. No all-
realm touch success is claimed. XP/gold/realm pacing, physical phones, expansion
release and the complete roadmap remain unfinished.

## Historical checkpoint — September 7, 23:53 UTC

Corrected **42 / bfbbc87374682bb80c825ce96543012a08841735** is pushed normally
through explicit `release/42-with-portal-pointer → origin/master` (47491 closed).
Fresh predecessor manifest/login/main/backend all match healthy Alpha 42 ea565
before push. New **CI 34171247520**: client passes, server active. No deployment
or live success yet. Previous failed CI remains preserved. The
[repair record](2026-09-07-release42-portal-pointer.md) contains the actual red,
portal **11.9s**, Water/Verdant **two / 4.7m** and final full client **212 suites /
3,134 tests / 72.867s** evidence. All of those owned handles are closed.

Only tests/docs change from ea565; game runtime and existing 42 notes/version
remain unchanged. Corrected QA ancestry is merged cleanly into newly named queue
refs; old refs remain intact. All use suffix **`-with-portal-pointer`**:

| Next release | Commit |
|---|---|
| 43 | f9556081a533db4b74ae52f7428a3520c1263acb |
| 44 | 67a431566e2f476eb33dffb1ed9f4f0f107f02c2 |
| 45 | cc9061daed673dd77faf1d3cab484511de555b4d |
| 46 | 2ef800edb341606077b1610095a277f0ab676619 |
| 47 | a9352defb446acfb07ef308da352782fef4283f3 |
| 48 | 5d5f3f04c17d9c95249fd7ab79cad2d897c7d106 |
| 49 | 72ab5288bed2dc6aab4b0f7537eb5e417cc9b357 |
| 50 | 4a04eab94f42ae236a9266afe548c7b324a33f4c |

Next publisher is **43/f955608**, strictly after every corrected-42 CI/deploy/
live gate and fresh exact public identity. Root merges new local 50 at **7481a0f**;
targeting/feedback/version/runtime contracts **265 / 1.56s PASS** (39479 closed).
Investigation merges the same QA ancestry at clean **144aac1745db45d67d60128f0e81b898910ca7f1**;
generated eight/16 checks pass; no investigation runtime changes. Latest combined
phone **49124 PASS / one test / 50.3s** (48.9s): actual combat/joystick/USE,
explicit rewards/reply, both orientations' real diary-ending swipes and saved
rereading. Both earned phone images are inspected and preserved in
`/tmp/eidolon-phone-combined-proof-YTqlQw/`; log
`/tmp/eidolon-investigations-phone-combined.log`, scan/cleanup pass. Clean
investigation **c775f9d** records the proof. **All owned handles are closed**;
CI 34171247520 remains client-pass/server-active. The other seven investigations'
touch routes, physical phones, XP/gold/realm pacing and complete roadmap
remain open; no 51 package or expansion/root integration yet.

## Historical checkpoint — September 7, 23:42 UTC

Corrected portal **11052 SUCCESS / one test / 11.9s** (10.6s test) against clean
**f94ea72**. It uses actual exposed-pointer acquisition, re-entry and town recall
during a real jump; credential scan (zero sanitizations) and cleanup pass.
Log `/tmp/eidolon-release42-portal-exposed.log`. The old driver failure remains
recorded; no production targeting rule is changed.

Full client **77557 FAIL / 211 suites pass, one fails / 3,131 tests pass, one
fails / 82.161s** on the same source. Failure is the existing
`GameEngineCombatFeedbackVisuals` matching-kind throttle test: its second bleed
call unexpectedly returns true. It uses real `Date.now()` around an 80ms
production throttle and assumes adjacent assertions execute inside that window.
Replace that scheduling assumption with a controlled clock and explicit
before/at/after-boundary cases; do not change production throttling or silently
count the failed suite as passed. No source edit during the current browser.
Log `/tmp/eidolon-release42-portal-client.log`.

**72220 is the sole owned browser**, corrected Water/Verdant routes against clean
f94ea72 in `/tmp/eidolon-release42-portal-QoFLrB`, log
`/tmp/eidolon-release42-portal-dungeons.log`. Water passes **15.9s**; Verdant earns
ordinary kills and has reached Rootbound Warden. Resume this handle; freeze the
entire repair worktree until terminal. All other owned handles are closed.
Investigation branch stays clean **4bfa0e7** with no active checks; root has only
documentation changes after its verified local 50 integration. Remote/public
remain 42 ea565, live gate failed, next 43 still withheld. No corrected 42 push,
43 publication or all-roadmap completion. All-realm touch and coordinated XP/
gold/access pacing still require work; the dungeon-level preference remains
unanswered and non-blocking.

## Historical checkpoint — September 7, 23:38 UTC

Air **59545 SUCCESS / one test / 5.1m** against **fa9feaa** (test 5.0m): Selen's
journal, all three horizon markers, both manual optional speeches/rewards,
reconnect and all four full saved records pass. Seven/eight engaged pursuers
are observed targets, not audited kill counts. Actual observatory/updraft/earned
journal screenshots are inspected and preserved in
`/tmp/eidolon-air-earned-proof-U6GbWV/`; credential scan and cleanup pass. Clean
investigation head **4bfa0e7** records the proof, with no runtime changes after
the fully tested 0036656. No active investigation handles. All four realms have
earned functionality on the recorded checkpoints; fresh full-campaign pacing,
broader touch and expansion publication remain open.

Public HTTP 200 manifest/login/main/backend all match **Alpha 1.0.42 / ea565ebf…**,
backend `ok` / database `ready` at 23:33; this does not override failed live QA.
Local diagnostic **77714 FAIL** on exact 42 plus observers **ad21d93** reproduces
the failure: actual before/after/pending click target is a live Inferno Titan
at (804.8,205.9), ray stack also contains the entrance, **zero dungeon-status
requests/responses**. Canvas input correctly attacks a covering enemy; this is
not an unresponsive server or evidence that the portal itself rejects clicks.
Log `/tmp/eidolon-release42-portal-observation.log`, scan (two sanitized files)
and cleanup pass. Existing live artifacts remain preserved.

QA-only correction **f94ea72** keeps enemy priority, waits for actual camera
settling and samples exposed entrance mesh points with normal hover checks.
The fresh click must still select the portal. No game/runtime/server changes.
Real-geometry desktop/touch checks preserve both enemy and exposed portal clicks:
**11 tests / 0.591s**, lint/diff pass (17516 closed). Isolated corrected portal
and full client checks are starting against the clean diagnostic worktree; no
new publication, successful correction run, or 43 gate is claimed yet.

## Historical checkpoint — September 7, 23:31 UTC

Investigation runtime **0036656** passes full client **219 suites / 3,279 tests /
174.009s** plus lint (86062 closed), and full server race root **22.755s**, game
**455.511s**, other packages green (1610 closed). Fire control-kit run **26226**
fails after **8.9m** with full 2,575 HP: 120 Fireballs, six Gravity Wells and five
Shields are accepted, zero rejected. It drifts away from the anchor while
fighting unrelated Djinn. This is not evidence of failed abilities or a kill.

Bounded ordinary retreat strategy **24d51e5** changes QA only, passes 30 control
tests / 0.465s and lint. Actual Fire **3159 SUCCESS / one test / 4.4m**: cold ash
earned, actual anchor death observed, mask 1 → 3 before ember inspection, then
manual catch-up completion/rewards, reconnect and earned journal rereading.
Inspected combat/released hearth/sprout/record images are preserved in
`/tmp/eidolon-fire-earned-proof-5ElOA2/`; scan/cleanup pass. Explicit level-100
common-staff veteran fixture, not earned leveling or average-difficulty proof.
Isolated source **fa9feaa** adds only the proof record over 24d51e5.

**59545 is the sole owned browser**, Air earned investigations against clean
fa9feaa, log `/tmp/eidolon-investigations-air-earned.log`. Freeze its entire
worktree until terminal. Root still retains locally verified 50 / 15 chapters;
the 23-chapter expansion is not root-merged or published.

42 **ea565ebf… / CI 34166841477** deploys successfully but **live QA FAILS**:
six tests pass; focused Verdant entry and Verdant combat route both time out
waiting for the entrance menu, including their retries. Client/server/browser/
predeploy and both deploy jobs pass. Live four-class/remote-animation checks
are not run after the failure. Last fully verified public release remains 41.
Do not publish 43 or count deployed 42 as signed off. Artifacts are preserved in
`/tmp/eidolon-42-live-failure-DIViBh/`. Separate diagnostic worktree
`/tmp/eidolon-release42-portal-QoFLrB`, branch `work/release42-portal-20260907`,
starts from exact 42 with read-only click/request observations; no runtime fix or
reproduction claimed yet. No blind CI rerun or skipped gate. Broader XP/reward
balance, all-realm/phone proof and full roadmap remain unfinished.

## Historical checkpoint — September 7, 23:08 UTC

Combined 170c53f verification closes: full client **30280 SUCCESS / 219 suites /
3,258 tests / 173.048s**, lint passes; full server **19540 SUCCESS**, root
**24.250s**, game **416.594s**, remaining packages green. Fire **53097** closes
**FAIL / 4.2m** before cold ash: nine actual hostiles nearby when the unarmored
common-staff fixture dies. Actual death screenshot is inspected; scan/cleanup
pass. No ordered-anchor completion or comfortable realm-pacing claim. Both
pointer-driver limitations and the prepared fixture's limited skill use are
kept distinct from unproven enemy-density conclusions.

Investigation source **0036656448ca78c3a53a235dd90b298481e6ce76** adds:

- Authored retrospective acceptance/completion for all eight optional chapters,
  generated into matching catalogs. Server initial migration/refresh supplies
  those descriptions; client conversation and manual reply use the same source.
  Fresh required speeches stay separate. Fire correctly says Ilyra holds the
  ore already handed in. Counts, rewards, evidence and access are unchanged.
- Player-specific native bound/released ember states. Actual anchor evidence
  replaces shackles with hearth embers and a sprout; counts alone and another
  player's progress cannot release it. Completed evidence restores the visual
  after reload. Browser visual inspection of this latest model is still pending.
- Optional prepared-fixture Gravity Well against real nearby clusters through
  the available hotbar, mana and cooldowns. Existing fresh-hunt baselines retain
  their shield/retreat-only controls. Added accepted/rejected Fireball/Well
  counters distinguish attempted inputs from accepted abilities. No damage,
  gear, talent, immunity, teleport-to-site or discovery grants.
- The realm browser checks the two ember states and actual manual catch-up
  speeches. Full Fire/Air play and broader touch/continuity/pacing remain open.

Catch-up regressions reproduce before routing changes: client **8 failed / 13
passed / 1.761s** (43316 closed), server **FAIL / 0.034s** (81109 closed). After:
client **24 / 1.487s** (26807), server discovery/expansion/catch-up three race
repetitions **6.302s** (12968); both pass. Combined model/content/conversation/
control checks pass **81 / 2.386s** (42660), then final lint/generated/diff checks
pass before clean commit 0036656 (29619). No failed run is counted as a pass.

Latest combined checks are active against clean **0036656**:

- **86062**, full client then lint, `/tmp/eidolon-investigations-catchup-client.log`.
- **1610**, full server race, `/tmp/eidolon-investigations-catchup-server.log`.
- **26226**, actual Fire with available control kit,
  `/tmp/eidolon-investigations-fire-control-kit.log`.

**26226 is the sole owned browser. Freeze the entire investigation worktree until
these checks are terminal; resume the same handles.** All older owned handles
are closed. Source remains isolated; root stays verified local 50 / 15 chapters.
42 **ea565ebf… / CI 34166841477** remains in predeploy character QA after successful
client/server/browser. Last fully verified public build is 41. Next publisher
stays 43, after all 42 deployment/live gates and fresh exact public identity.
Entry-level design preference remains unanswered and non-blocking. Full roadmap,
coordinated XP/gold/rarity/affordability and expansion release remain unfinished.

## Historical checkpoint — September 7, 22:45 UTC

Fire **1309** closes **FAIL / 5.2m**. Normal jump retreats clear fourteen actual
pursuers and the cold ash is genuinely inspected/recorded (mask 1); its actual
earned journal screenshot is inspected and copied to
`/tmp/eidolon-fire-earned-cold-ash.png`. The prepared character subsequently dies
in the anchor fight. Scan/cleanup pass. This is not ordered-combat completion or
evidence that Fire is comfortably balanced. That driver only attacked when the
anchor itself won the hover test; other covering enemies could leave it without
offense. New **0e6820c** allows normal attacks on actual covering hostiles, retains
the required ash → observed anchor death → ember checks, and adds attack/health/
position/mask diagnostics plus a combat-failure screenshot. Lint/diff checks pass
(9811 closed). No runtime difficulty or credit requirements are weakened.

The isolated investigation branch now merges the locally verified 50 release at
**170c53f8651987f8bb4f31e094f752a5e77709d5**. Merge is clean; generated eight
chapters/sixteen discoveries, shell syntax and diff checks pass. This aligns its
23-chapter story with current personal-fragment and reduced-equipment runtime
before further playtesting; **it is not the released 1.0.50 package or merged to
root**. Root remains locally verified 50 with the dormant investigation foundation.

Combined verification is active against clean 170c53f:

- **30280**, full client then lint, `/tmp/eidolon-investigations-50-client.log`.
- **19540**, full server race, `/tmp/eidolon-investigations-50-server.log`.
- **53097**, actual Fire route with ordinary crowd combat,
  `/tmp/eidolon-investigations-fire-combined-50.log`.

**53097 is the sole owned browser. Freeze the entire investigation worktree while
these checks run; resume these handles rather than starting duplicates.** No Air
run yet. Remaining narrative review includes retrospective optional chapter
instructions and Fire's completion line telling the player to keep ore already
entrusted to Ilyra; these have not been changed during the frozen tests.

42 **ea565ebf… / CI 34166841477** passes client/server/browser and is in predeploy
character QA. Last fully verified public release remains 41; next publisher stays
43 only after every 42 deployment/live gate and fresh exact public identity.
User has been asked asynchronously whether dungeon entry levels may be adjusted
to remove the Earth→Water preparation gap; no response yet. This is a pending
design preference for coordinated XP pacing, not a blocker to the current tests
or the overall goal. Full roadmap and broader balance/expansion remain active.

## Historical checkpoint — September 7, 22:35 UTC

Alpha **1.0.50** is locally verified and root-integrated as merge **93b62cc**.
Release ref **`release/50-routine-equipment-budget`** points to
**9f475e903aad06ebf54dbd20d1b906bccc15b695** (documentation-only final commit over
tested clean **4212e54e5347ba7a10f379f7634f970fc27e06b1**). Root runtime/package
matches that release; only execution-ledger documentation differs before the
latest plan status update. Root integration contracts pass **251 / 3.221s**,
handle **89224** closed. No 50 publication or public verification yet.

Exact-package fresh collection **18500** closes **SUCCESS / 1 / 2.2m**, test
2.1m. Actual local login and backend return HTTP 200 / Alpha 1.0.50 / clean
4212e54, backend `ok` / database `ready`. The route earns eight fragments with
**18 observed target deaths / zero deaths**, three gear drops worth **230 unsold
vendor gold** and 442 gold before turn-in. The inspected actual ready screenshot
shows 8/8 and a deliberate Complete Quest button. Claim/reconnect retains the
actual gear IDs/rarities/stats/value, manual 8,000 XP/100 gold leaves level 17 /
542 gold, and level-30 Guide remains locked. Collection/handoff takes 91 seconds.
Credential scan/cleanup pass. Small-run Common/Uncommon/Legendary observations
are not rarity-distribution estimates or a complete pacing approval.

Fire normal-jump investigation **1309** is active against clean **409da01**,
log `/tmp/eidolon-investigations-fire-jump-route.log`. This is the **sole owned
browser; freeze the entire investigation worktree until terminal**. All prior
Fire handles are closed. Full client on that source already passes 219 / 3,256 /
131.314s; full ordered Fire play and Air remain open. Root retains the original
15-chapter story with dormant investigation foundation, not the isolated 23 graph.

42 **ea565ebf… / CI 34166841477** remains active (client pass, server running).
Last fully verified public build is 41. Next remains 43, gated on all 42 jobs and
fresh exact public identity. The full roadmap, broader coordinated XP/gold curve,
non-daily leveling, rarity power and late-forge affordability are unfinished.

## Historical checkpoint — September 7, 22:30 UTC

41 **9c6eb9d… / CI 34163174335** closes **SUCCESS**, including both deployments
and live character/four-class/remote-animation QA. Fresh public manifest, login
label/versioned main asset and backend all return **HTTP 200 / Alpha 1.0.41 /
9c6eb9d20ad5171a5bb18240612b0998aba25d28**, health `ok` / database `ready`.
Staging is clean, remote master matches that SHA, and ancestry to 42 is checked.
Explicit **release/42-with-forge-pointer → origin/master** push **1718** succeeds;
new CI **34166841477 / ea565ebfdedb52fff7841e0fd4d650febd3d20da** is active.
Next publisher is **43 / 7523d0bb…**, strictly gated on all 42 CI/deploy/live jobs
and a fresh exact public 42 identity check. No root/master or later version pushed.

50 final anonymous **38023** closes **SUCCESS / 75 / 8.6m**, log
`/tmp/eidolon-50-final-anonymous.log`. Final exact-package fresh-collection run is
started against clean **4212e54**; log
`/tmp/eidolon-50-final-fresh-collection.log`. It is the sole owned browser; freeze
loot-frequency worktree while active. Final evidence/ref/root integration remain
pending; prior 14.2m earned readiness and full runtime tests remain unchanged.

Investigation browser controls/diagnostics commit **5554f5b** passes lint; no
new Fire/Air browser run yet. Added Ilyra greeting continuity **409da01** reflects
completed repair/portal/finale IDs instead of treating returning optional-lore
players as if they had not saved the world. Empty/unclaimed quest state does not
declare victory. Four regressions fail before the fix **1.427s**, all 13 relevant
tests pass afterward **1.447s**, lint passes. Full client **63085** closes
**SUCCESS / 219 suites / 3,256 tests / 131.314s**, log
`/tmp/eidolon-investigations-continuity-client.log`. Runtime/graph remain isolated.
Historic catch-up acceptance/completion speeches still need continuity review;
the greeting fix is not completion of that wider review.

## Historical checkpoint — September 7, 22:24 UTC

Routine equipment is packaged locally as **Alpha 1.0.50 / 4212e54**, isolated
`work/loot-frequency-20260907`. Patch notes and active version fields agree.
Package verification passes **251 contracts / 2.387s**, full client **217 suites /
3,213 tests / 137.407s**, lint and root server **17.940s**. Full runtime race checks
previously pass root **15.507s**, game **360.700s**. A new production party pickup
test passes three race repetitions **1.846s**: personal fragments remain separate,
one elite gear drop retains master-looter ownership, failed/full-bag pickups keep
the world item and successful pickup cannot duplicate it. Final package anonymous
browser **38023** is active, log `/tmp/eidolon-50-final-anonymous.log`; **sole owned
browser, freeze loot-frequency worktree until terminal**. No final release ref,
root merge or public 50 deployment yet.

Earned `fresh-ready` **58746** closes **SUCCESS / 1 / 14.2m** with credential scan
and cleanup passing. Collection yields exactly eight fragments, 12 observed
target deaths, five picked-up equipment items worth 80 unsold vendor gold and no
deaths; explicit turn-in/reconnect retains gear rolls and leaves level 17 with
the level-30 Guide locked. Optional Skeleton and Imp hunts then earn level 34
and unlock the Guide, with **three player deaths** across both hunts. Real
preparation uses common earned equipment, Control & Utility, Fireball mastery,
Arcane Shield and kiting. The 50,000/150,000 XP daily rewards cause large level
jumps (18→27 / 29→34); these remain balancing work, not a sign-off. This is not
required non-daily leveling or a new-player duration estimate.

Investigation head **cf4125d** generalizes the Water route for Fire/Air and adds
saved journal rereading. Fire **35656** fails **3.7m** after earning Hessa's ledger,
dying before cold-ash inspection. Removing a test-only restriction on fighting
the command anchor leads to **48744**, which closes **FAIL / 3.6m**: player alive
at 2,071/2,575 HP, but the walking-only retreat helper rejects all ground targets
covered by hostile models. Actual screenshot is inspected/preserved at
`/tmp/eidolon-fire-covered-retreat.png`; both runs pass credential scan/cleanup.
Next prepared test allows the same ordinary Ctrl-click jump as travel and reads
the actor's actual `stats.hp` for the anchor death/respawn check. No difficulty,
damage, discovery grants or live-player state changes. Fire/Air remain unverified;
23-chapter runtime remains isolated. Water 6.6m evidence remains valid and copied
to `/tmp/eidolon-water-proof-hiXbJx` before subsequent browser artifacts replace it.

41 **9c6eb9d… / CI 34163174335** has passed both deployments and is running live
gameplay QA. Next publisher remains **42 / ea565ebf…**, gated on every 41 job
passing and fresh exact manifest/login/backend identity. Last fully verified
public release is 40. Full roadmap and coordinated XP/gold/pacing, rarity and
late-forge affordability remain open.

## Historical checkpoint — September 7, 21:55 UTC

Water's prepared desktop route **6729** closes **SUCCESS / 1 / 6.6m**. Both
investigations are accepted, earned through normal travel/field interactions,
manually rewarded and saved across reconnect with masks **1 / 7**, gold and
cap-only Resonance. Prior dungeon completion remains and the first raid is not
completed. All actual earned screenshots are inspected; credential scan/cleanup
pass. Ordinary defensive play engages eight pursuers near the moving pool and
twelve near the bell; these are engaged targets, not audited death totals.
The eight-damage common-staff fixture and actual Control & Utility selection/
Arcane Shield/kiting are the successful route. Ten-second normal enemy respawns
and pressure while reading remain fresh-player pacing concerns. Post-reconnect
Water journal opening and Fire/Air's four chapters/ordered Fire fight remain open.
Water proof/helpers are committed **fc50cfc**, isolated investigation tree clean,
lint/diff checks pass (83438 closed). Root still does not activate the 23-chapter
graph. All investigation browser handles are closed.

Routine equipment candidate full backend **60005** closes **SUCCESS**, root
**15.507s**, game **360.700s**, other packages green. Added exact enumeration of
**54,872 elite-pool combinations** confirms **2.84210526 → 0.99985421** equipment
per elite with both material candidate totals unchanged at **4,332**. Three
repetitions of these and the production/boundary tests pass **30598 / 2.639s**;
log `/tmp/eidolon-routine-loot-exhaustive.log`. Runtime/design evidence is committed
**aaecc0180444459931216216daf66dff8c4e3bdb**, still isolated and not versioned.

An earned-route measurement/reconnect check is committed as **49ac0c7**. It logs
actual bag equipment, rarity/stat/value rolls, occupied slots and unspent gold;
reported vendor values are not sale income. `node_modules` links to root and
client assets are prepared. Lint/diff checks pass. Actual **fresh-ready** run
**58746** is active against clean candidate 49ac0c7, log
`/tmp/eidolon-routine-loot-earned-readiness.log`. **This is the sole owned browser;
freeze the loot-frequency worktree until terminal.** Collection/handoff portion
already passes: eight exact fragments, 12 observed target deaths, no player deaths,
five equipment pickups worth 80 vendor gold (not sold), saved gear rolls intact;
manual 8,000 XP/100 gold leaves level 17 with level-30 Guide correctly locked.
Collection/handoff portion is 74 seconds. Longer earned hunt/preparation checks
are still running. This route uses optional daily hunts; even a pass does not
prove the required non-daily leveling path or complete economy balance.

41 **9c6eb9d… / CI 34163174335** remains in predeploy character QA after successful
client/server/browser checks. Do not publish 42 before every 41 deployment/live
job and fresh exact identity pass. Last fully verified public build is 40.
Full roadmap, XP/gold tuning, equipment usefulness/affordability, rarity power,
late potency and all remaining story/release gates stay open.

## Historical checkpoint — September 7, 21:48 UTC

This turn makes concrete progress: actual Water discovery/encounter evidence and
an isolated routine-equipment frequency candidate, with a reproduced production
loot excess and passing repeated regressions. The full roadmap remains active.

Water **59985** closes failure after **3.3m**: the actual flood-shelter diary is
reached, inspected and earned; its approach/reading images are inspected. The
following still pool is physically present/in range, but three pursuing Mountain
Trolls cover its clickable geometry (actual hover/hit-list diagnostic). Preserve
`/tmp/eidolon-water-first-earned-ledger.png` and
`/tmp/eidolon-water-covered-pool.png`. No hostile-priority bypass is introduced.
The next route **7160** adds ordinary left-click/basic and right-click/Fireball
combat before inspection, then fails because the character dies. Both failed
runs finish credential scan/cleanup; logs
`/tmp/eidolon-investigations-water-earned.log` and
`/tmp/eidolon-investigations-water-field-combat.log`.

Third actual Water run **6729** is active, log
`/tmp/eidolon-investigations-water-defensive-route.log`. It selects Control &
Utility through the real Skills UI, uses actual Arcane Shield and ordinary
kiting, and corrects the fixture's staff from an arbitrary 100 damage to the
current common level-100 formula **round(12 × 16 / 25) = 8**. Canonical level-100
base stats and the nine explicitly seeded old milestones remain; it is not fresh
leveling or a claim of earned initial gear. Investigation branch 0262488 has two
uncommitted browser-helper/test changes, lint passing. **Freeze this worktree;
6729 is the sole owned browser.** The reading fix c14388b stays intact. Remaining
Water completion, Fire/Air chapters, actual ordered Fire fight and wider placement
quality remain unverified.

New isolated worktree **`/tmp/eidolon-loot-frequency-V09L3M`**, branch
`work/loot-frequency-20260907`, starts from root deede2e. Candidate retains 60%
of ordinary equipment candidates (40% fewer gear drops) and at most the first
equipment result from a non-boss elite. It preserves every material candidate,
dedicated material/gem rolls, personal quest drops and all recognized boss
rewards. Retained gear is not rerolled for rarity and existing inventory is not
changed. Current pool expectations: equipment **0.47368 → 0.28421** ordinary,
**2.84211 → 0.99985** elite; 25 empty bag slots imply approximately **53 → 88**
ordinary or **9 → 25** elite kills for gear alone. Material supply stays unchanged.
Exact accounting/design and open gates are in that worktree's
`docs/plans/2026-09-07-routine-equipment-budget.md` (not yet root-integrated).

The actual asynchronous production death test reproduces **57 equipment from 20
elite kills** before tuning, using 20 personal guaranteed-fragment publications
as its completion barrier. Red run **45706** closes **FAIL / 0.415s** as expected;
log `/tmp/eidolon-routine-loot-before.log`. After filtering before world publication,
the same route yields one QA-guaranteed gear piece per kill. Boundary, deterministic
10,000-roll, material/boss/QA, personal-fragment and pickup/instance checks pass
three race repetitions **49754 / 5.726s**, log `/tmp/eidolon-routine-loot-after.log`.
Full race **60005** is active, log `/tmp/eidolon-routine-loot-server.log`, root
package already passing **15.507s**. **Freeze that candidate's runtime/tests while
it runs.** Source/docs remain uncommitted and unpublished; further distributions,
earned gearing/affordability, packaging and sequential gates are required. This
does not close XP, gold, rarity power, late potency or the broader economy pass.

41 **9c6eb9d… / CI 34163174335** now has client/server/browser success;
predeploy character QA is active at last poll. Next publisher remains 42 only
after every 41 CI/deploy/live job and a fresh exact public-41 identity pass.
Last fully verified public build remains **Alpha 1.0.40 / 008ee7d…**. Root's locally
verified 49 package is not permission to skip the queued releases.

## Historical checkpoint — September 7, 21:31 UTC

Phone earned reading run **84495** now closes **SUCCESS / 1 test / 48.8s**
(test 47.4s), including actual landscape swipes until the final diary line is
inside the scrollport and unobscured, manual turn-in and saved rereading.
Credential scan/cleanup pass. Both actual screenshots are inspected and copied
to `/tmp/eidolon-earned-diary-reading-390.png` and
`/tmp/eidolon-earned-diary-reading-844.png`. These retain the explicit level-30
functional fixture and QA performance overlay; not fresh pacing/device evidence.

The isolated journal fix, browser red/green regression and phone reading proof
are committed as **c14388b**. The new ordinary Water travel/returning-character
test and isolated route are committed separately as **0262488**, with lint,
shell syntax and diff checks passing. Investigation worktree is clean. Actual
Water route **59985** is active against that exact commit, log
`/tmp/eidolon-investigations-water-earned.log`; its local containers are ready
and Playwright is running. **This is the sole owned browser. Freeze investigation
runtime/tests while it runs.** Water completion remains unproven.

41 **9c6eb9d… / CI 34163174335** remains active: client success, server running
at last poll. Full live-40 gate and fresh exact identity are established below;
next publisher remains **42 / ea565ebf…** only after 41's complete gate. Root
49 integration and its local package evidence remain valid but unpublished.
No expansion/root merge or completion claim for the broader goal.

## Historical checkpoint — September 7, 21:27 UTC

This goal turn makes concrete progress: closes 49's local sweep, integrates its
verified package, reproduces and fixes a real browser reading-position defect,
and advances the sequential release queue after a fully successful live gate.
**The full roadmap and broader balancing/story scope remain incomplete.**

40 **008ee7d3bb2b2017cea012006935897066629a49** CI **34159297803** is terminal
**SUCCESS, every job**, including Live Release and Character QA. Fresh no-cache
public checks immediately before publishing 41 return HTTP 200: manifest and
login/versioned main script match **Alpha 1.0.40 / 008ee7d…**; backend matches
that exact version/commit with `status: ok`, `database: ready`.
Remote master is verified at 008ee7d and ancestry to 41 is checked, then only
`refs/heads/release/41-with-forge-pointer:refs/heads/master` is pushed.
Push **45226** closes successfully. **41 / 9c6eb9d20ad5171a5bb18240612b0998aba25d28**
CI **34163174335** is active. Next publisher is
`release/42-with-forge-pointer / ea565ebfdedb52fff7841e0fd4d650febd3d20da`, only
after every 41 CI/deploy/live job succeeds and fresh exact public-41 identity.
Never publish root/master/HEAD or skip the sequential queue.

49 unchanged anonymous rerun **82828** closes **SUCCESS / 75 tests / 8.8m**.
The earlier network-interrupted sweep and trace remain preserved. Final evidence
commit **514702753d851f482b8b77656f06d4f71d678b0b** is saved on
`release/49-personal-fragment-budget` and its work branch. Root merges this
locally verified package as **31aff63**, with **250 integration contracts / 1.774s**
(19507 closed). Root now says Alpha 1.0.49 but **is not published**. Release 49
still waits for 41–48's gates and its own CI/deploy/live checks. Its active story
remains 15 chapters; the investigation graph is still isolated.

Investigation full client **63653** closes **219 suites / 3,252 tests / 145.889s**,
lint passes. Backend coverage remains root **16.127s**, game **396.729s** as
recorded below. The reading fix has an actual-browser red/green proof: with the
old ordering a later open multi-paragraph diary jumps **671 → 486 pixels**;
with the fix the same fixture retains its position across three rebuilds and
passes **1 / 4.2s** (test 2.9s), handle **8694** closed. Actual failed trace is
preserved at `/tmp/eidolon-reading-scroll-clamp-before-trace.zip`. Logs
`/tmp/eidolon-investigations-reading-browser-before-long-record.log` and
`/tmp/eidolon-investigations-reading-browser-final.log`. Earlier fixture attempts
first omitted an objective/target, then used a short record which passed even
with the old ordering; neither is evidence for the fix. The strengthened fixture
uses real Earth/Water record text and is added to the anonymous browser suite.

Actual earned phone diary touch-scroll-to-final-line run **84495** is active,
log `/tmp/eidolon-investigations-phone-reading-final.log`. This is the sole owned
browser; freeze the isolated investigation runtime/tests until it finishes.
Water catch-up field travel is newly authored with an explicit disposable
returning-character fixture, canonical level-100 Wizard stats and only the nine
old dungeon milestones seeded. No investigations/raids are granted; normal
acceptance, travel, prop interactions, manual rewards and reconnect are required.
The new `water-investigations` route has lint/shell syntax checks but **has not
run yet**. It is not fresh-character pacing evidence. Isolated source is still
uncommitted; remaining Water/Fire/Air playtests and coordinated XP/gold/loot
tuning stay open.

## Historical checkpoint — September 7, 21:18 UTC

40 `008ee7d` CI **34159297803** now has client/server/browser, predeploy
character QA, input validation and both deployments successful. **Live Release
and Character QA remains in progress**. Do not publish 41 until that terminal
success and a fresh exact public-40 identity check. Earlier live-39 evidence is
historical, not a claim that 40 has passed its full gate.

49 final anonymous handle **46704** is closed: **74/75 pass, 10.1m**. The one
failure occurs before layout assertions when dynamic imports encounter
`net::ERR_NETWORK_CHANGED`; the actual trace identifies simultaneous local-module
load failures, not a demonstrated layout regression. It is preserved at
`/tmp/eidolon-release49-network-change-trace.zip`. Unchanged full rerun **82828**
is active, log `/tmp/eidolon-release49-anonymous-rerun.log`; freeze package c0a6910.
No final-49 integration/publication yet. This is the only owned browser run.

Investigation combined backend **90803** is closed with **SIGTERM/143**, root
package passing **16.127s** but no game result. No Go child remained; the cause
of termination is unknown, not established OOM or test failure. Game-only verbose
rerun **83699** is now closed and **passes race / 396.729s**; log
`/tmp/eidolon-investigations-combined-game-rerun.log`. Combined runtime 84abecf
therefore has passing package coverage, without claiming the terminated invocation
itself passed.

Further isolated reading QA finds an ordering defect for a later open field
record: restoring scroll before expanded height can clamp the saved offset.
A modeled-browser regression reproduces **500 → 100 / 1.426s**; moving scroll
restoration after disclosure restoration passes **19 focused checks / 1.457s**.
The first one-record control passes because the legacy archive selector already
opens that first disclosure; the corrected regression covers a later record.
Logs `/tmp/eidolon-diary-scroll-before-second-record.log` and
`/tmp/eidolon-diary-scroll-after.log`. New real-browser layout coverage and actual
landscape diary swipe-to-final-line checks are authored but **not yet run**.
Full isolated client/lint **63653** is active, log
`/tmp/eidolon-investigations-reading-client.log`. These changes remain uncommitted
and isolated; do not merge the 23-chapter graph into root. Remaining realms,
ordered Fire fight, broader progression/economy and the full roadmap stay open.

## Historical checkpoint — September 7, 21:00 UTC

The preceding goal turn made concrete progress: real Earth discovery play,
phone interaction support, a reproduced/fixed surplus-drop defect and a separate
49 package. **Full roadmap and economy/story expansion remain incomplete.**
40 `008ee7d` CI **34159297803** currently has client/server/browser success and
predeploy character QA active; no deployment or live-40 success is claimed.
Last fresh public identity remains **Alpha 1.0.39 / 7ddf776e…**, healthy/ready.
Next publisher is still `release/41-with-forge-pointer / 9c6eb9d…`, only after
all 40 CI/deployment/live checks and fresh exact public identity succeed.
Do not publish root/master/HEAD or skip queued releases.

### Personal fragment limits and Alpha 1.0.49

Runtime **`b01d3c562e5f9fde0de128f9b6c1047a4ebeab7f`** is root-integrated by
fast-forward. It bounds personal quest drops using actual matching owned world
stacks, with roll/budget/publication under one world→player lock transaction.
The real asynchronous death test reproduces **20 drops with one needed** per
solo/party recipient before the fix (**0.593s**) and passes three times afterward
(**3.576s**). Lifecycle/collection race repeats pass **8.929s**; full backend race
passes root **12.795s**, game **302.674s**. Ten-thousand-entity source-operation
benchmark **0.240–0.255ms** is not a server concurrency-capacity claim.

The isolated worktree `/tmp/eidolon-quest-loot-1i4saA`, branch
`work/chronicle-loot-budget-20260907`, is clean at package
**`c0a6910c1f6e1cb02e0b04c08ba8d407d5361f2e`**. Version/patch notes align to
**Alpha 1.0.49 (only the fragments you need)**. Package contracts pass
**250 / 2.957s**, full client **217 / 3,212 / 201.597s**, lint, quest-related
race checks **3.626s / 11.243s**, and the actual fresh collection route **2.3m**:
exactly eight physical fragments, 20 observed target deaths, zero player deaths,
manual consumption/reward and saved reconnect. Unchanged 8,000 XP/100 gold still
leaves the player at 17 with the level-30 Guide correctly locked; broader pacing
is not signed off. The actual ready image is inspected and copied to
`/tmp/eidolon-release49-earned-collection-ready.png` before the next browser run.

Final anonymous sweep **46704** is active, log
`/tmp/eidolon-release49-anonymous.log`. Freeze this package while it runs. The
earlier fresh/browser/client/backend handles are closed. **Do not merge/package
as final or publish 49 before this sweep and its preceding release gates pass.**
Full evidence is in [the fragment budget](2026-09-07-personal-fragment-budget.md).

### Isolated investigation expansion

Latest release-48 corrections merge into the expansion at **93f0162** and pass
**276 focused checks / 4.148s**. The complete earned Earth chain now passes
**3.6m**: diary, eight seeds, all three scar discoveries, explicit turn-ins and
saved dungeon handoff. Final level 17, 16 observed target deaths, no deaths;
collection/scar/handoff portion 138 seconds. Log
`/tmp/eidolon-investigations-earned-earth-travel.log`. Roaming enemies cover the
first failed route's ground clicks; the successful route permits the existing
ordinary jump fallback, not teleport/protection/quest grants.

Phone USE previously handled only vendors. It now retains nearby loot priority
and uses ordinary interactions/ranges for other services and readable discoveries;
dead players cannot activate it, and interactables get a pointer cursor. Focused
checks pass **42 / 1.759s**, full client **219 / 3,251 / 138.491s**, lint.
Touch route passes **1 / 1.3m** (test 1.2m), log
`/tmp/eidolon-investigations-phone-town-route.log`: joystick travel, actual USE
inspection, journal at 390×844 and 844×390, manual completion and saved rereading.
Both actual screenshots are inspected. This uses an explicit level-30 fixture,
not fresh progression or physical-device performance evidence. Failed travel
diagnostics identify the merchant stall on the direct path; routing around its
south side preserves all collisions. No bypass is introduced.

Implementation **645ed36** is committed. The verified fragment-limit runtime is
merged into it as **84abecf**; combined full backend race **90803** is active,
log `/tmp/eidolon-investigations-combined-server.log`. Root still has only the
dormant foundation and 15-chapter active chain; the expansion remains isolated.
Remaining six Water/Fire/Air chapters, actual ordered Fire fight, landscape
diary touch-scroll-to-end, wider placements and coordinated reward tuning remain
open. All prior owned investigation browser/client handles are closed.

## Historical checkpoint — September 7, 20:30 UTC

Isolated world-integration commit **`f1f7919bd6302728f86e7ec0868cf486b5816344`**
is saved clean on `work/chronicle-investigations-20260907`; it is not merged
to root or release branches. Final lint/generated-content/diff checks pass.
The first actual diary route **65713 passes 1 / 1.2m**. A fresh level-one Wizard
earns the opening normally, accepts Mara's investigation, walks to its cottage,
clicks visible real prop geometry, reads the server-confirmed journal, completes
manually at Ilyra and reconnects with the completed quest/level intact. No grants
or hostile-priority bypass. The actual approach/journal PNGs are inspected.
Log `/tmp/eidolon-investigations-diary-visible-prop.log`; credential scan and
disposable cleanup pass. All local browser/full-client/full-server handles are
closed. The first three failed diary attempts remain recorded below.

Opening reward 500 XP/100 gold produces level 5; diary reward 1,000 XP/25 gold
produces level 8; automated route elapsed 71 seconds. This is not a new-player
timing estimate or final balance approval. Remaining seven investigation chapters,
touch readability, actual Fire combat, reconnect rereading and coordinated
progression/economy tuning remain open. Full local client **219 / 3,238 /
163.896s**, full server race **16.818s / 307.701s** and lint pass for this
isolated runtime; subsequent changes only affect browser travel/picking helpers.

Root merges the new queued 48 correction as **`6f5e69a`** and passes
**256 integration checks / 5.505s**. Root still has only dormant story foundation,
not the isolated 23-chapter expansion. Staging is clean on
`release/48-with-forge-pointer / c83b626`; next publisher remains exact 41
`9c6eb9d20ad5171a5bb18240612b0998aba25d28` after 40's complete success gate.
40 CI **34159297803** currently has client success/server active; no deployment
success or live 40 claim. Last fresh public identity remains healthy/ready 39.

## Historical checkpoint — September 7, 20:28 UTC

**New 40 `008ee7d3bb2b2017cea012006935897066629a49` is pushed; CI
`34159297803` is queued/active.** Its test-only Forge pointer/retry correction
passes the actual isolated Forge route **1 / 14.2s** (test 13.0s), lint and
credential scan/cleanup. No game runtime changed from `e7a07b6`.
Fresh public HTTP 200 manifest/login/versioned-main/backend checks before push
still match `7ddf776ef18caa0763eedeb8d5a0d7f25afdcd4d` / **Alpha 1.0.39** and
healthy/ready. Prior CI `34156520169` failed and all its deployments skipped.
No 40 live claim. Gate 41 on all new 40 CI/deploy/live jobs succeeding plus
fresh exact public identity; next publisher is explicitly
`release/41-with-forge-pointer`, **not root/master/HEAD**.

The correction is carried through preserved new release refs; all contract
checks pass (version, isolation, versioned assets and landing):

| Version | Branch suffix `-with-forge-pointer` commit | Checks |
|---|---|---|
| 41 | `9c6eb9d20ad5171a5bb18240612b0998aba25d28` | 237 / 2.161s |
| 42 | `ea565ebfdedb52fff7841e0fd4d650febd3d20da` | 238 / 1.836s |
| 43 | `7523d0bb291917da52b2bf145157f88128ba6663` | 240 / 1.865s |
| 44 | `e1c66fddf256327b73b766679105c087e2054b66` | 242 / 1.975s |
| 45 | `91f2a7014a680bb299756c777fdfc50491b08e3c` | 244 / 1.981s |
| 46 | `8d4943c02adf995ae5701deb0c6550516223f86e` | 246 / 2.126s |
| 47 | `965edce3f315fe695aeca83635469be924c8515c` | 248 / 2.018s |
| 48 | `c83b6263acf3c5a6e9eb8f2d7cd26ed242331d60` | 249 / 2.230s |

Investigation full client passes **219 / 3,238 / 163.896s**; full server race
**68729** closes green (root **16.818s**, game **307.701s**). The second diary
route **66245** reaches the site but cannot hover its center. Diagnostic third
run **71050** confirms three Skeletons cover that foundation-center ray;
the actual screenshot shows the reachable cottage, book and player. Runtime
hostile-target priority is correct and is not bypassed. The route now tries
visible real prop geometry; fourth run **65713** is active, log
`/tmp/eidolon-investigations-diary-visible-prop.log`. Prior diagnostic log
`/tmp/eidolon-investigations-diary-hover.log`, actual image inspected at
`/tmp/eidolon-investigations-Ock9zw/test-results/fresh-opening-gameplay-fre-bfa75-ng-Chronicle-without-grants/approach-mara_diary.png`.
All earlier local handles are closed. Investigation runtime remains frozen for
this owned browser; expansion is still isolated/unreleased.

## Historical checkpoint — September 7, 20:19 UTC

**40 CI `34156520169` fails; all deployments/live jobs are skipped.** Client,
server and browser smoke pass. Predeploy passes the corrected Lunge and preceding
routes, then Forge's projected click leaves the player outside interaction range
with no pending interaction. Its retry separately attempts to register the
already-created username. Log `/tmp/eidolon-release40-e7-failed-ci.log`.
Do not publish 41 or claim 40 live. Last exact verified live remains 39.
Staging now holds `work/release40-forge-hit-20260907` based on `e7a07b6`, with an
uncommitted test-only correction: await settled camera and actual Forge hover,
and register a fresh retry account. Lint passes; actual rerun is pending the
owned investigation browser. Existing 41–48 release refs are unchanged/preserved.

The isolated graph's final full game rerun **61937 passes 242.722s** and closes.
Further uncommitted investigation work connects authenticated inspection,
ordered personal state/discovery acknowledgements, earned journal opening and
actual Fire anchor death/party credit. Targeted race repeats pass root **2.121s**,
game **1.799s**; further graph/network checks pass **1.912s / 7.472s**.
Fifteen native readable landmarks have ordinary interactions, personal beacons,
three-wall-only building collisions and chunk cleanup. The hardware model gallery
passes **1 / 2.7s** and its actual PNG is inspected; this is not reachability QA.

Site spawning is active only in `/tmp/eidolon-investigations-Ock9zw`. The first
fresh opening passes at level 5/no deaths, but the diary route **69440** fails
to reach 125,200. Its helper issued clicks before walks/camera settled; corrected
helper rerun **66245** is active, log
`/tmp/eidolon-investigations-fresh-diary-settled.log`. First log
`/tmp/eidolon-investigations-fresh-diary.log`. Do not claim diary completion.
Full client **44707** passes **219 suites / 3,238 tests / 163.896s**, lint passes.
Full server race **68729** is active, root already **16.818s**, log
`/tmp/eidolon-investigations-landmarks-server.log`. No other browser is owned;
freeze investigation runtime until its checks close.

Root retains only the dormant foundation and 15-chapter playable chain. No new
balance/story package is released. Full roadmap, coordinated XP/gold/equipment
tuning and remaining earned investigations are materially incomplete.

## Historical checkpoint — September 7, 19:50 UTC

**Corrected Alpha 1.0.40 `e7a07b6` is pushed; CI 34156520169 is active.**
The preceding `34152138480` is terminal failure with all deployments skipped.
After clean staging, exact remote `1106228` and ancestry checks, the new
`release/40-with-lunge-landing` branch is pushed as a fast-forward. Fresh public
manifest/login/versioned-main/backend checks just before publication still
return exact `7ddf776ef18caa0763eedeb8d5a0d7f25afdcd4d` / **Alpha 1.0.39**, HTTP
200 and healthy/ready. No 40 live success is claimed. **Publish 41 only after all
40 CI/deployment/live jobs succeed and a fresh exact public identity check passes.**

40's final local verification passes **203 suites / 2,996 client tests /
122.763s**, full server race root **12.307s** and game **277.331s**, lint, and
**58 anonymous checks / 5.7m**. The first completed sweep passes 57/58 but its
failure collector records `net::ERR_NETWORK_CHANGED` for the external Cinzel
Google Fonts stylesheet; its actual trace is inspected and retained at
`/tmp/eidolon-release40-font-network-change-trace.zip`. The unchanged full rerun
passes every assertion. All owned 40 local handles are closed. Actual Rogue/
Cleric landing/bleed gameplay and complete evidence are in
[the Lunge correction](2026-09-07-release40-lunge-landing.md).

The verified correction and readiness backport are carried through new branches;
old candidates remain preserved. 41 resolves the readiness import by retaining
both `openGame` and its existing touch-scroll helper. All carry checks pass:

| Version | Branch suffix `-with-lunge-landing` | Commit | Contracts |
|---|---|---|---|
| 41 | `release/41` | `a820d9a` | 237 / 1.206s |
| 42 | `release/42` | `9c71a40` | 238 / 1.286s |
| 43 | `release/43` | `fc41641` | 240 / 1.323s |
| 44 | `release/44` | `85e5a62` | 242 / 1.387s |
| 45 | `release/45` | `a2c216c` | 244 / 1.443s |
| 46 | `release/46` | `3cbbd60` | 246 / 1.837s |
| 47 | `release/47` | `9f9bca7` | 248 / 1.840s |
| 48 | `release/48` | `ca14d8d` | 249 / 1.791s |

Root merge **`8aa307e`** passes **269 integration checks / 2.597s**. Staging
`/tmp/eidolon-release37-targeting-lT3Mdt` is clean on the new 48 branch; root is
not a publication target. The next publisher is explicitly the new 41 branch.

### Expanded Chronicle implementation, not released

The separate investigation worktree `/tmp/eidolon-investigations-Ock9zw` now
implements a **23-chapter** graph, interleaving diary → collection → linked
evidence → dungeon in each realm, followed by the original four raids/Vigils,
portal and Dark King. Returning characters retain every accepted/completed
classic milestone and quoted collection payout; missing earlier investigations
become unaccepted optional lore, never silently completed objectives. Tests cover
migration at all 15 classic milestones and idempotent refresh. New investigations
split existing collection XP (1/8 each) and gold (1/4 each), with the collection
retaining the remainder, so fresh realm and total story budgets do not inflate.
This is allocation, not final XP/loot balance sign-off.

Client changes keep required story primary, expose optional lore separately,
track optional quests independently, display the 23-chapter total, and preserve
recorded diary pages, reading state and focus across updates without exposing
undiscovered text. Targeted client checks pass **18 / 1.451s**; full client passes
**217 suites / 3,207 tests / 76.604s**, lint, and migration/discovery/protocol
checks pass three race repetitions (root **1.720s**, game **14.063s**).

The first full backend run **85154** closes with two stale fixture failures:
the root collection setup skipped the newly required diary, and the game turn-in
test expected collection immediately after the opening hunt. The root fixture
now records the diary and turns it in manually before testing bag receipts;
full root rerun **74966** passes **11.770s**, log
`/tmp/eidolon-investigations-expanded-server-root-final.log`. The game fixture
now checks that the actual next diary remains unaccepted, retaining the manual
turn-in requirement. Targeted graph/turn-in checks pass three race repetitions
**3.144s**. The complete game rerun **61937** is active, log
`/tmp/eidolon-investigations-expanded-game-final.log`; original failed game
duration is **247.941s**, not a passing full-game result. Revalidate this exact
new handle. No owned local browser is active. Expanded-graph commit **`9e1b0c4`**
must remain isolated: world rendering, inspect request/acknowledgement, actual Fire
combat credit, site reachability and earned desktop/touch playthroughs are not
integrated yet. Root still contains only the tested dormant foundation and
the existing 15-chapter playable chain.

Full roadmap delivery, coordinated rewards/XP/equipment tuning, late-potency
affordability and eight playable investigations remain open.

## Historical checkpoint — September 7, 19:27 UTC

**Alpha 1.0.39 remains live and healthy.** Corrected 40 CI **34152138480**
finishes with client/server/browser smoke passing, but predeploy character QA
fails: Rogue Shadow Lunge is accepted without visible movement; the retry also
fails real target hover. All deployments and live QA are skipped. Fresh public
manifest, login/main and backend checks at 19:22 return HTTP 200 and exact
`7ddf776ef18caa0763eedeb8d5a0d7f25afdcd4d` / **Alpha 1.0.39**, healthy/ready.
Do not publish 41 or later; 40 must be repaired and pass its complete gate first.

The repair is isolated in staging `/tmp/eidolon-release37-targeting-lT3Mdt`,
branch `work/release40-direct-target-20260907`, based on `1106228`.
Regression tests demonstrate that a short Lunge is moved authoritatively but
ignored by the local prediction deadband. An explicit accepted landing preserves
the aim point and legacy event behavior. Original client regression fails
**4 tests / 1.520s** and server event regression fails **6.246s**; corrected
client **15 / 0.989s**, related server movement/bleed/wall checks **16.036s**.
The first actual browser attempt detects a missing network payload mapping;
that mapper is corrected with a separate wire/zero-coordinate/isolation test,
passing three race repetitions **1.042s**. Actual direct-skills rerun passes
Rogue **21.4s total** and Cleric **14.1s total**, exact accepted landing,
attributed bleed, credential scan and cleanup. Both `92810` and `91656` are closed.

Runtime/notes/tests commit **`c7d07d3`** is followed by status-test readiness
backport **`785bd73`**. Its import conflict is resolved for the older 40 test;
a prematurely started anonymous attempt exits on that syntax error before any
checks run, and is closed. Final staging is clean and lint passes. Full final
checks are confirmed active: client **67547**, server race **83399**, anonymous
browser **24886**, logs `/tmp/eidolon-release40-lunge-full-client.log`,
`/tmp/eidolon-release40-lunge-full-server.log`, and
`/tmp/eidolon-release40-lunge-anonymous-final.log`. Revalidate these exact handles,
do not restart on observation timeout, and keep staging runtime frozen during
its browser test. This is not yet a verified/re-published correction. Earlier
release branches remain preserved and need carry-forward of the eventual
verified correction. Lunge evidence is in
`docs/plans/2026-09-07-release40-lunge-landing.md` on the staging branch;
it has not yet been merged into root.

**Alpha 1.0.48 is locally verified and root-integrated**, not published.
Release branch `release/48-with-combo-observation` is **`e13f512`**; root merge
**`b65295c`** passes **261 integration checks / 3.397s**. Full client passes
**216 suites / 3,198 tests / 149.264s**, full server race root **15.501s** and
game **381.500s**; actual Forge/reconnect **24.4s / 26.4s total**, credential scan
and cleanup pass. The inspected actual image is preserved at
`/tmp/eidolon-release48-forge-accumulated-progress.png`. Final anonymous suite
passes **75 / 9.4m**. The first 74/75 attempt fails on module dependency requests
with `net::ERR_NETWORK_CHANGED`; test-only startup correction `be80c67` uses
existing bounded readiness and passes four sizes twice before the full rerun.
All owned 48 local handles are closed. See [Forge evidence](2026-09-07-forge-earned-scaling.md).

**Investigation foundation `e320427` is root-integrated at `4f45b29`.** Shared
eight-chapter/sixteen-object content, authoritative personal recording, distinct
saved bits, snapshot/BSON/protobuf persistence and ID-based Ilyra replies pass
**217 suites / 3,203 tests / 120.157s**, full server race root **13.400s** and game
**321.451s**, plus lint. Root integration passes **254 checks / 3.249s**.
Worktree `/tmp/eidolon-investigations-Ock9zw` is committed; all its owned checks
are closed. The existing 15-chapter game is still active: no investigation world
spawn, network/combat integration or migration-safe 23-chapter graph is enabled
yet. Do not ship this foundation as playable expanded story. See
[implementation and remaining activation work](2026-09-07-investigation-implementation.md).

The full roadmap goal, coordinated XP/gold/equipment tuning, late-potency
affordability and eight playable investigations remain open. Root/master is an
integration branch, not a sequential publication target.

## Historical checkpoint — September 7, 18:44 UTC

**Alpha 1.0.39 remains fully verified live.** The first 40 run `34150633216`
fails anonymous smoke before deployment; every deploy job is skipped. The phone
composition test reads a transient combo label across separate browser round
trips after measuring it. A connected, atomic geometry/hit-policy observation
retains the runtime's normal 1.8-second expiry and all later tap checks.
The correction passes **9 repeated phone checks / 1.6m** and **222 contracts /
2.458s**; an actual portrait with the Mass Revival label is inspected.
See [40 correction evidence](2026-09-07-release40-combo-observation.md).

After terminal-failure, clean staging, exact remote and ancestry checks,
`release/40-with-combo-observation` / **`1106228`** is pushed as a fast-forward.
Fresh manifest/backend checks still return exact 39 and healthy/ready. New CI
**34152138480** is active. **Do not publish 41 before all corrected 40 CI/live
jobs succeed and a fresh exact public identity check passes.**

The test-only correction is carried through new sequential branches; old
candidates remain preserved. All owned carry-forward handles are closed.

| Version | Branch suffix `-with-combo-observation` | Commit | Contracts |
|---|---|---|---|
| 41 | `release/41` | `3daa489` | 226 / 1.416s |
| 42 | `release/42` | `74f5a5e` | 227 / 1.641s |
| 43 | `release/43` | `837c490` | 229 / 1.555s |
| 44 | `release/44` | `bea516d` | 231 / 1.811s |
| 45 | `release/45` | `95e4864` | 233 / 1.666s |
| 46 | `release/46` | `101f9ab` | 235 / 1.827s |
| 47 | `release/47` | `e8a40d3` | 237 / 1.622s |

Root integrates this queue at `a39eab3`, and the measured loot/Forge audit
(`6172111`, evidence `1fddd1e`) at **`7a20386`**. Runtime remains local 47;
root is not the publication target. The next balance implementation fixes lost
Forge stat precision and batch pricing, with persisted metadata and matched
previews. See [Forge work and exact active handles](2026-09-07-forge-earned-scaling.md).
The Forge runtime **`9695add`** now preserves precision in both auction mappers;
the original auction regression fails **0.234s**, and the corrected Forge/trade/
snapshot set passes three race repetitions **10.146s**. Initial full regression
passes **216 suites / 3,197 client tests / 124.202s**, full server race (root
**18.301s**, game **298.426s**), and actual Forge/reconnect **17.9s / 19.6s total**.
The actual image is inspected and independently preserved. These initial owned
handles are all closed; they are not final versioned-package evidence.

The isolated worktree merges corrected queue/root ancestry at `d055ccb` and
packages **Alpha 1.0.48 `2f365d0`**, with **every shard counts** patch notes and
aligned version defaults. Contracts pass **239 / 1.302s**. Final checks are
confirmed active: client `57233` (`/tmp/eidolon-release48-client.log`) and server
`46715` (`/tmp/eidolon-release48-server.log`). Actual packaged Forge `97542`
finishes **24.4s / 26.4s total**, with saved item/precision, guide choices,
credential scan and disposable cleanup passing. Its actual image is inspected
and copied to `/tmp/eidolon-release48-forge-accumulated-progress.png` before the
next suite. Final lint also passes; both those handles are closed.

The final anonymous suite is now confirmed active as owned handle **`8402`**,
log `/tmp/eidolon-release48-anonymous.log`. Revalidate these exact handles; do
not restart them on an observation timeout. Only one owned local browser may
run at once. No 48 release branch, root integration or publication is claimed
yet. The broad goal, reward tuning and eight playable investigations remain open.

## Historical checkpoint — September 7, 18:11 UTC

**Alpha 1.0.39 `7ddf776` is fully verified live.** CI **34146247683**
has terminal success for every job, including both deployments and live character
QA. Fresh checks in this checkpoint return HTTP 200 for manifest, login and
backend; all match `7ddf776ef18caa0763eedeb8d5a0d7f25afdcd4d`, **Alpha 1.0.39**,
with backend healthy and database ready.

After clean staging, exact remote-head and ancestry checks, **1.0.40 `8328637`**
is pushed explicitly from `release/40-with-runtime-readiness` to `origin/master`.
CI **34150633216** is queued. No 40 live success is claimed. Publish 41 only
after every 40 CI/live job succeeds and a fresh exact public identity check passes.

**Alpha 1.0.47 is locally verified and root-integrated**, not published.
Evidence/queued branch `release/47-with-runtime-readiness` is **`06f623f`**;
root merge **`3ac9b7d`** passes **237 integration contracts / 1.621s**.
Final package `f18dfcb` passes **215 suites / 3,187 client tests / 156.667s**,
lint, full server race (root **19.922s**, game **330.735s**), and **75 anonymous
browser checks / 7.9m**. The actual earned fresh collection route passes twice;
the final repeat takes **110 seconds** collecting eight fragments, with no
deaths, manual completion and saved progress after reconnect. Its actual ready
conversation is inspected and copied to
`/tmp/eidolon-release47-earned-collection-ready.png`. All owned local handles,
including the anonymous sweep and root integration, are terminal success.
See [collection evidence](2026-09-07-collection-pacing.md).

The new collection rules, save migration, concurrency repair and weekly full-bag
source-accounting correction are included in 47. Broader XP/gold/equipment
tuning, surplus uncollected quest drops and playable investigations remain open.
All eight investigation conversations and journal entries are authored as a
draft, not implemented world interactions. Root/master remains an integration
branch and must not be pushed as the next sequential release.

## Historical checkpoint — September 7, 17:06 UTC

This checkpoint supersedes the historical release-status paragraphs below.
**Alpha 1.0.38 `9ed011b` is fully verified live.** CI **34141178711** completes
successfully with every job passing, including predeploy and live character QA.
Fresh checks at **17:06:45 UTC** return HTTP 200 for public manifest, login and
backend; manifest/versioned-main/backend all match exact commit
`9ed011b3a32b92ac6c8b24ae73cb6f217c2e7cd9`, label **Alpha 1.0.38**, backend
healthy and database ready.

After clean staging, exact remote-head and ancestry checks, **1.0.39 `7ddf776`**
is pushed from `release/39-with-runtime-readiness` to `origin/master`. CI
**34146247683** is queued. No 39 deployment or live success is claimed yet;
40 must wait for every 39 CI/live job and fresh exact public identity to pass.

The existing tested HUD runtime-readiness helper is backported through a new
sequential queue. Old candidates are retained. 39–43 differ only in that test
file from their prior candidates; final 45's tree is identical to `82f01c6`.
All seven version/default/landing carry-forward checks pass; no local test
process remains active from the earlier carry-forward loop.

| Version | Queued branch | Commit | Carry-forward tests |
|---|---|---|---|
| 1.0.39 | `release/39-with-runtime-readiness` | `7ddf776` | 222 / 3.276s; pushed |
| 1.0.40 | `release/40-with-runtime-readiness` | `8328637` | 223 / 2.315s |
| 1.0.41 | `release/41-with-runtime-readiness` | `daaec74` | 224 / 2.238s |
| 1.0.42 | `release/42-with-runtime-readiness` | `bcf3f98` | 225 / 2.224s |
| 1.0.43 | `release/43-with-runtime-readiness` | `7eb1d1f` | 227 / 2.420s |
| 1.0.44 | `release/44-with-runtime-readiness` | `7c3d0be` | 229 / 2.287s |
| 1.0.45 | `release/45-with-runtime-readiness` | `7ceb61d` | 231 / 2.497s |

Root integrates 45 and the new queue ancestry, but is not the publication target.
45 package `71c0158`, evidence `82f01c6`, passes **214 suites / 3,173 tests /
163.807s**, lint, backend-root race **31.359s**, **65 anonymous checks / 8.0m**,
and actual versioned Shield gameplay **44.4s**, scan and cleanup. The final actual
portrait is inspected. See [compact status evidence](2026-09-07-compact-status-details.md).

The isolated entrance follow-up at `/tmp/eidolon-entrance-visibility-vPO24x`
implements a localized depth-correct cutaway (`d8a5361`). After rejecting whole
building transparency and an alpha-depth regression, it passes **10 GPU checks /
50.4s**, **215 suites / 3,183 tests / 129.07s**, lint and real cutaway/combat/town
restoration **47.7s**, scan and cleanup. Actual landscape imagery is inspected.
That earlier packaging state is superseded by the completion checkpoint below.

### 46 locally verified and integrated; balancing implementation begun

**Alpha 1.0.46** package **`2fe9cb2`**, evidence/queued branch
**`release/46-with-runtime-readiness` / `80ac065`**, completes all local checks:
**236 contracts / 1.788s**, **215 suites / 3,185 tests / 126.31s**, lint,
backend-root race **12.231s**, **75 anonymous browser checks / 8.2m**, and actual
packaged cutaway/combat/town-return gameplay **41.5s / 42.9s total**. Credential
scan and disposable cleanup succeed; the actual landscape image is inspected.
All owned local handles are closed. Root integration passes the same 236
contracts **1.337s**. See [entrance evidence](2026-09-07-entrance-visibility.md).
This is local Alpha 1.0.46, not the public version.

39 CI **34146247683** now passes client/server/browser smoke and runs
predeployment character QA. No 39 deployment/live success is claimed; the next
publish remains `release/40-with-runtime-readiness` only after its prior release
fully passes CI/live and exact public identity checks. The last exact public
verification remains 38 at 17:06:45 UTC above.

The new [progression baseline](2026-09-07-progression-pacing-baseline.md) and
production-path audit (`850fee2`) are integrated in root. Actual boss receipts
show a level-30 solo character receiving **2,000,310 XP / level 30 → 46** from
one boss reward; early story payouts alone reach level 16. The curve then grows
to billions of XP per level late in the game. Collection sweeps establish a
65% ordinary / guaranteed guardian rate, four required items and 6.15 expected
ordinary kills. This is measured reward logic, not a new earned playthrough or
sign-off on balance. The audit passes race **5.535s**, then three repeats
**9.039s**. Numeric reward tuning is still open.

Branch `work/progression-balance-20260907` in
`/tmp/eidolon-progression-balance-LQRg5a` additionally fixes weekly full-bag gold
source undercount (`3f62935`): **60,000 received / 50,000 recorded** reproduces
in **0.665s**, and the corrected weekly/quest/cap/pacing checks pass three
race-enabled repetitions **14.208s**. Payouts remain unchanged. This runtime
change is not root-integrated or packaged yet; the balance worktree has merged
the verified 46 ancestry. The broad XP/loot/quest/investigation work remains
open. A nonblocking question asks the player for desired first-dungeon pacing;
1–2 hours is a provisional design target, not measured or approved sign-off.

## Scope addition — September 7

### Collection implementation continuation

This supersedes the earlier statement that balance implementation was limited
to accounting. Worktree `/tmp/eidolon-progression-balance-LQRg5a` implements
eight-fragment / 35% collections with a fifth-eligible-kill guarantee, retained
legacy accepted contracts, and snapshot/BSON/login persistence. Runtime
`f66f50d` passes **3,185 client tests / 169.239s**, full game race **354.829s**
and earned fresh collection **2.5m**. A subsequent targeted concurrency probe
finds a real refresh/drop-state race (**0.968s**); player locking and response
snapshot corrections pass ten race repetitions **6.762s**, related game checks
**6.055s**, root **13.627s**, and five dispatch/combat repetitions **4.199s**.

Package **Alpha 1.0.47 `f18dfcb`** adds distinct **fragments worth finding** notes,
aligned defaults and a fresh-character collection route in full predeploy QA.
Each retry gets a separate disposable character. Final contracts pass **237 /
1.721s**, lint, **3,187 client tests / 156.667s**, full server race (root
**19.922s**, game **330.735s**) and actual packaged collection **2.5m**, with
scan/cleanup. The latter records eight physical fragments, manual completion,
saved progress, zero deaths and **109 seconds** collection time over 22 observed
target deaths. The unchanged XP reward still reaches level 17; broader pacing
and investigation implementation remain open.

The 47 anonymous sweep subsequently passes **75 checks / 7.9m**. The previous
ready-conversation capture was cleared before inspection; the same package's
fresh repeat supplies the inspected and independently preserved image instead.
Root integration and final evidence are recorded in the current checkpoint above.

At this historical checkpoint, 39 was running live QA. Its later terminal
success, exact public verification and the 40 push are recorded above.

The [eight-investigation content draft](2026-09-07-investigation-story-content.md)
now includes acceptance/discovery/completion copy and journal summaries. It is
authored content, not playable world sites or a completed campaign expansion.

Scope addition, September 7: the user requests a solid item-drop, XP and reward
balancing pass, longer appropriately paced collection/hunt objectives, and
investigation-driven story additions in each realm. The
[new implementation plan](2026-09-07-progression-balance-and-investigations.md)
adds coordinated tuning, eight investigations, active-save migration and earned
playthrough gates across 1.0.x/1.1/1.4/1.5/1.6. This update changes planning only;
no reward values, live quest requirements, version numbers or deployments change.

## Earlier checkpoint — shared-combat release correction

This checkpoint supersedes the older in-progress statements below. Public
release remains last verified **Alpha 1.0.37**. Corrected **1.0.38 `9ed011b`**
is pushed successfully; CI **34141178711** has passed client/server/browser
smoke and is running predeployment character QA.
Do not publish 1.0.39 until every 1.0.38 CI/live job succeeds and fresh public
manifest/login/main-script/backend identity matches that exact release.

The prior movement candidate `b3c1057` passed all local final checks: **52
anonymous tests / 4.9m**, **three repeated actual loot acquisitions / 1.4m**,
authenticated **3 / 44.7s** then beam/ground/movement **3 / 1.5m**, and final
contracts/lint. Scans and disposable cleanup passed. Its CI **34139776521**
then exposed a real Go race between asynchronous loot insertion and an unlocked
damage-event map lookup; both deployments were skipped, not failed live.

The correction passes the already-held live caster into damage reporting,
avoiding both the map race and recursive world locking. The red concurrency
probe fails in **0.241s**; twenty repeated regression checks pass **13.238s**,
world-lock-held checks pass **7.040s**, and the full Go race suite passes
(root **7.749s**, game **210.796s**). Runtime `814adbf` also passes the actual
Whirlwind route **29.4s**, final **221 contracts / 2.062s**, and lint. All local
handles are terminal success, including successful scan/cleanup. See
[release 38 race evidence](2026-09-07-release38-lifesteal-race.md).

Both movement and race corrections are carried through new sequential branches;
older candidates are preserved. These are local candidates, not live versions.

| Version | Current queued branch | Candidate | Local client verification |
|---|---|---|---|
| 1.0.39 | `release/39-with-lifesteal-race` | `262ae30` | 222 pass / 1.977s |
| 1.0.40 | `release/40-with-lifesteal-race` | `cf9db3f` | 223 pass / 1.852s |
| 1.0.41 | `release/41-with-lifesteal-race` | `e2df346` | 224 pass / 2.098s |
| 1.0.42 | `release/42-with-lifesteal-race` | `b4ba629` | 225 pass / 2.027s |
| 1.0.43 | `release/43-with-lifesteal-race` | `7c3c036` | 227 pass / 2.188s |
| 1.0.44 | `release/44-with-lifesteal-race` | `4f87516` | 3,171 full client tests / 104.897s |

Root merges corrected 43 without publishing it. Movement carry-forward had
already passed **11 combined rendered pointer/chat/action/framing checks /
48.3s**. The race correction changes no client runtime. Each later release
still needs its own sequential CI/live gate; integration checks are not those
gates.

The independent Shield follow-up `work/shield-training-20260907` now implements
4%-per-rank absorption, normalized cast-time capacity, preserved Spell Focus,
and canonical offline payment/cooldown/expiry. Actual paid server/rune impacts
and shared offline fixtures pass. Original runtime `304f2a6` passes **213
client suites / 3,161 tests / 121.867s**, full Go race (root **26.487s**, game
**278.437s**) and lint. Movement/race corrections are now merged into that
worktree. Actual baseline/trained/saved browser casts and rendered absorption,
packaging, integration checks and publication remain open. This is not a
completed four-class audit or a completed roadmap milestone.

### Shield package and the next visual follow-up

1.0.38 CI **34141178711** has now passed client, server and browser smoke;
predeployment character QA is running. No deployment/live success is claimed.

Shield gameplay passes on `7f4a157` (**43.7s**): baseline/trained/saved absorption
**695 / 834 / 834**, real 20-second expiry, and a normal hostile hit absorbs
**310**, leaving **524** with full player health. Scan/cleanup pass. Integrated
server race passes (root **13.355s**, game **321.115s**). Actual phone captures
show correct details but also oversized empty status-panel space and an entrance
facade obscuring combat. Both remain visual work, not signed-off polish.

The separate worktree `/tmp/eidolon-shield-training-CcxkLZ` packages **Alpha
1.0.44 `fedf247`**, with distinct patch notes, aligned login/runtime/deployment
defaults and the Shield route added to full predeploy QA. Final **214 client
suites / 3,171 tests / 104.897s**, lint and backend-root race **12.413s** pass.
Its anonymous suite is still running. The HUD case has failed during startup;
the retained trace shows **97 `ERR_NETWORK_CHANGED` module requests** at
16:16:32 UTC, before UI setup. The underlying network-change trigger is not
established. Preserve that failure and finish the handle before repair/rerun.
Final versioned Shield gameplay is pending. 44 is not merged to root or queued
for publication until those remaining local checks finish.

The compact status-panel follow-up is isolated in
`/tmp/eidolon-status-compact-vP1t1z`, branch `work/status-compact-20260907`, based
on the frozen 44 package. Only a new three-viewport rendered regression is added
so far; no CSS fix or browser pass is claimed. It requires an empty panel to fit
its content and one portrait shield to leave the encounter center unobscured.
The browser slot remains owned by 44's anonymous suite; do not overlap another
owned local browser or edit the frozen package's served runtime while it runs.

### Local 44 integrated; compact status details implemented

The 44 anonymous handle finishes **61 pass / 1 startup failure / 6.0m**. Its
network-change trace is retained at `/tmp/eidolon-release44-hud-network-change.zip`.
Both HUD cases then pass **18.5s** using the existing bounded runtime-readiness
helper; no gameplay or interaction assertion is changed. The final versioned
Shield route passes **43.9s** on `56438d7`, repeating **695 / 834 / 834** and
**310 absorbed / 524 left**, with successful scan/cleanup. The inspected
closed-panel portrait capture shows the actual sapphire ward around the Wizard.
This is focused corrected coverage plus the 61 sweep passes, not a claim that a
fresh full anonymous command passed. All 44 local handles are closed.

Candidate **`release/44-with-lifesteal-race` / `4f87516`** is retained and merged
into root, with its complete [package evidence](2026-09-07-arcane-shield-training.md).
Root now displays 1.0.44 locally, not on the public site. The exact public
manifest/login/versioned-main/backend still agree on healthy, database-ready
**1.0.37 `2e37508`** at **16:25:09 UTC**. The pushed 38 candidate remains in
predeployment character QA; neither 39 nor any successor is authorized yet.

The compact status follow-up is implemented in its isolated worktree at
**`54f4195`**. Three failing rendered checks measure empty panels at **496 /
258 / 188px**, instead of content budgets **129 / 105 / 177px**. Short panels
now fit their content; long lists use bounded scrolling, with kind/time sharing
a readable row. Combined compact and populated-list touch checks pass **7 /
26.5s**, status lifecycle checks **9 / 0.508s**, and lint passes. The new tests
join anonymous CI. Actual Shield gameplay with the revised CSS passes **44.8s**
in `/tmp/eidolon-status-compact-gameplay.log`: **695 / 834 / 834**, normal expiry,
**310 absorbed / 524 left**, and successful scan/cleanup. The inspected actual
portrait now shows the shielded Wizard below readable compact details. All
owned local handles are closed. This follow-up is not yet packaged with its own
successor version or merged to root. Entrance occlusion and physical-phone
review remain open.

## Earlier execution history

Current release queue (September 7): **corrected 1.0.37 (`2e37508`) is fully
verified live**. CI **34121785766** completed successfully at 13:14:09 UTC,
with every job passing, including live character/four-class QA. Fresh
post-terminal checks at **13:15:13.160 UTC** return HTTP 200 and match the public
manifest, login label, versioned main script and healthy/ready backend to
`2e37508505c9ff67e160886e2a91fad89196f25f` / Alpha 1.0.37.

The first 1.0.38 CI **34126386286** fails before deployment at the movement
route's chat-focus assertion; neither deployment runs. The
[retained correction](2026-09-07-release38-chat-focus.md) reproduces three invalid
helper focus assumptions, then passes four focused browser checks (14.0s),
47 anonymous checks (3.2m), the authenticated/beam/ground/movement sequence,
lint and 212 version/default tests. Game/server/index source is unchanged.

After exact remote-head, clean-state and ancestry checks, corrected **1.0.38
`b071afff3475dfd4cb4710419688c70f52e364e2`** is pushed successfully from
`release/38-with-chat-focus`. CI **34130749050 fails predeployment**: on landscape
rotation the populated objective intercepts the expanded chat Collapse button.
The retry also incorrectly reuses an already-selected specialization. Both
deployments are skipped. Log: `/tmp/eidolon-release38-chat-correction-ci-failure.log`.

Correction runtime **`ace87c8`**, branch `work/release38-phone-chat`, lives in
`/tmp/eidolon-release38-focus-oocXIw`. Expanded chat now sits above the objective
but below normal windows; retry gets a fresh allowlisted character. The new
populated-HUD test fails both landscape cases before repair (1 pass / 2 fail,
10.5s) and passes all three viewports afterward (12.7s). Version/default checks
pass **213 / 1.64s**. Full client checks pass **196 suites / 2,898 tests /
105.014s**, lint passes, and all **50 anonymous browser checks pass / 5.0m**.
The intentional-failure Purifying probe completes baseline/trained/saved
verification on both attempts (**16.4s / 20.2s**), with a successful credential
scan and normal cleanup. The injected first-attempt failure is expected; the
second attempt starts untrained. All local test handles are closed.
The login version remains 1.0.38 with an additional patch-note bullet.

After clean-state, remote-head and ancestry checks, **`c788e8537d4d221e0a88c7491d02f46eaf3a698c`**
is pushed successfully from **`release/38-with-phone-chat`**. New CI
**34134256905 is in progress**. Fresh public identity at **14:36:31.152 UTC**
still agrees on healthy/ready Alpha 1.0.37. This is not a verified 1.0.38
deployment. The correction's detailed evidence is in its isolated worktree's
`docs/plans/2026-09-07-release38-phone-chat.md`.

Do not push 1.0.39 until corrected 1.0.38 completes every CI/live gate and fresh
public identity agrees. The **new phone-chat correction** is now carried through
the queued descendants below. Original candidates remain
unchanged; do not push root HEAD or the older queue over the corrected release.
Carry-forward inspection finds conflicts in 1.0.39's package and phone-layout
files: union the anonymous test lists and **retain 1.0.39's higher existing
`--z-window + 1` chat layer** for its party sheet, rather than lowering it to
1.0.38's HUD+2 fix. These conflicts are resolved without dropping either browser
test list or the later party-sheet behavior.

The sequential descendants differ from their previous `with-chat-focus`
candidates only in QA/evidence, the additional 1.0.38 patch-note bullet, and two
CSS comment lines. Game/server behavior is unchanged. Their version/default
checks pass, and the final carried chat, action-readability and encounter-framing
browser set passes **9/9 / 39.2s**, `/tmp/eidolon-phone-chat-carried-browser.log`.

| Version | Current queued branch | Candidate | Version/default checks |
|---|---|---|---|
| 1.0.39 | `release/39-with-phone-chat` | `3607275` | 214 pass / 1.157s |
| 1.0.40 | `release/40-with-phone-chat` | `76fb0f3` | 215 pass / 1.220s |
| 1.0.41 | `release/41-with-phone-chat` | `c7b9d67` | 216 pass / 1.435s |
| 1.0.42 | `release/42-with-phone-chat` | `9a23d62` | 217 pass / 1.212s |

Root merges corrected 1.0.42 at `0b206c7`; staging in
`/tmp/eidolon-release37-targeting-lT3Mdt` is also on that queued branch. Neither
is authorization to skip 1.0.38's current gate. The older queue table below is
historical evidence, not the branch to publish next.

September 7 continuation: CI **34134256905 is terminal failure**. Client/server
and browser smoke pass; predeployment fails the dungeon movement wall check.
First attempt's Teleport endpoint is 0.285 units short of the asserted north
wall; retry's event reaches the wall but the client settles 2.83 units away.
Neither deployment runs. The authenticated loot route also needed a successful
retry after failing pointer acquisition. Preserve the failure log
`/tmp/eidolon-release38-phone-chat-ci-failure.log`; do not classify either issue
as a harmless flake without investigation. The bounded movement observer on
`work/release38-movement-observer` records actual cast, movement input and
position evidence while retaining the original assertions and game runtime.
The corrected 39–43 queue still needs any resulting correction carried forward
before publication. Live remains last verified 1.0.37, not 1.0.38.

The movement correction progresses on `work/release38-movement-observer`,
current clean checkpoint **`da43a0c`** in `/tmp/eidolon-release38-focus-oocXIw`.
Three failing local event tests expose ignored short Teleport landings. Accepted
finite local Teleport events now commit the clipped destination and clear stale
path/intent; the normal three-unit prediction deadband no longer swallows a
short blink. **109 focused tests / 1.833s**, **197 suites / 2,905 full client
tests / 96.375s**, and lint pass. Game server source is unchanged. The real
versioned route proves a 1.5-unit blink remains at its accepted landing after the
movement lock and idle heartbeat; the authenticated → beam/ground/movement
sequence passes **48.2s + 1.5m**, with successful credential scan/cleanup.

The cast-aim helper's fractional-pixel setup error is independently reproduced
(0.165 units, 15.2s) and corrected by aiming at the nearest real pixel and
verifying that pixel's ground ray, without shortening the destination. Repeated
loot QA then produces **two passes / one failure / 1.4m**: a living Skeleton
covers the intended active drop. The actual hit stack proves enemy priority is
correct; the helper kept trying the same covered center. A real LootDrop/input/
raycast fixture fails before the helper starts checking exposed hitbox sides,
then both aim and loot fixtures pass **2 / 6.1s**. No direct pickup or changed
enemy priority is used; exact-item receipts remain required. Both join anonymous
CI and 1.0.38's notes include **Short blinks count**.

Final repeated real-loot QA is running on clean `da43a0c`, log
`/tmp/eidolon-release38-loot-acquisition-after.log`. The final corrected movement
sequence, full anonymous package checks and guard/lint are still to close before
republishing. Full evidence is in that worktree's
`docs/plans/2026-09-07-release38-movement-landing.md`.
Fresh public identity at **15:17:11 UTC** still agrees on healthy/ready 1.0.37.
Do not push root HEAD or the existing 39–43 candidates before carrying this
correction through and closing each preceding CI/live gate.

Local **1.0.43 `e0bc417`** now packages Seraph training, lifecycle, offline actor
and self-casting repairs, with its own patch notes and aligned version defaults.
The offline rendered scene passes **3 / 31.2s**; an additional desktop label
regression reproduces oversized smite text, then the combined rendered fallback
and compact-label set passes **4 / 34.3s**. Inspected captures show the actual
summon and its attributed two-line label above the model. Version/default checks
pass **219 / 1.635s**, backend-root race **14.015s**, lint/syntax/whitespace pass.
Full packaged client checks pass **212 suites / 3,146 tests / 134.915s** and all
**60 anonymous browser checks pass / 7.9m**. The versioned real-server cast route
passes **1.3m**, damage **288 / 345 / 345**, lifetime **14.97 / 16.41s**, saved
training, following and recall cleanup. Credential scan and disposable cleanup
pass. No local Seraph test remains active. Evidence commit `884741c` and merge
`ffe8a98` integrate the verified package into root, with retained candidate
`release/43-with-phone-chat`. This is not published; all earlier release gates
still apply. See [the packaged evidence](2026-09-07-release43-seraph.md).
The actual combat capture still shows concurrent action-label overlap and
entrance-facade obstruction; compact single-label proof is not full visual polish.

The next defensive-talent probe independently reproduces ignored Arcane Shield
Mastery via paid casts: baseline capacity 150, rank 1 still 150 instead of 156,
rank 5 still 150 instead of 180 (0.190s). The diagnostic Go overlay is outside
the production worktree, `/tmp/eidolon-shield-mastery-probe-3XfUpt`; log
`/tmp/eidolon-shield-mastery-probe.log`. Separate clean worktree
`/tmp/eidolon-shield-training-CcxkLZ`, branch `work/shield-training-20260907`,
starts from `e0bc417`; no fix or later release is claimed yet. Deployment failure
investigation takes priority over implementing that follow-up.

Earlier Seraph implementation evidence on `work/seraph-lifecycle-20260907` in
`/tmp/eidolon-seraph-lifecycle-MbWPg7`, checkpoint **2329891**. Seven paid summon
failures (0.247s) reproduce ignored damage/duration training, owner-lifecycle and
dungeon-wall defects. Server fixes and an actual offline summoned actor now
have 59 focused client checks (0.933s), shared-contract/expanded actual-cast race
checks (3.680s), lint and **212 suites / 3,137 full client tests (115.252s)**.
The full Go race suite finishes successfully, session **22417** terminal exit
zero: root **10.143s**, game **264.589s**. The longer duration was active test
execution, not a stuck process. Those test handles are closed. Subsequent
browser/model/transition and packaging evidence follows; none implies publication.

September 7 continuation: Seraph checkpoint **`1b6235d`** additionally repairs
desktop self-casting. Four new failing hotbar cases (0.845s) show that a missing
cursor intersection suppresses Spirit Guardians/Seraph, while Seraph can chase
a distant hovered actor or lose a buffered cast when that actor disappears.
Both self-casts now dispatch around the owner without cursor targeting. The
focused set passes **42 tests / 1.929s** and the complete client suite passes
**212 suites / 3,141 tests / 151.394s**. Server source is unchanged from the full
race-tested summon implementation. Logs:
`/tmp/eidolon-seraph-hotbar-before.log`,
`/tmp/eidolon-seraph-hotbar-after.log`,
`/tmp/eidolon-seraph-final-client.log`.

The ordinary browser route observes baseline **288** and trained **345** smites,
and **14.86s / 16.44s** expiry against expected **15s / 16.5s**. Inspected captures
show the model following its owner after the birth flash. The run then terminates
with exit 143 before saved-login/recall completion; it is **partial evidence**, not
a passing route or successful credential scan. Its exact disposable containers,
database, image and orphaned local web-server group were removed after checking
the driver was gone; ports are free before restarting. The fresh same-checkpoint
route **passes 1.3 minutes** in `/tmp/eidolon-seraph-browser-final.log` (session
**9493**, terminal exit zero): **288 / 345 / 345** baseline/trained/fresh-login
damage, **14.94 / 16.46s** expiry, following, and ordinary dungeon recall cleanup.
Credential scan passes with zero sanitizations and disposable cleanup completes.
All local Seraph test handles are closed; its evidence checkpoint is **65e7b85**.
Earlier retained test failures distinguish asynchronous model creation from
server deletion and wait for authoritative rather than optimistic talent ranks.

Visual follow-up remains: desktop summon action labels overlap the combat
silhouette, and fighting near the large entrance facade obscures actors. The
town follow capture proves a rendered summon, not broad encounter readability
or physical-phone quality. Offline rendered fallback,
release packaging and the full roadmap gates remain open.

Local **1.0.42 `0d57f0e`** packages the status
work below after integration `4e05228`, with separate patch notes and matching
login/runtime versions. Final package checks pass **3,113 client tests / 211
suites (73.66s)**, lint, root backend race (**7.576s**) and **53/53 anonymous
browser tests (3.9m)**. Earlier full game race and additional shared-contract/
rune-only checks cover unchanged Go gameplay source. All three status skills
individually pass real baseline/trained/saved damage checks. The final combined
versioned run on **`ef6f47d`** also passes: Lunge **23.9s** (69/82/82), Serrated
Edges **28.4s** (38/45/45), Poison Coating **34.4s** (67/80/80), with exact
cast/source/target checks and clean credential scan/disposable cleanup. All
local handles are terminal success; no owned local browser remains active.
See [1.0.42 evidence](2026-09-07-release42-status-training.md).
This package is not published and does not close the full roadmap.

Earlier isolated status-training checkpoint reproduces and repairs an entrance
targeting defect: entrance geometry overrode any enemy in the raycast hit stack,
even when the entrance was behind it. New real-geometry tests fail twice before
the fix and pass afterward; combined targeting/mobile/status coverage passes
29 tests in 0.985s. Isolated runtime checkpoint **b095bd9** retains hostile-first
selection while allowing normal entrance interaction after the enemy dies.
Browser targeting proceeds past the old entrance proxy failure. Subsequent
driver failures expose overlapping moving enemies and an incorrect assumption
that `ability_result` contains a target ID; the actual `ability` event does.
The current driver **aa1b7f7** snapshots the hovered actor at outgoing input,
requires matching server cast identity and exact attributed status ticks, and
is running the three-skill route. No complete browser pass or 1.0.42 release is
claimed yet. Full roadmap and physical-phone gates remain open.

Previous release checkpoint: **corrected 1.0.36 (`69b34a7`) is fully
verified live**. CI `34114458548` is terminal success with every job passing,
including live character/four-class QA. Fresh post-terminal checks at
**11:48:44.381 UTC** match the public manifest, login label, versioned main script
and healthy/ready backend to `69b34a78cd880f7a863d5ad2a0aa33af0680f961` /
Alpha 1.0.36. Earlier pre-terminal checks at 11:38:58.626 UTC also matched, but
were not used to close the release gate.

The first 1.0.37 CI **34118770059** fails predeployment: a local module request
reports `ERR_NETWORK_CHANGED`, then the automatic healing retry cannot reselect
its already-saved specialization. Neither deployment ran. The [retained repair](2026-09-07-release37-protection.md)
isolates retry accounts without weakening baseline/trained/saved-healing checks.
Its opt-in intentional-failure probe completes both attempts (9.9s/9.8s), with
clean credential scan and normal cleanup. Game/server source is unchanged.

After confirming exact remote ancestry and clean staging, corrected **1.0.37
`2e37508505c9ff67e160886e2a91fad89196f25f`** is pushed successfully; new CI
**34121785766 is in progress**. Do not push corrected
1.0.38 until every 1.0.37 CI/live job passes and fresh post-terminal public
identity agrees. Do not push the root working HEAD or skip any queued versions.

Previous 1.0.36 repair checkpoint: **1.0.35 (`948ed0c`) was fully verified**.
The first 1.0.36 CI (`34110323348`) failed predeployment Rogue targeting; neither
deployment ran. Accepted Shadow Lunge and bleed events named a different enemy.
The desktop hotbar dropped the hovered actor's ID when converting its position
into a vector-only cast. A retry also assumed saved Quick Draw ranks were zero.
The failure log is retained at `/tmp/eidolon-release36-ci-failure.log`.

Correction **`69b34a78cd880f7a863d5ad2a0aa33af0680f961`** is a direct descendant
of the original 1.0.36 source, prepared in
`/tmp/eidolon-release36-targeting-AVg9om` (`work/release36-targeting`). It preserves
hotbar actor identity through buffered input, handles unavailable targets,
retains self-casting, fixes retry rank purchases and strengthens outgoing/accepted/
bleed-target browser assertions. Its 1.0.36 patch notes are updated, without
including later candidates. **191 suites / 2,802 client tests pass in 104.11s**;
lint and whitespace pass. After confirming remote master and ancestry, only this
correction was pushed successfully. New CI **`34114458548` is in progress**.
Do not publish 1.0.37 until all corrected 1.0.36 CI/live jobs pass and a fresh
post-terminal public identity check matches. Preserve the original 1.0.37–1.0.40
candidates and carry this correction forward into each before its publication.
Do not push the root 1.0.40 working HEAD.

The hotbar fix is now integrated into root checkpoint **`affcd47`** after the
earned Fighter run completed; **203 suites / 3,009 client tests pass in 105.293s**,
plus lint. Corrected sequential candidates preserve their original versions,
patch-note histories and server trees:

| Version | Corrected branch | Candidate |
|---|---|---|
| 1.0.37 | `release/37-with-target-identity` | `2e37508` |
| 1.0.38 | `release/38-with-target-identity` | `faf18fd` |
| 1.0.39 | `release/39-with-target-identity` | `dbd991d` |
| 1.0.40 | `release/40-with-target-identity` | `dbc6a0d` |

Each is a descendant of the preceding corrected candidate; originals remain
unchanged. The staging checkout `/tmp/eidolon-release37-targeting-lT3Mdt` is
returned to corrected 1.0.37 for the next publication gate. Target identity,
ability config and version/default/history checks pass on every corrected
candidate; these supplement their original full tests, not new full browser
runs. Server-tree equality to each original candidate is verified. The 1.0.37
candidate is now pushed to remote master with CI in progress; 1.0.38–40 remain
unpublished. The top entry records the current gate.

The table now includes the healing-retry correction carried forward from 1.0.37.
Original corrected candidates are additionally preserved as
`release/{38,39,40}-before-healing-retry`. Only the retry test/runner and retained
failure record differ; each candidate's game/server/index source matches its
previous version exactly. Version/history/isolated-default checks pass 212 tests
in 1.207s for 38, 213 in 1.613s for 39, and 214 in 1.500s for 40. Shell syntax
passes. Staging is returned to 1.0.37; later releases remain unpublished.

Next local package: [1.0.41 critical training](2026-09-07-release41-critical-training.md),
integration **52d78ee**, now includes the previously isolated critical work and
corrected release ancestry through 1.0.40. Three-class ordinary browser purchases,
accepted targeted primary casts and fresh-login saved ranks pass on **a93194b**
(Rogue 21.7s, Wizard 19.5s, Fighter 21.6s), including positive authoritative
cooldowns. Version/history/default checks pass 214 tests in 0.970s; full client
regression passes 208 suites / 3,080 tests in 82.118s and actual-consumer probes
pass 0.890s. Full server race passes (root 9.851s/game 185.709s), plus lint.
Anonymous browser checks finish with 47 passes/six failures (HUD module import,
two quest taps, three status-to-chat transitions); diagnosis remains open.
It is not published; do not skip the four
preceding releases. Historical separate-branch and pending critical-browser
statements below are superseded by this checkpoint, not erased evidence.

Final 1.0.41 QA integration **1fa2a21** now carries the healing retry correction
through corrected 1.0.40 ancestry. Touch diagnostics reproduce native scrolling
consuming the next tap; waiting for measured scroll offset to settle repairs the
driver without changing runtime UI or retrying taps. The speculative status
dismissal change is removed. Ten targeted browser cases pass 27.9s; the cleaned
full anonymous rerun passes **53/53 in 2.0 minutes**, including the HUD import
case. Final lint/shell checks pass, and merged version/default/history checks
pass **215 tests in 0.968s**. Runtime source is unchanged from the full 3,080-client
and server-race passes. The package is locally verified, not published.

Latest confirmed 1.0.37 CI **34121785766**: client/server checks pass and browser
smoke is in progress. The goal remains the full 1.1–1.10 roadmap; neither this
critical package nor its passing checks close the broader gates.

Next isolated implementation: **`work/status-consumers-20260907`**, checkout
`/tmp/eidolon-status-consumers-eCpCd1`, runtime **b7e807a**, latest browser driver
**8c482a9**. Paid casts reproduce six ignored rank-one/five Mastery expectations
for Shadow Lunge, Serrated Edges and Poison Coating in 0.236s. Their wound
application now snapshots the matching training; derived bleeds retain inherited
modifiers once. Expanded real applications include Fan of Knives and asynchronous
coated basic attacks, plus generic and unrelated controls. Offline ticks retain
their attacker, work during stun, and respect expiry/cleanse/authority.

Full isolated client checks pass **211 suites / 3,109 tests in 79.330s**, lint
passes, and full server race passes (root **8.048s**, game **190.252s**). Additional
shared-contract/actual-cast race checks pass 4.182s. Browser Shadow Lunge passes
baseline/trained/saved ticks (69/82/82); projectile coatings still require proof.
Starter enemies can die to the initiating hit, so the new route uses natural
durable overworld enemies by the existing Verdant waypoint, with ordinary input
and no enemy-health edits. An overly restrictive ground-only driver failed
before casting; the current run permits normal jump input and waits for landing.
Source and tests stay frozen in that worktree during the browser run. This is
not merged into root or packaged/published as 1.0.42. Preserve 1.0.41 unchanged.

The remaining Purifying Wave Mastery design choice has been sent to the user
(modest healing versus a cleanse-only radius benefit); other work continues.
Latest 1.0.37 CI now has client/server/browser smoke passing, predeploy character
QA in progress. Do not publish 1.0.38 until its full live gate completes.

The earned Fighter run completed on unchanged source `2c80b06`, session
`47165`, `/tmp/eidolon-earned-fighter-corrected-gameplay.log`. Its paid Skeleton
and Imp contracts and saved manual rewards reach level 34; the full Verdant
route passes in **29.3 minutes**, including all four bosses, completed recall/
re-entry, manual Earth reward and saved Rootheart access. It ends at level 54,
with zero rejected dungeon casts; see the fresh-progression evidence for counts.
The isolated critical-talent checkpoint is now **`1a8cf94`**, following `b32c084`,
on `work/critical-talents-20260907` in `/tmp/eidolon-critical-talents-lkoMno`.
Its latest server race suite passes (root 10.524s, game 235.272s), plus a new
shared metadata/critical composition race run (4.950s). Real paid Backstab casts
reproduced 600/1,200 damage from stacked critical sources instead of 300; the fix
composes rune/combo/equipment into one ordinary critical after armor, preserving
Lucky independently. Real Fireball flights reproduced doubled splash modifiers,
primary-only debuff leakage and splash through solid dungeon walls; all have
regression coverage and corrections. Offline basic criticals and numeric tooltips
now agree with a server-validated 160-talent metadata contract. Client regression
passes **204 suites / 3,033 tests in 72.435s**, lint and whitespace pass. The
critical checkout does not yet include the separate hotbar fix. Offline ability/
projectile consumption, utility/periodic coverage and real browser/persistence
checks remain open. It is not merged into root or queued as a release.

Offline follow-up **`3dd9c46`** extends actual critical consumption to implemented
direct abilities, projectiles and periodic areas, preserving caster attribution.
Nine paid offline cast/flight tests first reproduce missing criticals. Backstab
now consumes its normal Cloak sequence and Ambush rune with one post-armor
critical; Fireball uses per-recipient Implosion, 40% raw splash and dungeon
flight/splash walls, and never predicts authoritative-engine damage. Actual
periodic checks cover Whirlwind, Inferno, Spirit/Boost, Consecrated and Radiant
Strike. The final isolated client run passes **207 suites / 3,074 tests in
92.635s**, lint and whitespace pass; Go source is unchanged from its race pass.
The first full client run's 15 failures were exact one-argument damage-call
expectations; amounts were unchanged and assertions now also require the caster.

The critical branch now integrates corrected hotbar targeting in **`054b285`**;
combined verification passes **208 suites / 3,079 tests in 62.461s**, lint and
whitespace pass. Original actual-cast consumer probes pass 0.457s; that narrow
probe pass does not close the full talent audit. It remains isolated in
`/tmp/eidolon-critical-talents-lkoMno`, not in the 1.0.37–40 queue. Browser/saved
talent validation and further consumer coverage remain open. Older offline
base/stat/rune differences, bleed/poison attribution and the unimplemented
offline Seraph summon are not claimed fixed by these critical tests.

Previous 1.0.36 publication snapshot:
CI **`34105565222`** is terminal success with every job successful, including
final live character QA. Fresh post-terminal uncached checks at
**10:13:16.396 UTC** match public manifest, login version, versioned main script
and backend to `948ed0c178c7c5967db078b53ef951d930660f30` / Alpha 1.0.35;
health `ok`, database `ready`. Remote master and next-source ancestry were
checked before pushing only preserved **1.0.36
`90e157973178fcd9907a756d8729248b49c312df`**. Push succeeded; its CI
**`34110323348`** is in progress. Do not publish 1.0.37 until every 1.0.36 CI/live
job passes and fresh post-terminal public identity agrees.

Previous release queue snapshot: **1.0.34 (`dba8268`) is fully verified**.
CI **`34101007172`** passed every job, including final live character QA.
Fresh post-terminal uncached checks at **09:21:25.161 UTC** matched manifest,
login label, versioned main script and backend to
`dba826845e13d81586ccecd06c352b7a662d42af` / Alpha 1.0.34; health `ok`, database
`ready`. Remote master and next-source ancestry were checked before pushing only
**1.0.35 `948ed0c178c7c5967db078b53ef951d930660f30`**; that push completed
successfully. Do not push 1.0.36 until the complete 1.0.35 CI/live gate and fresh
post-terminal public identity checks pass.
CI **`34105565222`** has passed server/client/browser smoke, predeployment
character QA and both deployments. Final live character and four-class QA is
still in progress. Fresh **pre-terminal** public checks at **10:05:34.142 UTC**
match manifest, login label, main script and healthy/ready backend to 1.0.35
`948ed0c178c7c5967db078b53ef951d930660f30`. This proves deployed identity, not the
complete live gate. Do not push 1.0.36 until terminal success and a new identity
check after that terminal result.

The [1.0.40 candidate](2026-09-07-release40-cleric-readability.md) packages bounded
phone actor/action feedback, trained accepted Cleric areas, clear phone combo
feedback and the [offline Healing Light/Radiant Strike repair](2026-09-07-cleric-offline-areas.md).
The offline checkpoint is `43fa0c3571bd2a318b6001e80b13fbdffcf85a3f`.
Separate patch notes and all version defaults advance to 1.0.40 without replacing
1.0.39 history. Final client regression passes **201 suites / 2,974 tests in
95.175s**, full server race checks pass (root **13.049s**, unchanged game cached),
all **53 anonymous checks pass in 6.0 minutes** after the retained network-change
failure, and final actual caster/observer gameplay passes **37.1s**. Lint, shell,
whitespace, credential scans and cleanup pass; all owned local processes close.
This candidate is not published and does not close the remaining offline combat,
physical-device or larger 1.1–1.10 scope. The next concrete progression task is
the [earned melee dungeon comparison](2026-09-07-earned-melee-followup.md).
Candidate source **`be9184b79df00455542395b7cf68630ecb0f0817`** is preserved on
**`release/40-with-rites`**, after the unchanged 1.0.39 candidate.

Previous release: **1.0.33 (`0024f33`) is fully verified**.
CI **`34096361856` attempt 1** passed every job, including final live character
and four-class/remote-animation QA. Fresh post-terminal uncached checks at
**08:30:51.811 UTC** matched manifest, login label, versioned main script and
backend to `0024f3370c0f1e648bc219a5d3ac816b4566a3e2` / Alpha 1.0.33; health `ok`,
database `ready`. Only **1.0.34 `dba826845e13d81586ccecd06c352b7a662d42af`** was
pushed next (terminal successful push). CI **`34101007172`** is in progress.
Do not push 1.0.35 until its complete CI/live gate and fresh post-terminal
identity check pass.

Previous fully verified release: **1.0.32 (`d578bdf`)**.
CI **`34089969590` attempt 2** passed every job including final live character and
remote-animation QA. Fresh post-terminal uncached checks at **07:36:56.055 UTC**
matched manifest, login label, versioned main script and backend to
`d578bdfff7cd998c56bc422bc403d4cbe666b902` / Alpha 1.0.32; health `ok`, database
`ready`. Only **1.0.33 `0024f3370c0f1e648bc219a5d3ac816b4566a3e2`** was pushed next.
Its subsequent full verification and ordered successor push are recorded above.

The unchanged 1.0.32 rerun follows a predeploy browser `ERR_NETWORK_CHANGED`
failure; [the original failure and pre-terminal checks](2026-09-07-release32-network-retry.md)
remain recorded. A passing rerun does not establish the host-network cause.
Previous fully verified 1.0.31 (`a82baa2`) passed CI `34086731393` and fresh
post-terminal identity at **06:14:00.877 UTC**; a **06:33:12.223 UTC** recheck
still matched healthy 1.0.31 before the 1.0.32 deployment.

The [Guardian Embrace area repair](2026-09-07-guardian-area.md), checkpoint
`a0a17e705055c4e5fdc4ee0ce4f12743e092db4e`, is locally verified
after the preserved 1.0.36 source: 191 client suites / 2,809 tests, full server race
checks and actual two-browser cast/late-observer/expiry gameplay pass. It is not
part of the queued 1.0.36 candidate and does not close the wider combat/phone gates.
The [Consecrated Ground follow-up](2026-09-07-consecrated-area.md) now passes
192 client suites / 2,822 tests and real-server phone casting/rune/persistence QA
in 57.3s. Full server race checks pass root 22.926s / game 322.243s, plus final
lint/shell/whitespace checks. It is a local checkpoint, not yet a release.
The [Alpha 1.0.37 candidate](2026-09-07-release37-protection.md), source
`47a565b0ec4d38ef9149b1a7055cf056ccfe3802` on `release/37-with-protection`, includes both
checkpoints plus trained Blessings/Trumpet, with separate notes and synchronized
login/runtime metadata. Final client checks pass 193 suites / 2,864 tests and full
server race checks pass root 19.953s / game 354.538s. Actual phone support casts
pass 48.9s. The final Guardian route hit the same browser network error after its
functional assertions; its unchanged monitored rerun passes 55.6s with all error
checks intact. The final holy-ground route passes 39.0s, including rune selection,
actual healing and fresh-login persistence. This candidate is not
published.

The subsequent [Spirit Guardians/Boost area checkpoint](2026-09-07-spirit-area.md)
passes **194 suites / 2,875 client tests**, full server race checks (game
**367.003s**) and real-server phone/late-observer gameplay in **1.2 minutes**.
Checkpoint `b8a761ee46ce6e91ed171aac351508ea6f072180` retains this work.
Trained/rune radius is captured at cast, replicated, consumed by real ticks and
drawn with an exact perimeter without enlarging the cherubs. This is not included
in the preserved 1.0.37 candidate. Screenshot review still finds excessive phone
HUD occupancy; shared encounter composition is the next visual priority.
The next paired diagnostic casts reproduce ignored Ministry area for Radiant
Strike, Healing Light's Beacon and Mass Revival in **0.438s**; rank-zero controls
pass. Those remain open, not a reason to claim the talent audit complete.

The next [phone encounter-space pass](2026-09-07-phone-encounter-space.md) gives
callouts real expiration, keeps one tappable objective row, preserves every
tracking selection, corrects level-unlock guidance and removes the redundant local
player-name prefix from phone support feedback. Screenshot review and a new
568×320 route catch tracker/health overlap, clipped row margins and the Journal's
desktop minimum height covering chat. Corrections and seven expanded layout checks
pass, including 568×320. The [1.0.38 candidate](2026-09-07-release38-encounter-space.md)
adds distinct patch notes and aligned version labels. Actual Spirit/phone/observer
gameplay passes in 1.3 minutes, full server race checks pass, and final client
regression passes **195 suites / 2,892 tests in 142.066s** after correcting two
missed CI version defaults. All local verification processes are terminal.
Source **`add49409a0b6fd845ebd7995aa462731b2a29271`** is preserved on
**`release/38-with-space`**, after the unchanged 1.0.37 candidate.
Shared camera/encounter-region composition and physical-phone sign-off
remain next, rather than treating another menu patch as the completed redesign.

The subsequent [1.0.39 candidate](2026-09-07-release39-phone-party.md) implements
the shared CSS-owned camera reservation and landscape thumb layout, a readable
tap-open party panel, deliberate Healing Light/Divine Intervention ally selection,
chat-layer repair and compact touch-through combo feedback. It has separate patch
notes and aligned login/runtime metadata. Final client checks pass **197 suites /
2,915 tests in 118.224s**, server race checks pass, and ten populated camera/HUD
checks pass. Both support spells reach a real selected party member in three phone
sizes. Final combat (**18.7s**) and support (**18.9s**) repeats pass; final full
anonymous retry passes **50 tests in 5.0 minutes** after the retained fixture
corrections and module-load `ERR_NETWORK_CHANGED` failure. All local gates are
complete. Source `c6145c35dc935ae197ca643ce1a3dfe75416fcd1` is preserved on
`release/39-with-party`. It is not published and does not
change the preserved 1.0.38 source or close physical-phone sign-off.

The subsequent [phone actor-action readability pass](2026-09-07-phone-action-readability.md)
is preserved as unversioned checkpoint `c9c93b9b521d27c1b96bbc113c150893bb6399b1`.
It bounds long actor/action labels above the model while retaining attribution,
keeps damage-number/desktop presentation separate, and cleans up pooled feedback
at teardown. Full client checks pass **198 suites / 2,925 tests in 128.766s**,
all **53 anonymous checks pass in 5.7 minutes**, and real two-account support and
actual recipient-label checks pass **43.8s**. Lint/whitespace pass; all local
verification processes are terminal. This is not part of preserved 1.0.39 and
still needs its next release packaging.

The subsequent [Cleric accepted-area implementation](2026-09-07-cleric-final-area-implementation.md)
repairs trained cone/Beacon/Mass Revival radii, actual accepted healing centers,
explicit direct-heal shape metadata and planar body-edge cast intent. Real phone
casts exposed a missing WebSocket payload field; its retained regression now
passes. Final actual cast/boundary route passes **21.4s**, two-account phone
support passes **17.6s**, client **199 suites / 2,936 tests** pass in **100.639s**,
and full server race coverage passes (game **219.529s**, post-wire root **8.348s**).
This is an unversioned local checkpoint after 1.0.39, not a deployment or closure
of offline Cleric parity, observer gameplay or the broader milestone gates.
Source `95eac97a9b40fdaa1e0add9bed23a6f1cd333441` preserves that accepted-area
checkpoint. The subsequent phone combo polish removes the screenshot-observed
oversized duplicate while keeping its compact notification and desktop feedback.
Actual normal-combo/geometry QA passes **25.6s**, final client regression passes
**200 suites / 2,940 tests in 112.163s**, and before/after capture inspection,
lint and whitespace checks pass. All local verification processes are closed.
These remain unversioned changes after preserved 1.0.39, not part of the queued
1.0.35 deployment or proof of completion of the larger visual milestone.

The earlier [expanded remaining Cleric probes](2026-09-07-cleric-final-area-probes.md)
complete in **0.595s** with explicit expected failures: trained boundaries remain
ignored, and all nine accepted-shape cases emit zero radius/arc. Normal branch-A
Divine Intervention → Healing Light proves Mass Revival is reachable without
granting an ActiveCombo flag; other cross-branch issues remain separate. These
diagnostics do not close the remaining area, offline or broader roadmap gates.

Historical 1.0.30 → original 1.0.31 failure and repair:
CI **`34081910599`** passed every job, including final live character QA.
Fresh post-terminal uncached checks at **04:58:37.772 UTC** matched release
manifest, login label, versioned main script and backend to
`c3247e849daad029b0c4f053b3d4d969ebba0f82` / Alpha 1.0.30; health `ok`, database
`ready`. Only **1.0.31 `bacaa59c7dd2fa016d400ddeacbe90c4a51982d2`** was pushed next;
CI **`34085084576` failed before deployment** on the server race-suite near-death
QA test's one-second wait. Client checks passed; browser/deploy/live jobs were
skipped. Its own patch notes and package/login version were checked before the
exact-source push. A closer ordinary overworld Skeleton deterministically
reproduced the timeout: randomized world spawns could replace the intended test
attacker with one whose normal swing takes longer than the one-second wait.
The [test-only isolation repair](2026-09-07-release31-qa-isolation.md) passes 100
race repetitions and the full repaired race suite (game 242.012 seconds).
Successor **`a82baa2adcd41d25f9e9bc01c96d3af6a853674f`** is pushed, with CI
**`34086731393` in progress**. Original CI did not record its chosen attacker;
the reproducible fixture defect and original failure are both retained.
Fresh public checks at **05:21:22.997 UTC** still match healthy 1.0.30 across
manifest/login/script/backend. Later versions remain queued behind the complete
1.0.31 CI/live gate; do not push main HEAD over it.

The [1.0.36 combat candidate](2026-09-07-release36-combat.md),
**`90e157973178fcd9907a756d8729248b49c312df`**, now packages the previously
unversioned range, bleed/poison and ground-spell work with the
[Purifying Wave area repair](2026-09-07-cleansing-area.md). Final checks pass
**190 suites / 2,797 client tests**, full server race checks, lint and two
isolated gameplay routes (phone cleanse 24.8s; Wizard ground spells 34.9s).
Its distinct patch notes and all version defaults are 1.0.36. It remains local on
`release/36-with-combat`, behind every predecessor; remote master is still the
1.0.31 repair `a82baa2`. This does not close the 1.1 or full talent-consumer gates.

Previous **1.0.29 `bc96862`** passed CI `34078663504` and its post-terminal
uncached manifest/login/script/backend identity check at **04:06:20.318 UTC**.

Previous checkpoint **1.0.28 (`48c74cd`)** passed CI **`34075628459`**, including
final live four-class and remote animation QA. Its fresh post-terminal uncached
verification at **03:08:31 UTC** matched manifest/login/script/backend to
`48c74cddaf79293a80dc62ebd66565cc0cf7923d` / Alpha 1.0.28, health `ok`, database
`ready`.

Previous verified checkpoint: **1.0.27 (`0d4e1a1`)**.
CI **`34072603962`** passed every job, including final live character/animation QA.
Post-terminal uncached checks at **02:03:16 UTC** matched manifest, login label,
versioned main entry and backend to `0d4e1a1fb37d728db85c1eac9d56b6dc3bc785dd` /
Alpha 1.0.27; health `ok`, database `ready`. Original **1.0.28
`424e6b11579b5e7ea5c50a060dcb89011fab7126`** failed CI **`34075003387`** before
deployment on a real-clock-dependent cooldown unit test. Server checks passed;
all browser/deploy/live jobs were skipped. The deterministic test-only successor
**`48c74cddaf79293a80dc62ebd66565cc0cf7923d`** was pushed and its CI **`34075628459`**
subsequently passed as recorded above. Full local coverage passes 169 suites / 2,420 tests plus lint. See
[the retained failure and clock repair](2026-09-07-release28-clock.md).
The prior 1.0.26 full verification (`34070192341`, uncached identity at
01:18:17 UTC), 1.0.25 verification at 00:32:55 UTC and retained attempt-1
local-port collision remain historical checkpoints.
Later releases remain local until the preceding complete CI/live gate passes.

The earned Wizard Earth comparison on clean `fb35139` **passes in 31.4 minutes**:
all four Verdant bosses and encounter-room checks, recall/re-entry, manual Earth
story reward and saved Rootheart raid access. The clean earned-readiness checkpoint,
final browser errors, credential scan and isolated cleanup also pass. See
[the exact scope and retained failures](fresh-progression-evidence.md). This is
one class/seed/realm, not closure of the whole dungeon/campaign or 1.1 gate.
Main integration of the clock-only repair passes **181 client suites / 2,518 tests
in 111.705 seconds**, log `/tmp/eidolon-clock-merged-client.log`, session `41396` closed.

The same test-only repair is merged into queued descendants without runtime
changes. Sequential ancestry and package/manifest/login versions are checked.
The subsequent 1.0.31 test-only isolation repair is also inherited sequentially.
Each 1.0.32–35 successor differs from its previously tested candidate only in the
near-death unit test and repair evidence document. Package/manifest/login version,
separate patch-note entry and preceding-repaired-release ancestry are checked.
Main integration passes another **20 race repetitions in 4.941 seconds**,
`/tmp/eidolon-main-qa-isolation-merged.log`. Its unversioned ground-spell changes
remain separate from every queued release candidate.
These are the current successor sources; older source IDs below remain historical
implementation/validation receipts, not the next commits to push:

| Version | Queued source | Branch |
|---|---|---|
| 1.0.29 | `bc96862209b621b1e995c3dd4d9d72acf61aaf44` | `release/29-with-clock` |
| 1.0.30 | `c3247e849daad029b0c4f053b3d4d969ebba0f82` | `release/30-with-clock` |
| 1.0.31 | `a82baa2adcd41d25f9e9bc01c96d3af6a853674f` | `fix/release31-qa` |
| 1.0.32 | `d578bdfff7cd998c56bc422bc403d4cbe666b902` | `release/32-with-qa` |
| 1.0.33 | `0024f3370c0f1e648bc219a5d3ac816b4566a3e2` | `release/33-with-qa` |
| 1.0.34 | `dba826845e13d81586ccecd06c352b7a662d42af` | `release/34-with-qa` |
| 1.0.35 | `948ed0c178c7c5967db078b53ef951d930660f30` | `release/35-with-qa` |
| 1.0.36 | `90e157973178fcd9907a756d8729248b49c312df` | `release/36-with-combat` |
| 1.0.37 | `47a565b0ec4d38ef9149b1a7055cf056ccfe3802` | `release/37-with-protection` |
| 1.0.38 | `add49409a0b6fd845ebd7995aa462731b2a29271` | `release/38-with-space` |
| 1.0.39 | `c6145c35dc935ae197ca643ce1a3dfe75416fcd1` | `release/39-with-party` |

Alpha 1.0.34 is committed locally and merged into main as `976235a`.
The phone stash has separate notes/version metadata, server-side Chronicle
deposit protection, rejection feedback, explicit Store/Withdraw and saved item
verification. Local checks pass: 182 client suites / 2,530 tests, lint, full
server race checks, 43 anonymous browser checks, and the final portrait/landscape
real-server inventory/stash/login repeat in 1.4 minutes. See
[phone stash evidence](2026-09-07-phone-stash.md). Not pushed; preserve every
preceding release gate.

The September 7 forge-refresh and dungeon-guide reports are now in the roadmap's
immediate hotfix list. Their implementation and retained failing regressions are
tracked in [forge and guide evidence](2026-09-07-forge-guide.md). Alpha 1.0.35 is
locally verified and committed as `0088543`: 183 client suites / 2,556
tests, lint, full server race suite, 46 anonymous browser checks and the final
versioned real-server forge/persistence/guide route in 23.2 seconds all pass.
It has separate patch notes and synchronized login/package/runtime metadata.
The runtime also repairs the confirmed Forge approach blockage and vacant-item
hydration discovered by the route. No later-version goal or physical-phone
playability gate is closed, and this candidate is not yet published.

The next unversioned range-consumer work is tracked in
[the range evidence](2026-09-07-talent-range-work.md): Teleport and Scorch Beam
now consume existing range talents, with paired client/server boundary and
wall/presentation checks. The remaining Wizard/Rogue consumers, area probe and
whole talent audit are still open. This working tree is not the queued 1.0.35
source and must not replace it in the sequential deployment queue.

Local checkpoint `18f1636` additionally connects Rogue movement ranges and
restores Shadow Lunge's promised bleed plus actual enemy bleed ticks. Its final
full server race suite passes (game **230.350 seconds**), alongside 187 client
suites / 2,676 tests and the real-server Rogue/Cleric cast/login route. The
follow-up poison checks reproduced applied-but-inert enemy poison and spread
through dungeon walls. Both are repaired locally, with actual coated attack /
projectile tick, kill-credit and cover regressions passing; the separate poison
full race suite also passes (root **18.502 seconds**, game **278.453 seconds**).
See the same range evidence for retained
failures, exact logs and remaining cone/placement/area work. None of this local
unversioned work changes the source or publication status of queued 1.0.35.

The next local Flame Whip change connects its actual talent-adjusted cone with
cast intent, offline body/cover checks, and explicit accepted radius/arc through
the network. Its new isolated browser route passes in **43.0 seconds**, verifying
12m versus trained 14.52m actual meshes on High/Low and saved ranks. Full regression
suites pass: **188 client suites / 2,704 tests**, lint, and server race checks
(root **16.391 seconds**, game **310.466 seconds**). A final added test-only
angle/relationship/CC-immunity race check also passes. The normal combo
build-access limitation (different branches replace the unlocked list) is also
recorded there; a prepared combo fixture is not a player-facing loadout sign-off.

Alpha 1.0.33 phone status implementation `fe857a6` is committed locally with
separate notes and synchronized metadata. It adds tap-readable buff/debuff details,
stable countdown rows, explicit Close/Escape and unobstructed combat/chat controls;
short landscape uses a compact minimap to avoid covering Attack. The real-server
phone route passes countdown/expiry, ordinary casts, chat and saved training;
180 integrated client suites / 2,511 tests, lint and all 39 anonymous browser checks pass.
The latest main hunt diagnostics and movement-input QA are merged into this
candidate; integration validation is recorded in
[phone status evidence](2026-09-07-phone-status.md). Not published, not a full
phone-playability milestone; physical-device and camera-composition gates remain.
The final integrated gameplay repeat passes in 38.8 seconds after making the
test respect the server's existing global cooldown; earlier failures remain in
the evidence record. This candidate is ready for its place after 1.0.32.

Alpha 1.0.31 healing implementation `b2bf5fd` is locally verified and merged as
`1d425049234293622c15c769b468cb4d78ab53f1`, branch `release/31-with-healing`; not
published. Actual direct/periodic healing regressions, full race checks, 177 client
suites / 2,479 tests, lint and the real-server phone cast/purchase/login route pass.
It has its own patch notes and synchronized login/release metadata. The three
remaining duration/range/area probes still fail intentionally. See
[the scoped healing evidence](2026-09-07-talent-healing.md).

Alpha 1.0.32 is committed locally as `95de5ce8e514d4c495cb74ea63b41654dc7bc5fa`,
branch `release/32-with-duration`. Timed Wizard duration consumers and general
phone talents are verified by paired casts, expiry, all class/branch menu cases,
2,498 client tests and real phone timer/badge/expiry/login checks. The unchanged
full race rerun passed after a retained, unreproduced Tripwire fixture failure.
See [the complete evidence and limits](2026-09-07-talent-duration.md). Not published;
the full 1.1–1.10 roadmap and ordered deployment queue remain open. Integration
with the later hunt diagnostic was merged as `b0f2db8`; the merged tree passes
179 client suites / 2,501 tests in 57.571 seconds.

Previous release checkpoint (September 6): **1.0.24 (`44c7ed1`) was fully
verified**. CI **`34065220719`** passed every job, including final live
four-class/remote-animation QA. Fresh post-terminal uncached checks at
**23:39:32 UTC** matched frontend manifest, login label, main entry query and
backend health to `44c7ed1509317c499643c10d77b71ebb228d2025` / Alpha 1.0.24;
health is `ok`, database `ready`. Only **1.0.25
`d55b5d8d8460f75513a0eca02baf873aa52203c6`** was pushed next; CI
**`34067519448`** attempt 2 is running. Attempt 1 stopped before gameplay because
the local readiness check occupied API port 18085; no deployment ran. The unchanged
failed jobs were rerun after exact local cleanup, and new local QA defaults use
18185 to prevent that collision. No 1.0.26-or-later release has been pushed.

Previously, corrected 1.0.23 CI **`34062629059`** passed every job. Its
post-terminal uncached checks at **22:51:20 UTC** matched all four identities
to `5f1c3f71de4f22f8fa3bb0f1706154085020fe4f` / Alpha 1.0.23, with healthy backend
and ready database, before 1.0.24 was published.

Previously, 1.0.22 CI **`34058325420`** passed every job, including final live
character/animation QA. Post-terminal uncached checks at **21:26:23 UTC** matched
frontend manifest, login label, main script release query and backend health to
`e0b9afd3f8cfcefdbd056ef0339cb7937c27c4e7` / Alpha 1.0.22; health reported status
`ok`, database `ready`. **1.0.23 `ad72a64` is pushed**, but CI **`34061096121`
failed before deployment** in its animation gallery check (Imp Walk/Run read
Idle). Both deployments and the live gate were skipped. A gallery preview-jump
lifecycle repair passed local validation and is now pushed as **1.0.23
`5f1c3f71de4f22f8fa3bb0f1706154085020fe4f`**, whose complete gate is now verified
above. Uncached checks at 22:42:30 UTC also matched the corrected release, but
were pre-terminal observations, not the evidence used to advance the queue.

Previously, corrected 1.0.21 (`9f58757`) passed every job in CI `34055526018`,
including final live character/animation QA. Post-terminal checks at **20:32:20 UTC**
matched frontend manifest, login label, main script release query and backend
health to `9f587570313d2f78aa469f21bd73bf8db1dd50ab` / Alpha 1.0.21; health reported
status `ok`, database `ready`, before 1.0.22 was published.

Previously verified 1.0.20 `99303f5` passed CI `34031297122` and its post-terminal
identity checks. The original 1.0.20
(`bd54b2a`) deployed but failed CI `34028688737`'s final live multiplayer check;
that failure remains recorded rather than reclassified as a pass.

The confirmed loot-over-enemy targeting defect is corrected in the successor
1.0.20 commit **`99303f5a108ab1a965bd723fbd4272923a0f67b9`**. See the separate
[repair record](2026-09-06-release20-targeting-repair.md). After its full gate,
**1.0.21 `c76db47` was pushed to `master`**, but CI `34051295918` failed final
live gameplay after both deployments succeeded. Its two loot attempts expected
occupied slots to exceed 24 and timed out at 24; the bag limit is 25, so this
alone does not prove a full-bag defect. The test also blindly clicks a projected
ground position and treats stack merges as failed pickups. Corrected successor
**`9f587570313d2f78aa469f21bd73bf8db1dd50ab` passed CI `34055526018`**, with exact
item/quantity receipts, actual pointer acquisition, recorded early manual pickups
and saved-quantity checks. This successor clears the live gate; the old failure
remains recorded, and its precise cause is not proven by the limited old diagnostics.
Local merges carry that same fix forward and preserve ancestry:

| Next version | Queued source | Supersedes |
|---|---|---|
| 1.0.21 | `9f587570313d2f78aa469f21bd73bf8db1dd50ab` (fully verified live) | `c76db47`; strengthens pickup and persistence verification |
| 1.0.22 | `e0b9afd3f8cfcefdbd056ef0339cb7937c27c4e7` (fully verified live; CI `34058325420`) | `ed793e0`; inherits corrected 1.0.21 |
| 1.0.23 | `5f1c3f71de4f22f8fa3bb0f1706154085020fe4f` (fully verified live; CI `34062629059`) | `ad72a64`, whose CI `34061096121` failed before deployment; adds gallery jump cleanup while retaining collection inventory repair |
| 1.0.24 | `44c7ed1509317c499643c10d77b71ebb228d2025`, branch `release/24-with-gallery`; fully verified live, CI `34065220719` | `bcc29f4` plus corrected 1.0.23; phone navigation and fresh-opening QA |
| 1.0.25 | `d55b5d8d8460f75513a0eca02baf873aa52203c6`, branch `release/25-with-gallery`; original runtime `bea6c34`; pushed, CI `34067519448` running | `dd2ce16` plus corrected 1.0.24; starter encounters, Ilyra guidance and recall pursuit cleanup |
| 1.0.26 | `85efebef86ccb9a980bc630b9e860d7f68c47d4b`, branch `release/26-with-gallery`; original runtime `479cfd7` | `f0a1286` plus corrected 1.0.25; server-sourced entry requirements and guarded entry |
| 1.0.27 | `0d4e1a1fb37d728db85c1eac9d56b6dc3bc785dd`, branch `release/27-with-gallery`; not pushed | original `ac494b8` preparation copy, earned-route QA `f0cfc15`, and inherited gallery repair |
| 1.0.28 | `424e6b11579b5e7ea5c50a060dcb89011fab7126`, branch `release/28-with-recovery`; runtime `d4670b2`; not pushed | equipment-slot validation, lossless legacy recovery and readable phone recovery panel; separate notes/version metadata |
| 1.0.29 | branch `release/29-with-economy`, locally verified; not pushed | real talent cooldown/mana consumers, matching client checks and explicit economy contract |
| 1.0.30 | `c6e5cd4f5c1aab13481dc0633c8202f609e76e51`, branch `release/30-with-imp`; browser verification in progress, not pushed | Imp arrival null-destination repair, server-owned Imp AI lifecycle and disjoint Linux QA services; separate patch notes/version metadata |

The corrected 1.0.21 → 1.0.22 → 1.0.23 → 1.0.24 ancestry was checked with
`git merge-base --is-ancestor`. Exact clean `9f58757` passes **163 client suites /
2,351 tests in 73.794 seconds**, lint and real extended gameplay in **29.5 seconds**
(27.6-second body). That run observed an actual early manual pickup request,
matched equipment quantity 0 → 1, then verified the received item after dungeon
return, reconnect and fresh login. Credential scan and disposable cleanup passed;
logs `/tmp/eidolon-release21-pickup-final{,-client}.log`, sessions `84554` and
`36573` closed. See the [pickup verification record](2026-09-06-release21-pickup-verification.md).

Exact clean `c76db47` repeated the real phone inventory route successfully in
**59.6 seconds** (58.6-second test body), including both orientations, normal
combat loot, equip/unequip, canceled/confirmed drop and manual recovery. Credential
scan and disposable cleanup passed; log `/tmp/eidolon-release21-targeting-inventory.log`,
session `59951` closed. This verifies the next Settings candidate after the
targeting merge, not the old failed 1.0.20 deployment.
Publish each next release only after its predecessor's full CI/live gate. The
earned Earth campaign route passes locally; the wider 1.1–1.10 scope stays open.
Earlier entries describe their status at the time,
not the current queue. Do not publish a successor before the preceding version's
complete CI/live verification. The original 1.0.14 failure remains recorded below.

## September 6 continuation — dungeon class and campaign evidence

### Alpha 1.0.30 candidate — a steadier hunt

The combined earned route in session **`92076`** is closed with failure after
28.6 minutes. Its clean earned-readiness checkpoint passed at level 34, and it
defeated Rootbound Warden, Briar Matron and Rustbound Colossus. A later retreat
failed to establish six-unit displacement while the player was alive at level 52;
Hollow Sentinel and the subsequent campaign checks were not reached. Credential
scan and isolated cleanup completed. No full dungeon clear is claimed. See the
[detailed outcome](fresh-progression-evidence.md).

Original launch record: log
`/tmp/eidolon-1-0-30-fresh-dungeon-host.log`, from exact clean **`c6e5cd4`** on
local API/Mongo 18185/18186, host networking and static port 4187. The initial
18087/18088 launch was safely refused before build/browser because an unrelated
service owns 18088; it was not stopped or changed. Keep runtime and selected QA
sources were frozen until the handle was terminal. Do not infer a readiness or
dungeon pass from the completed unit checks. CI 1.0.25 attempt 2 remains in its
full predeploy character job; only 1.0.24 is fully verified live.

Runtime/configuration commit **`3375447`** remains local. The following QA-only
work extracts the shared dungeon traversal without removing assertions, defaults
it to ordinary town-guide entry, and adds `fresh-dungeon` for the no-grants earned
chain plus complete Verdant and manual story/raid-access persistence. The
prepared route explicitly retains its existing QA waypoint; it is not presented
as earned evidence. Final client **176 suites / 2,473 tests in 57.971 seconds**,
lint and shell syntax pass. The first combined browser measurement is active above;
see [fresh progression evidence](fresh-progression-evidence.md).

The Imp exception found by the earned readiness route now has eight regressions:
five fail before the scoped repair, all eight pass afterwards. Replicated Imps
also stop making a second local AI decision after their server-owned base update.
Full client **173 suites / 2,461 tests in 65.521 seconds**, lint and server race
checks pass (root 9.330 seconds, game package cached). The new earned-readiness
browser run **failed its final browser-error assertion after 15.3 minutes**;
session `22831` is closed, log `/tmp/eidolon-1-0-30-fresh-ready.log`. It reached
earned level 34, zero deaths, saved manual rewards and enabled entry, with no Imp
exception recorded. Chrome instead recorded local-module `ERR_NETWORK_CHANGED`
failures. No clean full-route pass is claimed. Credential scanning and cleanup
passed. The CI/local API-port collision is separately prevented with disjoint
port defaults; Linux uses the existing loopback host-network mode to avoid
script-created bridge/veth changes. See the
[repair record](2026-09-06-imp-movement-repair.md). No dungeon clear or balance
change is claimed by this narrowly scoped fix.

### Earned Wizard defensive route and remaining talent probes

The optional `fresh-ready` measurement now uses a normally selected Control &
Utility specialization, available Arcane Shield and ordinary ground-click
retreats, without progress grants or a changed death bound. Its first run failed
before the Imp hunt: a normal death during target-search travel escaped the
combat-only recovery path. The diagnostic showed a dead character, not a living
collision blockage. Target-search death now goes through the same counted
respawn path; live-character navigation errors still fail. **219 focused tests**
(including version/history checks) and lint pass.

The second run **failed its final browser-error assertion after 12.4 minutes**;
session `11882` is closed. Gameplay assertions reached earned level 34 with zero
deaths, both manually claimed contract rewards saved after fresh login and
Verdant entry enabled. Preparation saved seven legal equipment slots, five
Mastery ranks and the selected C branch/hotbar. The Imp hunt used 205 ordinary
retreats and seven accepted Shields, with no rejected Shields. However, an Imp's
roam update passed a null destination to `Vector3.distanceTo` after `Actor.move`
cleared it on arrival. This is an entity-update error, not a proven world-generation
defect. The route is **not a clean readiness pass**. Credential scanning and exact
disposable cleanup passed. Full client verification passes **172 suites / 2,452
tests in 61.316 seconds**. Details and retained failure are in
[fresh progression evidence](fresh-progression-evidence.md).

Independent build-overlay probes reproduce four more real-cast defects in
healing, shield duration, range and area. The separate
`npm run audit:talent-consumers` command deliberately reports these open failures;
it neither changes runtime code nor suppresses standard release regressions.
The [consumer audit](2026-09-06-talent-consumer-audit.md) records paired outcomes
and the required client/server geometry and presentation follow-through. This
is a QA/evidence follow-up to 1.0.29, not another player-facing release.

### Alpha 1.0.29 candidate — make your training count

Paired actual casts reproduce missing talent mana/cooldown consumers in all
four classes, and four client regressions reproduce the matching prediction
failure. The candidate connects the existing bonus definitions to real spell
execution, input affordability, cooldown prediction, HUD cost and Teleport charge
recovery. A shared Go/JavaScript contract checks the relevant metadata across all
160 talent entries; this is not a claim that every talent effect works.

The new phone route purchases ten Wizard ranks through normal UI on an explicitly
prepared disposable level-100 fixture, verifies server-confirmed Fireball cost
30 → 21 and reduced cooldown, and repeats after fresh login in landscape. It
passes in **25.8 seconds**, with credential scan and exact cleanup passed. Full
client/lint checks pass **170 suites / 2,435 tests** after real-class multiplayer
override coverage. Full server race checks pass (game package **245.523 seconds**
in the final repeat), including both Teleport charges. The patch has separate
1.0.29 notes and aligned version metadata; its publication source is
`release/29-with-economy`, and it is not pushed. See the
[talent economy record](2026-09-06-talent-economy.md) for formulas, preserved rates,
remaining talent categories and evidence limits.

### Alpha 1.0.28 candidate — every item in its place

The ordinary bag-click gem defect now has client/server slot validation and an
explicit recovery path for existing saved items. Recovery stages all merges so
a full bag cannot duplicate a partial stack or lose the original; unsupported
entries remain saved but grant no equipment bonuses. A readable phone panel
offers Back to bag and reachable recovery actions above persistent chat.

The real-server legacy fixture passes full-bag rejection, legal equip, exact
18+5 gem conservation, direct saved-state inspection and fresh login in **11.4
seconds**. It is explicitly seeded into a newly registered run-owned local
account, not earned-progression evidence. Final client validation passes **169
suites / 2,418 tests**, lint and full server race checks pass, and **seven phone
recovery/bag layout checks** pass. The normal phone inventory gameplay regression
also passes in **36.2 seconds**, covering both orientations with equip/unequip,
confirmed/canceled drops, manual pickup and reconnect persistence. Its prepared
level-30 fixture is functional evidence only. Retained failures and scope are in the
[equipment recovery record](2026-09-06-equipment-recovery.md).

The patch is committed as `d4670b2`, with its own 1.0.28 notes and synchronized
version metadata. It remains
behind the ordered 1.0.23–1.0.27 release gates; no wider roadmap milestone, fresh
Imp hunt or physical-phone review is marked complete by this repair.

### Earned preparation extension and 1.0.23 predeploy repair

The next optional `fresh-ready` route uses ordinary story/contract combat and
manual rewards, then earned equipment and Fireball Mastery selection. Its first
Wizard run passed the two story chapters, 100-Skeleton contract and saved level
27 preparation. The Imp extension failed on its third death after last reporting
61 credits at level 28; no Imp reward or dungeon readiness pass was obtained.
The test also exposed a persistent unsupported gem equipment slot through an
ordinary desktop click. Its helper now excludes gems and resolves only empty
legal slots, but that corrected build needs a new measurement. Game-side slot
validation/recovery and truthful/functional talent bonuses are concrete follow-ups
recorded in [fresh progression evidence](fresh-progression-evidence.md).
No gameplay balance changed in this QA-only extension; lint and shell syntax pass.

1.0.23 CI `34061096121` failed the predeploy gallery on an Imp movement preview;
deployments were skipped. A previous actor's one-second preview jump timer was
not canceled by presentation cleanup and could later reset the replacement actor
to Idle. Three focused regressions reproduce this; the scoped gallery cleanup
repair passes 21 focused checks and the full 165-suite / 2,364-test client suite.
The full rendered gallery repeat **passes all 30 checks in 4.1 minutes**, including
the original strict movement matrix and new interrupted-jump regression. The
repair is committed and pushed as `5f1c3f7`; CI `34062629059` is running. Local
merges carry it through the queued 1.0.24–1.0.27 versions without publishing them.
See the [gallery repair record](2026-09-06-release23-gallery-repair.md).
Uncached live checks at **21:53:29 UTC**
still match healthy 1.0.22 `e0b9afd` across manifest, login label, main script and
server, with database ready. Later releases remain queued pending a fully verified
1.0.23 successor. The full roadmap goal stays active.

The integrated 1.0.27 tree passes **221 focused gallery/actor/version tests in
1.444 seconds** and lint (`/tmp/eidolon-gallery-queue-focused.log`). Each queued
1.0.23–1.0.27 SHA has checked sequential ancestry and matching package, manifest
and login versions. All local browser, client and push handles from this
continuation are closed. CI `34062629059` remains running; its client job has
passed. The next publication target is **1.0.24 `44c7ed1`**, only after the full
corrected 1.0.23 CI and post-terminal live identity checks. The new gem-slot and
talent-consumer findings remain open; the failed fresh-readiness route is not a
completed first-hour or dungeon balance gate.

### Alpha 1.0.27 — before the descent (local candidate)

The previous goal turn implemented and verified 1.0.26, verified 1.0.21 live,
and pushed 1.0.22; it was progress. This continuation corrects stale level-30
claims in town guidance and gives Ilyra's dungeon handoff actual preparation
context, with authoritative entry levels in all four dungeon objectives. Rewards,
manual turn-ins, existing-save progression and dungeon gates remain unchanged.
Focused regressions and final full client/server checks pass: **167 suites /
2,389 client tests**, lint and full Go race checks (root 17.100 seconds, game
177.865 seconds). Three phone conversation/journal layouts pass. Exact clean
runtime `ac494b8` repeats the collection/Ilyra-preparation route in 1.5 minutes,
with zero deaths, manual rewards and fresh-login persistence. The existing 100-Skeleton route passes
through manual 100-gold / 50,000-XP turn-in and login persistence in 208 seconds
from hunt start, with no deaths, ending at level 27. This is not yet level-30
entry or a complete first hour. See the
[preparation measurement](fresh-progression-evidence.md) for failed approach and
contract-list assumptions, their diagnostics, and the final direct-NPC result.

CI `34058325420` for 1.0.22 completed successfully and fresh post-terminal
identities match. Queued 1.0.23 `ad72a64` was then fast-forward pushed; CI
`34061096121` is running. Wait for its full gate and post-terminal matching
identities before pushing 1.0.24 `bcc29f4`. All local validation handles from this
continuation are closed. The full roadmap remains active and incomplete; the
next first-hour work is ordinary preparation from the measured level 27 to 30,
appropriate equipment/skill choices and actual earned-level dungeon play.

### Alpha 1.0.26 — know when you are ready (local candidate)

The previous continuation completed and verified the starter/recall candidate;
this one extends genuinely earned progression through the second Chronicle and
addresses the guide's confirmed misleading entry flow. The old menu offered
under-level Start and all run bands, while claiming every dungeon unlocked at 30.
Twelve new desktop/phone checks reproduce the defect; the corrected menu passes
all 30 focused tests and server race-enabled authority/snapshot checks. Patch
notes preserve all earlier releases and login/build defaults advance together.
The full client suite passes **166 suites / 2,386 tests**, lint and full Go race
checks pass, and all four classes pass the first two genuinely earned chapters
with no deaths, manual rewards and fresh-login persistence (level 16 for Fighter,
Wizard and Rogue; 17 for Cleric). Three enlarged-text phone layouts also pass;
the muted disabled-button appearance passes the final 27.7-second layout repeat. The
level-16/17-to-30 preparation interval is not yet verified. See
[fresh progression evidence](fresh-progression-evidence.md) for the interrupted
first measurement's harness defect and the unchanged XP/entry-authority scope.
Exact clean runtime `479cfd7` repeats the Wizard route successfully in 1.8 minutes,
ending at level 17 with zero deaths and all manual turn-in/persistence checks.
All local validation handles from this continuation are closed. The full goal
remains active; the next first-hour work must measure an ordinary preparation
route to level 30 without debug grants, alongside the outstanding dungeon,
phone, campaign and later-version gates.

Corrected 1.0.21 CI `34055526018` passed the entire gate and post-terminal identity
checks. The next 1.0.22 source `e0b9afd` was then fast-forward pushed to `master`;
CI `34058325420` is running. Wait for its full gate and fresh matching identities
before pushing queued 1.0.23 `ad72a64`; never push the local 1.0.26 HEAD past it.

### Alpha 1.0.25 — a first step beyond the wards (local candidate)

The previous turn was progress: it corrected and pushed 1.0.21 verification and
reproduced fresh Fighter combat failure. This continuation implements an actual
level-one-to-ten Skeleton band around Lanternhold, three shared ordinary east-gate
encounters, preserved outer/dungeon profiles and Ilyra's matching guidance.
The new full-world test found elites could still spawn at x=120 beside the gate;
their spawn positions now stay beyond the starter band without changing their
strength. A Cleric run then exposed stale overworld recall pursuit. Four failing
client regressions reproduced it; living recall now clears pending combat and
travel state immediately. Both fixes are included in 1.0.25 patch notes and its
synchronized login/server/build metadata; older patch-note history is retained.

Fresh Fighter, Wizard and Rogue routes passed with zero deaths on the initial
starter candidate (97 / 34 / 38 seconds); final-code Cleric passed in 43 seconds
after recall repair. All earned their kills and manually claimed rewards, then
verified saved progress, without debug grants. The final real phone quest route
also passes (48.9 seconds), but uses functional level/waypoint preparation.
Final client checks: **165 suites / 2,371 tests, 124.612 seconds**, lint; focused
recall/version checks **252 tests, 6.85 seconds**. The full server race rerun
passed (root 16.862 seconds, game 251.592 seconds). Clean runtime commit
**`bea6c34`** then repeated the fresh opening successfully as **Fighter in 93
seconds** and **Cleric in 45 seconds**, both zero deaths, level one → five,
manual rewards and saved progress. Credential scans and disposable cleanup
passed; logs `/tmp/eidolon-1-0-25-exact-{Fighter,Cleric}.log`, session `88889`
closed. The final test-only cleanup inspects `NewWorld`'s actual population
without an extra spawn call and checks that outer elites keep their positions.
Those final focused server regressions passed ten race-enabled repetitions in
**4.245 seconds**; session `16149` closed. Runtime is unchanged from `bea6c34`.
Full details and failed attempts:
[fresh-character evidence](fresh-progression-evidence.md).

Preserve **`bcc29f498504fa83a53f62e5cb5aa00e020844c8`**, branch
`release/24-with-pickup`, as the unpublished Alpha 1.0.24 tip; the new candidate
must not replace that release or jump past 1.0.21–1.0.24. The current working
version is 1.0.25, not the version deployed live. The broader first-hour XP/
dungeon handoff, full 1.1 dungeon/party matrix and the rest of 1.1–1.10 remain open.

Latest continuation completed and pushed the 1.0.21 pickup-verification successor
after exact-source checks, then reproduced a separate fresh Fighter failure.
The Fighter suffered three deaths without a kill on both the clean `f2b7b76`
route and the diagnostic repeat; the latter proved actual target health loss
against a level-10 Skeleton. See the [fresh-character evidence](fresh-progression-evidence.md).
Do not weaken the no-grants route, classify this as a dungeon-targeting failure,
or claim all-class onboarding is complete. Starting encounter/stat budget is the
next gameplay repair, alongside the ongoing corrected 1.0.21 CI/live gate.
The final merged Alpha 1.0.24 helper/version checks pass lint and **208 tests
in three suites, 1.998 seconds**; `/tmp/eidolon-1-0-24-observer-merge-checks.log`.

Clean `a8d0aa9` passed the full Cleric Verdant route in **8.7 minutes**, Normal
30 / player 100, seed `6533633041847534961`, generator 2 attempt 0. All four
bosses and rooms cleared, gold and completed-run recall/re-entry persisted.
Credential scanning and disposable cleanup passed; session `50690` is closed.
This is solo basic/primary-ability functional evidence, not every Cleric skill,
party healing, level-appropriate balance or a complete class/instance matrix.

A new optional `fresh-opening` route starts at level one and uses ordinary town
travel, Skeleton combat and explicit Ilyra turn-in, with no level grants, QA
waypoints, item grants or quest-progress grants. The corrected route passed in
**93 seconds** (1.6 minutes including overhead): Wizard level one → six, three
earned kills, 18 retreats, **one death**, normal respawn, manual 100 gold / 500 XP
turn-in and fresh-login persistence. Credential scan and cleanup passed; log
`/tmp/eidolon-fresh-opening-recovery.log`, session `92005` closed. Source was
`a8d0aa9` plus these test/documentation changes; runtime was unchanged. Earlier
stationary-control and recovery-helper failures remain recorded separately.
This is opening-chapter evidence, not a whole first-hour benchmark.
Source inspection found the first two chapters give
8,500 quest XP, while the current exponential curve requires roughly 98,400
cumulative XP to reach level 30. Combat also awards XP, so the quest-only budget
is a reason to measure earned progression, not proof of the actual pacing or
authorization to bypass dungeon entry gates.
Method, failed attempts and the remaining earned-progression checks are tracked
in [fresh-character evidence](fresh-progression-evidence.md).

Latest continuation: the preceding goal turn was progress (1.0.23's sync repair
and earned Earth route). Clean `fba546a` subsequently passed a full Rogue Verdant
run in **8.9 minutes**, seed `-7334011171890423023`, Normal 30, generator 2 /
attempt 0, all four bosses/rooms, gold and preserved completed-run recall/re-entry.
Credential scan and cleanup passed; session `37673` is closed. It adds class/
layout evidence, not the full skill/party/level-appropriate matrix.

The next phone-menu/HUD implementation is isolated in worktree
`/tmp/eidolon-phone-hud-uGi4ZU`, branch `feature/phone-hud-composition`, based on
`fba546a`. The current working design moves five navigation shortcuts into the
existing menu, keeps Back outside its scroller, enlarges health/resource text and
removes the reproduced short-landscape header overlap. Party-target ergonomics
remain separate; do not collapse all party targeting without Cleric verification.
Initial checks pass 164 client suites / 2,358 tests and lint. Browser layout checks
are running in `/tmp/eidolon-phone-hub-layout.log` (session `72794`); this is not
yet a versioned, verified or published release. Runtime changes were made only
in that worktree while the clean main-source Rogue browser ran.

The previous goal turn completed the Settings/adventure candidates and exact-source
checks; it was progress, not completion of the roadmap. This continuation started
by confirming 1.0.19's CI was still live. It subsequently passed predeploy QA and
both deploy jobs; final live character QA is still running.

Clean `a323d96` passed a complete **Wizard Verdant run in 8.4 minutes**, Normal 30,
generator 2, seed `4005696311737504843`: all four bosses, all encounter rooms,
gold, town recall and completed-run re-entry. Credential scan and disposable
cleanup passed; session `18569` is closed. Full evidence and limitations are in
`dungeon-playthrough-evidence.md`. This adds another class, not the whole matrix.

The next dedicated `chronicle-earth` route is being prepared to earn the first
three Chronicle chapters through actual combat, natural relic drops and manual
turn-in, then prove the dungeon kill opens Rootheart access only after Ilyra's
completion dialogue. Level preparation and encounter travel/protection are
explicit; it does not grant quest progress, items or raid access and is not
fresh-level balance evidence. The implementation is test-only and not yet run.

Review also found the old phone bag QA route tried to tap hidden Auto-loot after
the 1.0.21 Settings reflow. In `/tmp/eidolon-release21-qa-iF7eif`, branch
`qa/phone-settings-inventory`, `2f5c46bef15601d965cda2bd098867cfe12b4b6d` adds
the real Play-category tap and scroll before the existing checkbox action.
Lint passes; exact-source real inventory QA is running in
`/tmp/eidolon-release21-inventory-route.log`. Do not publish the old `0498ffe`
without the correction, or claim the new route passed before it finishes.

The first worktree run stopped before login: its generated `vendor/` browser
dependencies had not been prepared when sharing the installed Node dependencies.
`npm run prepare:client` creates the required local Three/protobuf runtime files.
The exact same committed candidate is rerunning after this setup correction in
`/tmp/eidolon-release21-inventory-route-prepared.log`; the original failed route
does not supply gameplay evidence.

After preparation, exact `2f5c46b` **passed in 1.8 minutes**: normal combat loot,
Settings → Play, and both orientations' authoritative equip/unequip, canceled
drop, confirmed drop and manual recovery. Credential scanning and disposable
cleanup passed; session `94525` is closed. Merge `e3bbcf7` carries those two
test-navigation lines into the later release without changing its runtime.
The old `0498ffe` is superseded as the next publishable 1.0.21 commit.

The first earned Earth route failed after 38.4 seconds at collection turn-in:
four naturally acquired seeds remained visible in the client inventory after
Ilyra completed the chapter (expected zero). Server consumption already has
unit coverage; inspection found `MsgCompleteQuest` sends quests/endgame state
but no updated inventory. This is a real synchronization defect, not grounds to
remove the consumption assertion. Log: `/tmp/eidolon-chronicle-earth-first.log`;
credential scan passed and the isolated run terminated. The optional route does
not yet prove a campaign clear. A separate 1.0.23 correction will carry the
dispatch regression, inventory refresh and an earned-route rerun. The 1.0.22
client suite passed 163 suites / 2,352 tests; lint also passed. The earlier
"not yet run" statements above record preparation, not current test status.

## Alpha 1.0.24 — room for the adventure (local candidate)

Integration update: branch commit `5d9a81a` was merged as clean **`cc1b7d4`**
after the corrected 1.0.20 → 1.0.21 → 1.0.22 → 1.0.23 ancestry. The merged
candidate passes **164 client suites / 2,361 tests in 50.442 seconds**, lint,
the server race suite (root 7.751 seconds, game cached), and an exact-source
real phone-combat repeat in **15.7 seconds**. Both orientations exercise
deliberate selection, Attack/Skill, two-thumb cast, joystick takeover and Clear
Target. Credential scan and disposable cleanup passed; session `26273` closed.
Logs: `/tmp/eidolon-1-0-24-merged-{client,lint,server,phone-combat}.log`.

Implemented in `/tmp/eidolon-phone-hud-uGi4ZU`, branch
`feature/phone-hud-composition`, based on `fba546a`. A single Menu launcher
replaces five permanent phone shortcuts; the same bound navigation controls move
into its readable panel. Back stays outside the scroller, health/resource text
is 16px, and portrait objectives use the freed row. Navigation closes the hub
before opening its destination; opening chat closes it, and opening Menu clears
held movement input. Desktop navigation and camera zoom are unchanged. Party
targeting/roster ergonomics and physical-device sign-off are still open.

Five composition unit cases cover node identity, callback ordering, reachable
Back and safe reinitialization. Final versioned checks pass **164 suites / 2,359
tests in 70.113 seconds**, lint, the complete server race suite (root 9.814 seconds,
game 146.559 seconds), and **31 anonymous cases in 2.8 minutes**. New layout cases
cover 360×800, 844×390 and 568×320 at 125% menu text, including hit targets,
unobstructed health/navigation, scroll bounds, Back, bag navigation and chat.
Inspected captures distinguish the initial menu from its scrolled-bottom view;
these fixtures are layout evidence, not real-world or physical-phone proof.

Real-server core navigation passed in **8.5 seconds**, covering joystick movement,
Bag/Hero/Quests/Social/Map, Skills, camera reset and chat in both orientations.
The updated real inventory journey passed in **37.2 seconds**, including normal
combat loot, both orientations' authoritative equip/unequip, canceled drop,
confirmed drop and manual recovery. Both passed credential scans and disposable
cleanup. Logs: `/tmp/eidolon-phone-hub-{layout,gameplay}.log` and
`/tmp/eidolon-1-0-24-{client,lint,server,anonymous,inventory}.log`.
Separate 1.0.24 patch notes and all release labels/defaults are updated. It is
not yet published and must inherit the pending 1.0.20 live-QA targeting repair
before entering the ordered release queue.

## Alpha 1.0.23 — relics delivered (local candidate)

Committed runtime: `2070c420e9e98f37e75480cbf504c65bf5318fdd`. Its exact clean
source passed the dedicated real-server collection/reconnect repeat in **37.4
seconds** (test body 36.3 seconds), with credential scan and disposable cleanup.
Log: `/tmp/eidolon-1-0-23-exact-collection.log`; session `17371` is closed. This
checks immediate bag consumption before reload and the same remaining relics,
completed collection chapter and accepted next offer after reload/login. It is
not a second full dungeon run. No runtime changes followed the full campaign
pass; subsequent edits added this optional focused QA route and documentation.
Publication remains behind 1.0.20's full gate, then exact 1.0.21 and 1.0.22.

The earned Earth route found that successful collection turn-in consumes the
server's items but leaves the browser's bag stale. `MsgCompleteQuest` now
serializes inventory and quest payloads under world/entity read locks, then sends
inventory before quests. The asynchronous story callout is not treated as an
inventory acknowledgement. Manual acceptance/turn-in, quantities, rewards and
raid gates are unchanged.

The new dispatch test reproduced missing inventory responses for both exactly
four seeds and six seeds before the fix. Afterward it verifies the authoritative
bag, freed slots, spare seeds/unrelated equipment, completed quest/reward, replay
rejection and physical-item rejection despite a saved ready count. Focused
dispatch/recovery checks pass; the complete server race suite passes (root
10.221 seconds, game cached). Client checks pass **163 suites / 2,353 tests in
75.509 seconds**, plus lint. Separate patch notes, login label, manifests and
runtime build defaults identify Alpha 1.0.23.

The real earned route **passed in 10.1 minutes** against `d5b4320` plus this
correction in `/tmp/eidolon-1-0-23-chronicle-earth.log` (session `47393` closed,
credential scan and disposable cleanup passed). It covers ordinary kills,
natural relic pickup, exact consumption on manual turn-in and the sealed pre-clear
raid, all four bosses/rooms of a generated Normal-30 Wizard run with seed
`-3877784623499751578`, generator 2 / attempt 0, preserved completed-run recall/
re-entry, real dungeon quest credit, manual Ilyra completion, Rootheart access
and reconnect persistence. Level-100 preparation and travel/protection are explicit;
this does not establish fresh-level balance, full Wizard hotbars/runes, party raids
or the rest of the campaign. The separate `chronicle-collection` isolated route
supports a shorter exact-commit collection/reconnect repeat without claiming
a dungeon clear. This is not published and does not replace any full-roadmap
gate. Alpha 1.0.22's separate queued source is
`d5b432065ffbc887851613da9c36d6175cc646ec`; later runtime fixes must not be
mistaken for part of that release.

## Alpha 1.0.22 — adventure within reach (local candidate)

Committed runtime: `ecf75247895a4021423c968187e4b143ef3ef901`. Its exact clean
source subsequently passed the complete phone adventure route in **12.7 seconds**,
with credential scanning and disposable cleanup. Log:
`/tmp/eidolon-1-0-22-exact-adventure.log`. Local browser session `91715` is closed.
The following entries retain the implementation/reproduction sequence, not an
unresolved test failure. The release still awaits its ordered publication turn.

Phone dungeon/raid selection has readable native choices and controls, expandable
party/difficulty/daily-reward details, remembered tab scroll, and an always-reachable
Start/Continue footer with the actual selected run summary. Raids hide the dungeon
footer. Existing run settings, follower permissions and Chronicle unlocks are
preserved. Phone reset requires confirmation and is absent without an instance;
cancel preserves the run and focus. The server's occupied-instance rejection is
unchanged. Chat can close the guide and open its composer without disappearing.

Six of seven new unit regressions failed before implementation; the existing
story/leader gate check already passed. Focused checks passed 109 tests; the
initial full run passed **163 suites / 2,351 tests in 58.187 seconds**, plus lint.
Three initial phone layouts passed in **14.3 seconds** at 360×800, 390×844 and
844×390. Inspected dungeon, raid and reset captures with 125% menu text.

The first real-server route entered Verdant and recalled, then failed to walk
after landscape rotation. A diagnostic repeat proved the populated party roster
was above the joystick: `elementFromPoint` returned a `.party-member`, joystick
input stayed zero, and both client/server positions remained at town spawn. A
dungeon creates a party even for a solo player. The landscape roster now occupies
space between the thumb regions. No movement/server guard was bypassed.

The new anonymous populated-party test initially used a desktop browser identity,
causing the application's resize handler to leave mobile mode. Its first cleanup
also obscured the assertion by sending touchEnd without an active touch. Those
test issues were corrected: a phone identity and safe touch cancellation preserve
the original assertions. This does not invalidate the separate real-phone-mode
server reproduction. All **five layout/HUD checks passed in 32.4 seconds**,
including joystick acquisition/release with five seeded members and controls at
390×844, 844×390 and 568×320. The very small landscape case proves thumb access,
not full visual acceptance; header/status overlap and party readability still
belong to the remaining phone polish work.

The corrected real-server route passed in **12.3 seconds**: default-zoom joystick
approach and guide tap, level/story restrictions, initial entry, fully rebuilt
town recall, landscape continuation of the same instance, canceled reset, and
confirmed reset creating a different instance. Only level 30 was prepared;
no instance, crystal access, kill or quest credit was granted. Credential scanning
and exact disposable cleanup passed. This is entry/recovery evidence, not a full
dungeon clear, group combat or physical-device test.

Logs: `/tmp/eidolon-phone-adventure-{red,unit,client,layout,gameplay,diagnostic,layout-device,gameplay-fixed}.log`.
Separate 1.0.22 patch notes and all version defaults are updated. Final versioned
client/lint/server and 28 anonymous checks followed by the real-server route are
running under `/tmp/eidolon-1-0-22-`. No publication or full milestone sign-off
is claimed.

Final versioned checks passed **163 client suites / 2,352 tests in 66.161 seconds**,
lint, server race checks (root 9.683 seconds; game package cached), and all
**28 anonymous browser checks in 2.5 minutes**. The real-server repeat then found
the test's full-speed joystick controller oscillating across its arbitrary
one-metre waypoint: client and server positions agreed around Z=235.53 and 238.23,
with nonzero input. This is distinct from the confirmed zero-input roster overlap.
The fixture now stops within the guide's existing interaction radius (with a
0.5m margin), not at an irrelevant exact waypoint. It still must open the guide
by actual touch and pass every server-owned entry/recall/continue/reset assertion.
The corrected route is running in `/tmp/eidolon-1-0-22-adventure-range.log`.

That fixture revision initially read the guide before town's throttled actor
queue had recreated it after recall. It now explicitly waits for the real guide
actor before reading its radius. The original scenery/collision/position recall
assertions remain, with additional actor readiness rather than a fixed sleep.
Latest route log: `/tmp/eidolon-1-0-22-adventure-ready.log`.

The corrected final route **passed in 13.6 seconds**, including credential scan
and exact disposable cleanup. Browser session `28148` is closed. Together with
the full versioned checks above, this makes 1.0.22 ready for a separate local
commit. The fixture corrections made no runtime changes after the passing
28-case anonymous suite. Publication remains queued behind 1.0.19–1.0.21.

## Alpha 1.0.21 — comfort without losing the view (local candidate)

Committed as `0498ffed14591c10c2d3072a287958e68eed71ff`. Its exact clean source
passed the Settings real-server route again in **8.1 seconds**, with credential
scanning and disposable cleanup. Log: `/tmp/eidolon-1-0-21-exact-settings.log`.
Still queued locally behind 1.0.19 and 1.0.20.

Phone Settings reuses the existing native controls in four readable categories:
Screen, Play, Sound and Device. Navigation and Close remain outside the content
scroller; controls have at least 44px hit areas. Menu text can grow from 100% to
125%, with a separate phone preference, without scaling the world, camera or
desktop layout. This is menu text sizing, not completion of the whole HUD-scale
or physical-phone gate. Settings replaces the pause menu, and tapping the permanent
chat strip closes Settings so the composer is reachable after rotation.

A regression also found missing brightness storage being converted from `null`
to numeric zero. Fresh settings now use the documented 50% renderer default;
an explicitly saved zero remains zero. Initial HTML output now matches that default.

Evidence and corrections:

- Two independent phone-text preference tests failed before the implementation;
  the fresh-brightness test separately reproduced 0 instead of 50.
- Initial rendered layouts failed in both portrait sizes because the new flex
  panel lacked column direction. Correcting composition restored all three cases.
  Visual review then kept category labels unwrapped and the chat strip unobscured.
- The first real-server Settings route found the old pause menu intercepting
  chat after rotation. Closing it when opening Settings fixed the actual route;
  no forced click or weaker assertion was used. The corrected route passed in
  9.3 seconds before the final versioned rerun.
- Final versioned checks passed **162 client suites / 2,344 tests in 60.087
  seconds**, lint, server race checks (root 10.216 seconds; game package cached),
  and **24 anonymous browser checks in 2.0 minutes**.
- The final fresh-character real-server route passed in **8.4 seconds**: native
  touch text sizing, graphics/audio/loot preferences, unchanged camera zoom and
  character position, landscape chat, and reload persistence. Credential scanning
  and exact disposable cleanup passed. No level or progression grants were used.
- Inspected 390×844 and 844×390 Settings captures at 125% and the enlarged
  landscape rune card. Layout coverage also includes 360×800. These are desktop
  Chrome touch emulation, not physical iOS/Android performance evidence.

Logs: `/tmp/eidolon-1-0-21-{client,lint,server,anonymous,settings}.log`.
All login/package/server/deployment version defaults and separate patch notes
identify 1.0.21. Essential dungeon-guide touch flow is next; remaining menus,
physical devices, full dungeon coverage and the broader roadmap gates stay open.

## Alpha 1.0.20 — a build you can read (local candidate)

Committed locally as `bd54b2aab3b56aa6c83efe40d6071e3881ba6074`. Its exact clean
commit subsequently passed the expanded real-server phone build route in
**12.9 seconds**, including credential scanning and disposable cleanup.
Log: `/tmp/eidolon-1-0-20-exact-build.log`. Not yet published.

Phone Skills, Talents, Runes and Combos now have readable cards, permanent section
navigation outside the scroller, explicit build actions and preserved reading
position. Rune selection filters to one ability. Talent reset requires confirmation;
the phone UI never mutates shared ranks optimistically. Correlated server receipts
plus authoritative state confirm changes. Reconnect waits for a full build snapshot
without replaying an interrupted request. Desktop rendering remains on its existing
path. Current level-gated branch progression is explained, not redesigned.

Six new behavior tests failed on the prior UI and passed after implementation.
The initial full client run passed **161 suites / 2,329 tests in 53.91 seconds**,
plus lint. Server race tests passed (root 9.378 seconds; unchanged game package
cached), including new action receipts, rejections and legacy compatibility.
The initial server run caught a violation of the dispatcher's single-switch
architecture guard; moving request-ID parsing into the individual handlers
restored the guard without weakening it.

All three touch-layout cases passed in **11.4 seconds** at 360×800, 390×844 and
844×390; portrait and landscape rune captures were inspected. The first real-server
route confirmed branch and talent actions, then failed because its test selected
Sweeping Strike, which has no rune definitions. The fixture now selects Earthshaker,
an actual supported branch-B rune skill; no assertion was removed. Final versioned
checks and the corrected real-server route are running under `/tmp/eidolon-1-0-20-`.
Separate patch notes and all login/package/server/deployment version defaults
identify 1.0.20. This is not publication or physical-phone acceptance.

Final versioned server race checks passed (root 9.587 seconds; unchanged game
package cached). The first versioned client run found one stale login-version
assertion still expecting 1.0.19; after updating it, **161 suites / 2,332 tests
passed in 64.581 seconds**, plus lint. All **21 anonymous browser checks passed
in 2.0 minutes**. The corrected real-server build route initially passed both
orientations and reconnect persistence in 10.3 seconds, then its expanded route
passed in **13.8 seconds** with canceled/confirmed reset, refunded ranks, re-ranking
and an open-menu WebSocket interruption/resume. The client waited for a fresh
authoritative build before allowing further changes. Credential scanning and
exact disposable cleanup passed. Local browser session `93035` is closed.

Logs: `/tmp/eidolon-1-0-20-{client-final,lint-final,server,anonymous,build,build-final}.log`.
Additional four-class locked-choice checks and explicit rune-button hit-area
assertions are being finalized before commit; no runtime changes followed the
passing real-server route. Broader all-class combat, physical-phone and remaining
menu gates remain open.

Those additional checks passed: **161 suites / 2,336 tests in 59.634 seconds**,
lint and all three explicit rune hit-area layouts in **14.9 seconds**. Final
landscape inspection then prompted a CSS-only composition refinement: talent
and rune actions sit beside their descriptions on short landscape screens so
more of a card fits at once. The anonymous suite and expanded real-server build
route are being rerun after that refinement. Logs use
`/tmp/eidolon-1-0-20-{client-release,lint-release,layout-final,anonymous-release,build-release}.log`.

The final composition reruns **passed**: all 21 anonymous browser checks in
**1.9 minutes** and the expanded server-owned build route in **13.7 seconds**.
The landscape rune card was visually inspected with its name, description,
requirement and Equip action visible together. Credential scanning and disposable
cleanup passed; local browser session `6314` is closed. The 1.0.20 candidate is
ready for its separate local commit; it is not published over the queued releases.

## Alpha 1.0.19 — a story you can settle into (local candidate)

Status: prepared locally, not published; queued behind 1.0.17–1.0.18. Phone quests use
readable viewport-sized conversation/journal panels, footer actions and a compact
tracker that cycles all saved selections. Manual acceptance/completion still
awaits server acknowledgement. Progress updates preserve lore, scroll and focus;
daily Back restores the offers-list position. Chat remains visible below the
panels. Login, package, release defaults and patch history identify 1.0.19.

The initial full client run passed 160 suites / 2,317 tests plus lint. Three
rendered phone layouts passed in 17.6 seconds after correcting a test locator
that did not follow the pending button's changed label. A dedicated real-server
first-chapter route passed in 1.3 minutes: touch acceptance, actual kill credit,
manual landscape turn-in, gold/XP, Ilyra's reply and reconnect persistence. Setup
explicitly uses level 30 and the encounter waypoint; this is neither first-hour
balance nor full-campaign evidence. A later daily-list scroll regression was
reproduced and repaired, and final versioned checks are running. See
[phone evidence](mobile-playability-evidence.md) for logs and limits. The broader
1.1 and physical-phone gates remain open.

Final versioned checks subsequently passed **160 suites / 2,321 tests in 75.584
seconds**, lint, the server race suite, all **18 anonymous browser checks in 1.9
minutes**, and the real-server phone quest route in **1.4 minutes**, including
reconnect, credential scanning and exact disposable cleanup. Inspection and a
failing geometry assertion caught and repaired long tracker titles overlapping
progress. Matching footer actions now retain their DOM/focus across quest updates.
One earlier server turn-in timed out and then passed with diagnostics; its cause
remains unconfirmed, not established by the separate action-node regression.
Keep that failure recorded and retain the diagnostic route during publication.

### Confirmed post-recall turn-in failure and recovery correction

An exact-commit repeat of `43321ed` failed again. The Complete callback fired,
but the server rejected giver distance. Temporary admission diagnostics then
proved that the client reached approximately `(17.5, 215.4)` while the server
still placed it at the recall spawn `(-1.25, 200)`: fresh movement packets arrived
128–943 ms after recall and were rejected by the existing one-second recovery
guard. This explains the reproduced immediate turn-in failure; it does not
retroactively prove the cause of every earlier timeout. Diagnostic-only server
logging was removed after gathering evidence.

The correction gives approved recall/respawn an acknowledged movement context.
Fresh-context movement works immediately, old-context packets remain rejected,
and legacy clients retain their timed guard. Sequence, ability-lock, crowd-control,
distance and geometry checks remain. Join/resume sends the current session
context. Manual quest acceptance and completion are unchanged. Protocol details
and the player-facing correction are included in the unpublished 1.0.19 notes.

Initial corrected checks passed **160 client suites / 2,322 tests in 69.466
seconds**, lint and the complete server race suite (game package 150.448 seconds).
The real-server phone quest route passed in **1.4 minutes**, including normal
kill credit, immediate manual landscape turn-in, gold/XP, next chapter, reconnect
and authoritative movement after reconnect. Credential scanning and disposable
cleanup passed. Additional compatibility/rejection/jump tests and the final server
race run passed (root 9.826 seconds; game 158.739 seconds). The final client run
passed 160 suites / 2,322 tests in 83.576 seconds, plus lint; all 18 anonymous
browser checks passed in 1.9 minutes. Portrait dialogue and landscape journal
captures were inspected. The real-server dungeon death/respawn/re-entry regression
passed in **1.7 minutes**, using a level-30 Wizard, generator 2 and seed
`-7689347035156546500`: normal hostile death, denied dead-player recall, explicit
respawn and guide re-entry preserved the unfinished run. Credential scanning and
cleanup passed. Log: `/tmp/eidolon-recovery-context-dungeon.log`. Logs use
`/tmp/eidolon-recovery-context-`; original reproductions are retained under
`/tmp/eidolon-phone-quest-{transaction,recall-movement}-diagnostic.log`.
These checks do not close the physical-phone, full-campaign or full dungeon gates.

The correction was committed as `98f42866848e6fdd1c113b304b0d5d397e54e14d`.
The exact clean committed runtime then passed the phone quest route in **1.3
minutes** and both two-thumb combat orientations in **16.7 seconds**. Both
credential scans and disposable cleanups passed. Sequential local session `21689`
is closed; logs are `/tmp/eidolon-recovery-context-exact-{quests,combat}.log`.

Next phone implementation: Skills & Runes. Inspection identifies 10–14px inline
descriptions, tabs inside the content scroller, rerenders that discard reading
position, whole-card rank/rune actions and optimistic talent-rank mutations.
Reflow this into readable deliberate controls with server-confirmed feedback and
preserved navigation. Preserve the actual progression rules: selecting a branch
currently enables its level-eligible skills automatically; do not invent a new
point-spending requirement during the UI redesign. Verify branch choice, talent
ranks, rune equipment and reconnect with the real server. No skill-menu runtime
changes are included in 1.0.19.

## Alpha 1.0.2 — rewards and roads that meet

Status: pushed as `89dad70db593ac8509eeef5e0506e796e0aec212`; CI run
`33986072901` completed successfully, including server/client tests, anonymous
browser smoke, disposable full-character QA, both deployments, and live
anonymous/persistent-character/four-class/remote-animation QA.

Changes:

- Publish pending explicit wizard/daily quest conversations and quest rewards:
  gold plus XP, with max-level XP and level-cap overflow going into Resonance.
  Authoritative receipts preserve the exact split through persistence/protobuf.
- Publish the shared overworld projectile-boundary correction for Air and Fire.
- Replace independently overlapping room/corridor/corner floor assembly with
  an exact partition of the server's walkable rectangle union. Emit masonry
  only on exposed boundaries, preserving intersections, holes, and rectangular
  rooms. Align floor textures across partitions with one material and origin.
- Retain the existing room dressing and legacy fallback layouts.
- Synchronize version defaults and include the new dungeon geometry browser
  regression in anonymous CI. Historical notes remain intact.

Evidence gathered before final version metadata changes:

- 146 client suites / 2,096 tests passed, including exact floor coverage,
  no internal wall collision, 40 deterministic rectangle-union seed fixtures,
  large boss approaches, and the legacy fallback. The randomized fixtures test
  the surface algorithm; they are not a sweep of actual server dungeon seeds.
- Hardware browser geometry fixture passed at High/Low; inspected the reframed
  overview. The generated approach has one floor per sampled point, one floor
  material, and no collision corrections along its center-line route.
- Existing isolated real-server Verdant entry/recall test passed on the initial
  baseline. This does not reproduce or resolve the reported exit failure.
  The helper is now stricter: town position, scenery, and cleared dungeon
  collision/layout must all finish, not just the early instance-type update.
- Previous deployed master `f6accbf` has successful CI run `33945080866`, checked
  through GitHub Actions. That is not evidence for the new candidate.

Final candidate checks: the full client suite (146 suites / 2,096 tests), full
server race suite, lint, and whitespace checks pass. The added release-history
assertion and helper checks pass in a subsequent 181-test focused run. The
stricter isolated real-server Verdant entry/return route passes on the candidate
with completed town scenery/collision/position recovery; its disposable Mongo
and API containers were removed by the runner. This remains narrower than
reproducing all reported exit states or playing a full dungeon.

All eight anonymous browser release checks pass, including the new dungeon
geometry fixture. A synthetic 79-rectangle layout produced 157 floor partitions
and 316 wall segments in approximately 10 ms on this host; this is a generation
microcheck, not a multiplayer performance claim.

Independent live endpoint checks on September 5 confirmed both `release.json`
and backend `/healthz` report `Alpha 1.0.2` and the full SHA above; the frontend
entry-point query matches too. This hotfix's publication is verified. It does
not close the broader dungeon repair or milestone gates.

## Alpha 1.0.3 — within reach, safely home

Status: pushed as `2ec04bc94d8b5cd684e7182499172ddd80d1d5df`. CI run
`33987477412` passed server/client/anonymous checks but failed predeploy portal
QA before either deployment. The jump destination was projected before the
camera settled; the retry then inherited the unfinished dungeon visit. The
corrective QA change waits for a visible ground destination and returns the
dedicated character to town after inspection failures or before a resumed run.
That initial attempt did not go live; the correction below subsequently did.

Correction pushed as `434216c7224392e936bd50d99620671cd6b22120`, with run
`33988179112` now completed successfully, including deployment and all live QA.
Independent frontend and backend checks report Alpha 1.0.3 and that exact SHA.
The corrected portal test passed against
an exact detached copy of that commit, not the newer uncommitted dungeon work.
Its disposable API/Mongo data and temporary verification worktree were removed.

Confirmed reproductions and changes:

- Scaled Rustbound Colossus and Hollow Sentinel client bodies stopped melee
  players outside the server's attack range. Replicate the authoritative actor
  body radius through JSON and protobuf, including stationary radius/scale
  changes. Decorative model bounds no longer determine multiplayer collision.
  Real server Fighter/Cleric attacks at the replicated contact boundary damage
  all 22 dungeon bosses plus the four elemental raid bosses and Dark King
  (27 boss types) in focused race tests; client collision and production
  synchronization tests pass. Browser picking, kills, and quest credit remain open.
- Recall/respawn during an old charge retained dungeon destinations and height,
  moving the player away from the town spawn on the next update. Reset departed
  movement state under the player lock and reject stale movement samples using
  the existing recovery window. Client transitions clear predicted movement and
  queued casts. Generation guards stop late town/legacy dungeon loading from
  overwriting a newer instance. The old failure and repaired next-update positions
  are covered by server/client tests, not yet all live recovery scenarios.
- Actual Wizard Teleport casts in Air, Fire, and an offset dungeon were clamped
  to the old overworld rectangle. Use the current world bounds only outside an
  instance; preserve dungeon walkability constraints inside. Server tests cover
  all four realms and a dungeon at coordinates (20000, 20000).

Final candidate unit checks: 147 client suites / 2,111 tests and the full server
race suite pass. Coverage includes 41 collision/transition tests, 249 focused
version/menu/Wizard checks, 27 boss-contact types, and all 52 selectable abilities
casting inside a registered offset dungeon without displacing the caster or
owned entities into another instance/coordinate space. That last check is not
proof of delayed damage, wall rules, rune variants, or visible effects.
Lint and whitespace checks pass. Login, runtime defaults, and patch history now
identify the local 1.0.3 candidate. The browser portal route now includes real
re-entry and mid-jump recall, with a post-arrival stability check; it is enabled
for both predeploy and live CI. The isolated real-server route passes, including
both returns to Lanternhold with settled scenery, cleared dungeon collision,
stable position, and no remaining jump/charge. Temporary Mongo/API containers
and their data were removed by the runner. Earlier attempts exposed an occupied
development port and two test assumptions (town's existing 0.5m presentation
lift and repeat visits already at maximum zoom); the final run used port 4185
and corrected those assumptions without weakening the recovery-state checks.
All eight anonymous browser release checks also pass on the final candidate.
Publication and live verification of 1.0.3 are complete; the wider 1.1 gate is not.

## Alpha 1.0.4 — roads that remember

Status: pushed as `40658d07538404e3db1c9ac5c3a6d82e47bcc785`. CI run
`33990677342` failed before deployment: client/server checks and eight browser
tests passed, but the production-layout fixture timed out twice while capturing
a screenshot on hosted Chromium. The unchanged fixture is being moved to the
existing hardware-Chrome predeploy gate, retaining all 20 layouts and High/Low
captures. The previous 1.0.3 release remains live. A corrective 1.0.4 candidate
also addresses the renewed first-boss report below; it is not yet published.

Correction published as `b888f7f0bdd290ecabc5de4418bc5b66e0562afc`.
CI run `33992723668` passed every job, including both deployments and live
character/class/multiplayer QA. Independent frontend `release.json`, entry-point
asset query, login version, patch history, and backend `/healthz` match Alpha
1.0.4 and that exact SHA. The real Wizard route killed Rootbound Warden and
Briar Matron, cleared intervening encounters, and returned to town both before
deployment and against production. The initial failed push did not go live;
this corrected release did. Wider dungeon gates remain open.

- Four regional generators now have a local seeded RNG independent of global
  combat/loot traffic. Production retries receive distinct deterministic seeds;
  the successful seed, generator version, attempt, and fallback marker travel
  with the layout and survive database mapping, JSON, and restore. Existing
  saved geometry is not regenerated. Fixed-layout Umbral/raid instances share
  the diagnostic identity. The four global-RNG dependence repros fail before
  the change and pass afterward.
- Real client fixtures exposed the old X=50000 scene boundary pushing Water
  positions and excluding Umbral/crystal-raid space. Canonical dungeon collision
  now uses its own walkable area instead of that unrelated envelope. The client
  still enforces its walls/union; clearing the instance restores the scene guard.
  All six Water/Umbral fixture failures pass after the fix, along with explicit
  tests at every dungeon/raid origin from X=50000 through X=110000.
- Added [seed capture/replay instructions](dungeon-seed-replay-qa.md), 1,500
  production layout checks, 20 shared server-generated fixtures, actual client
  floor/collision traversal sampling, and a browser geometry/High-Low fixture
  check. The latter now runs in the hardware-Chrome predeploy gate after the
  hosted screenshot failure described above.
- Dungeon entry also retained departed charge/jump targets: a reproduced jump
  sent the newly entered player to (0,0,0) on the next update. The shared scene
  movement reset now runs on entry under the player lock. Recall/respawn still
  preserve cooldowns and buffs. Focused entry/recovery/restore race tests pass.
- Added a visible Escape-menu Return to Lanternhold (B) action using the shared
  keyboard recall path. Updated help and completed-dungeon routing text so they
  do not imply that a player must backtrack to a physical exit. UI callback and
  menu tests pass.
- The real Water route exposed a stale legacy socket reference after reconnect:
  movement and recall used the new connection, but Continue Party Run sent to
  the closed original socket. The engine's compatibility accessor now follows
  NetworkManager's active socket. A focused regression and the actual browser
  route pass. The route verifies eastward Water movement, session resume, menu
  recall, and re-entry with unchanged instance ID and exact generation seed.
  It is included in predeploy and live CI. Camera-follow reprojection corrected
  the guide-selection test without bypassing real mouse interaction.
- Running Water after the existing Verdant tests exposed incorrect party-leader
  detection in both menu status and reset authorization: the handler compared
  the party ID, not its leader ID. Corrected both tuple reads. Reset now rejects
  an occupied instance under the world lock instead of deleting its players.
  A dispatch-level regression reproduced both failures, then passed leader/member
  status, non-leader rejection, occupied-run preservation, and empty-run reset.
  Successful resets now use system chat rather than an error frame; the combined
  Water run exposed that misleading success-as-error response after all gameplay
  assertions had passed. The final full server race suite passes with these fixes.

Earlier evidence: 148 client suites / 2,138 tests and the full server race suite pass.
The additional diagnostic-seed test passes in a focused 16-test containment run;
the explicit reported-seed replay command passes. All 20 browser fixtures pass.
Inspected Water High and Umbral Low corridor screenshots: floors are continuous
through the shown joins. The browser check captures both qualities for all ten
dungeon/raid families, but this is not a claim of whole-run visual inspection or
real-player combat/traversal. The final server race suite and lint pass; all nine
anonymous browser checks pass, including the 20 production fixtures. The focused
Water gameplay route passes with normal entry/reconnect/menu recall/re-entry.
The final client suite passes all 148 suites / 2,142 tests. Two older test harnesses
were updated to stop assigning the now-read-only compatibility socket accessor.
The first full updated character QA sequence completed its authenticated gameplay
assertions but failed the final browser-error check on Chrome
`ERR_NETWORK_CHANGED`; the focused portal route also passed in that attempt.
The next run passed all three authenticated routes, then exposed the leader
bug above when resetting the earlier Verdant run before Water. The corrected
complete sequence passes: all three authenticated routes, Water reset/entry/
movement/reconnect/menu recall/re-entry, acknowledged movement smoothness, all
four class ability/rune matrices, and two-account remote effects/movement/combat.
The artifact credential scan passes. Disposable API/Mongo containers and data
were removed by the runner. Final whitespace checks pass; the added patch notes
pass the 177-test version/history suite. Publication and live verification remain
open for this candidate.

## Dungeon investigations still open

The renewed Verdant first-boss/no-later-spawns report exposed another confirmed
failure: room rewards acquired instance -> actor locks, while enemy movement
held actor -> instance locks. A deterministic real-layout regression reproduced
the deadlock. The candidate reserves each room reward under the instance lock,
copies its context, then releases it before touching actors. The regression,
32 concurrent once-only reward attempts, and full server race suite pass.
A new real-input Wizard route passed ordinary kills, Rootbound Warden, later
rooms, Briar Matron, both boss-room clear assertions, and town recall. It does
not use forced kills or inside-instance waypoints. A starter-equipped Fighter
landed steady basic attacks (approximately 540 damage per 15 seconds), but the
15,000-health first boss exceeded the original two-minute encounter deadline.
That run is not recorded as a boss-kill pass. Follow-up melee QA selects the
normal level-unlocked Whirlwind/Shield Slam specialization through its skill UI.
The final Fighter sequence passes Water movement/reconnect/recall/re-entry,
normal reset into fresh Verdant, ordinary enemies, Rootbound Warden's death,
later enemies, Briar Matron's death, both room-clear checks, and town recall
(3.7 minutes total). World-state heartbeat assertions remain active throughout.
The input helper can click a visible point on tall hitboxes when their center
is behind the HUD; no target, health, or progression state is injected. The
credential artifact scan passes, and disposable containers/data were removed.
The client suite was rerun after the final helper changes: all 2,142 tests pass.
The corrected hardware layout fixture passes all 20 layouts and High/Low
captures in 10.8 seconds total. Full client checks pass 148 suites / 2,142 tests;
the full server race suite, lint, and 177 version/history tests also pass.
This repair is now live as recorded above, but does not close all dungeon gates.

## Alpha 1.0.5 — your party holds its ground

Pushed as `3443609cb4d29b20bedb18688fe6ed8898f7ba19`, CI `33995464506`.
Server/client/browser and full disposable predeploy character QA passed, followed
by both deployments. Independent frontend `release.json` and backend `/healthz`
checks report Alpha 1.0.5 and that exact SHA. The run subsequently completed
successfully, including live persistent-character, four-class and remote-animation
QA. The full release is verified.

Confirmed regressions: returning through the dungeon portal moved all members
back to the entrance, a low-level dungeon request could enter a saved higher-
level/Chronicle-gated dungeon or raid, and a non-leader could create a new run.
Dispatch-level tests reproduced each before the change. Entry now resolves the
saved run, checks its real access requirements and moves only the caller on
resume. New runs remain leader-owned and validate the group before creation.
Concurrent duplicate enters are idempotent and preserve movement/geometry.
Qualified raid members can resume an existing formed raid individually without
repeating its launch ready check; initial raid creation retains the full group,
readiness and Chronicle requirements. Unqualified replacements cannot enter.
The menu displays the saved name, difficulty and level with immutable controls.
Login registration now marks restored dungeon membership active; previously
restored instances retained their empty timer even with a player inside. The
new restart/login regression verifies the timer and room-summary initialization.
Two-player real-browser recall/re-entry in both directions passes, followed by
the existing remote summon/effect/movement/combat assertions (1.3 minutes total).
The credential artifact scan passes and disposable services/data were removed.
The full server race suite passes. A prior failure was an old hazard-transfer
fixture entering a nonexistent dungeon; it now creates a real run and retains
the hazard-reset assertion. The full client suite passes 2,146 tests with the
release metadata updates. The complete isolated sequence passed all authenticated
routes, Water recovery, both Verdant boss deaths/return, smoothness, Fighter and
Rogue matrices, then failed the Wizard's post-move animation assertion: the
helper can return after a short move has already completed. The observer now
records animation during the actual movement and still requires Run/Walk plus
authoritative displacement. Focused Wizard verification passes on the latest
server image (49.2 seconds including setup), with a clean credential artifact
scan and disposable cleanup. The full combined sequence is not yet recorded as
passed; predeploy CI will run it against the committed candidate. The latest server race suite
also passes the restored-login membership correction added after the first
isolated image was built.
This work is deployed as recorded above and does not close the full 1.1 gate.

## Alpha 1.0.6 — every road has an ending

Pushed as `8027f221952156a6a7d4c2ee0ac8f24b60f2e3b3`, CI `33997180208`.
Server, client, anonymous browser and disposable predeploy gameplay gates passed.
Both deployments completed, and independent frontend/backend endpoints report
Alpha 1.0.6 with this exact SHA. Final live gameplay checks are still running.
The next push can now queue safely: deployment's branch-tip checks have finished
and workflow concurrency has `cancel-in-progress: false`.

The old retry-exhaustion path removed generated actors and returned only an empty
start room. Required-encounter regressions failed for all ten dungeon/raid types.
The candidate builds connected ordinary/elite/boss blocks covering the catalog,
including the elemental raids' terminal crystal Vigil hook. New attempts check
both boss-room count and actual required boss spawns inside those rooms. Tests
force eight failures at all three difficulties, verify failed actors are removed,
preserve unrelated instances, and require every encounter without pre-clearing
rooms or granting rewards. A successful third attempt also stops retrying normally.

Generator identity advances to 2. Valid saved version-1 layouts remain exact;
only flagged one-start-room fallbacks are upgraded on restore. Persistence tests
retain exploration, cleared bosses and reward flags without spawning cleared
encounters. The configured QA-account allowlist can select the next fresh fallback
through a one-shot chat command; normal level, party and Chronicle gates remain
enforced, and resuming a saved run does not consume this selection.

The complete server race suite exposed a missing ordinary actor in one Water
fallback. Dungeon spawns used only 10,000 random suffixes and could overwrite an
existing actor. Deterministic regressions occupying all old suffixes reproduced
this across regional, Fire and Air spawn helpers for ordinary and elite enemies.
Collision-safe suffix selection now checks the world registry before insertion;
it does not alter the independent geometry random stream.

Thirty production/fallback browser fixtures pass their real-coordinate route
collision and single-floor coverage checks at High/Low (22.8 seconds). Inspected
Verdant High and Dark King raid Low fallback joins are continuous. These are
rendered geometry checks, not completed raid encounters. The first full fallback
Fighter run killed Rootbound Warden and Briar Matron but exceeded its encounter
deadline on Rustbound Colossus: the test's fixed four-unit range suppressed both
melee skills at large-body contact. Real server Whirlwind and Shield Slam tests
pass at all four Verdant bosses' replicated body boundaries. The browser helper
now casts through the hotbar at the normal basic-attack boundary. The full fallback
rerun passes all four boss deaths, boss room clears, increased gold and town recall
in 8.2 minutes, without forced kills or in-instance waypoints. It uses the existing
level-100 QA setup and entrance protection, so it is a functional check, not a
level-appropriate balance claim. This browser image predates the ID-collision fix;
the final full server race suite passes with that fix and the legacy-save recovery.
Artifact credential scanning passes and disposable services/data were removed.
The workspace client suite passes 148 suites / 2,158 tests (including the new,
separately staged quest-icon regression for the next UI update). Lint and whitespace
checks pass. Release metadata and patch notes are ready for 1.0.6; publication
remains open until the committed candidate clears CI and live verification.

- DUN-01: targeted movement/scene fixes and the Verdant mid-jump recall route
  shipped in 1.0.3. Water reconnect/menu recall/re-entry passes on the 1.0.4
  candidate. Wipe, remaining dungeons, and party variants remain open.
  The 1.0.5 candidate resolves Continue Party Run's settings display and
  member-specific re-entry with actual saved-run access checks. Two-player
  Heroic Water recall/re-entry passes in both directions. Other dungeons,
  completed/wiped runs and actual group raid recovery still require evidence.
- DUN-02: contact/range mismatch reproduced and repaired in 1.0.3; mouse picking,
  all-class full combat, boss deaths, loot, and progression still need validation.
- DUN-03: Teleport failure reproduced and repaired in 1.0.3; remaining abilities,
  rune variants, wall restrictions, presentation, and instance isolation need
  systematic coverage. Neither this nor the projectile fix proves all skills work.
- DUN-04/05: multi-dungeon player-controlled traversal, reported failing-seed
  capture, and repeated scene-lifecycle checks remain open. The next local
  hotfix now supplies real seed sweeps and rendered
  fixture coverage; these are stronger evidence, not completion of the play gate.
  The 1.0.6 candidate replaces the confirmed empty retry-exhaustion fallback and
  forces that path in encounter tests. Full Verdant fallback Fighter progression
  passes as recorded above; other regional and raid runs remain open. Do not
  treat the seed sweep as covering this whole gate.

Alpha 1.0.6 publication is now verified: commit
`8027f221952156a6a7d4c2ee0ac8f24b60f2e3b3`, CI run `33997180208`, completed
successfully including predeploy, both deployments, and the live class/remote
matrices. Both public release endpoints independently reported this exact version
and commit while 1.0.7 was in predeploy QA.

## Alpha 1.0.7 — your bag, your adventure

Added in response to the player's bag-icon, drag-out drop and tracker-selection
requests while 1.0.6 passes through deployment:

- Four authored elemental SVG icons cover every server Chronicle drop name.
  A generic Chronicle relic fallback prevents future quest items from going blank.
  Shared inventory icon resolution also covers tooltips/stash consumers.
- Dragging a bag item onto the actual world canvas requests an authoritative
  whole-stack ground drop at the character's current position and instance.
  Quest items, stale indices/IDs, duplicate requests, dead/disconnected players
  and active trades are rejected. Items retain stack, stats, sockets and identity.
  No bag removal is predicted before the server acknowledges it. Dropped loot is
  public and follows the existing one-minute expiry; bag guidance explains this.
  Deliberate drops are excluded from this session's auto-loot selection but can
  be manually picked up. Pickup now also rejects cross-instance and dead actors.
- Journal checkboxes select any accepted daily and the story chain. Choices are
  saved per character in browser storage, tolerate unavailable storage, and follow
  the next story chapter. Custom selections are not truncated to three cards;
  the bounded tracker scrolls, including at short screen heights. Default tracking
  remains the initial three until the player customizes it. The existing compact
  party-roster mode still shows the Journal shortcut instead of overlapping cards.

Evidence: focused unit checks cover arbitrary selections, more than three tracked
quests, an intentionally empty selection, per-character reload isolation, chapter
handoff, icon catalog parity, canceled/invalid/quest-item drags, delayed inventory
acknowledgement and auto-loot exclusion. Server checks preserve a complete item on
drop/pickup, reject cross-instance pickup, validate failed drops leave state intact,
and accept exactly one of 32 concurrent duplicate requests. Dispatch tests require
the inventory acknowledgement and reject replay. The full server race suite passes.

A disposable real-browser route passes earned loot → bag drag-out → ground item
survives auto-loot cycles → ordinary mouse pickup → fresh-login inventory and
tracking-preference persistence (21.7 seconds including setup). Its first attempt
incorrectly assumed the fresh starter model represented owned equipment; the
corrected test acquires an actual server drop through the existing QA loot route.
This is an inventory test, not evidence for level-appropriate combat balance.
Credential artifact scanning passes and disposable services/data were removed.

Two anonymous browser checks pass (8.4 seconds): all four icons decode at 48px,
and nine selected objectives remain reachable by ordinary tracker scrolling.
Inspected the icon strip and tracker crop. An initial fixture placed the journal
halfway down the screen without its normal centering transform; positioning the
fixture inside the viewport resolved that test-only failure. These checks join
the predeploy gallery; the real bag route joins disposable full-character QA.
The full client suite before final release metadata passes 148 suites / 2,165
tests. Version metadata, login text and patch notes advance together to 1.0.7.
Publication is pending the 1.0.6 deployment and final candidate checks.

Final candidate checks pass: 148 client suites / 2,166 tests, the full server race
suite, lint and whitespace checks. The new real-browser inventory route and both
visual checks also pass as recorded above. Neither this quality-of-life patch nor
the fallback repair closes the broader 1.1 dungeon, party, ability and PvP gates.
Checkbox updates also preserve keyboard focus and journal scroll position; a
storage-blocked regression verifies that selection remains usable without browser
persistence. This final UI refinement is included in the candidate.
The final full client rerun passes all 148 suites / 2,167 tests; lint and
whitespace checks remain clean.

Published as commit `015f3cd4258c8cb2cf65e16b2529dc9ad922c418`. CI run
`33998433871` has passed server/client suites, browser smoke, disposable
full-character predeploy QA, and both deployments. Both public release endpoints,
the login label and the client entrypoint release query independently match
Alpha 1.0.7 and that exact commit. Post-deployment live gameplay QA is running;
its terminal result is now **success**. CI `33998433871` completed successfully,
including all post-deployment live gameplay, class and remote-animation checks.

Additional DUN-02/04 evidence: the full **generated** Verdant Fighter route passes
in 7.5 minutes (`/tmp/eidolon-full-generated-verdant-1-0-7.log`), with ordinary
combat, all four actual boss deaths, room completion, increased gold and town
recall. This complements the forced-fallback run above, but remains one generated
instance of one dungeon/class, with level-100 QA setup and entrance protection.
It is not a balance test, three-seed proof, campaign credit proof or a party run.
The original log omitted the generated seed; subsequent Verdant routes now log
seed, generator version, attempt and fallback status without account/instance IDs.

## Alpha 1.0.8 candidate — the last teammate standing

The next 1.1 PvP corrections were reproduced with failing regressions: one death
awarded a 2v2 round immediately, and a practice duel changed rating, wins, honor
and season points. The candidate now records each elimination once and awards
a round only after the whole opposing team is eliminated. Intermission suspends
hostility and rejects further death records; one round-scoped timer restores all
participants before incrementing the round. Stale timers cannot reset later
rounds. Client opponent lists follow the same elimination/intermission state.

Only ranked arena modes update ranked profiles; duel completion/forfeit leaves
existing profiles unchanged and creates no new profile. Practice forfeits do not
apply a ranked queue penalty. Results notify every participant independently of
profile persistence, and completed match/challenge fields clear from UI snapshots.
The panel explains the actual damage scalar/burst cap instead of claiming full
stat normalization. Rating-aware matching, normalization policy, seasons and
anti-farming remain 1.7 work, not claims of this patch.

Town recall/respawn returns an actionable error during a PvP match, without a false
overworld transition. The death screen instead explains teammate survival, round
recovery or automatic return, and offers explicit forfeit where applicable.
Match startup/reset/completion reset movement and acquire actor locks without
holding the PvP lock, preserving combat's actor-to-PvP lock order.

Evidence: server regressions cover duplicate and 32 concurrent death records,
survivor hostility, round intermission, early/stale resets, re-entrant state
callbacks, both teams' best-of-three rewards exactly once, practice results and
forfeits, recall/respawn world and dispatch rejection, and result messages without
database writes. A full server-combat test uses ordinary asynchronous melee hits,
waits out production protection clocks, observes the first elimination surviving
the old three-second reset window, and completes both rounds and restoration
(13.32 seconds). Positions are test fixtures; health is never forced and this is
server combat evidence, not a four-browser player-control test.

Full final-candidate server race suite passes; client suite passes 148 suites /
2,170 tests after version/patch-note updates. Anonymous real-Chrome feedback QA
passes; screenshot inspection identified the old cramped horizontal match card.
It is now a two-column score/action layout with full-width title and guidance;
the recheck passes in 5.5 seconds and the corrected screenshot is inspected.
The check covers survivor count, forfeit clicks (not town respawn), automatic
recovery text, disabled return button and cleared result snapshot. It joins the
predeploy UI gallery. Lint and whitespace checks pass. Final publication/live
verification are pending; 1.0.7 has now finished both deployment jobs, so this
candidate can enter CI without changing the prior deployment's branch tip.
The broader 1.1 gate stays open.

Published the PvP candidate as commit
`968c2c722d8fc7cef200224a352b7fa713079608`, CI `33999632052`. Server/client suites
and browser smoke pass; disposable predeploy character QA and both deployment
jobs now pass. Both public release endpoints, the login label and entrypoint
release query match this exact Alpha 1.0.8 commit. CI `33999632052` now completed
successfully, including all post-deployment gameplay and class/remote checks.

## Continued 1.1 dungeon verification

The full player-control route is now parameterized for the five catalog dungeons,
difficulty and run level, with logged replay identity and completed-run re-entry
assertions. The server body-contact matrix expands to all four classes and adds
220 skill/rune/instance-isolation combinations. These are meaningful partial
checks, not closure of the all-class/all-dungeon player-control gate.

Molten Core's full Fighter route passes in 23.8 minutes after resolving a
locked-portal test assumption and replacing its too-short two-minute combat timer.
It covers all five bosses, every encounter room, gold, recall and completed-run
re-entry without duplicated gold. A distinct solid-wall projectile bug was
reproduced and repaired locally; fresh-server Wizard browser verification now
passes in 11.3 seconds, including actual wall contact and zero-radius presentation.
It exposed a protocol-layer zero omission that is also repaired and regression
tested. Commands, seeds, exact limitations and
run results are recorded in [the playthrough evidence](dungeon-playthrough-evidence.md).

## Alpha 1.0.9 candidate — walls hold, roads continue

Packages the verified ground-projectile wall repair and explicit zero-radius
impact transport/rendering with the expanded dungeon verification routes. It also
corrects Ilyra's opening objective and daily descriptions to name Lanternhold,
with a regression preserving acceptance and kill count on existing characters.
Other cross-wall ability types, secondary effects and the full 1.1 matrix remain
open; the patch notes do not claim those fixed. Login, package, server/container,
deploy and CI release defaults advance together. Final candidate checks pass:
the complete server race suite, 149 client suites / 2,180 tests, lint and
whitespace validation. Publication and live results follow below.

Published as `20eadc9483abbc6d2bd19f1bde0a2a3f78bda4b9`, CI `34001977877`.
Client/server checks, browser smoke, predeploy gameplay QA and both deployment
jobs pass. Both public release endpoints, the login label and runtime entry query
match this exact Alpha 1.0.9 commit. CI `34001977877` completed successfully,
including post-deployment gameplay, all four classes and remote-animation QA.
The complete Abyssal Well Fighter attempt used this clean commit, generator 2 seed
`-7057617757322159080`, Normal 60. All first four bosses were defeated, but the
character died during a Siren encounter before Thalorath after 18.7 minutes.
This is not a full-run pass. The failure and normal defensive/rune/wipe-control
follow-up are recorded in the playthrough evidence ledger.

## Alpha 1.0.10 candidate — paths, not just landings

Endpoint-only movement checks allow Charge, Shattering Charge, Teleport and
jumping to skip a solid wall when the landing is in another valid room. Twelve
ordinary-dispatch charge/teleport regressions and two authoritative jump cases
reproduce the problem. Ground-targeted movement now clips its complete path
through the canonical floor union, preserving open doorways, existing realm
bounds and invalid-position recovery. Charge/Teleport events and jump targets
carry the actual bounded destination. Normal walk-target selection and AI routing
are unchanged.

The matrix covers base/Momentum Charge, Shattering Charge, base/Blink/Warp
Teleport, two distant coordinate regions, solid gaps and open doorways; jumping
adds ordinary and large simulation steps. The full server race suite passes
(`/tmp/eidolon-movement-walls-server-full.log`, game package 110.292 seconds).
Six further red cases reproduce Rogue movement, damage and debuffs through a
thin wall. Shadow Strike, Shadow Lunge and Backstab now require an accessible
target before mana/cooldown commitment; blink landings also clip the full path.
Open doorways retain damage and representative rune effects. The expanded server
race suite passes (`/tmp/eidolon-movement-rogue-server-full.log`, game package
142.951 seconds); additional legacy/recovery matrix checks pass in 6.937 seconds.
Rejected casts now explain their requirements, action locks and cooldowns while
reconciling authoritative resource state. The client suite passes 149 suites /
2,188 tests before the subsequent charge-sync and release-note additions.

The fresh-server Wizard browser route passes in 13.1 seconds, including actual
Teleport events/landing, Ctrl-click jumps against the wall and on open floor,
and ordinary recall (`/tmp/eidolon-movement-wall-wizard-browser.log`). Fighter's
first attempt failed with its client stopping 2.8848 units short of the server
landing. Normal prediction's three-unit correction threshold did not reconcile
short server-driven Charge steps. Charge now reconciles each authoritative step
and its final landing while retaining ordered movement acknowledgements.
Focused client checks pass, and the unchanged Fighter browser assertions now
pass in 12.2 seconds (`/tmp/eidolon-movement-wall-fighter-browser-sync.log`).
Both disposable runs clean up successfully. The new route joins predeploy QA.
These are real-control wall/open-floor movement checks; crossing a gap between
two valid rooms is separately established by the server regression matrix.

Version defaults and patch notes advance to Alpha 1.0.10, not milestone 1.10.
The final client candidate passes 149 suites / 2,190 tests, with lint and shell
syntax checks passing. The final complete server race suite passes (game package
110.525 seconds). Publication remains pending. Cross-wall secondary/AoE
effects, ordinary movement authority, Rogue rendered wall checks and the full
dungeon/class/party matrix remain open. This is not 1.1 closure.

Published Alpha 1.0.10 as `6212ef3d50b7712126a1349fff50dcdd842d1930`, CI
`34003316079`. Client/server suites and browser smoke pass; disposable predeploy
gameplay QA **failed** at the multiplayer member's dungeon-guide re-entry. Its
retry then failed an overworld-only waypoint while still in the unfinished run.
Both deployment jobs were skipped. Alpha 1.0.9 remains the verified live release;
Alpha 1.0.10 has not deployed. The guide failure is under investigation.

## Continued 1.1 recovery checks — unpublished

The full Fighter route now selects Bloodwhirl, Fortify and Extended through the
rune UI and uses Iron Fortress/Guardian Roar alongside its damage skills. An
independent hotbar selector honors placement, cooldowns, class, charging, mana and
range; its nine tests pass. Actual server ability events must confirm all four
hotbar skills by the first boss kill. The new Abyssal attempt ran on
`6212ef3` with QA-route changes, seed `-412794620771892541`, generator 2 attempt 0,
Normal 60. First-boss events confirm all four skills. It killed the first four
bosses and reduced Thalorath to 18,626 HP while the Fighter remained at 2,575 HP,
then hit the aggregate 25-minute test timeout. This is a failed run, not full
completion/reward/re-entry evidence. The full route now has a 40-minute aggregate
budget consistent with five individually bounded six-minute boss fights plus
trash/traversal; its no-damage and individual encounter deadlines remain intact.
The new health logs exposed the old test's nonexistent `stats.mp` field. The
selector/telemetry now read `stats.mana` and reject missing mana; that correction
was made after this run started and is not evidence from this running attempt.
All requests still use normal client/server resource validation.

Recovery regressions reproduce two independent issues: dead recall created an
IDLE actor with zero health, and recall/respawn did not start the empty-instance
return window. Dead recall now requires explicit Respawn, with non-blocking client
guidance rather than an alert. Successful town exits update presence after
releasing the actor lock. One member leaving retains the occupied run; the last
starts its existing five-minute grace period; re-entry preserves room progress
and clears that timer. Dispatch, lock-order and membership tests cover these
contracts. Progress/death states in these unit tests are fixtures, not a claim of
a real party wipe. Two older chat/Chronicle test actors needed explicit living
health for their intended recall scenarios; the production health guard remains.

The corrected full server race suite passes (game package 134.295 seconds,
`/tmp/eidolon-dungeon-recovery-server-rerun.log`). Client suites pass 150 suites /
2,199 tests before the later recovery-guidance test; that addition and the hotbar
selector pass together (57 focused tests). Two additional regressions exposed
the client predicting recall for a zero-health actor before server acceptance;
both fail before the client guard and pass after it (59 focused tests total).

The actual level-30 Wizard route passes in 37.4 seconds, generator 2 seed
`-1986625632463315919`, dirty `6212ef3` candidate. It observes ordinary hostile
damage and death, rejected recall while still dead inside, explicit Respawn and
normal guide re-entry with the same seed and cleared flags. It uses no protected
waypoint or health/kill command. Log:
`/tmp/eidolon-dungeon-natural-recovery-browser.log`. The isolated predeploy chain
now runs this check on its own newly registered Wizard, not an earlier protected
combat character.

A fresh actual Cleric/Wizard multiplayer route passes in 1.0 minute, including
both member/leader-specific recall and same-run re-entry, remote casts, movement,
jump and browser error audit (`/tmp/eidolon-party-guide-investigation.log`). The
original CI guide failure has not reproduced; diagnostics remain in place rather
than claiming a proven gameplay cause. Retry setup now uses normal recall/Respawn
before asking for an overworld-only waypoint, fixing the separate retry failure.
The never-deployed 1.0.10 candidate retains its version and adds recovery patch
notes; full CI and exact live verification remain required before release.
The full dungeon/class/party and remaining ability-wall gates stay open.

The final client candidate passes all 150 suites / 2,202 tests in 58.59 seconds,
with lint, shell syntax and whitespace checks passing. Moving the recovery check
to a separate newly registered account first exposed an omitted disposable QA
allowlist entry (failed before dungeon entry); that account is now explicitly
included in the isolated server's allowlist. Production QA permissions are not
changed by this test-runner configuration.
The corrected fresh-account runner passes in 35.6 seconds on generator 2 seed
`5580111386158966775`, including actual death, rejected recall, explicit Respawn
and preserved-run re-entry; credential scan and disposable cleanup pass. Log:
`/tmp/eidolon-dungeon-recovery-fresh-account-allowlisted.log`.

Pushed the corrected 1.0.10 candidate as
`a8c09ef4db43162b4752437e757c70d4859b5bad`, CI `34005044422`.
Client/server checks, anonymous smoke and the High/Low gallery pass, but the
disposable gameplay job **failed again** at the multiplayer guide. Both attempts
failed its initial leader interaction (party route line 13), not member re-entry.
Diagnostics show a live socket, IDLE player at (-2.685579, 240.213598), no pending
interaction and no menu. Neither deployment ran; live remains verified 1.0.9.
Log: `/tmp/eidolon-1-0-10-recovery-ci-failure.log`. Click/request/response probes
and three repeated party-return cycles are being tested locally to find the cause;
do not call this fixed merely because one fresh standalone run passed earlier.

A clean full Abyssal Fighter run on this exact commit **passed in 29.1 minutes**,
seed `-3014860983784452515`, generator 2 attempt 0, Normal 60, with corrected mana
selection and the 40-minute budget. All five bosses, every encounter room, gold,
town recall and completed-run re-entry assertions passed. Log:
`/tmp/eidolon-1-0-10-abyssal-full-fighter-recovery.log`. Its image does not include
the following unpublished changes and it does not close the full 1.1 matrix.

## Alpha 1.0.10 corrected candidate — direct-target boundaries

Twelve direct-dispatch cases reproduce six blocked-path failures: Smite, Mark of
Weakness and Weak Point Mark applied damage/debuffs and spent resources across a
solid gap, with either explicit targeting or cursor fallback. The local patch
uses canonical path validation for hostile direct targets, preserves friendly
support/legacy rules and open doorways, and commits these spells' resources only
after selecting a reachable target. Arcane Missiles no longer retains a rejected
explicit homing ID; ordinary cursor volleys still fire. The existing targeted
movement wrapper reuses the shared validation without a duplicate geometry scan.

Focused race checks pass for the 12 spell cases, four missile-lock cases, support/
legacy/isolation checks and the existing Rogue targeted-movement wall matrix
(latest 6.611 seconds). The first full server race run found an older contract
explicitly expecting Smite to spend its cast on a cross-instance target. That
contract now requires rejection with no damage, mana loss or cooldown. The full
corrected server race suite passes (game package 206.853 seconds), log
`/tmp/eidolon-dungeon-direct-skills-server-rerun.log`. These are server
fixtures, not rendered class playthroughs; rendered basic attacks, ground-targeted AoE and
secondary wall effects remain open. Nothing in this section has deployed yet.
A real-input Cleric/Rogue mark test is prepared for empty-target rejection and a
server-accepted mark on a reachable ordinary enemy. Its first execution exposed
an accepted cursor-selected mark publishing an empty target ID. Three red server
cases reproduce the omission for both marks and legacy Smite. Those handlers now
publish the resolved target and its coordinates. The actual Rogue and Cleric
browser checks both pass (11.3 and 11.9 seconds including setup), log
`/tmp/eidolon-direct-target-resolved-browser.log`. They join the isolated predeploy
chain using the exact allowlisted class actors. The full Water run has finished;
an updated short Verdant Fighter route is checking the new basic-attack code.

Basic-attack regressions then reproduced wall-crossing admission with all four
classes, plus damage landing after a target moved behind a wall during wind-up.
The local repair validates both admission and actual impact against canonical
floors. Delayed attacks retain a private floor snapshot so impact validation does
not acquire an instance lock while holding an actor lock; old attacks cannot
follow actors into another scene. The post-delay damage body is extracted without
changing its damage rules, letting tests prove rejected impacts by synchronous
completion rather than an absence-of-events timer. Open-doorway dispatch still
lands real delayed damage for each class.

The basic/impact/snapshot, direct-spell and projectile-wall focused race checks
pass in 7.963 seconds (`/tmp/eidolon-dungeon-basic-wall-impact-green.log`). The
complete server race suite passes with this change (game package 224.471 seconds,
`/tmp/eidolon-dungeon-basic-wall-server-full.log`). A further red regression found
that the combat snapshot omitted InstanceID, sending actual basic and reflected
damage events with empty routing scope. The snapshot now retains its instance;
the focused event/basic/impact matrix passes (3.431 seconds). Another final full
race run passes after that last field correction (game package 146.604 seconds,
`/tmp/eidolon-dungeon-attack-routing-server-final.log`). The completed clean
1.0.10 Water playthrough predates these local patches and cannot verify them.

The guide failure reproduced in a fresh three-cycle multiplayer route. The click
probe records DungeonNPC before the click, no hit on the click's fresh raycast,
and an ordinary ground-move destination afterwards. No menu request or response
occurred; 937 state updates arrived while the test waited. The player was still
at z=217.28 during the click, proving the approach/camera had not settled. Log:
`/tmp/eidolon-dungeon-guide-click-probe.log`. The helper now waits for IDLE with
no movement destination and rendered actor/camera agreement before reprojecting
and clicking. This corrects a test timing error; production click raycasts still
use the actual click coordinates. The repeated route passes in 2.4 minutes: all
three cycles, both party roles, remote combat/movement and browser error audit,
log `/tmp/eidolon-dungeon-guide-settled-cycles.log`.

The updated client candidate passes all 150 suites / 2,202 tests (73.236 seconds).
The never-deployed Alpha 1.0.10 entry now includes the basic/direct wall and damage
routing corrections. The complete server race suite passes after the final
resolved-target event correction (game package 161.847 seconds), log
`/tmp/eidolon-direct-resolved-server-final.log`. The actual short Verdant Fighter
route passes in 3.5 minutes on dirty `a8c09ef`, generator 2 seed
`6311919532000196432`, Normal 30: Rootbound Warden and Briar Matron die, ordinary
encounters continue and town return succeeds. Log:
`/tmp/eidolon-direct-basic-verdant-browser.log`. This tests the new attack code,
but is not a full dungeon/class/party completion claim. Lint, shell syntax and
whitespace checks pass. The corrected candidate is ready for a new full CI run;
deployment and exact live verification remain unproven.

Pushed the corrected candidate as `3dbb76d0a24d972e756583023e2ba4a11356cff0`, CI
`34007206525`. Client checks pass; the server race step is running. Public
frontend release and server health still match healthy Alpha 1.0.9 at
`20eadc9483abbc6d2bd19f1bde0a2a3f78bda4b9`. A full Tempest Spire Fighter run is
active on clean `3dbb76d`, seed `3202185699779077470`, generator 2 attempt 0,
Normal 70. Log: `/tmp/eidolon-1-0-10-tempest-full-fighter.log`. No full Tempest
completion or 1.0.10 live deployment is claimed yet.

The Tempest run has now terminated **failed after 9.2 minutes**: Windshear and
Stormcallers died normally, then the player died during a later Cloud Elemental
encounter. The incoming sources are not established by that log. Its replay seed
is retained in the full-run evidence document; the route now prints bounded
damage/healing history on death without changing combat or granting protection.
CI `34007206525` has passed client/server/smoke checks and is executing predeploy
character QA. The public build remains Alpha 1.0.9 at the last verified check.

Both 1.0.10 deployment jobs subsequently succeeded. The public release manifest,
healthy database-ready backend, login label and commit-qualified main module
independently match **Alpha 1.0.10** at
`3dbb76d0a24d972e756583023e2ba4a11356cff0`. Post-deployment live character QA is
running; the entire CI run is not yet terminal. This is the first deployed 1.0.10
candidate, not either of its earlier failed candidates.

## Alpha 1.0.11 candidate — grounded in the dungeon (not deployed)

Red canonical-floor dispatch tests reproduced four ground spells accepting
wall-blocked destinations and spending resources: Gravity Well, Meteor Drop,
Inferno Cataclysm and legacy Rain of Arrows. Independent legal-center tests
reproduced those spells and Consecrated Ground damaging enemies across a wall.
The repair validates clamped cast destinations before resources/combos, and
uses private floor snapshots for area damage while actor locks are held.
Gravity Well's accepted pull stays on the validated segment, without nesting
an instance lock under the target lock. Meteor's shield-explosion combo uses
the same damage boundary. Cluster and Apocalypse scatter clip from the accepted
center; their actual corrected positions drive warnings and impacts.

Focused race checks cover open doorways, blocked casts, damage/pull/debuffs,
expanded/Black Hole/Cluster/Extinction variants, all six Apocalypse meteors,
shield explosions, friendly Sanctuary/healing, invalid points, legacy geometry,
and stale spatial entries after a target changes instance. The final focused
suite passes (14.382 seconds), `/tmp/eidolon-ground-area-final-focused.log`.
The full server race suite passes (game package 171.606 seconds),
`/tmp/eidolon-ground-area-server-full.log`; the final two additional tests were
added during that full run and are covered by the later focused run.

The real Wizard UI route passes in 23.5 seconds including setup, source dirty
`3dbb76d`: ordinary walking to a generated dungeon wall, rejected Meteor/Inferno/
Gravity casts with zero cooldown and no accepted ability event, followed by
accepted reachable-floor casts and a client-presented Meteor impact. Log:
`/tmp/eidolon-ground-area-browser.log`. Credential scan and disposable cleanup
pass. This is placement/feedback evidence, not a full dungeon or rendered AoE
occlusion matrix. The route joins predeploy QA and is available as `ground-walls`.

The candidate advances version defaults, login text and patch notes to 1.0.11.
It must not be pushed into deployment ahead of the pending 1.0.10 deployments.
Full client checks and final release verification are still required. Remaining
1.1 work includes self-centered AoE, channels/cones, secondary effects, clipped
area footprints, full class/party/campaign progression, and Tempest survival.
Zone PvP relationship coverage is also still open; this geometry patch does not
silently change the existing zone target-type policy.

The first complete client candidate run passed 149 suites and failed one stale
MenuPolish login-version assertion (2,202 passing tests, one failure). That
assertion now expects 1.0.11, matching the updated release identity; the complete
client rerun is in progress. This was a test expectation mismatch, not a runtime
UI failure. Lint, shell syntax and whitespace checks pass.

Final candidate checks pass: **150 client suites / 2,203 tests** (102.149 seconds),
`/tmp/eidolon-1-0-11-client-final.log`, and the complete server race suite after
all final tests and metadata edits (game package 183.721 seconds),
`/tmp/eidolon-1-0-11-server-final.log`. The candidate is ready for a local commit;
publishing remains sequenced after 1.0.10's post-deployment verification. None of
these results closes the full 1.1 acceptance matrix.

## Milestone tracking

### Continued directional and pull audit — unpublished after 1.0.11 candidate

The previous goal turn made implementation progress: the 1.0.11 ground-spell
candidate was committed locally as `ba4a32e5477da6f13105f278eb5f40a207abe241`,
and 1.0.10's exact public identity was verified. At this continuation's latest
check, CI `34007206525` is still executing live four-class/remote-animation QA;
the 1.0.11 candidate has not been pushed ahead of that verification.

A new clean-`ba4a32e` full Tempest Fighter run is active with generator 2 attempt
0 seed `-1329185764639002788`, Normal 70, log
`/tmp/eidolon-1-0-11-tempest-diagnostic.log`. Windshear died and Stormcallers is
in combat at the latest observation. This is not a completed run. The server
image predates the local changes below and cannot verify them.

Sixteen directional dispatch cases reproduced eight wall-crossing failures:
Flame Whip, Scorch Beam, Radiant Strike (base/Smite), Shield Slam, Sweeping Strike,
and Earthshaker (radial/Fissure). Log: `/tmp/eidolon-directional-wall-red.log`.
Private canonical-floor snapshots now block damage, stun and armor-reduction
effects across walls without changing legal empty-space casts or open-doorway
hits. The shared Earthshaker helper checks the actual effect origin, including
its delayed use. No area/beam visual clipping is claimed by these server tests.

Eight Grip cases reproduced six failures: selecting enemies across a wall and
pushing targets closer than two units outward, sometimes into the next room.
Log: `/tmp/eidolon-grip-wall-red.log`. Selection now requires a reachable enemy
before spending resources; the pull stops at the lesser of two units and the
original distance, keeping movement on the validated segment without nesting
an instance lock under the target lock.

Combined directional/Grip/ground/Meteor race checks pass in 21.604 seconds,
`/tmp/eidolon-directional-grip-green.log`. The complete server race run is active,
`/tmp/eidolon-directional-grip-server-full.log`. These local changes are not part
of the committed 1.0.11 candidate and still require rendered verification and
their own release notes/version before publication.

The complete server race run subsequently passed (game package 214.627 seconds),
`/tmp/eidolon-directional-grip-server-full.log`. Whitespace checks pass. Source
inspection identifies the next presentation work: the canonical beam uses the
requested target position, while the network handler discards the local actor's
accepted ability event. Server damage occlusion alone therefore does not prove
that local/remote beam endpoints and area footprints agree with walls. That
rendered/authoritative presentation audit remains open; no client presentation
change was made during the active clean-source Tempest playthrough.

### Alpha 1.0.11 publication and continued aura audit

CI `34007206525` is now terminal **success**, including all post-deployment live
character, class and remote-animation checks. Frontend release and backend
health were rechecked at the exact healthy 1.0.10 commit. Pushed only the already
tested 1.0.11 candidate `ba4a32e5477da6f13105f278eb5f40a207abe241`; its CI run is
`34009078308`. New local directional/pull/aura changes are not in that commit.
The 1.0.11 client/server jobs pass and browser smoke is running at the latest
check. No 1.0.11 deployment is claimed yet.

Twenty-six initial self-area cases reproduced thirteen blocked-wall failures,
`/tmp/eidolon-self-area-wall-red.log`: Whirlwind (base/Bladestorm), Executioner
Spin, Guardian Roar taunt, Juggernaut Charge, Death Spiral, Smoke Bomb, Frost Nova,
Heaven's Trumpet and Spirit Guardians (base/Expanded/Vengeful/Boost). Canonical
floor reachability now applies to these hostile effects and existing active
Whirlwind ticks. Friendly Roar buffs and Spirit healing retain their existing
rules. Bladestorm pulls stay on the validated segment and cannot overshoot the
caster. The actual target position is checked under its lock before damage;
floor snapshots are taken outside actor locks.

The expanded checks include Bloodwhirl healing only from reachable hits, ordinary
Spirit casts ticking before/after an enemy moves behind a wall, friendly Roar
buffs and the existing active-Whirlwind tick branch. The initial combined race
checks pass (22.766 seconds), and the first full race suite passes (game package
201.957 seconds), `/tmp/eidolon-aura-directional-server-full.log`. The subsequent
target-lock refinement passes focused checks (26.691 seconds),
`/tmp/eidolon-aura-locks-focused.log`. Final full checks including the explicit
active-state fixture are running in `/tmp/eidolon-aura-locks-server-final.log`.

The rune audit also exposes a separate unresolved contract: `whirlwind_extended`
reduces instant damage by 50%, but no cast path sets `WhirlwindActive` true. Its
advertised extra duration is therefore not established. The explicit active-state
fixture tests wall behavior only and is not claimed as rune activation evidence.
This needs a real duration/damage/presentation repair before the rune gate closes.
Rendered aura footprints and beam endpoints likewise remain open.

### Continued beam agreement and Tempest evidence — unpublished

The final aura full-server race check passed (game package **208.503 seconds**),
`/tmp/eidolon-aura-locks-server-final.log`, including the target-lock refinement
and explicit active-state fixture. It predates the following beam endpoint edit.

Two new Scorch Beam event cases reproduced that the server reported the cursor
position rather than the actual line endpoint, `/tmp/eidolon-scorch-endpoint-red.log`.
The event now reports the canonical-wall-clipped full-range endpoint; the line
hit extent uses that same length. Focused directional/endpoint race checks pass
in 4.561 seconds, `/tmp/eidolon-scorch-endpoint-green.log`. A new full server race
run is active in `/tmp/eidolon-beam-server-full.log`.

Eight real-Three mesh tests reproduced the analogous local/remote presentation
failure at High and Low quality, `/tmp/eidolon-beam-presentation-red.log`. After
the clean Tempest process terminated, the shared transient-effect route was
updated to normalize Scorch Beam to its configured range and clip its segment
against the canonical floor union. Caller aim vectors are not mutated. All eight
mesh cases and six segment-geometry cases pass (1.957 seconds). A disposable
Wizard browser route is running in `/tmp/eidolon-beam-browser.log`; rendered
browser/server agreement is not yet claimed. Other aura/cone footprints and the
legacy offline Wizard hit path are not covered by this beam integration.

Tempest terminated **failed after 29.7 minutes**: four bosses dead, final boss
Zephyrion still taking damage at the six-minute encounter cutoff. The last
report was 12,673 boss HP and 2,021/2,575 player HP. The exact clean-source seed
and limitations are recorded in `dungeon-playthrough-evidence.md`. Only after
termination was the functional encounter ceiling extended to eight minutes,
retaining the stall watchdog and whole-run ceiling. A full-clear rerun is pending.

CI `34009078308` is still live in disposable full-character predeploy QA;
client, server and browser-smoke jobs pass. The public frontend and backend
remain healthy at exact 1.0.10 commit `3dbb76d0a24d972e756583023e2ba4a11356cff0`.
The latest user-request check also reconfirmed the already-deployed bag icons,
deliberate drops and tracking choices: 244 focused client tests and server drop
race tests pass. No new feature release or 1.1 milestone closure is claimed.

### Alpha 1.0.12 candidate — a clear line of fire

The ordinary Wizard browser route now **passes in 27.8 seconds** (30.8 seconds
including browser setup), `/tmp/eidolon-beam-browser-corrected.log`. Actual
production beam meshes attached to the effect scene match accepted server
endpoints for north-wall and open-floor casts at High and Low quality. Input uses
the skill tree, hotbar, mouse aiming, settings and recall; no actors, casts or
combat events are injected. The first browser attempt used the wrong observer
field (`x/z` instead of the protocol's `targetX/targetZ`) and failed in its numeric
assertion. Correcting only that observer resolved the failure. This is local-cast
browser evidence; the remote endpoint check remains the separate real-Three unit
matrix, not a claim of two-client dungeon browser verification.

The full post-beam server race suite passes (game package **189.500 seconds**),
`/tmp/eidolon-beam-server-full.log`. Ten mesh cases now include non-mutating aim
and source vectors and stale-layout overworld/legacy compatibility. The beam
browser route joins disposable CI and can run alone with `beam-walls` and class
`Wizard`. Credential scanning and temporary-service cleanup pass.

Login label, package/lockfile, release manifest, server/container/deploy/QA/CI
defaults and historical patch notes now identify the local **1.0.12 candidate**.
The 1.0.11 history is retained. Full final client/server checks and lint are
running in `/tmp/eidolon-1-0-12-client-full.log`,
`/tmp/eidolon-1-0-12-server-final.log`, and `/tmp/eidolon-1-0-12-lint.log`.
This candidate is not published; 1.0.11 still precedes it in deployment order.

Final candidate checks pass: **152 client suites / 2,220 tests** in 106.401
seconds, final full server race checks (unchanged game-package results cached
from the successful 189.500-second post-beam run), lint, shell syntax and
whitespace validation. The candidate is ready for a local commit and a new
clean-source full Tempest run. Publishing still waits for 1.0.11's complete
deployment and post-live verification; the full 1.1–1.10 roadmap remains active.

### Continued rune duration audit — unpublished after 1.0.12 candidate

The previous goal turn made implementation/release progress: committed 1.0.12
as `fd93bd3b89d1817762df757a6568e14be8dd1794` after final checks. It remains
local, behind 1.0.11's post-live gate. CI `34009078308` passed both deployments
and live anonymous/persistent-character QA; four-class/remote-animation QA is
still running at this continuation's latest check. Public frontend release,
backend health, login label and entrypoint query were verified at exact 1.0.11
commit `ba4a32e5477da6f13105f278eb5f40a207abe241`.

The clean-`fd93bd3` full Tempest Fighter rerun is live in
`/tmp/eidolon-1-0-12-tempest-full.log`, session `27831`, seed
`-5249240270438193008`, generator 2 attempt 0, Normal 70. Windshear, Stormcallers
and Roc Matriarch are dead at the latest observation. It uses ordinary
Bloodwhirl/Fortify/Extended defenses and the eight-minute per-encounter ceiling.
It is not a completed run and its built server cannot verify the newer local
Whirlwind edits below. No client runtime or active QA shell-script edits were
made during this clean-source run.

Two actual-cast regressions reproduced missing Whirlwind activation for both
base and Extended, `/tmp/eidolon-whirlwind-duration-red.log`. The local repair
uses the existing authored one-second Fighter spin and half-second pulse cadence:
base has two pulses, Extended has four over two seconds. Each Extended pulse has
half the normal pulse's raw damage (integer rounding distributed across pulses).
The former instant cast's raw damage budget, including its talent/combo bonus,
is preserved, not multiplied by the number of ticks. This deliberately changes
base Whirlwind from an instant hit to damage over its spin; final post-mitigation
damage can still vary with normal combat effects on each pulse.

The server owns an independent pulse clock, snapshots the cast budget, and
rechecks current target range, relationship, instance and canonical walls per
pulse. Bloodwhirl healing and Bladestorm pulls occur once per distinct enemy per
cast. Death, disconnection, scene reset, expiry and instance change terminate
the spin; late updates do not replay an already-expired cast. Attacker snapshots
are captured before target locking, retaining party identity and safe-zone
coordinates. The old manually activated tick fixture now uses a real Extended
cast followed by a later pulse.

Focused race checks pass in 16.272 seconds, then expanded checks pass in 19.432
seconds, `/tmp/eidolon-whirlwind-expanded.log`, covering duration, exact budget,
independent timers, range/wall rechecks, rune side-effect limits, cancellation,
combo capture and an ordinary later-pulse kill with gold rewards. An additional
parallel shared-enemy/party-safety race check passes in 1.352 seconds,
`/tmp/eidolon-whirlwind-parallel.log`.

New server protobuf fields 110/111 carry active state and remaining duration;
entity broadcast copies preserve that presentation state without copying private
pulse maps/budgets. Observer change detection includes expiry and elapsed time.
The full-server run in `/tmp/eidolon-whirlwind-server-full.log` first exposed a
test-only 100 ms allowance around copying a whole world. The copy test now
requires the exact preserved deadline and a positive, bounded remaining time;
the focused protocol race rerun passes in 1.565 seconds,
`/tmp/eidolon-whirlwind-protocol-corrected.log`. The original full game-package
run is still executing; a final full rerun is required after test refinements.

This rune work is **not release-ready**: client protobuf generation, local and
remote animation/effect timing, late-observer and cancellation presentation,
real browser casting, final full checks, version metadata and patch notes remain
to do. The running Tempest test retains the unmodified 1.0.12 client graph; only
the server protobuf output was regenerated so far. No 1.1 or later milestone is
closed by these local changes.

The initial full game-package race run passed in **242.803 seconds**; that
overall invocation failed only the copy-timing assertion described above. The
corrected full-server rerun then **passed**, game package **242.828 seconds**,
`/tmp/eidolon-whirlwind-server-final.log`. A final inactive-path optimization
(avoid unlocking/relocking actors that are not spinning) passes focused race
checks in 5.765 seconds. A normal entity-update/copy-path test was also added;
the full check including these last refinements is running in
`/tmp/eidolon-whirlwind-server-current.log`. These results do not establish
client animation agreement or release readiness.

Tempest has now defeated Thunderlord Kaelix as well as its first three bosses
and is clearing the route to Zephyrion on the same clean source/seed/process.
The 1.0.11 CI watcher remains live (`/tmp/eidolon-1-0-11-ci-watch.log`), still
in four-class and remote-animation QA. The committed 1.0.12 candidate has not
been pushed ahead of that gate.

Tempest has defeated Windshear, Stormcallers and Roc Matriarch and is fighting
Thunderlord Kaelix on the same clean-1.0.11 process/seed. This is progress, not a
complete clear; the current local fixes are absent from that running server.

1.1 remains open until all five dungeon reports meet their acceptance criteria,
alongside onboarding/reconnect and the initial PvP corrections. Releases 1.2
through 1.10 remain unimplemented roadmap work; none is closed by this hotfix.

## September 6 continuation — Tempest complete, Whirlwind client integration

The previous turn made concrete progress: the requested subtle open-source
credit and GitHub link are implemented beneath the login controls. All 70 menu
tests, lint, and desktop/mobile keyboard browser checks pass. The link opens the
actual repository in a separate tab without opener access. This remains local.

The clean 1.0.12 Tempest run above is now **terminal PASS**, all five bosses plus
completed recall/re-entry, 31.5 minutes, seed `-5249240270438193008`. Its full
evidence is recorded in `dungeon-playthrough-evidence.md`. Alpha 1.0.11 CI
`34009078308` completed all gates successfully. Alpha 1.0.12 was pushed as
`fd93bd3b89d1817762df757a6568e14be8dd1794`; CI `34011698025` has passed client,
server and browser smoke and is now running predeploy character QA. Neither a
queued nor a running deployment gate is a verified live release.

The final full server race run including the Whirlwind inactive-path refinement
and normal entity-update/copy regression **passed**, game package 200.263 seconds,
`/tmp/eidolon-whirlwind-server-current.log`. After the clean Tempest process ended,
client protobuf was regenerated and local/remote presentation integrated. Base
and Extended spin meshes follow the caster for one and two seconds respectively;
authoritative remaining time supports late observers, explicit stop, and event
deduplication. Predicted rejection and death/removal/disposal clear the effect.

Twelve initial real-Three presentation regressions failed before integration,
then passed; expanded coverage now passes **18 tests**, including protobuf false
defaults, late observers, rejected predictions, acknowledged repeat rejection
and cancellation. The earlier complete client check passed 153 suites / 2,232
tests; later additions require a fresh final run. Extended's tooltip now explicitly
says its damage reduction is **per pulse**, in both client and server catalogs.
The new ordinary-input dungeon browser route is running against a fresh disposable
server in `/tmp/eidolon-whirlwind-browser.log`; its outcome is not yet established.
No version beyond 1.0.12 has been prepared or deployed, and the full roadmap gates
remain open.

### Alpha 1.0.13 candidate — hold the whirlwind

Version defaults, the login label and patch history are now prepared for 1.0.13.
Notes explicitly describe the change from an instant hit to two pulses, Extended's
four half-damage pulses, per-target side-effect limits, duration presentation and
the open-source login credit. All previous release entries remain intact.

The first actual browser route failed after its first successful High-quality
cast: a late positive snapshot recreated an expired effect for approximately
11 milliseconds. A regression reproduced the extra mesh; synchronization now
remembers the preceding authoritative remaining time and rejects a decreasing
tail snapshot after local expiry. A new cast can start after a clear or newly
increased duration. All **19** presentation tests pass after this correction.

The fresh-server corrected browser route passed **27.8 seconds**, followed by
the versioned candidate and dedicated CI account route passing **27.5 seconds**,
`/tmp/eidolon-1-0-13-whirlwind-browser.log`. Both exercise base/Extended at High/Low,
ordinary movement, authoritative acknowledgment, duration and no duplicated
effect. Artifact credential scanning passed and disposable services were removed.
The route is included in the full predeploy sequence, not only a manual command.

Final full client/server checks are running in `/tmp/eidolon-1-0-13-client.log`
and `/tmp/eidolon-1-0-13-server.log`. A fresh complete Verdant Fighter run is live
in `/tmp/eidolon-1-0-13-verdant-full.log`; this is deliberately after the Whirlwind
damage-timing change, unlike the earlier clean Tempest evidence. These pending
checks are not yet passes. Alpha 1.0.12 remains in predeploy full-character QA;
the next candidate has not been pushed ahead of that release's live gates.

### Added scope: phone playability (September 6 player report)

The main roadmap now explicitly treats usable phone framing, HUD, touch controls
and core menus as a **1.1 release gate**, with a complete portrait/landscape visual
redesign in **1.2**, touch-combat/performance refinement in **1.3**, retained mobile
flows through later features, and physical-device evidence required for **1.10**.
The player reports excessive mandatory zoom-out and unusably small/awkward UI.
Source inspection confirms aspect-scaled orthographic horizontal framing and
fixed-offset touch controls; the exact physical-phone failures still need reproduction.
This is a roadmap change, not a claim of a shipped mobile fix. It includes readable
UI independent of world zoom, no keyboard/hover-only actions, safe-area/keyboard
handling, always-available visible chat, and real Android/iOS testing.

The final 1.0.13 client run passed **153 suites / 2,241 tests**, 110.341 seconds;
lint also passed. The full server race and Verdant playthrough remain live at this
update. Verdant seed `4391125778650393874`, generator 2 attempt 0, Normal 30,
Fighter 100, has reached and is damaging Rootbound Warden through ordinary combat.

The final full server race check subsequently **passed**, game package 239.040
seconds, `/tmp/eidolon-1-0-13-server.log`. The same Verdant process has defeated
Rootbound Warden and Briar Matron; the remaining bosses and recall/re-entry are
still pending, not a complete-run pass.

The Verdant process subsequently **passed in 8.7 minutes**, all four bosses and
completed recall/re-entry with preserved seed/boss/gold state. This is the first
complete dungeon evidence containing the Whirlwind duration changes; replay details
are in the dungeon evidence document. The final anonymous browser suite is running
in `/tmp/eidolon-1-0-13-anonymous.log` before candidate commit.

The new `mobile-playability-evidence.md` records concrete phone baseline findings:
aspect-ratio camera span, 10px mobile HUD/chat text, 36px scaled landscape skill/
interact targets, and a production InputManager/jsdom reproduction where a
two-finger gesture over the quest list emits a world zoom callback. This is
diagnostic evidence for the upcoming phone work, not a claimed mobile fix.

Final candidate anonymous checks **passed all nine tests**, including the new
desktop/mobile login-credit route, release/dependency surface, canonical dungeon
floors, menu layers, raid menus and responsive entry flow. Together with the
153-suite client pass, full server race pass, ordinary Whirlwind casts and complete
Verdant run above, this permits committing the 1.0.13 candidate. Publication still
waits for 1.0.12's terminal live gates; watcher session `1678` follows CI
`34011698025` in `/tmp/eidolon-1-0-12-ci-watch.log` without restarting it.

### Candidate committed; 1.0.12 deployed; next phone input repair

Alpha 1.0.13 is committed locally as
`b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8`, including Whirlwind, login credit,
phone roadmap/baseline evidence, synchronized version metadata and patch notes.
All nine final anonymous tests passed in 1.4 minutes. It has not been pushed
ahead of the preceding release's terminal live checks.

Alpha 1.0.12 CI subsequently passed predeploy QA and both deployment jobs. Direct
public checks confirm frontend release, login label, entrypoint query and backend
health all identify `fd93bd3b89d1817762df757a6568e14be8dd1794`, Alpha 1.0.12,
with database ready. Post-deployment character QA remains active; the full CI run
is not yet a terminal pass.

Separate local work after `b321307` fixes the reproduced phone pinch-routing
problem. All 11 new regressions first failed, then passed alongside 11 existing
input tests. Browser-generated touch targeting passes in 3.1 seconds; the check
is added to anonymous CI for the next candidate. The repair is limited to gesture
ownership, cancellation and distance-based zoom response; phone camera composition,
HUD, menus and real-device acceptance remain open. See the mobile evidence document.
The full client rerun is active in `/tmp/eidolon-mobile-pinch-full.log`.

That full client run finished with 152 passing suites and two failing constructor
fixture suites (10 failures): their RenderSystem mocks omitted the renderer canvas
now explicitly passed into input handling. The mocks now expose that production
interface, and the settings constructor test also asserts that the correct canvas
is wired. Production code retains strict renderer-canvas ownership. Focused
constructor/pinch checks and a corrected full rerun are executing via session
`13196`, `/tmp/eidolon-mobile-pinch-constructor.log` and
`/tmp/eidolon-mobile-pinch-full-final.log`. This is still uncommitted next-candidate
work, not a modification of committed 1.0.13.

### 1.0.13 pushed; phone HUD work advances separately

Alpha 1.0.12 CI `34011698025` completed **all gates successfully**. Exact frontend
and backend identities were rechecked after terminal success; both report
`fd93bd3b89d1817762df757a6568e14be8dd1794`, Alpha 1.0.12, database ready.
The existing watcher ended successfully. Only then was committed candidate
`b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8` pushed to master. Alpha 1.0.13 CI
`34013545773` has passed client/server/browser checks and is in predeploy QA.
Newer phone work stays uncommitted and is absent from that release.

The corrected pinch full suite passed **154 suites / 2,252 tests**, 104.32 seconds.
The phone HUD then gained separated controls/status/navigation, 44px-or-larger
primary touch targets, explicit menu labels, compact permanent expandable chat
with activity count, preserved XP/level feedback and phone Menu entries for Skills
& Runes/Abilities. These address inspected overlaps and missing touch navigation,
not merely source formatting. Full HUD tests passed 154 suites / 2,253 tests before
the last spacing/menu refinements. The corrected combined browser suite passes
all three phone/party/service checks (44.1 seconds). Remaining evidence and scope
are in `mobile-playability-evidence.md`.

A new real-server phone route is currently live via session `63902`,
`/tmp/eidolon-phone-gameplay.log`. It uses a fresh disposable character, actual
browser touch input for joystick movement, inventory/character/quest/social menus,
Skills & Runes and chat, in portrait and landscape. It does not grant quest progress
or kills. Do not edit the running isolated-QA shell script or client graph before
it terminates. No mobile patch version/notes have been finalized or pushed yet.

The first phone route ended at its 180-second limit, with cleanup masking the
stalled action. After bounded action timeouts and stage diagnostics, a fresh run
reproduced a real obstruction: joystick movement and Inventory opening worked,
but the minimap intercepted Inventory's Close tap. It was mounted at body level
above the whole menu UI stacking context. A failing unit regression confirmed
the wrong parent; minimap and tooltip now mount in the same UI root as menus.
The local phone fixture also instantiates the real minimap. A new disposable
rerun is active through session `67356`, `/tmp/eidolon-phone-gameplay-layer-fixed.log`.
The prior phone processes are terminal failures, not verified usable mobile runs.

### Alpha 1.0.14 candidate — room for your thumbs

The layer-corrected real-server phone route **passed**, 10.1 seconds, both
orientations and all its movement/menu/chat actions; minimap tests pass 15/15.
Replay limits and failures remain recorded in the mobile evidence document.

Version metadata/login display and patch notes are prepared for 1.0.14. The notes
describe separated phone controls, persistent compact chat, canvas-owned pinch,
touch-accessible skill menus and the minimap layering repair. They explicitly
leave camera framing, complete menu redesign, combat and physical-phone acceptance
open. The fresh phone account route joins full predeploy QA; phone HUD/pinch fixtures
join anonymous CI. No 1.1 or later milestone is closed.

Final versioned client/lint, server-race and phone checks are live via sessions
`83396`, `67029` and `98106`, logs `/tmp/eidolon-1-0-14-client.log`,
`/tmp/eidolon-1-0-14-server.log` and `/tmp/eidolon-1-0-14-phone.log`. Do not edit
the active isolated script or runtime while that phone check runs. The 1.0.13
deployment watcher is session `38496`, `/tmp/eidolon-1-0-13-ci-watch.log`;
publication of 1.0.14 will wait for that preceding release's terminal live gates.

The final versioned client/lint checks **passed**, 154 suites / 2,255 tests,
107.594 seconds. Full server race checks passed (root package 14.173 seconds,
unchanged game package cached). The dedicated-account 1.0.14 phone route also
**passed in 15.4 seconds**, 19.8 including browser overhead, with normal touch
movement, all exercised menus and chat in both orientations; credential scanning
and disposable cleanup passed. The final 11-test anonymous suite is active via
session `90199`, `/tmp/eidolon-1-0-14-anonymous.log`. No candidate commit or push
has occurred yet.

All **11 final anonymous checks passed in 1.1 minutes**, including the new phone
HUD with the real minimap and browser-generated pinch targeting. A final CSS-only
palette pass replaces neon action rings with muted game-consistent colors and
reduces the short-landscape minimap to 88px. The phone HUD/skill-menu check was
rerun afterward and **passed in 14.1 seconds**; its portrait and landscape captures
were inspected and preserved at `/tmp/eidolon-1-0-14-phone-hud-portrait.png` and
`/tmp/eidolon-1-0-14-phone-hud-landscape.png`. These are rendered UI fixtures, not
physical-phone gameplay captures. The 1.0.14 candidate is ready for local commit;
push/deployment still waits for 1.0.13's live gates.

### Alpha 1.0.15 candidate — a wider view of Eidolon

The preceding HUD candidate was committed as
`af3757b668da11cc932c9e93b7a0f770259d334b`. It is not yet pushed: 1.0.13 CI
`34013545773` has passed predeploy and both deployment jobs, and is still running
its live four-class/remote-animation gate. Do not overlap the next deployment.

The next local candidate changes phone projection to a 24-unit short-axis default,
preserving rotation scale and manual zoom. Persistent navigation/hotbar bounds
influence hero framing; chat and transient menus do not. Phone Menu gains Reset
Camera, relocking follow and restoring default zoom. Desktop framing stays intact,
raycasts use the same projection, and zoom no longer reallocates drawing buffers.
Patch notes/login/runtime metadata are prepared as Alpha 1.0.15. None of the open
1.1–1.10 milestones is closed by this change.

The former projection failed 8 of the 9 new camera regressions; all now pass.
Initial full client tests passed 155 suites / 2,266 tests. A corrected production
mesh fixture and HUD pair passed 2 checks in 24.3 seconds; the first fixture's
nonexistent Goblin mesh request was a test error, corrected to Skeleton. Inspected
portrait/landscape captures show a readable Fighter, Skeleton and six-unit warning
boundary, not a populated dungeon or physical-phone combat session. A fresh
real-server phone route passed 10.5 seconds with movement, core menus, chat, default
framing and Reset Camera in both orientations, with credential scan/cleanup passing.

Final versioned **client/lint passed: 155 suites / 2,267 tests**, 101.69 seconds,
`/tmp/eidolon-1-0-15-client.log` and `/tmp/eidolon-1-0-15-lint.log`. Full server
race checks passed, root package 13.480 seconds (unchanged game package cached),
`/tmp/eidolon-1-0-15-server.log`. All **12 anonymous browser checks passed in
1.8 minutes**, `/tmp/eidolon-1-0-15-anonymous.log`, including camera layout at
360×800, 390×844, 430×932, 844×390 and 800×360. The narrow portrait/landscape
captures were inspected and preserved in `/tmp/eidolon-1-0-15-camera-*.png`.

The versioned real-server phone rerun is active through session `89316`, log
`/tmp/eidolon-1-0-15-phone.log`. Do not edit that runtime or the isolated QA script
until it finishes. Further phone requirements and evidence limits are recorded
in `mobile-playability-evidence.md`; touch targeting is a concrete next issue.

The versioned phone rerun **passed in 12.6 seconds**, 15.3 with browser overhead;
artifact credential scan and disposable cleanup passed. Session `89316` ended
successfully. All final 1.0.15 checks are complete and the candidate is ready for
commit. Its publication follows 1.0.14, which still waits on 1.0.13's live gate.

### 1.0.14 deployment advances; Alpha 1.0.16 candidate — choose your mark

The camera release was committed as
`2b55efabfa4da459d14f37b5e18b659888de7e1e`. Alpha 1.0.13 CI `34013545773`
subsequently completed all live gates successfully. Frontend/backend manifests,
database readiness, login label and commit-qualified runtime were reverified as
exact `b3213077faa8eb8e1ddc7b45d2905d5682b8fbb8`, Alpha 1.0.13. Only then was
the exact 1.0.14 commit `af3757b668da11cc932c9e93b7a0f770259d334b` pushed,
without prematurely publishing 1.0.15. Its CI is `34015379084`, watcher `21598`,
`/tmp/eidolon-1-0-14-ci-watch.log`. It has now passed client/server/browser and
full predeploy gameplay checks and is running both deployment jobs. Wait for all
postdeploy live gates before pushing the camera release.

The next local candidate adds persistent deliberate mobile selection, shared by
Attack and offensive abilities; invalid/dead/removed/previous-instance/friendly
targets cannot remain selected. Canvas taps select without attacking, while
empty-ground taps and a 44px target-card Clear button cancel pursuit and queued
casts. Self-centered casts retain their behavior; unselected directional casts
use facing. Target-card name/range feedback is compact on phones, with the existing
gold world ring. Menu/drag/pinch/cancel/blur/reset cannot become synthetic selection.

The actual combat route exposed overlapping Skeleton hitboxes that made a rear
enemy unselectable through repeated identical taps. Production raycasting now
retains the actual hit stack and repeated phone taps cycle hostile overlaps in
stable ID order without attacking. The unit regression covers cycling and the
real route still requires the intended target, not any arbitrary acquired enemy.
Earlier failures and diagnostic IDs/positions are recorded in the mobile evidence
document; the fixture's proto import, chat-focus and desktop-UA errors are not
claimed as gameplay fixes. Corrected pre-version combat passed both orientations
in 18.5 seconds, with normal enemy health loss and cancellation observations.

Alpha 1.0.16 patch notes, login/package/release and all runtime version defaults
are prepared. Its dedicated Wizard `phone-combat` route is added to full predeploy
QA with an exact disposable account; it grants no kills or campaign completion.
The open phone and 1.1–1.10 requirements remain intact.

Final versioned **client/lint passed: 157 suites / 2,290 tests**, 104.05 seconds,
`/tmp/eidolon-1-0-16-client.log` and `-lint.log`. Full server race checks passed,
root 11.520 seconds (unchanged game package cached), `-server.log`. Real-server
touch combat passed **2 tests / 27.8 seconds**, `-combat.log`, including selected
spell damage, basic attack IDs, both orientations and no new combat commands for
1.1 seconds after cancellation; credential scan/cleanup passed. The full anonymous
browser suite is active as session `93949`, `/tmp/eidolon-1-0-16-anonymous.log`.
A final phone movement/menu regression remains to run after that browser process.
No 1.0.16 commit or push is claimed yet.

The first final anonymous run ended **11 passed / 1 failed**, 3.5 minutes. Its
dungeon gallery never initialized: the preserved trace
`/tmp/eidolon-1-0-16-anonymous-network-change.zip` reports `ERR_NETWORK_CHANGED`
for multiple local module requests. It did not reach the floor assertions. The
same process was allowed to finish before any rerun; no assertion was weakened.

Inspection also found the login shell selected `/usr/bin/node` 18.19.1, below
the repository's Node 24 baseline. Local JS checks now explicitly use the existing
runner toolcache's Node **24.18.0** at
`/home/aeml/.local/share/eidolon-actions-runner/_work/_tool/node/24.18.0/x64/bin`.
Use this prefix for subsequent local npm/Playwright commands; it changes no global
installation. The full supported-toolchain rerun passed **157 suites / 2,290 tests
in 67.024 seconds**, lint, and **12 anonymous checks in 1.4 minutes**. The dungeon
gallery passed in 3.0 seconds. Logs: `/tmp/eidolon-1-0-16-node24-{client,lint,anonymous}.log`.
The independently passing server race checks are unaffected by Node selection.

Final Node 24 phone movement/menu and combat reruns are sequential in session
`87532`, logs `/tmp/eidolon-1-0-16-node24-phone.log` and `-combat.log`. Do not run
another local Playwright session or edit their runtime while this sequence runs.
Alpha 1.0.14 now has both deployment jobs successful and its live character gate
running; later versions still wait for that gate's terminal success.

The final Node 24 phone sequence **passed** and session `87532` is closed:
movement/core menus/chat in both orientations passed in 6.7 seconds (8.0 total),
and the two combat orientations passed in 17.2 seconds total. Both artifact
credential scans and exact disposable cleanup passed. All required local candidate
checks are now complete; 1.0.16 is ready for commit, but its publication remains
behind the committed 1.0.15 release and 1.0.14's active final live animation gate.

### 1.0.14 live failure and manual phone movement follow-up

CI `34015379084` ended in **failure** at Live Release and Character QA. Both
deployments and all preceding jobs succeeded, as did the live four-class matrices.
The final two-account route failed on its original attempt and retry when a real
hostile click did not acquire an attack target. The projected centers were on the
canvas; this alone does not prove that the current ray intersected an active
hostile. Do not classify this as transient or bypass the assertion without evidence.

Added read-only acquisition diagnostics to the multiplayer test: pointer/canvas
ownership, open-menu flags, target activity/position, hovered entity and current
ray hits. The isolated route on `226a298` plus local changes passed in **1.9 minutes**,
including all three party dungeon return cycles, effect lifecycles, remote movement,
jump, basic attack and ability. Log:
`/tmp/eidolon-release14-multiplayer-diagnostic.log`. Credential scanning and exact
disposable cleanup passed. This newer local source is not proof that deployed
1.0.14 passes.

Diagnostic-only branch `qa/release14-click-diagnostic`, commit `527a812`, starts
from exact deployed `af3757b` and changes only the test diagnostics and its branch's
workflow. Run `34017914992` verifies frontend/backend SHA before repeating the
original four-class and remote sequence against production with existing QA
accounts. It has no deployment step or automatic push trigger and must not be
merged as the production CI workflow. The run is pending at this entry.

Meanwhile, local phone input work gives joystick movement priority over old
attack/ability pursuit before actor updates. Crossing the movement dead zone
clears older buffered actions once, while new casts requested with the other thumb
remain available; the selected enemy is retained. Another finger cannot steal
joystick ownership, and blur/reset/cancellation clears the knob and rejects stale
touch movement. No new release number or publication is assigned to this work yet.

The old behavior failed **5 tests** before repair. Focused checks passed **36 tests**;
Node 24 lint and the full client suite passed **158 suites / 2,296 tests** in 55.016
seconds. Logs use `/tmp/eidolon-manual-movement-`. The real-server two-thumb route
passed both orientations in **18.1 seconds**: movement while the second finger
casts, authoritative selected-target health loss, manual takeover of attack pursuit,
retained selection and no resumed pursuit after release. It uses an allowlisted
encounter waypoint for setup, not ordinary traversal or campaign-completion proof.
Physical-phone, all-class and full-menu acceptance remain open.

Diagnostic run `34017914992` subsequently **passed** against the exact deployed
`af3757b` frontend and backend: all four real-input class matrices and the remote
Cleric/Wizard sequence, including basic attack acquisition. Sanitization passed.
Log: `/tmp/eidolon-release14-live-diagnostic.log`. This did not reproduce or explain
the original failure; the loot-first raycast priority is only an investigation
lead, not an established live cause. The original failed job in `34015379084` is
now being rerun unchanged; do not publish successors while it is running.

### Alpha 1.0.17 candidate — your next step is yours

The manual joystick follow-up above now has a separate patch-note entry and
synchronized login, package, release manifest and runtime version defaults. It
remains an unpublished candidate behind 1.0.15 and 1.0.16, not a claim that the
mobile milestone is finished. Final Node 24 client checks passed **158 suites /
2,297 tests** in 44.658 seconds (`/tmp/eidolon-1-0-17-client.log`). Final versioned
lint, server race and anonymous-browser checks are pending at this entry. The
prior two-thumb combat proof uses the same input/runtime changes before the
version-only update; a final versioned phone run remains to be gathered.

Final versioned checks subsequently **passed**: lint, server race suite (root
7.010 seconds; unchanged game package cached), and 12 anonymous browser checks
in 1.1 minutes. The sequential real-server phone route passed in **8.3 seconds**,
followed by both two-thumb combat orientations in **17.1 seconds**. Both
credential scans and exact disposable cleanups passed; local browser session
`44631` is closed. Logs: `/tmp/eidolon-1-0-17-{lint,server,anonymous,phone,combat}.log`.
The candidate is ready for commit; no gameplay release is published by this work.
The original 1.0.14 live gate rerun remains active and successors remain queued.

### 1.0.14 verified; 1.0.15 publication starts; phone item routes underway

The unchanged original live job in `34015379084` subsequently **passed**, making
the full CI run successful after its earlier failure. Independent post-terminal
checks confirmed frontend release metadata, versioned main entry, login label and
backend commit/version all match `af3757b` / Alpha 1.0.14; backend database status
is `ready`. The exact-live diagnostic had also passed independently. The original
acquisition failure was not reproduced or attributed to a confirmed cause; retain
its evidence rather than calling it fixed. Loot-first raycast priority remains
an unconfirmed investigation lead.

Only `2b55efabfa4da459d14f37b5e18b659888de7e1e` was pushed to master next, preserving
the separate 1.0.15 camera release. CI `34018964584` is running. Later commits
remain local; do not push HEAD over this gate. 1.0.17 was committed as `99c9ab9`
after all its local checks completed.

The next local phone work adds readable bag rows and explicit item details/actions.
Source inspection found that mobile material/quest-item clicks returned without
inspection and equipped-slot taps immediately unequipped gear. Seven new tests
failed before the change; the initial candidate passed 20 inventory tests and
lint. Its first rendered check then exposed inherited square-slot geometry causing
neighboring rows to intercept taps. This is a candidate regression, not evidence
that the new layout is ready. Browser session `65130` is still running at this
entry; no runtime changes or replacement browser run are made over it.

### Alpha 1.0.18 candidate — a bag made for your hands

The phone bag/detail implementation now has separate patch notes and synchronized
login/package/runtime release metadata. The initial square-slot regression was
repaired after its browser run ended; three rendered phone layouts passed in
16.4 seconds, including actual touch scrolling, target reachability, comparison
and Back/Escape navigation. Item details expose explicit equip/unequip and
confirmed drop actions, validate current item identity/stack, protect quest items
and preserve desktop drag-out. Native dialog lifecycle cleanup is included.

The real-server inventory route initially failed its combat setup. Diagnostics
proved a level-1 Fighter was dealing damage to a level-10 Skeleton, but not enough
to finish within 40 seconds. Explicitly preparing the dedicated QA character at
level 30 corrected that test precondition; it does not prove first-hour balance.
The resulting normal-combat/loot route passed in 1.1 minutes with authoritative
equip, unequip, canceled/confirmed drop, manual recovery and reconnect persistence
in both phone orientations. No forced kill or guaranteed-loot command is used.
Credential scanning and exact disposable cleanup passed. This route is now part
of full predeploy QA, alongside the existing two-thumb combat route.

Final versioned Node 24 client/lint checks pass: **159 suites / 2,310 tests**, 67.612
seconds, plus server race checks. The first anonymous run ended 14/15 because
Chrome reported `ERR_NETWORK_CHANGED` loading local modules in the login-flow
audit; its trace is preserved at `/tmp/eidolon-1-0-18-anonymous-network-change.zip`.
The unchanged rerun and subsequent versioned combat/inventory checks are pending.
No assertion was weakened and no live local browser run was replaced.

Meanwhile, 1.0.15's predeploy and both deployment jobs succeeded. CI `34018964584`
is now in Live Release and Character QA. Later releases remain queued; 1.0.18 is
not yet committed or published. The wider dungeon, phone and 1.1–1.10 gates remain
open. Detailed phone evidence and remaining limits are in the companion evidence file.

The final 1.0.18 sequence **passed** and session `43940` is closed: unchanged
anonymous rerun **15/15 in 1.4 minutes**, two-thumb combat **2/2 in 17.2 seconds**,
and server-owned bag/equipment/drop/recovery/persistence **1/1 in 1.0 minute**
covering both orientations. Both credential scans and exact disposable cleanup
passed. Final landscape comparison was visually inspected. Server race checks
passed (root 7.816 seconds; unchanged game package cached). Logs use
`/tmp/eidolon-1-0-18-{anonymous-rerun,combat,inventory,server}.log`.
The candidate is ready for commit. 1.0.15 is still in its final live gate;
1.0.16, 1.0.17 and 1.0.18 must retain separate, ordered publication.
