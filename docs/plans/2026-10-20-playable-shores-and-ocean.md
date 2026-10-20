# Alpha 1.80.2 playable shores and ocean

Prepared against accepted Alpha 1.80.1 source
`6071ecadf4c6e7efcfeb4db0546bcb4c2d0a39f1` and documentation-only master
`5e187643fabd7e6b6912e816db8d1334aaca97e1`. Deployment acceptance is pending.

The ocean was reachable because overworld jumps had no playable-region guard,
ordinary movement relied on finite-height fences and a large scene envelope,
and pointer targeting used an infinite ground plane. The authoritative server
now clips complete travel segments to the union of the four canonical realm
rectangles. This also prevents jumping or blinking between valid endpoints
through the ocean at concave realm corners. Shared edges stay connected and
existing physical fences still own their gates. No geography is enlarged.

Walking and movement abilities use the same guard. Admission and saved-position
recovery return stranded overworld players to the nearest land before grounding
and spatial-grid publication. Instances retain their own layout authority.
Client jump prediction and physical walk correction match the server's union
and 0.05m travel inset; ocean clicks no longer select a fictitious floor.

The ocean material uses world-space wave slopes for moving reflection/highlights,
deep teal variation and broken foam along the actual land outline. It still
uses the original two-triangle plane, one material and no extra render passes.
High and Low use the material; reduced motion pauses its presentation clock.
The existing explicit waterShader=0 diagnostic fallback remains available.
All existing terrain, town roofs, canonical gateways and four timber fences stay.

Local qualification:

- Seven focused client suites pass all 157 checks, including outer shores,
  concave-corner paths, gateways, recovery, walk collision, ground targeting,
  authoritative/predicted jumps, terrain and town roofs.
- Nine release/history/workflow suites pass all 455 checks. All 523 prior raw
  history entries are unchanged in 524 entries / 52 lazy pages.
- Native System Chrome passes the all-realm scene and existing gateway scene
  (two cases, 19.9s). The final water review passes in 14.5s, including actual
  High/Low GPU pixels changing with time, nonuniform water detail, a two-triangle
  ocean, paused reduced-motion time and five bounded predicted jumps. Ten final
  wall/water screenshots retain visual review; mandatory native CI owns the case.
- Changed-source lint and all 17 generated-content groups pass.
- The first broad server run exposed synthetic combat fixtures placed at
  50000/60000 without a scene, plus an obsolete unbounded-overworld expectation.
  Broadcast publication fixtures also used out-of-zone origins; they now test
  the same recipient distances on real land. Those fixtures use isolated scenes
  or real land without weakening combat,
  recipient, range, damage or instance assertions. Their focused regressions pass.
  All non-root backend packages pass the broad run (game: 234.151s); after
  correcting the two broadcast fixtures, the full server entry package passes
  in 108.054s. Final movement/jump/roof/instance/PvP race checks pass (9.960s),
  and the two broadcast concurrency/recipient race checks pass (2.003s). The
  original broad command's nonzero result remains recorded, rather than relabeled.
- Initial local command/fixture failures and the rejected excessive-highlight
  water review are retained alongside final evidence; no CI retry/cancellation
  or soak/stress is substituted for an original result.

Exact deployment receipts will be completed after CI and public verification.
This correction does not open beta, finish P01–P13, activate raised terrain or
perform a soak/stress test. The broader game completion goal remains open.
