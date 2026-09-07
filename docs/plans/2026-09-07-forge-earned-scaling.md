# Forge earned scaling — implementation in progress

Follow-up to the [measured loot/Forge baseline](2026-09-07-loot-and-forge-baseline.md).
Runtime work is isolated on `work/economy-balance-20260907` in
`/tmp/eidolon-economy-balance-MYgoxi`. It is not yet a numbered release or live.

## Required behavior

- Purchasing identical item levels in +1, +10 or larger batches gives identical
  stats, value and total shard charges. Charge each crossed tier at its own cost;
  retain the existing one-shard lower tiers and two-shard level-80+ costs.
- Preserve fractional stat gains using an immutable saved basis taken from the
  item's current stats/level/potency/value at its first new-system upgrade.
  Existing gear is not retroactively rerolled or reduced. Old lost fractions
  cannot be reconstructed and are not claimed as recovered.
- Potency and level purchase order must not change the final result. Clone
  nested maps so upgrades cannot mutate prior snapshots or escrowed item copies.
- Preserve the basis through snapshots, BSON, all four saved item containers,
  actual login, auction persistence, direct trading and the equipment protocol.
  The Forge screen previews the same arithmetic, including proto3 zero fields.
- Reject unaffordable/invalid operations without consuming items or initializing
  a basis. Retain live Forge refresh, saved selection and ordinary reconnect.
- Use consistent world → player locking for upgrades and response serialization;
  save snapshots can outlive their short world read lock.

## Evidence so far

Three original behavior tests fail **2.011s**: successive rounding loses stat
gains, batches skip tier costs, operation order differs, and upgrades mutate
prior item maps. The initial corrected Forge set passes race **2.200s**.
A separate snapshot concurrency probe exposes a real race **2.597s**; matching
player locks and inventory reply locks fix it. Three repeated corrected Forge
sets pass race **5.516s**. Logs:
`/tmp/eidolon-forge-progression-before.log`,
`/tmp/eidolon-forge-progression-after.log`,
`/tmp/eidolon-forge-snapshot-before.log`,
`/tmp/eidolon-forge-snapshot-after.log`.

Snapshot → BSON → production item mapper → continued upgrading is exercised
after every one of 99 single-level upgrades, including all saved containers.
Equipment protobuf retains the basis. These server-root checks pass race
**1.584s**. Client Forge/preview/protocol checks pass **20 / 1.067s**;
the full client suite passes **216 suites / 3,197 tests / 124.202s**, and lint
passes. Logs `/tmp/eidolon-forge-persistence.log`,
`/tmp/eidolon-forge-progression-client.log`, `/tmp/eidolon-forge-full-client.log`,
`/tmp/eidolon-forge-lint.log`.

At this checkpoint the first full backend run is active (owned handle `58835`,
`/tmp/eidolon-forge-full-server.log`). The actual isolated Forge route is also
active (`83660`, `/tmp/eidolon-forge-precision-gameplay.log`). Do not restart
either merely because observing it times out; revalidate its actual handle.
No success or visual claim is made for these still-running checks.

## Remaining before packaging

- [ ] Finish the active handles and inspect/preserve the actual Forge image.
- [ ] Carry the saved basis through **TradingSystem.toDBItem/fromDBItem**;
  inspection found these separate auction mappers after the initial suites
  started. Add a real auction BSON round-trip/continued-upgrade regression.
  Current runtime must not be packaged until this omission is corrected.
- [ ] Cover rejected operations, copied/escrowed basis isolation, the final
  persistence paths and any changed final runtime with proportionate regressions.
- [ ] Integrate the corrected 40 combo-observation ancestry, version/package
  the completed change with patch notes, run final release checks and publish
  only after all earlier sequential CI/live gates pass.

This is an arithmetic/persistence correction within balancing, not the full
balance pass. Attainable late-potency costs, equipment frequency, XP/gold curve
tuning and playable investigations remain separate required work.
