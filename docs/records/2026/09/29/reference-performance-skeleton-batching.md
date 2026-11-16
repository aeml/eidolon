# Reference performance and skeleton batching — September 29

Local continuation ofe9e272f9. No deployment/version change.

## Evidence and change

A bounded six-site High-quality reference profile passed on the integrated
candidate before optimization (30.1s browser run). Median16.7ms and
p95 16.7–16.8ms at all sites. This replaces the older failed six-site result
for this local candidate/workload, not for all hardware or gameplay.

Actual draw attribution showed a runtime skeleton using52 color/45 shadow
draws near the first grove. Its constructor art has51 meshes (the runtime adds
an interaction hitbox). Reused the existing immutable rigid-pivot batching
utility for the production Skeleton factory:51→34 art meshes. Source art
factory remains available unbatched for comparisons. No changed triangles,
materials, animation tracks, bounds, combat radius, targeting or enemy rules.

Batch before capturing the reset pose so pooled models do not retain removed
source objects. Shared merged geometry is cached and not actor-disposed.
Other enemy families remain unchanged.

## Verification

-149 unit checks pass3.779s: humanoid batches, legacy enemy families and model
 loading. Skeleton addition compares actual triangle world positions, normals,
 UVs and material/shadow ownership at25%/70% of all five clips; validates reset,
 bounds, shared geometry reuse and disposal.
-Scoped lint and whitespace checks pass.
-High/Low renderer comparisons pass6.2s across Idle/Run/Attack/Death.
 High112→80 draws; Low52→35 draws. Triangle counts identical in each mode.
 Maximum mean pixel error0.000145, changed-pixel fraction0.00000324, below
 unchanged equivalence thresholds. Artifacts:/tmp/eidolon-skeleton-batching-0929.
-Inspected final skeleton capture.
-Final six-site High production-renderer profile passes29.8s with original
 median/p95/draw/triangle/resource thresholds unchanged. Hardware:
 AMD Radeon Graphics RADV RENOIR via ANGLE Vulkan, viewport1280×844.
 All medians16.7ms; p95 16.7–16.8ms. Calls156–325; triangles55,249–181,374.
 First-grove draw count313→281; its triangle count181,374 unchanged.
 Repeat resources stable386 geometries/51 textures/56 programs.
 Artifacts:/tmp/eidolon-reference-profile-final-0929.

## Limits / next

The host load was about12 at this run's start versus about36 during the older
failure. Do not attribute that old-to-new timing difference solely to code,
or claim a skeleton FPS gain: frame pacing was already at refresh before this
optimization. The supported result is fewer draws and retained visual fidelity.

This fixture uses the default flat overworld, normal camera, prepared actor
and scene updates. It does not enable optional terrain elevation, simulate
a busy network party or prove phone FPS. The former six-site High regression
is resolved for this candidate; broader performance and visual acceptance
remain separate open gates. No campaign soak or long raid run.

Continue remaining code/art integration and the ordered roadmap. Pending
1.39/1.40 owner release decision remains unassumed; full goal active.
