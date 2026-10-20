# Alpha 1.80.1 realm fence and ground correction accepted

Source `6071ecadf4c6e7efcfeb4db0546bcb4c2d0a39f1` passes original [CI 39466732460](https://github.com/aeml/eidolon/actions/runs/39466732460), attempt 1, all ten jobs,
both deployments and live QA. No manual workflow retry or cancellation occurs.
Normal-TLS frontend/backend identities match Alpha 1.80.1 and this exact source;
the database is ready, registration remains open and terrain stays flat-v1.

All four elemental realms now use the existing timber/iron perimeter. Replicated
fence actors retain their identity and collision lifecycle while suppressing the
old orange mesh, including actors that arrive before the environment. Gates
and authoritative wall positions remain unchanged. Ground reaches every wall,
with a 0.75m exterior footing under outer posts and one material owner at concave
corners. UV scale/interior elevation are preserved; the border follows existing
128m tile cuts. No raised-terrain rollout or server movement/bounds change.

[Local qualification](2026-10-20-realm-fence-ground-correction.md) passes 50 checks
in seven focused suites, 455 release/history/workflow checks in nine suites,
changed-source lint and all 17 generated-content groups. Native System Chrome
passes both the all-realm High/Low scene and shared gateways in 18.0s; eight
wall screenshots retain visual review. Production queued-fence creation yields
four environment-owned actors without legacy meshes; actual timber/iron render
submissions, inside/outside footing rays and stable owners through quality changes
pass. Prepared scenes do not certify live traversal, whole-world performance,
physical phones or final collection art. Original local failures are retained.

Own CI passes 823 client suites / 12,843 checks, 566 hosted browser cases,
185 native cases and 11 live cases, with 15/2/1 excluded cases and zero
failed/flaky browser outcomes. The added hosted exclusion is the new mandatory
native fence case; the native stage runs it before either deployment. Existing
release gates, tile-culling bounds, timeouts and retry policies are retained.
Server/race/build stages pass.

All 522 prior raw patch-note entries remain identical in the 523-entry history
with 52 lazy pages. Dependency graph, models, canonical geography, server gameplay,
schema/protocol and accounts/progress remain unchanged. The procedural correction
uses existing licensed art/code inputs; no new asset permission is inferred.

All 443 fresh public-file pins match this exact run's Pages artifact;
110 unchanged GLBs reuse accepted1.80.0 TLS proof only after exact current
artifact-byte comparison. Worker SHA256 remains
`835578df97d6ade3683f781b95caf5aa4fd9b71d047fa5353f7a83798ce0d04a`;
precomputed geometry and analytics remain unchanged. Four acceptance receipts
and inventory are frozen read-only under the owned master's
`.qa-release1801-fences/deployed-acceptance-v1/`; inventory SHA256:
`e020a7937a8a2c897696294dcad45378cb91dbe0d4b6a2fdb1ddd2990753a21f`.
Local evidence retains 49 files under the detached fence worktree's
`.qa-realm-fences/`, inventory SHA256
`fad5941e7a5e127147f0fc507af0569fc638ce67c686d0f9cba7193611e5b50a`.

This is a P01/P04 correction within the [accepted feature freeze](2026-10-20-release1-80-0-acceptance.md).
F1–F5 remain accepted; all remaining art/performance/human/device/operations/
rights/capacity/beta requirements remain scheduled. No beta activation, new
spending or soak/stress test. Next scheduled milestone: 1.81 recovery readiness.
