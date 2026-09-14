# Broadcast snapshot allocation correction

Follows the measured [100-player memory-budget failure](2026-09-14-concurrency-trials.md).
Local implementation, not yet a deployed performance claim.

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

Before publication: complete build, repeat only affected50/100-client bounded
stages on a frozen compiled commit with unchanged health/heap/error targets,
record the result and exact cleanup, then package accurate cumulative patch notes.
Wait for exact1.9.8 delivery (CI34802207933); do not supersede its running job.
Suggested player-facing note: reduced repeated actor-state allocations in crowded
areas while preserving visible equipment, effects and instance boundaries.

This does not close earned campaign, group raid, visual/phone or broader final1.10
requirements. Preserve the already-passing geared Verdant result and existing
EP recovery checks rather than repeating them for this snapshot change.
