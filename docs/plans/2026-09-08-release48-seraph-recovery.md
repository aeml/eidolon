# Release48 predeploy Seraph recovery

CI34257070035 on7a9869d639659cd6f6173dca16c12ba2487e3221 failed predeploy
Seraph target acquisition twice; both deployment jobs were skipped. Client,
server and all three smoke shards passed. The fresh-opening collection failed
its120s per-encounter watchdog once, then passed retry with27 target deaths,
zero player deaths and561s collection. That pacing/driver issue remains open;
its deadline and two-respawn bound were not reduced to clear CI.

This correction changes only `tests/e2e/seraph-gameplay.spec.js` and this record.
Game code,48 patch notes/login/version, Forge fixes and earlier acceptance are
unchanged. Do not count a local route pass as full CI or live-deployment approval.

## Evidence and correction

- Diagnostic8d5f281 passed actual93423,1.6m, but the reviewed combat image still
  placed the fight beside the entrance facade. The movement helper returns after
  initial displacement, not arrival at its nominal20-unit target. Counting a few
  clicks therefore did not establish exit or search randomized enemy placement.
- 2054707 verifies Z>=240 and navigates toward observed live Titans while still
  requiring rendered target acquisition. Actual93472 failed on an unavailable
  backward ground projection; no pointer input was issued. It was not a pass.
- 6a4ed8e uses normal mouse-wheel zoom before approach. Actual88533 failed when
  an approach opened the dungeon menu and its modal backdrop intercepted the
  readiness chat click. Baseline smites passed, but the whole route did not.
- 9dedb2a closed that menu at readiness; actual19295 failed earlier, during
  approach. Closing only at cast time was too late.
- f28e797c3babc3d8a16da66aea98dde55b819a6a also checks menu state around each
  navigation step. It closes the actual visible menu normally and waits for its
  backdrop to disappear. A retry is allowed only for a GroundInputUnavailableError
  (no input issued) with a confirmed open menu; issued movement failures still
  fail. No forced clicks, synthetic hits or runtime state edits were added.

The added exit, rendered target, movement and modal checks retain the existing
240s route bound,15/16.5s real server lifetimes,288 baseline and345 trained/saved
noncritical smites, talent persistence and ordinary dungeon-recall cleanup.
Fixed-coordinate QA travel and readiness grants were already explicit fixtures;
this is not an earned-level campaign or physical-device acceptance test.

## Corrected frozen-source acceptance

Actual69668 CLOSED PASS0/1.7m on f28e797. Fresh-world repeat1 also completes its
script normally (1.8m; the set-e loop proceeds and archives its evidence).
Repeat2 gameplay assertions pass1.9m, but outer67120 terminates143 afterward,
before archiving that run. Cleanup is independently confirmed; do not describe
the whole two-run wrapper as a normal success or infer the signal's cause.

Additional standalone57904 CLOSED PASS0, explicit QA_SCRIPT_EXIT=0/1.7m, again
on unchanged f28e797. All four rendered runs observe baseline288 and trained/
saved345 smites,15/16.5s lifetime checks and dungeon recall cleanup. Three routes
have proven normal script completion; the extra wrapper143 is retained as a
qualification, not discarded. Full-project lint61600 CLOSED PASS0 and diff check
pass. No assertions or deadlines were relaxed, no game code changed.

Logs: `/tmp/eidolon-release48-seraph-{walk,repeat-1,repeat-2,final}.log`.
Reviewed/retained evidence:
`/tmp/eidolon-seraph48-walk-evidence-VUj5lP/{first,repeat-1}` and
`/tmp/eidolon-seraph48-third-evidence-s4Mf9e/{rendered-pass-wrapper143,final-normal}`.
Credential scans pass; all owned48-seraph Mongo/API containers are independently
absent after cleanup. No production player data touched.

Carry this exact QA correction through49–55 so a later release does not restore
the failed route. Publish only the ordered48 correction, then require its entire
CI, final live QA and fresh public client/server identity before49 can publish.
The root staged52/ledger and unreleased resource candidate are not release sources.
