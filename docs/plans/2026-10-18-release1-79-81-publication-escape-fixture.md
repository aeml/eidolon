# Publication escape fixture preparation

The phone-layout source `6ea31f04b` has a completed failing client job
`117656999361` in run `39120174896`: 811 suites and 12,594 tests pass; the
unsafe add-on escape case exceeds its existing five-second deadline. There is
no failed publication assertion. That result remains a failure, not a waived
release gate. A separate local baseline escape case passes in 1.029 seconds;
the hosted delay is not reproduced or attributed to a proven single cause.

The escape fixture previously copied the entire prepared vendor directory,
including hundreds of files the rejected import cannot reach. It now copies
the real manifest and license and creates the add-on root. The ordinary copied
worker, geometry artifacts, login and engine inputs remain. This exercises the
same production vendor admission and lexical escape rejection before any add-on
load. The version and linked-entry/dependency negatives still use the full
vendor copy, as do the valid add-on and actual game-graph cases.

All four unsafe-input cases now additionally verify that the original engine
source stays byte-identical and that no engine bundle is published. Their
original error checks and unchanged login entry checks remain. No runtime code,
test deadline, concurrency, coverage threshold, version or game rule changes.

All 16 publication tests pass with coverage in 59.31 seconds on one assigned
CPU. The escape fixture also detects a temporarily disabled production path
guard through its expected-error assertion, without a timeout; the original
production source is restored byte-for-byte. Changed-file lint and diff checks
pass. Private evidence is retained in the owned correction worktree under
`.qa-bundle-escape-fixture`.

This is a correction within the pending Alpha1.79.81 milestone. Its own complete
CI and deployment verification remain required. It does not accept earlier
failed runs or close the original game, performance, device, art or beta gates.
Soak and stress checks remain deferred.
