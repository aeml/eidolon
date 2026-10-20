# Alpha 1.80.2 playable shores and ocean accepted

Source `b3889294cb3c0db234f54f854e6d7151865692b8` passes original [CI 39497820995](https://github.com/aeml/eidolon/actions/runs/39497820995), attempt 1, all ten jobs,
both deployments and live QA. Normal-TLS frontend/backend identify this exact
source and Alpha 1.80.2; database ready, registration open, flat-v1 terrain.
No manual workflow retry or cancellation occurs.

The authoritative server now clips entire walking, jump and movement-ability
paths to the union of canonical realm floors. This blocks ocean destinations
and paths through ocean corners between otherwise valid endpoints. Client jump
prediction and walking agree; pointer targeting no longer supplies an infinite
ocean floor. Saved overworld players outside land recover inside the nearest
fence before publication. Shared gateways, roof jumps and instance layouts retain
their own movement behavior. The four timber/iron perimeters remain in place.

The ocean uses world-space animated slopes, reflective highlights, deep teal
variation and broken shoreline foam. It retains one two-triangle plane and no
extra render passes; High/Low and paused reduced-motion presentation are checked.
The final native screenshots were reviewed after reducing excessive highlights.

[Local qualification](2026-10-20-playable-shores-and-ocean.md) passes 157 client
checks in seven focused suites and 455 release/history/workflow checks in nine
suites, changed-source lint and all 17 generated-content groups. Native System
Chrome passes the all-realm/gateway scenes and final High/Low water review,
including actual changing GPU pixels, nonuniform detail, paused water time,
bounded predicted jumps and unchanged two-triangle geometry. Local server
regressions and race checks retain the original synthetic-fixture failures and
their corrected isolated-scene/real-land results. No combat/range/recipient,
geometry, timeout, retry or performance assertion is weakened.

Own CI passes 824 client suites / 12,856 checks, 566 hosted browser cases,
185 native cases and 11 live cases, with the existing 15/2/1 excluded cases and
zero failed/flaky browser outcomes. Mandatory native coverage includes the
extended realm-fence/water/jump case before deployment. Server/race/build stages
pass. Prepared visual scenes do not certify human traversal, whole-world
performance, physical phones or final collection art.

All 523 prior raw note entries are unchanged in 524 entries / 52 lazy pages.
Dependency graph, models, canonical geography, schema/protocol and saved progress
are preserved; movement admission changes as described above. The procedural
material uses existing code/texture inputs and introduces no external asset.

All 445 fresh public-file pins match this exact run's Pages artifact;
110 unchanged GLBs reuse accepted Alpha1.80.1 normal-TLS proof only after
exact current-artifact byte comparison. Worker SHA256 remains
`835578df97d6ade3683f781b95caf5aa4fd9b71d047fa5353f7a83798ce0d04a`;
precomputed geometry and analytics remain unchanged. Four receipts and inventory
are frozen read-only under `.qa-release1802-zone-water/deployed-acceptance-v1/`
in the owned master, inventory SHA256 `3839a703fc99216646f8ff075c3db686842733373e88b6468b018872420c0056`.
Local evidence is frozen under the detached zone/water worktree's
`.qa-zone-water/`, inventory SHA256 `f6674b4eb89ce76dcee561dbb2c77d7aeab62a2944c3e02d4980c29245f1d6a8`.

This is a correction within the [accepted feature freeze](2026-10-20-release1-80-0-acceptance.md).
F1–F5 remain accepted. P01–P13 and the full1.99/beta/launch requirements remain
open. No beta activation, new spending or soak/stress test. Next scheduled
milestone remains 1.81 recovery readiness.
