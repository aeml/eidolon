# Bounded connection and schema startup qualification

Qualified runtime433b332d53249394065f8e78d61e14cda69a2a93; wrapper/CI source
4d51a26c4955c2712ea1d6a0f0f519899da44448, based on accepted81master2f292b139.
This component is not deployed. It does not certify all storage recovery or
the full release-readiness goal.

The first isolated82native controller built its exact copied client successfully
(520modules/4,915,528bytes), then failed in database.New at migration8,
auction_bid_operations. The connection context expired after ten seconds.
No account, browser, GPU or gameplay case was reached. All six gameplay cases
remain unexecuted; the owned Mongo/ports were removed and protected inputs
remained unchanged. Its ten-file startup-failure inventory SHA256 is
`8747e9661f2c01d8c69d803a42cb437afa79f33a79ec838d167661cd6d8ebed8`.
The original controller did not retain Mongo command/resource timing, so a
specific host CPU/IO cause is not established.

Source inspection confirms that connection discovery, ping and all27migrations
shared one ten-second context. A controlled disposable Mongo fixture reproduces
that constraint: a real six-second ping followed by a real six-second index
command fails at the migration-version index with the original constructor.
The Go case takes12.105seconds including cleanup. No gameplay deadline or
assertion is involved. The preceding fixture-control attempt used an unordered
command map and failed before New; it is retained separately and is not evidence
of the budget defect.

The constructor keeps its original ten-second connection context and gives
RunMigrations a separate45second context. Successful constructor work is thus
bounded by55seconds across the two stages; this is not a whole-service startup
or recovery-time guarantee. Migration ordering, schema27, future-writer refusal,
indexes and saved-data rules are unchanged. No retry or unbounded migration loop
is added. Gameplay clocks, performance targets and the original six cases remain.

The corrected direct fixture passes12checks in26.198seconds, including schema
catalogue/fence checks, actual idempotent migrations/query indexes and both
startup-budget cases. The actual new CI shell wrapper separately starts a fresh
owned fault-enabled Mongo and passes both cases in29.401seconds. Its delayed
cold-start case takes16.31seconds including cleanup; the connection rejection
case takes12.06seconds including cleanup and asserts the constructor call still
fails within9–11seconds. Test commands remain disabled on the ordinary Mongo.
The wrapper runs serially, bounds Mongo to one CPU/512MiB, uses fresh loopback
storage, refuses an occupied port, and removes its container/volumes. Shell syntax
and whitespace checks pass. No browser/native/stress or production request occurs.

Seven-file original control-error, controlled-negative and corrected inventories
retain SHA256 respectively
`58908ac1f489d5347055e3db91a64782e1b8c70e42671679c34f5947e55d190f`,
`a3a6f2b071a00a5c54ae11405287dcf0474a5f1e6dc3fef7ed8c4ded8e947e02`,
`5196c9ea37b0a15318f863ca79858eb575c81de7c5747e481a723baf1be0ffe9`.
Six final source/wrapper/qualification files retain inventory SHA256
`7e57cca7dca366a0d5edde486c3999f50b20668dc4ebd8c624caaa2d110ab3bb`.
Evidence is under `.qa-db-startup` in the owned sparse startup-review worktree.

The separate constructor path that returns after a failed Ping without explicitly
disconnecting its client remains a resource-lifetime review item; this component
does not claim to fix or reproduce that issue. Original movement-audio/input
failures, final native82qualification, deployment acceptance, owner/policy,
device/campaign/performance and F1–F5/beta/1.99 requirements remain open.
