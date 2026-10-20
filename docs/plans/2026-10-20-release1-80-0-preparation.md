# Alpha 1.80.0 feature-freeze candidate

Current correction: original source `a4b905e4` / CI39352722710 fails the server
public-monitor deadline classification and does not deploy. The
[qualified monitor correction](2026-10-20-release1-80-0-monitor-deadline.md)
adds a post-read cancellation check and six EOF-boundary cases, preserving all
original limits. The preparation and metadata-only statements below describe
the first candidate; the corrected candidate also contains that F2/P09 fix and
requires its own complete pipeline. All first-run results remain retained.

F1–F5 readiness is qualified in the [freeze review](2026-10-20-feature-freeze-review.md).
The owner confirmed the [operating baseline](2026-10-20-freeze-operating-proposal.md)
and reported no known rights issues, asking that unsubstantiated inputs remain
flagged. All original art, performance, campaign/device, capacity, recovery,
rights and beta/release requirements remain scheduled as P01–P13. This candidate
does not activate beta, wipe accounts or introduce commerce.

The selected change synchronizes Alpha 1.80.0 identity across package/lock,
login/history, release manifest, server/default image/Compose/deployment and QA
builds. It adds one feature-freeze note and 52 lazy history pages. All 521 prior
raw entry strings remain identical in the 522-entry history. The client/server
gameplay, model catalog, odds/rewards, schema/protocol and dependency graph are
unchanged from accepted86. Private input comparison verifies the exact allowed
metadata changes; package/lock comparison ignores only the root release versions.

Local qualification:

- All 17 generated-content groups pass read-only checks before release identity
  preparation; their generator/runtime/model inputs remain unchanged.
- The unchanged historical talent-consumer overlay passes using Go 1.27.2
  (game package 1.158 seconds), resolving a stale README known-failure statement.
- Nine release/history/workflow suites pass all 455 checks in 3.372 seconds.
  The first local run exposed the missing README source-version line; that line
  is now explicit and distinct from the accepted live version. An inadvertently
  repeated unchanged local run and the original mismatch are retained privately;
  neither is counted as a pass or a game defect.
- Changed-test lint, whitespace, all new document links, 85 promise IDs,
  153 source/regression anchors and thirteen scheduled workgroups verify.
- Worker preparation produces the unchanged 179,747-byte worker, SHA256
  `835578df97d6ade3683f781b95caf5aa4fd9b71d047fa5353f7a83798ce0d04a`.

The initial review pins accepted runtime
`4bfafdd62b81db2dd0037b33bf6947da8e811351` and its original CI39301167062.
That evidence remains scoped baseline evidence, not this candidate's CI result.
Fresh public baseline checks match86 with a ready database, open registration
and flat-v1 terrain. The candidate requires its own original complete pipeline,
both deployments, live checks and exact artifact/public verification before
1.80 acceptance. No successor is published before that result is reviewed.

All work uses a detached owned worktree, preserving the dirty original checkout
and isolated unselected experiments. No soak/stress, repeated full campaign,
new local GPU run, production-data operation, repository administrative change,
extra paid service or inferred rights grant occurs. Editable Blender sources
remain fifteen LFS pointers in this checkout; expanded/remote matching source
availability remains explicitly flagged for the final source/rights review.
