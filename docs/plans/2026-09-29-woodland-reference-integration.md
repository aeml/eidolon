# Woodland, ground and lighting integration — September 29

Status: local combined reference candidate, based on `2cf962b7`; not deployed.
Runtime identity remains 1.38.0. The full roadmap and ordered release gates are
unchanged.

## Integrated

- Town paving/soil transitions and Earth forest-floor composition tied to actual
  paths, woodland, meadow cover and mineral detail. Materials own/dispose their
  added maps; no downloaded texture dependency.
- Composed woodland stands, detailed pine/willow foliage, shared render batches
  and cullable opaque understory. Tree count stays330. Low ground cover is a
  deterministic subset, not a different navigation layout.
- Town/Earth lighting contrast and camera-aware shadow coverage; no additional
  postprocessing pass. Existing environment reflection scaling retained.
- Matching client/admin tree positions and enemy spawn exclusions:456solids,
  eight readings. This supersedes the prior126-solid reference manifest.
- Enemy-sector test includes the actual western Construct sector. Ordinary
  collision recovery already supports saved positions inside the moved trees;
  no save rewrite, mass teleport or account migration was introduced.

Terrain elevation/rock profile, audio, remaining town architecture and actor
batching are still separate integration work. WorldGenerator and RenderSystem
were patched selectively to avoid partial elevation consumers.

## Evidence and limits

79 tests passed in11suites in the initial69.452s run. The remaining understory
suite initially imported the not-yet-integrated elevation profile. Decoupled
that geometry-unit test from the profile: it now checks both flat production
ground and a nonconstant analytic sampler, preserving per-instance height,
culling, clearance, resource and quality assertions. All3checks then passed
in2.384s (82tests across12suites total). Actual elevation integration remains
separately covered in the root work, not claimed by this sampler test.

Saved-position checks cover all330trunks × four movement directions (1320cases),
including adjacent scenery and subsequent movement. Focused server population/
admin-obstruction checks passed .216s. Scoped ESLint, whitespace and both
generated-manifest checks passed. Release identity and startup unchanged.

Desktop High and phone-sized Low populated scene checks passed22.9s:
`/tmp/eidolon-woodland-integrated-0929`.
Inspected both grove images and High town well. Forest composition/shadows are
improved, but plainly procedural trees, broad terrain treatment, separate prop
platforms and fallback actor anatomy still miss the final modern-ARPG bar.
Prepared combat timeline remains in the scene; this is not a network session,
human enjoyment approval or a new frame-time/performance pass.

Next: integrate remaining town architecture/courtyards, actor render batching
and effect hierarchy; review the combined reference. Elevation/rocks and audio
remain unfinished transfers. No repeated campaign/raid soak. Pending1.39/1.40
owner release decision is unassumed; no push, live mutation or version bump.
