# Schema compatibility bridge — candidate, not released

Based on canonical queued55/9f92f985e6857edcdb99863b99d823af9196b4af.
Worktree `/tmp/eidolon-schema-compatibility-bridge-ehsEZY`, branch
`work/schema-compatibility-bridge-20260908`. Schema fence f2238ce, final runtime
dff080bfe03069d74748ed806cfe746f7b34acdf. Staged Alpha1.0.56, not published.
Version/package/server/deployment/login metadata and cumulative patch notes agree.

## Current acceptance — September 8, 21:37 UTC

Actual old-to-new crash recovery exposed a send/close race in the bridge's
world-state broadcasts. dff080b synchronizes all queue producers and shutdown;
its concurrency regression passes with the race detector. Patch notes include
the disconnect fix. Full race7903 CLOSED PASS0: root19.664s, other packages
cached from the earlier full run (game378.604s). Version231 checks and lint pass.
Full client21761 previously passed237 suites/3379 tests before the queue-only
runtime/patch-note addition. Updated rendered notes92857 CLOSED PASS0: two
browser cases6.4s; screenshot inspected with all four56 headings readable.

Resource candidate includes the fence as153fbcb and fixes an actual AI cast-state
race as288b623. Its full race9898 completed: root18.942/game298.014s, other
packages passed/cached. Test4321e69 compares preserved legacy HP rather than
incorrectly assuming full health. The fixture deliberately has legacy HP1/MP100;
two ordinary Fireballs plus Arcane Shield leave MP0.

Actual complete sequences60645 and48290 BOTH CLOSED PASS0,16.795s/12.545s,
each against a fresh disposable database. Bridge normal login/save/schema7 →
resource schema8 → first ordinary listing → second listing's pending escrow
journal → SIGKILL → bridge startup refusal without any writes → two normal
resource recoveries. Resources/XP/gold/equipment/receipts stay exact, both listings
appear once and the first publication deadline is unchanged. Eight child logs
independently clean: two expected kills, two legacy normal exits with verified
disconnect saves, four completed resource shutdown drains. Two older-server
refusals exit1 before admission. Owned Mongo containers and volumes removed and
independently absent. Logs `/tmp/eidolon-schema-fixed-{actual,repeat}.log`.
Bridge binary `/tmp/eidolon-schema56-fixed-proof-nt5ouG/dff080bfe03069d74748ed806cfe746f7b34acdf`;
resource binary `/tmp/eidolon-schema-ai-proof-uuKVhP/288b623acb53c6548a1bcf350b6dd6bccc490d5b`.

Earlier actual attempts5518/84072/81661/40736 failed and are not acceptance:
incorrect legacy resource assumptions, the real AI race, then the real bridge
queue race. Both runtime defects and fixture assumptions were corrected, not
suppressed. Remaining publication and supported-target gates below stay open.

## Purpose and behavior

The current55 server knows database schema7. It previously ran known migrations
and then admitted players even when newer migration records were present. Its
full-character writer cannot retain future resource snapshots/receipt fields.

Before any migration/index write, this bridge reads the highest stored schema
version and refuses a newer version. Read errors, invalid negative versions and
decode errors fail closed. Empty/known schemas retain normal migration behavior.
The existing server startup propagates this error and exits before constructing
the world or opening admission. The standalone migration command uses the same
database constructor. The error instructs operators to deploy a compatible
binary, never to edit the migration records to bypass protection.

This is a startup compatibility fence, NOT a distributed writer lease. The
supported deployment remains one authoritative server; stop the prior writer
before starting a format-changing release. It does not retroactively protect
unmodified55 or older binaries and does not make them supported rollback targets.

## Verification — September 8, 21:04 UTC

Focused45306 PASS1.056s, final72751 PASS1.029s. Actual52120 CLOSED PASS0/1.903s,
exact race-builtf2238ce binary, disposable owned loopback Mongo. Prepared future
schema8 and a raw character containing zero mana, gold1209, listing receipt-25
and an unknown future field. Two database-open attempts and TWO actual server
processes refused before admission. Raw character BSON stayed byte-for-byte
identical; no collections or migration indexes were added. After removing ONLY
the test's prepared marker, normal fresh migration to7 and repeated migration
succeeded. This fixture manipulation is not a production downgrade procedure.

Exact owned Mongo `eidolon-schema-bridge-proof-20260908-2103` and volumes removed
by EXIT cleanup; container independently absent. Log
`/tmp/eidolon-schema-bridge-actual.log`; binary
`/tmp/eidolon-schema-bridge-proof-1ZQbf4/f2238ce506c4961fbd8cc117b706a885ba45dc0f`.
Full race17140 CLOSED PASS0, root20.033/database1.072/game378.604s,
`/tmp/eidolon-schema-bridge-full-race.log`.

## Remaining release gates

1. Retain all normal ordered release CI gates; local rendered notes are verified.
2. Deploy and independently verify the bridge before publishing the resource/
   auction persistence candidate. Do not skip intervening49–55 release gates.
3. Preserve the now-verified schema8 fence and round-trip test when integrating
   the final ordered release ancestry into the resource candidate.
4. Document/enforce supported deployment targets so unguarded55 or older are not
   used after the format boundary; preserve backups and require roll-forward
   recovery when the bridge deliberately refuses a future schema.

The bridge's narrow refusal proof does not close the entire rollback, resource,
raid, phone or1.1–1.10 roadmap acceptance scope.
