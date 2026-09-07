# Forge earned scaling — Alpha 1.0.48 locally verified

Follow-up to the [measured loot/Forge baseline](2026-09-07-loot-and-forge-baseline.md).
Runtime work is isolated on `work/economy-balance-20260907` in
`/tmp/eidolon-economy-balance-MYgoxi`. Runtime **`9695add`** and corrected release
ancestry **`d055ccb`** are packaged as **Alpha 1.0.48 (every shard counts)**.
Package `2f365d0` plus test-only readiness correction `be80c67` is locally
verified. It is not published; the preceding sequential release gates still apply.

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

The first full backend run passes race (root **18.301s**, game **298.426s**),
log `/tmp/eidolon-forge-full-server.log`. The actual isolated Forge route passes
**17.9s / 19.6s total**, log `/tmp/eidolon-forge-precision-gameplay.log`, including
credential scan and disposable cleanup. Its inspected image shows potency +2,
**46 damage → 50** for the next rank, and the correctly disabled four-heart
purchase with an empty bag. Reconnect preserves the exact item and its basis.
The image is independently retained at `/tmp/eidolon-forge-accumulated-progress.png`.
This is a prepared functional fixture, not earned economy or phone evidence.
Both owned handles are closed. These full checks precede the auction mapper
correction described next, not a claim of final packaged verification.

The auction BSON round-trip regression fails **0.234s** because the basis is
missing at the first saved upgraded level. Both auction mappers now deep-copy
the basis. Repeated reload/continued upgrades, rejected purchases, direct-trade,
snapshot and Forge checks pass three race repetitions **10.146s**. The final
server-root persistence/equipment set passes **1.854s**. Logs:
`/tmp/eidolon-forge-auction-before.log`, `/tmp/eidolon-forge-auction-after.log`,
`/tmp/eidolon-forge-persistence-final.log`. These handles are closed.

## Remaining before packaging

- [x] Finish the initial handles and inspect/preserve the actual Forge image.
- [x] Preserve the basis through both auction mappers with a real auction BSON
  round-trip and continued-upgrade regression.
- [x] Cover rejected operations, copied-basis isolation and corrected persistence.
- [x] Integrate corrected 40 combo-observation ancestry and align 48's package,
  login, release manifest, server/deployment defaults and distinct patch notes.
  Version/default/Forge contracts pass **239 / 1.302s**.
- [x] Finish final packaged client/server/browser and real Forge checks; retain
  exact artifacts and integrate locally only after the package is verified.
- [ ] Publish after earlier sequential CI/live gates, then verify exact public
  commit/version and healthy/ready backend. Local 48 is not the current live game.

This is an arithmetic/persistence correction within balancing, not the full
balance pass. Attainable late-potency costs, equipment frequency, XP/gold curve
tuning and playable investigations remain separate required work.

## Final packaged evidence

- Full client: **216 suites / 3,198 tests / 149.264s**.
- Full server race: root **15.501s**, game **381.500s**, remaining packages pass.
- Version/default/Forge contracts: **239 / 1.302s**; lint passes.
- Actual packaged Forge/reconnect: **24.4s / 26.4s total**, with exact saved
  stats and precision basis, guide choices, credential scan and disposable cleanup.
  Inspected image: `/tmp/eidolon-release48-forge-accumulated-progress.png`.
- Final anonymous browser sweep: **75 / 9.4m**, all passing.

The first anonymous attempt passes 74 checks but fails the phone status test
during module loading, before layout assertions. Its trace shows UIManager
returning HTTP 200 while dependency requests fail with `net::ERR_NETWORK_CHANGED`.
The status test now uses the existing bounded runtime-readiness helper; its
layout assertions and production code are unchanged. All four sizes pass twice
(**8 / 49.0s**) before the complete 75-check rerun. This is test-startup recovery,
not a claim to have diagnosed the machine's network change.

Logs: `/tmp/eidolon-release48-client.log`, `/tmp/eidolon-release48-server.log`,
`/tmp/eidolon-release48-anonymous.log` (failed first attempt),
`/tmp/eidolon-release48-status-readiness.log`, and
`/tmp/eidolon-release48-anonymous-final.log` (passing rerun).
All owned final verification handles, including rerun `57685`, are closed.
