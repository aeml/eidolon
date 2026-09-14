# Broadcast snapshot allocation correction

Follows the measured [100-player memory-budget failure](2026-09-14-concurrency-trials.md).
Local implementation, not yet a deployed performance claim.

## Accepted bounded load rerun — September14

After1.9.8 finished all CI/live checks, tested frozen source
`9d3f4e1c67b5cfe656e650b285396ba1c4dc6465` (runtime22a56525 plus docs), on the
same Ryzen7 5700G/31GB shared host, isolated loopback API/Mongo7.0.16 and existing
mixed-script loadtester. Original error, frame-rate, DB readiness and memory
limits retained. No parallel native Chrome/deployment gate or new soak.

| Players | Duration | Actual admissions / state frames | Read/write/decode errors | Sampled heap maximum |
| --- | --- | --- | --- | --- |
| 50 |120s|50 /175,715|0/0/0|124,514,240bytes,26samples|
|100 |120s|100 /237,702|0/0/0|182,125,088bytes,28samples|

Both stages **PASS**: aggregate frames exceed5per configured client-second,
all health samples DBready, heap below512MiB and four times BOTH the original
healthy baseline82,548,176bytes and each stage's first sample(84,619,568 /65,671,368).
After100clients disconnected, final sampled heap80,831,096bytes. These prove
bounded admission/replication/memory behavior, not Internet latency, browser FPS,
actual raid clears or long-duration retention. The old stopped100-player result
remains a failed baseline; it is not retroactively a pass.

Evidence: `/tmp/eidolon-shared-load-20260914-AfsRLL/` with `fifty-clients.log`,
`fifty-health.jsonl`, `hundred-clients.log`, `hundred-health.jsonl`.
All client/sampler processes ended. API24227 exited normally BEFORE Mongo
`eidolon-shared-load-mongo-20260914` was stopped/removed. Ports38761/38762 absent.
No production accounts/currency/schema/data modified by these load tests.
Do not repeat these accepted stages for version-label/documentation changes.

Packaging asAlpha1.9.9 with synchronized login/runtime and cumulative notes;
publish after final packaging checks. Actual1.9.8 delivery is already verified.

`World.GetStatesForPlayers` assembles recipient views under the existing world
membership read lock and copies each relevant actor once per broadcast. Recipient
maps share those detached snapshots; no cross-tick/global cache or new wire format
is introduced. The existing single-recipient API remains. Each recipient retains
its self snapshot, range and instance filtering; detached instance/position are
rechecked before inclusion. A character change after recipient capture skips that
stale recipient rather than sending another character's view.

State serialization/change tracking only reads the shared copies. Mutable skill
slices, equipped-item nested stats/gems/basis and loot items now detach too, using
the existing item clone function. EP, allowance/exchange/casino receipts, bag and
unlocked cosmetic ownership stay absent from public snapshots. No gameplay stats,
visibility radius, tick frequency, rewards or movement rules are changed.

## Focused evidence

- Batch values match the existing single-recipient snapshot path; overlapping
  viewers share pointers only within that batch. Subsequent broadcasts see new
  HP and removed players. Instance/radius boundaries and private fields checked.
- Live equipment/skill/loot mutations cannot change retained shared snapshots.
- Concurrent locked instance moves and repeated batches pass under race checks.
  Final expanded game checks PASS1.921s.
- Eight parallel actual protobuf/snapshot/change-detection readers with concurrent
  live equipment/skill changes preserve identical wire data, race PASS1.358s.
- Existing focused main replication/snapshot/protobuf checks PASS0.784s.
- Controlled 100-observer/250-enemy benchmark, same world/fields on both paths:
  independent copies127,538,797ns /204,079,329B /65,336allocs per batch;
  shared copies10,934,950ns /5,842,006B /16,911allocs. About97% fewer allocated
  bytes in this workload. This is not a universal FPS or live capacity estimate.
  `/tmp/eidolon-batch-state-benchmark-20260914.log`.

Implemented at **22a56525746f5ed25026db0d29da5caf854aa9b5**; full Go build passed.
The affected bounded stages and1.9.8 delivery are now complete above. Finish
packaging checks, publish and verify the exact1.9.9 deployment.
Suggested player-facing note: reduced repeated actor-state allocations in crowded
areas while preserving visible equipment, effects and instance boundaries.

This does not close earned campaign, group raid, visual/phone or broader final1.10
requirements. Preserve the already-passing geared Verdant result and existing
EP recovery checks rather than repeating them for this snapshot change.
