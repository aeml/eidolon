# Alpha 1.48 public acceptance

Accepted September 30, 2026 after corrected-source CI and independent public
checks. This accepts the declared rendering/performance scope, not final modern
art, physical-phone performance, closed-beta capacity or the full roadmap.

- Published `46e812e18846a1e566747a2d13c87cdffb3d28c7`, Alpha 1.48.0.
- [CI 36722919432](https://github.com/aeml/eidolon/actions/runs/36722919432),
  attempt 1, completed successfully at 14:28:18 UTC. Luna monitored the exact
  run; the root independently verified its SHA/attempt and all ten successful
  jobs: Jest109914844871, Go109914845250, browser109914845260/109914845287/
  109914845452, predeploy109926391115, inputs109927716823, Pages109927768186,
  SSH109927768375 and live109930080492.
- Normal-DNS IPv4 frontend release and backend health report that exact commit
  and version, with database ready. The document has the current login label,
  cumulative notes for 1.11–1.48, exact main.js release key and viewport policy.
- All 24 changed production JavaScript files match the source after the exact
  publishing rewrite, including actor/foliage batches, equipment, scene owners,
  network/render startup, shadows and world generation.

The initial run36720351298 failed its foliage geometry oracle and deployed
nothing. The stronger actual-vertex oracle exposed a real sheared-transform
sphere underbound; the corrected source, independent reproduction and native
appearance/performance evidence are retained in the
[performance receipt](2026-09-30-release1-48-performance-work.md). No tests were
silently dropped or tolerance weakened to bypass that failure.

No production account mutations, privileged DNS/nginx changes, IPv6 assurance,
beta transition or balance changes in these independent checks. Fresh remote
fetch/merge remains mandatory immediately before later pushes. Source-only
acceptance notes will travel with the next ordered release.
