# Alpha 1.80.1 realm fence and ground correction

Accepted and deployed as Alpha 1.80.1, source `6071ecadf4c6e7efcfeb4db0546bcb4c2d0a39f1`, original CI 39466732460.
[Exact acceptance](2026-10-20-release1-80-1-acceptance.md) records all ten successful jobs, deployment/live
and public proof. The preparation below records its pre-promotion baseline.

Prepared against accepted 1.80 source `805e7219ce1d1595184ee030a115bdcb0ea00134`
and its documentation-only master follow-up `529161d785ffff85db7c7e0ef1a3376fd75a7b3f`.
Its own CI/deployment/public qualification is recorded in the acceptance above.

The owner reports ocean beneath Earth's perimeter and legacy orange rectangles
around the other three realms. All four now use the existing weathered timber/
iron perimeter, with authoritative wall positions/gaps and batched culling.
Network fence actors retain identity/collision but suppress their legacy meshes,
both on initial creation and when the environment arrives afterward. Startup and
instance return construct the complete perimeter set idempotently.

Realm ground now reaches every fence line and adds a 0.75m exterior footing so
outer posts stand entirely on terrain. Shared realm edges meet exactly; concave
corner footings have one material owner. Ground UV scale, the canonical interior
height grid, flat-v1 production terrain, gates, world bounds and server physics
remain. Border triangles follow the existing 128m tile cuts, preserving raised-
preview culling bounds; this does not select or deploy raised terrain.

Qualification:

- Before correction, the focused new regressions fail five cases; eight existing
  cases pass. The final seven focused suites pass all 50 checks, including all
  walls/footings, concave corners, tile bounds/triangle parity, fences, gates,
  initial startup and retirement of replicated rectangles in each realm.
- Native System Chrome passes the new all-realm High/Low presentation and the
  existing shared-gateway test: two cases in 18.0s. Eight screenshots retain the
  four realm walls at both settings. Actual production queued-fence creation
  yields four environment-owned actors without legacy meshes; native renderer
  assertions, observed timber/iron submissions, owner identity through quality
  changes and ground rays inside/outside exterior fence centres pass. Visual
  inspection confirms grounded posts. This is a prepared scene, not live realm
  traversal or whole-game performance/device certification.
- Changed-source/test lint and nine release/history/workflow suites pass all
  455 checks. All 522 prior raw entries remain identical in the 523-entry
  cumulative history with 52 lazy pages. Release identity is Alpha 1.80.1.
- Dependencies, models, server gameplay/geography/schema/protocol and accounts
  remain unchanged. Generated-content verification and exact release/public
  receipts accompany promotion. Original local failures are retained privately
  under `.qa-realm-fences/`, including the caught oversized border triangle,
  seam query correction (one floor owner, shared triangle edges) and native
  fixture correction to the actual `GameEngine.addEntity` method.

This is a P01/P04 visual correction within the accepted F1–F5 freeze. No new
feature, beta activation, spending, rights decision or soak/stress work follows.
All existing beta/launch requirements remain; next scheduled milestone is 1.81.
