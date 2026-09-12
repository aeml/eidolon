# Integrated 1.1.0 development regression

Draft notes, outstanding acceptance and publication steps are consolidated in
the [1.1.0 release handoff](2026-09-12-1-1-release-handoff.md). It is not release
approval or a substitute for the full roadmap.

## Tripwire/healing integration — September 12, 23:19 UTC

Subsequent integration: accepted PvP componentbec83434 is now merged. Its exact
runtime03aef5b2 passed full CI34724352226 (client420/6489, server game race
360.608s and all three browser shards). See the
[race acceptance](2026-09-12-pvp-impact-relationship-race.md). A fresh combined
workflow is required; earlier CI34725102442 is still running on frozene604dbdb
and cannot validate this additional merge. The independently running fresh
Rogue native16530 also remains frozen on e604dbdb. Cleric utility runtime work
is still isolated and unaccepted; no production publication occurred.

Merged accepted primarye6bedc73, including component2a6f18b4. Full CI34723986784
passes on runtime48713d22: client417/6456/101.627s, game race348.863s and all
three browser shards. Actual paid/trained/saved trap43530, complete entrance/
shield86468, prepared support36250 and all three stable status routes75575
close the identified component checks. See [acceptance](2026-09-12-tripwire-damage.md).
The later status correction only stabilizes the test's temporary-stat conditions.

Fresh combined regression is required for this merge and its additional QA
stage. No version/public notes/deployment changed. PvP03aef5b2 is still separate
pending full CI34724352226. Three newly reproduced Cleric utility Masteries
remain an unaccepted diagnostic branch59cad46c, not part of this integration.

## Accepted preparation integration — September 12, 23:07 UTC

CI34723609678 completed SUCCESS on exact
802d216abb8367fdf61ebb463b757128871248b2. Client420 suites/6489 tests pass137.486s;
server game coverage101.549s/86.9%, race355.767s; all three browser shards pass.
Logs `/tmp/eidolon-integrated-preparation-{client,server}-34723609678.log`.
Native/deploy/live stages skipped, not passed. This accepts the merged optional
preparation UI/keyboard component, not the full milestone or later candidates.

The independent focused2v2 audit subsequently exposed a genuine delayed-impact
relationship race even though this complete CI passed. Preserve that contrary
evidence; candidate03aef5b2 in work/1-1-pvp-completion-race fixes it and has full
CI34724352226 pending. Healing48713d22 similarly awaits full CI34723986784,
with paid Rogue/Cleric support now native-verified. Poison's remaining collateral
test sampled a rested stat before the buff expired; corrected stable-condition
status verification is running separately on50d2ea57. None is merged here yet.

## Preparation integration — September 12, 22:45 UTC

Merged primary fdb13277, adding accepted preparation guidance cf7f67a1. Exact
candidate c09248c8 passed full CI34722166310, including actual desktop Enter/
Space and both phone layouts; all three relevant captures were inspected.
See [component acceptance](2026-09-12-dungeon-preparation-guidance.md).
The handoff now includes these two player-facing changes as reviewed note
material. No version bump, public notes or deployment was performed.

Earlier combined CI34722568754 on54901f19 completed SUCCESS at the subsequent
22:45 check: client/server and all three browser shards pass. Native/deploy/live
were skipped, not passed. Require a fresh combined run for this new integration.
Tripwire remains separate pending its arrival collateral routes and full CI.

## Follow-up integration — September 12, 22:21 UTC

Merged accepted primary1ea44fbc, including the fully verified role-equipped
four-player controller/fixture component e2d5da9b. Native15051 on9b6745d7 passed
all rooms/four original-health bosses, individual credit/manual rewards/Water
offers and saved state after relog,58.8minutes with zero deaths. Exact evidence
and limitations are in [the party record](2026-09-12-party-progressed-gear.md).
These incoming changes are QA/supporting documentation, not production stat
scaling or boss tuning. No preparation UI or Tripwire candidate is merged here.
Fresh combined hosted regression is required; earlier0087e4de CI does not prove
the merged test/controller surface. Native/deployment/live acceptance remains
separate. The handoff checks off only this exact prepared-party route, not1.1.

## Latest accepted combined regression — September 12, 21:41 UTC

CI34719685288 completed SUCCESS on exact
0087e4deb036009abaf17cea09b6a299fab17edc, adding accepted desktop talent
confirmation0992f77b to the earlier combined work. Client414 suites/6408 tests
passed135.680s; server game coverage102.032s/86.9% and race361.096s. All three
browser smoke shards passed. Complete logs:
`/tmp/eidolon-integrated-desktop-ci-{client,server,browser1,browser2,browser3}-34719685288.log`.
Manual native, deployment and live stages were skipped, not passed.

This closes the combined hosted regression for these accepted components only.
The correctly equipped party has now killed the original-health Warden and
Briar Matron in a separate native run, but the full clear/individual credit/
Water handoff is still pending. Tripwire collateral diagnostics, first-hour,
all-dungeon and resource/reconnect acceptance remain open, along with all later
milestones. No release metadata or production deployment was changed.

## Earlier accepted combined regression — September12,20:56UTC

CI34717404204 completed SUCCESS on719df4de, combining accepted Serrated Technique
and equipment health normalization with the earlier primary work. Client413
suites/6398tests passed133.637s; server game race358.420s. All three browser
smoke shards passed. Complete logs are
`/tmp/eidolon-integrated-ci-{client,server,browser1,browser2,browser3}-34717404204.log`.
Manual native/deploy/live stages were skipped, not passed.

This establishes combined hosted regression for these accepted fixes, not
release readiness. Desktop talent confirmation, Tripwire's collateral entrance
checks and the provisional Verdant boss budget remain separate candidates.
The actual four-player dungeon run is still underway. Full earned first-hour,
all-dungeon/party, resource/reconnect and broader roadmap gates remain open.
No production version or deployment was changed by this acceptance.

## Earlier accepted combined regression — September12,19:52UTC

CI34714237895 completed SUCCESS on8b3e04042b008e5836e1411355c85b9421f6720d,
including the accepted Guardian Roar protection merge. Client413suites6393tests
PASS107.533seconds; server game86.9% coverage100.035s and full race354.988s.
All three browser shards passed. Manual-event native/deployment/live jobs were
intentionally skipped, not passed. Logs
`/tmp/eidolon-integrated-roar-ci-{client,server}-34714237895.log`.

Primary75de2aff retains the same accepted gameplay merge. Tripwire and new
Serrated Technique remain independent candidates pending native/full acceptance.
The actual four-player clear is still open; this combined CI does not supersede
failed dungeon evidence or establish1.1.0 release readiness. No production or
version metadata was changed by this acceptance record.

## Earlier regression history

This is a **non-publishing development rehearsal**, not a1.1.0 release candidate
or completion claim. Base08a73777 includes the accumulated primary development
work through Charge/Unstoppable, plus the instrumented four-role dungeon route.
Current version metadata remains the historical development baseline; normal
milestone version/patch-note preparation is still required before publication.

Ported only the already verified65 workflow queue separation and its contract
test from9ab5b644. Master/main publishing pushes retain the serialized`pages`
group and`cancel-in-progress:false`. Manual branch rehearsals have their own
workflow/ref group; every native/input/deploy guard and post-deploy dependency
is unchanged. No soak workflow change or native job is enabled by this work.

Run the ordinary full client/server/three-shard browser checks on GitHub-hosted
runners, preserving the local hardware for active64 production QA and the
existing scheduled soak. Verify the pushed branch SHA and actual dispatch SHA
before attributing evidence. Native/production acceptance cannot be inferred
from this rehearsal. Keep the same running job until it reaches a terminal
state; failures must be diagnosed without weakening gameplay requirements.

Required afterward: inspect terminal results/artifacts, resolve any integration
regression, run native Teleport65 and the instrumented four-role dungeon route
when hardware is available, then complete the first-hour/all-dungeon/earned
pacing/reconnect/balance gates for1.1.0. All1.2–1.10 scope remains intact.

## First integrated rehearsal accepted; follow-up scope

September12 acceptance: **CI34711998572 SUCCESS** on exactf9ddf686. Full client
412suites6383tests135.552s, server game87.0%91.114s/race292.001s, all three
browser shards passed. Native/deployment intentionally skipped by manual-event
guards. Logs `/tmp/eidolon-integrated-rogue-ci-{client,server}-34711998572.log`.
This verifies the combined RogueTech/QAack/Fortress/BladeStorm revision.
After terminal success, merged primary506e3200's separately verified native
Spin/Roar purchase-recovery tests; see their exact native/CI evidence. No new
runtime ability changes in that merge. GuardianRoar protection and Tripwire
remain separate candidates until their own outstanding checks finish.

September12 follow-up: primary15870d85 now integrates verified Rogue utility
Techniques and QA resource acknowledgement56ea1669. Exact QA runtimee7b907ce
passed CI34710643517 and native50451 (3.8minutes, zero retries); saved effects,
costs and cooldowns passed. Integratedf9ddf686 focused3suites66tests PASS2.580s.
CI34711998572 is queued for that exact combined revision behind34710916056
(Fortress+Blade Stormf0218c8a, still running). No Tripwire integration yet.

Earlier cbdec31a CI34709857382 attempt2 has now SUCCEEDED, including the real
disposable upgrade test after the external registry connection failure. This
does not replace the required checks on the later combined revisions.

September12 18:21: primary8561a773 now includes Blade Storm95299372 as well as
Fortress. Blade Storm runtime6cd11168 full CI34709688359 and native92396 passed;
subsequent full-stage fixture enrollment correction passed5suites89checks.
This combined branch must pass fresh full CI; no Techniques/QA resource-ack
integration yet. No production version/patch-note publication until1.1 closes.

Prior cbdec31a run34709857382 attempt1 failed in disposable upgrade verification
when Docker Hub's authentication connection reset while pulling mongo7.0.14.
Its code/coverage and full game race275.182s had passed. Exact failed job log:
`/tmp/eidolon-integrated-fortress-failed-server-34709857382.log`. Requested
`gh run rerun 34709857382 --failed` only after terminal failure and inspecting
the network error; attempt2 currently active on unchangedcbdec. No timeout-based
restart, test relaxation, production cancellation or soak change. Both sources'
results must retain their actual provenance; a rerun is not yet a pass.

September12 18:00 update: primary5d4c5123 integrates the verified Fortress
component1f6b1f75 overa2c30d97. Exact component8864133e passed full CI34707847501
and native9420; see its mitigation evidence for damage-rounding limitations.
Combined focused Fortress/Rogue tests3suites33tests passed1.457s. This branch
now rehearses that integration; Blade Storm6cd11168 and Rogue Techniques8b07e36c
remain separate candidates. No deployed metadata, production or soak changes.
All first-hour, full-party/seed/dungeon and later milestone gates remain open.

CI34670988965 at e2cd42f2 is TERMINAL SUCCESS. Client367suites/5465tests
PASS100.597s plus full lint/audit/benchmark. Server game coverage97.027s/86.6%,
full race301.947s and backup/restore/bench/build PASS. Browser shards1/2/3
PASS40/50/26cases=116. Native, deployment and live checks were intentionally
skipped by unchanged manual-event guards, not passed.

Full logs `/tmp/eidolon-integrated-1-1-{client,server,browser1,browser2,browser3}
-34670988965.log`; artifacts `/tmp/eidolon-integrated-1-1-shard1-JaX63B`,
`/tmp/eidolon-integrated-1-1-shard2-49pR9L`,
`/tmp/eidolon-integrated-1-1-shard3-XLnDMH`. Inspected broken/restored crystal
presentation captures; their stage coloring is distinct. These mocked scenes
are not earned raid repair, native/phone performance or full visual acceptance.

After terminal completion, fast-forwarded this rehearsal branch through
5ab1b96e (server Charge recovery/explicit death-QA cleanup) and9bb79ab6 (the
already accepted65 phone surface fix port). Their focused evidence is recorded
in their dedicated documents. Run another exact-source hosted regression on
the combined changes; do not attribute e2cd42f2's result to these later edits.
No new1.0.x candidate, milestone version bump or production push was made.
