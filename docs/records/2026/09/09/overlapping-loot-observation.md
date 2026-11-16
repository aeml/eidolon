# Follow the actual front drop in general pickup QA

Full58 rerun92856 on51c9bf7 failed its combat/loot test; login and the real
portal/reentry/jump-Recall test passed. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0602.log`; sanitized failure archive
`/tmp/eidolon-rest58-full-loot-failure-sKrdfS/test-results`. Terminal1, scan0,
exact owned containers/image absent. The diagnostic contained two LootDrop
hits on the same ray: the requested drop was behind another clickable drop.
The10s pointer deadline expired while the helper insisted on the back drop.

The general combat/pickup route requires an actual acquired item and persistence,
not one arbitrary item hidden behind a coincident hitbox. Add explicit opt-in
for that route to observe the actual front drop. Specific-item callers remain
strict by default. Both paths require a fresh on-canvas pointer sample and an
active actual LootDrop with an authoritative item. An alternative qualifies only
when it shares the raycast hit stack with the intended active drop. A hostile,
unrelated item, stale pointer or disappeared target never qualifies.

The selected actual item ID is carried into the existing inventory-quantity
receipt and reconnect proof. No bag-slot-count substitution, direct pickup,
hover assignment, changed targeting priority, fake grant or extended deadline.
A later click that acquires a different item still fails that exact receipt.
Prepared combat fixtures remain prepared QA, not earned-progression evidence.

Deterministic baseline58464:6fail/3pass/0.600s against the old intended-ID-only
predicate. Corrected22244:26tests/3suites/1.112s covering the new9cases, entrance
freshness and actual GameEngineRaycastPriority, plus lint/diff passed. Node24.
Real browser geometry/input62614:2tests/8.3s. The inherited hostile-covered-center
fixture retains enemy priority and finds an exposed loot edge; the new coincident
LootDrop fixture selects the actual front item while the back item remains.
These are component fixtures, not a server pickup or save proof.

Logs `/tmp/eidolon-rest58-loot-pointer-{baseline,after,lint,browser}.log`;
browser result metadata archived at `/tmp/eidolon-rest58-loot-pointer-proof-8fFCV0`.
Full client and actual full server gameplay reruns follow. Production runtime,
release metadata and normal recovery behavior remain unchanged from5a17be1.
