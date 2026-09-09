# Town recovery release acceptance — Alpha 1.0.58

Update13:08UTC:57predeploy PASSED, then production backup FAILED because Docker
lost the old image reference when building the shared tag. Old56 restarted
successfully; no schema upgrade on that failed attempt. Recovered the exact old
linux/amd64 image from verified BuildKit history (not a replacement rebuild).
Only failed CI jobs rerun. Server deployment now PASSED; actual production backup
`save-upgrade-20260909T130106Z-boTz4I` COMPLETE and all checksums/gzip independently
PASS. Public client and backend57/8af54f2 now match; final live class QA still
ACTIVE34347504351/job102475487008. Full live acceptance still required before58.

58 supplements accepted e73be3a with deployment-only preventionfix **fb8db754**:
pin previous exact image before build under the deployment lock, fail closed
before downtime if unavailable, exclude private backups from build context.
No game runtime changes. One extra58 patch-note bullet and disposable CI tests.
Focused race1.253s and actual owned replacement→backup/restore15.20s + actual
Docker-context confidentiality1.21s PASS. Final fullclient/lint/Go94121 ACTIVE.
Accepted earlier fullgameplay evidence remains scoped to unchanged game runtime,
not proof of production delivery. Root roadmap ledger has exact logs/receipt.

Update12:28UTC: **19624 fullall PASSED/TERMINAL0** on unchanged/clean
e73be3acb195dbd87c20108fc1619f9457c4c5df. Archive
`/tmp/eidolon-rest58-full-proof-veHaDo`; scan0 and exactr13containers/image/network/
ports cleanup verified. Full dungeon/phone/combat/resource/animation/multiplayer/
nameplate chain plus native recovery/expiry2/1.1m and actual restedparty1/12.4s
passed. Real combatHP110→108, acceptedFireballMP110→80, townfull110both/reconnect
bank preserved; natural expiry/reentry confirmed. Native town image inspected,
golden rings/no enclosing cube. Prior failed/interrupted runs remain failed.
57allserver/client/backup-restore/browserchecks passed; predeployCI34347504351still
ACTIVE. Must finish57production backup/deploy/final liveQA/public identities
before58push. NO production town recovery claim. Separate primary crystal visual
work remains excluded; full regression47504active there, no owned local browser.

Update12:05UTC:57CI34347504351 server/client/disposable backup-restore and two
browser shards PASSED; remaining shard ACTIVE. Complete predeploy/deploy/production
backup receipt/final live QA and public57 identities still required.58full19624
remains ACTIVE on unchanged/clean e73be3a, r13sameports18560/18561/41960. Seven
dungeon cases passed5.5m; later spell/phone checks passed and fresh collection is
exercising actual town mana refills/rest banking. Not a full pass or live recovery.
Separate primary13a55fd crystal-state work is excluded from58. No cancellations.

Update11:52UTC:56allCI/liveSUCCESS; fresh11:44public manifest/login/runtime/server
exact31c7d9f/56ready.57normallyPUSHED8af54f2 after clean244/3461/69.222+lint;
CI34347504351 ACTIVE.70313 seven-case replayPASSED6.3m, archive
`/tmp/eidolon-rest58-dungeon-input-proof-eu9B5K`, scan0/exact cleanup. No observed
interception/no-input branch in this pass; original failures remain failed.
Final57ancestrymerged58e73be3a, treeidenticalto9ea7213 (replaycode+closure doc).
19624 completeall ACTIVE, only owned browser, r13/18560/18561/41960,
`/tmp/eidolon-rest58-all-node24-rerun-1149.log`. Fullall,57CI/backup/livecompletion,
then58CI/deploy/native live recovery remain required. Town recovery NOT live.

Update11:39UTC:56public manifest/backend now31c7d9f/1.0.56; final live QA remains
ACTIVE, so57cannotpushyet.33035 replay FAILED1/7 on a no-click navigation step,
not the original clicked retreat; archive
`/tmp/eidolon-rest58-pointer-replay-failure-7QbgHX`, sanitized2/exact cleanup.
58cbb158c handles unavailable/intercepted navigation inside unchanged deadlines;
actual failed movement remains fatal.70313 fullclientPASS253/3570/80.203+lint,
now exact seven-test browser replay ACTIVE, sixpassed/Verdant ongoing.
Log `/tmp/eidolon-rest58-dungeon-navigation-replay.log`, only owned browser with
same18560/18561/41960ports. Completeall and ordered live58 verification remain due.

Update11:27UTC:2466 fullall FAILED3/7dungeon cases; two fresh portal clicks selected
the covering InfernoTitan, plus a Verdant retreat with no movement/pendingMatron.
Archive `/tmp/eidolon-rest58-verdant-r12-failure-P1ap9x`; sanitized2/exact cleanup.
58b5abc2a includes strict click-time interception evidence, preserving actual
failed movement, portal entry, deadlines and runtime priorities. Fullclient34455
PASS252suites/3564tests/87.123+lint on8b9073b; extra b5case/doc only.33035 exact
seven-test dungeon replay ACTIVE, `/tmp/eidolon-rest58-dungeon-pointer-replay.log`,
only owned browser on18560/18561/41960. Completeall and ordered live gates still
required.56CI remains predeploy; no57/58push. Primary story fixes remain excluded.

Update11:08UTC:95652 Cleric-only matrix PASSED1.0m with unchanged assertions;
25frames in diagnostic attachment, actual hardware renderer and moving cast.
Original10-frame sample cause remains unknown, not retrospectively passed.
Archive `/tmp/eidolon-rest58-cleric-frame-proof-8ORFWQ`, scan0/exact cleanup.
Current clean/frozen58c5e3204, **2466 complete all-route ACTIVE**, only owned browser,
`/tmp/eidolon-rest58-all-node24-rerun-1107.log`, r12sameports18560/18561/41960.
56CI remains predeploy; no57/58push or recovery-live claim.

Update11:05UTC:49970 fullall TERMINAL1/FAILED on028f23b. All duels and first three
class matrices passed; Cleric moving-cast sample had10frames in650ms against>10.
Remaining Cleric/multiplayer/nameplate/native-rest suffix did not run. Archive
`/tmp/eidolon-rest58-cleric-frame-failure-02mQPZ`, scan0/exact cleanup verified.
58e5d7bd4 adds JSON frame diagnostics only before unchanged assertions/durations.
95652 Cleric-only replay ACTIVE, `/tmp/eidolon-rest58-cleric-frame-diagnostic.log`;
only owned browser, same18560/18561/41960ports. Fullall stillrequired.56CI remains
predeploy; no57/58push. Separate Maelin NPC fix stays excluded from58.

Update10:50UTC:56CI34340328283 server/client and all three browser shards PASSED;
predeploy character QA ACTIVE. Fresh10:47 public manifest/backend still55/c5ce9dc.
58all-route49970 remains ACTIVE on unchanged028f23b; ordinary fresh Wizard
opening/collection passed4.7m with earned town refills/rest, followed by ongoing
talent/Seraph checks. No full-route pass, successor push or production recovery
claim. Mandatory live recovery/expiry/party wrapper remains in58's workflow.

Update10:34UTC:93957 final client/lint PASSED251suites/3539tests/117.45s on
028f23b. Complete gameplay49970 remains ACTIVE, currently in Verdant boss combat.
Corrected56CI34340328283 client passed/server running; no57/58push or live claim.

Update10:29UTC:69623 complete corrected tail PASSED, including all class duels,
animations, multiplayer, town nameplates and native rest/expiry/phone-party;
scan0/exact cleanup verified. Archive
`/tmp/eidolon-rest58-corrected-tail-proof-J7LHvs`. Not a full all-route pass.
Corrected56/31c7d9f passed full client and the original CI-mode MoltenCore visual
test47.3s, then was normally pushed after fresh exact55public identities.
New56CI34340328283 ACTIVE. Final ancestry/visual fix/notes merged through57and58;
current frozen58 **028f23b737210d4db0e467429e376bbc8f4dda77**.
**49970 complete all-route ACTIVE**, `/tmp/eidolon-rest58-all-node24-rerun-1028.log`;
**93957 full client/lint ACTIVE**, `...rest58-final-scenery-full-{client,lint}.log`.
Only this local browser runs. Complete regression and ordered production/live
gates remain required. No57/58push or town-recovery-live claim.

Update10:23UTC:98816 full client/lint PASSED251suites/3535tests/157.667s on5cc8849.
69623 tail is still ACTIVE: all four corrected duels, class matrices, multiplayer
and town nameplates passed; native recovery/expiry/party suffix running. Not a
complete tail/all-route pass. Separately56CI34337271486 FAILED before deployment
on a slow-render scenery-restoration timeout. A reproduced visual elapsed-time
fix is staged56cfc79 with patch notes; focused245tests/lint pass, full client24706
active and CI-mode browser proof due. Ordered releases remain blocked on that
corrected56 acceptance; no57/58push or town-recovery-live claim.

Update10:13UTC:82037 full gameplay FAILED four PvP mana comparisons after earlier
dungeon/phone/resource/movement passes. Diagnostic16108 reproduced all four:
110/110 with bank>0 became100/100 with bank0 during each real duel. The old test
compared a full bar against its expired maximum. Both original failures retained;
scan0/exact temporary cleanup verified. Archives and detailed evidence in ledger.
Current frozen **5cc8849** changes QA only: full-current-mana checks preserve all
other duel assertions; optional recovery-tail rehearses the exact unchanged full
gate suffix. **69623 tail ACTIVE**, `/tmp/eidolon-rest58-corrected-tail.log`;
**98816 full client/lint ACTIVE**, `...duel-corrected-full-{client,lint}.log`.
Complete all-route repeat and ordered56–58 deployment/live verification remain
required.56 is in browser QA;57/58 remain unpublished. No recovery-live claim.

Update09:54UTC:55CI34328735856 PASSED all ten jobs; fresh09:53 public manifest,
login/runtime and healthy backend exactly matched55/c5ce9dc. Canonical56/9f41111
was normally pushed and CI34337271486 is ACTIVE. Prepush full client79982 passed
240suites/3409tests/173.072s plus lint.57–58 remain unpublished.
82037 complete recovery gameplay is still ACTIVE on frozen1fd0d35; ordinary
fresh Wizard collection now underway after passing earlier dungeon/ability/phone
and equipment batches. Not a complete regression or production recovery claim.
Separate explosive-gear deadlock work is explicitly excluded from58.

Update09:39UTC:1035 terminated143 during dungeon QA; source unchanged. Signal
sender unknown. Partial evidence at `/tmp/eidolon-rest58-interrupted-r9-S6GCe7`,
scan0; exact orphan web process/API/Mongo/image cleanup verified. **82037 unchanged
complete repeat ACTIVE**, frozen1fd0d35, log
`/tmp/eidolon-rest58-all-node24-rerun-0935.log`. No bypassed tests or signals.
55has now deployed with matching public identities/database ready, but its final
live QA is still ACTIVE.56full-client prepush check79982active; no56push yet.
Town recovery is NOT live; all prior partial/focused evidence remains scoped.

Update09:30UTC: exact live-wrapper rehearsal58189 PASSED on disposable loopback
services, NOT production: expiry/journey2tests1.3m plus actual party1test27.9s.
Real combat depletedHP/MP, town filled both, reconnect preserved bank/resources,
natural expiry removed bonuses and Recall restored them;High19/Low10aura parts.
Scan0 and exact cleanup verified; archive
`/tmp/eidolon-rest58-live-rehearsal-proof-8GN3fo`. PortraitHigh status/shortLow world
captures inspected; physical-device/performance acceptance remains separate.
**1035 complete gameplay ACTIVE** on clean1fd0d35, log
`/tmp/eidolon-rest58-all-node24-rerun-0928.log`. Initial3checks passed54.8s;
dungeon batch underway.55stillpredeploy; no live recovery or full-run pass claim.

Update09:26UTC: both actual movement replays PASSED on1fd0d35: max-speed31.68
49283/25.2s and ordinary fresh-speed10.56 (68919/24.9s). Both enforce2updates,
speed-proportional distance, no backtracking/camera/correction failures; scan0
and exact cleanup verified. Archives/logs in execution ledger. Full client26873
PASSED251suites/3534tests/172.663s plus lint. **58189 exact live-wrapper rehearsal
ACTIVE**, `/tmp/eidolon-rest58-live-recovery-rehearsal-0925.log`.
Complete gameplay rerun and ordered production/live verification remain due.

Update09:21UTC:52270 TERMINAL FAILED at the original movement distance bound.
This time retained75-frame evidence proves the1.056step equals exactly two1/60s
updates at31.68 rested speed (28.8 ×1.10), not extra simulation catch-up.
Archive `/tmp/eidolon-rest58-movement-speed-failure-rlccng`; exact cleanup verified.
Current clean candidate **1fd0d35683d973e99dc01c7fadbcbfe9f47e1202** includes the
prepared live-recovery gate and speed-aware QA correction. It preserves the
two-update limit and all other movement assertions; no runtime speed/timing or
rest/stat changes. Original full run remains failed, not retrospectively passed.
**26873 full client ACTIVE** and **49283 maximum-speed movement ACTIVE**; see
execution ledger for logs and later ordinary-speed/live-wrapper/full-rerun gates.
Separate Dark King phase work is explicitly excluded from58.55 still predeploy.

Update09:01UTC: **52270 full gameplay remains ACTIVE on frozen45797ee**.
Dungeon7 and subsequent spell/phone flows have passed; fresh Wizard collection
is underway with real town recovery stops. No full-pass/live claim.
Separate primary4172dfa prepares a mandatory post-deployment native recovery,
expiry and party gate plus an isolated rehearsal route. Full primary regression
on9fa4638 passed268/3818/170.675s plus lint; subsequent observer-routing correction
passed20 focused checks plus lint. This gate is NOT yet imported into58 and has
NOT yet had its exact wrapper browser rehearsal. Finish/archive current52270
first, then integrate only6226fc1/9fa4638/4172dfa and rehearse; see execution ledger.
55 remains in active predeploy gameplay. No release queue advancement yet.

Update08:50UTC: unpublished candidate **45797ee24167071312e53bc9d015394fc39e4391**.
Previous53012 finished FAILED on module errors from a redundant reconnect load;
retained evidence and exact cleanup are recorded in the execution ledger.
QA now uses login's existing fresh navigation without a preceding raw reload.
Real injected-failure browser proof passed4tests; actual inventory/reconnect
passed1/19.3s. Full client1520 passed249suites/3499tests/123.612s plus lint.
**52270 complete gameplay ACTIVE**, frozen45797ee, log
`/tmp/eidolon-rest58-all-node24-rerun-0843.log`; initial3authentication tests pass,
dungeon encounters underway. No full regression or live delivery claim.
55CI34328735856 has all unit/browser jobs passed and predeploy QA running.
56–58 still queued. See the ledger for precise artifacts and failure history.

Update08:29UTC: **07283d077757ce42ba6d07ba1c8768ef7f822ce5** focused beam replay
55264 PASSED1/53.1s, all eight actual beam endpoint cases plus saved rank.
Current full client46700 PASSED248suites/3492tests/112.724s plus lint underNode24.
Full gameplay **53012 ACTIVE**, `/tmp/eidolon-rest58-all-node24-rerun-0828.log`;
authentication passed, dungeon batch underway. Earlier failures remain retained.
55CI34328735856 has client/server passed and browser shards running.58 NOT LIVE.

Update08:25UTC: full70373 finished FAILED (one beam-approach failure, six other
dungeon batch tests passed). Evidence archived and exact cleanup verified.
Canonical58 **07283d0** now includes the prepared settled-approach QA correction;
**55264 focused beam-walls replay ACTIVE**, `/tmp/eidolon-rest58-beam-settled-0825.log`.
No production change or actual replay pass is claimed yet.55CI34328735856 is active.

Latest September9 08:23UTC: **d5d04cc5e128616982d97b0f8d0997b6c3e7798b** is the
unpublished recovery candidate. Full run88641 ended FAILED on late-observer
module requests with ERR_NETWORK_CHANGED; original evidence retained and exact
cleanup verified. Guardian/Spirit observer warm-up now uses existing bounded
`openGame` readiness instead of an extra raw navigation. Both actual routes pass,
as do two injected module-failure recovery/preservation checks. No new error
filter, retry budget, timeout or gameplay-threshold change.

**70373 full rerun ACTIVE** (`/tmp/eidolon-rest58-all-node24-rerun-0817.log`), but
its first dungeon beam test already failed pre-cast positioning:2.1826 versus
the required<2units. Remaining tests in that invocation are still collecting
evidence; do not count the full run as passed or restart it while active.
A test-only settled-approach correction is prepared in primary1389f7e, not yet
imported/replayed in this active candidate. Movement's earlier intermittent
failure remains unproven; its limits and added diagnostics remain intact.

54/5e22b747 has now passed its complete CI/deployment/live gate and fresh public
identities.55/c5ce9dc is pushed under active CI34328735856.56–58 remain queued;
town healing/Well Rested is NOT in production. See the execution ledger's08:23
checkpoint for exact artifacts, source identities and next actions.

Latest September9 07:56UTC: candidate **f6f420d6f5f3f03665c075042160e20c1c2acf07**
remains UNPUBLISHED. Complete58 run65093 failed movement's unchanged one-unit
render-step bound (1.056 observed), after earlier combat/phone/resource routes
passed. No failing-frame attachment existed in that older test, so the cause
remains unproven. Retained log/archive and exact cleanup are in the execution
ledger's07:56 checkpoint. Focused diagnostic98426 then passed the SAME limits,
largest sustained/outside steps0.176 at speed10.56, with frame evidence retained.
QA-only40aca4f/f6f420d attach samples before assertions and include simulation
frame/time; no production code, threshold or timeout changed. Complete rerun
**88641 ACTIVE**, `/tmp/eidolon-rest58-all-node24-rerun-0755.log`. This is not a
completed regression or production delivery. Earlier evidence below is historical.

Status at September 9, 07:18 UTC: **unpublished candidate**, not delivered.
Candidate worktree `/tmp/eidolon-standalone-town-recovery-QJ6Drv`, current source
`ee8a713d6d6daef1caa5d319c63c2089fdf37771`, includes canonical57/6babef5 ancestry.
Production runtime is unchanged from previously tested
`5a17be147ce527bae556663cc452ecae10e87785`; subsequent corrections change QA only.
53CI34312290353 completed successfully, including all final live checks. Public
manifest, login version, loaded runtime URL and server health independently match
53/ce330b3 at06:08; client/server rechecked06:43. First54CI34317808528 failed
before deployment on a prepared visual timer. Corrected54/5e22b74 is pushed,
remote verified, new54CI34320477081 has all client/server/browser jobs passed
and is in predeploy gameplay. No55push until the complete54 gate.
The complete roadmap remains open. Expanded story and coordinated balance are
separate preserved work, not removed or declared complete by this release.

## Supported-toolchain regression and ordinary earned play

Local npm/Playwright uses Node24.18.0 explicitly inside `sg render`; the login
shell's default Node18 is not supported acceptance. Full client57780 passed
245suites/3466tests/187.057s plus lint. Full Go race75384 passed root23.243s and
game327.779s; server/go.mod selects Go1.24.5. Logs:
`/tmp/eidolon-rest58-node24-full-client.log`,
`/tmp/eidolon-rest58-node24-lint.log`,
`/tmp/eidolon-rest58-full-server.log`.

All four ordinary fresh-class routes passed on5a17be1, with no grants,
forced kills, extended encounter deadlines or removed console/network assertions.
The existing eight-seed collection, manual turn-in, saved earned gear and locked
level30 dungeon were checked. The wrappers removed their exact temporary
containers/images; absence was independently verified. Credential scans changed
zero files, and ready-to-claim screenshots were inspected after archival.

| Class / handle | Total test | Collection | Observed target deaths / player deaths | Full-pool town stops | Stop time including travel |
|---|---|---|---|---|---|
| Wizard69597 | 4.7m | 213s | 19 / 0 | 4 | 83.664s |
| Fighter58871 | 6.7m | 289s | 17 / 0 | 4 | 86.038s |
| Rogue34088 | 4.2m | 212s | 23 / 0 | 3 | 63.975s |
| Cleric21402 | 3.7m | 174s | 20 / 0 | 2 | 39.157s |

Observed target deaths are not an exhaustive kill census or a drop-rate estimate.
These routes use current legacy payouts:500XP opening and8000XP collection,
100gold each. Collection still jumps characters to17; that is a known balance
issue for the coordinated successor, not something58 fixes. Rogue reached8 before
the claim; the other three reached7. Each stopped to recover at its actual
class/gear-adjusted ability cost, not a universal Wizard30mana assumption.

Logs and retained screenshots:

- Wizard: `/tmp/eidolon-rest58-wizard-node24-rerun-0528.log`;
  `/tmp/eidolon-rest58-wizard24-proof-c7jLU7/test-results`.
- Fighter: `/tmp/eidolon-rest58-fighter-node24-0535.log`;
  `/tmp/eidolon-rest58-fighter24-proof-h4p5PS/test-results`.
- Rogue: `/tmp/eidolon-rest58-rogue-node24-0545.log`;
  `/tmp/eidolon-rest58-rogue24-proof-mvJ29A/test-results`.
- Cleric: `/tmp/eidolon-rest58-cleric-collection-0515.log`;
  `/tmp/eidolon-rest58-cleric-proof-TKN8ET/test-results`.

## Failures remain part of the evidence

Wizard97055 failed the final console/network assertion with
`net::ERR_NETWORK_CHANGED`; its unchanged repeat69597 passed. The cause is not
proven. A later read-only monitor observed unrelated virtual-network churn, also
during passing play. No unrelated workload was changed and no errors were filtered.
See the execution ledger for original log/archive and the closed monitor.

Native rest32952 terminated143 after a passing natural-expiry test37.3s, before
journey and party completion. Bank14.81542373s expired naturally to0 outside town,
strength11→10 and maxima110→100, icon/aura removed; normal Recall earned1.750368119s
and restored the rested stats/aura. Do not count the whole invocation as passed.
Original log `/tmp/eidolon-rest58-native-node24-0548.log`; credential-scanned
partial screenshots `/tmp/eidolon-rest58-native24-interrupted-SZjDjQ/`.

The wrapper/test processes were absent after terminal143, but an orphan static
server and its exact disposable API/Mongo remained. The web server's candidate
cwd, start time and process ancestry were verified before stopping only248702;
its parent shells exited. The exact run-specific containers, temporary Mongo
volume and image were removed. Port41960, process family and resources were
independently confirmed absent. No production data or CI process was touched.
No matching OOM event was found in the accessible kernel log; termination cause
remains unknown. **81669 unchanged native24 repeat passed**, project
rest58-native24-r1-0552, log
`/tmp/eidolon-rest58-native-node24-rerun-0552.log`: expiry36.3s and journey31.0s
(first CLI2tests/1.1m), actual party24.1s (second CLI1test/25.9s). The wrapper
exited0, credential scan0, and exact owned containers/image are absent.

Natural expiry14.617466611s→0 removed strength11→10, maxima110→100 and icon/aura;
ordinary Recall earned1.617247573s and restored them. The journey registered an
actual42damage Wizard spell hit with30mana spent, then Recall and reconnect:
returned MP94, rejoined MP110 through normal town recovery. Reconnect bank
14.744371348s retained/continued legitimate online town earnings. Two actual
party members moved through the native joystick and rendered19visible parts each
at High,10each at Low, without opaque box geometry.

Both output folders are archived at `/tmp/eidolon-rest58-native24-proof-n1IyTo/`.
Desktop reconnect, portrait390 High status/aura and short landscape568 Low status
were visually inspected. The desktop reconnect capture shows16FPS while other
captures show higher rates under concurrent CI load: this is not sustained
performance approval or proof that the aura caused a slowdown. Physical-device
and sustained gameplay performance remain open roadmap gates.

**57389 complete58 isolated gameplay FAILED**, terminal1: two authenticated
tests passed, but the third actual entrance click selected InfernoTitan rather
than DungeonEntrance. The assertion remains strict. Scan0 and exact owned
cleanup confirmed. Log `/tmp/eidolon-rest58-all-node24-0554.log`, archive
`/tmp/eidolon-rest58-full-portal-failure-U24ntr/test-results`.

Source inspection and a deterministic4fail/2pass baseline exposed a test-helper
freshness gap: it accepted old hover while the new pointer raycast was deferred.
The helper now observes `needsRaycast === false` and the actual on-canvas pointer
before accepting a matching entrance. No forced raycast or hover assignment;
production priority,15s deadline, candidate sampling, final click and real dungeon
assertions remain unchanged. A mismatching click now logs the existing public
probe before failing. This does not prove every potential moving-enemy overlap
comes from the stale-hover gap.

New source51c9bf7 focused91607 passed239observation/version tests1.273s plus lint;
67666 passed17observation/actual GameEngineRaycastPriority tests1.089s. Original
bare-Jest invocation failed ESM discovery; supported baseline used `npm test`.
See candidate `docs/plans/2026-09-09-entrance-pointer-observation.md` for details.

12405 full client/lint passed246suites/3472tests/136.825s on51c9bf7. Log
`/tmp/eidolon-rest58-fresh-pointer-full-client.log`. Focused actual portal97047
passed1/20.1s including real reentry/jump-Recall (test18.1s), scan0/exact cleanup;
log `/tmp/eidolon-rest58-portal-node24-0601.log`, result metadata archive
`/tmp/eidolon-rest58-portal24-proof-fKJOtg/test-results`.

Full rerun92856 then failed a different assertion: two LootDrop hitboxes overlapped,
and manual pickup QA insisted on the covered drop while the real pointer selected
the front one. Login and portal tests passed. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0602.log`, sanitized archive
`/tmp/eidolon-rest58-full-loot-failure-sKrdfS/test-results`; terminal1, scan0/exact
cleanup. This failed complete run remains failed, not superseded retroactively.

New a7ef83c adds explicit general-pickup opt-in to follow the actual front loot
only when both active drops share the raycast stack. Strict specific-item callers
stay strict; stale/off-canvas/hostile/unrelated/no-item targets are rejected. The
actual picked item's quantity and reconnect receipt remain mandatory. No runtime
change, direct pickup, fake grant, slot-count proof or deadline extension.
Baseline58464 reproduced6fail/3pass; corrected22244 passed26tests/3suites/1.112s
plus lint. Browser geometry62614 passed2/8.3s: enemy-covered center/exposed edge
and exact coincident front/back loot. These fixtures do not establish a server
pickup; the full route must still do that. Details in candidate
`docs/plans/2026-09-09-overlapping-loot-observation.md`.

**33950 full client/lint passed**, terminal0,247suites/3481tests/121.961s; log
`/tmp/eidolon-rest58-loot-observation-full-client.log`. **12130 complete gameplay
FAILED** on a7ef83c: authentication, dungeon/inventory, area abilities and phone
movement/combat/party/inventory passed, then legacy gem recovery expected base
Intelligence10 instead of legitimate rested total11. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0610.log`; sanitized archive
`/tmp/eidolon-rest58-gem-rest-failure-e5EF2M/test-results`, scan0/exact cleanup.

QA correction7f066a4 requires base10, rested11, positive bank and Lanternhold
before and after reconnect. Unsupported+999 gem bonuses still fail; full-bag
rejection, legal sword equip, exact18+5 gems, rejected loose-gem equip and actual
Mongo/reconnect remain required. Focused97572 passed1/13.3s; scan0/exact cleanup.
Log `/tmp/eidolon-rest58-gem-rest-browser-0630.log`; metadata archive
`/tmp/eidolon-rest58-gem24-proof-wjeDn3/test-results`.

Current6e85547 also inherits54's corrected prepared respawn fixture clock through
the canonical release chain. No production/version/script changes were imported.
**1416 full gameplay FAILED**, Node24.18.0,
projectrest58-all24-r3-0909-0650/API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-rerun-0650.log`. **81287 full client/lint PASSED**,
248suites/3490tests/125.305s, terminal0, exact6e85547/Node24.18.0;
logs `/tmp/eidolon-rest58-finalclock-full-{client,lint}.log`.

1416 passed the corrected gem case, Forge/Guide, ordinary opening/collection,
and talent economy/healing, then failed the duration test's obsolete expectation
that the panel be empty after shield expiry. Server shield timer/HP/effect/badge
removal checks passed; the error snapshot shows earned Well Rested still active.
Archive `/tmp/eidolon-rest58-duration-rest-failure-ATQ2N9`; scan0/exact cleanup.
The corrected assertion requires the shield gone and the resting row retained;
a PhoneStatusUI coexistence regression covers it. Focused19tests/lint passed.
Actual duration replay48279 passed1/1.1m on currentee8a713, including natural
ranked expiry and saved landscape cast; scan0/exact cleanup. Archive
`/tmp/eidolon-rest58-duration24-proof-Sei3x7`, log
`/tmp/eidolon-rest58-duration-rest-browser-0713.log`.

Public-proof review found the native journey imported a test module that Pages
does not publish. The current observer injects only its trusted self-contained
read-only counter; the journey blocks/tests network access to enforce that
boundary locally. It additionally requires actual hostile damage, living HP
below maximum, accepted Fireball/spent mana, Recall and full recovery of both
pools. No shared localhost wall clock, grants or longer test deadline is used.
Focused26tests/lint/discovery passed; that is not actual public gameplay proof.
**99620 stronger native journey PASSED1/38.7s** (test36.5s), exactee8a713:
actual hostile damageHP110→108, accepted FireballMP110→80, ordinary Recall
returnedHP110 andMP95, then both110/110 before and after reconnect. Earned
rest/aura retained, with all/tests network requests blocked. Scan0/exact cleanup;
log `/tmp/eidolon-rest58-public-proof-browser-0716.log`, archive
`/tmp/eidolon-rest58-public-recovery-proof-HWZkIN`. Rejoined screenshot viewed.
Its11FPS under concurrent work is not sustained performance approval or a causal
diagnosis. This invocation used `well-rested`, which runs ONLY the journey;
expiry/party were not rerun here. Complete `all` retains all three native tests.
**37941 full client/lint PASSED248suites/3492tests/157.555s**, same source, logs
`/tmp/eidolon-rest58-public-proof-full-{client,lint}.log`.
**65093 complete gameplay ACTIVE**, only owned local browser, frozenee8a713,
projectrest58-all24-r4-0909-0718/API18560/Mongo18561/web41960, log
`/tmp/eidolon-rest58-all-node24-rerun-0718.log`.
Preserve artifacts/verify exact cleanup when terminal. Complete gameplay still
needs a new full pass; no failure above is retroactively changed to success.

## Remaining delivery gates

- The complete unchanged58 isolated gameplay chain PASSED as recorded above;
  preserve exact accepted source e73be3a and its evidence until publication.
- 53–56 are delivered and57 is published. Before publishing58, require57's
  complete CI/deploy/final live QA, production backup receipt, and independent
  exact client manifest, runtime script and server identities.
- Publish58 through that same gate, with its existing58 login/patch notes.
- Independently verify public58 identities, then use fresh dedicated ordinary
  QA characters against the public client and WebSocket. Verify actual combat
  depletion, normal Recall, full HP/MP recovery, earned/resting buff display,
  outside countdown/expiry and reconnect. Do not use a prepared resource grant
  as proof of live healing; do not use a localhost-only clock predicate remotely.
- Record exact live source, observed values and retained sanitized evidence.
  Only then report town recovery delivered. Keep the larger roadmap active.
