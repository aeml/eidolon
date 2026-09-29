# Woodland construction and silhouette pass

Local continuation after f5f98def. Modern-ARPG scene quality remains unaccepted;
no version bump, deployment, closed-beta transition or release-gate waiver.

Earth birch, pine and willow now use tapered ring-built stems with restrained
bends, fluted cross-sections, smooth bark normals and connected overhead forks.
Pine/willow gain the existing timber surface detail. The duplicated UV seam's
normals are averaged so it does not become a lighting stripe. Old detached-looking
birch boughs were removed after phone review; the new stem owns the forks.

Broadleaf crowns retain 256 leaves but use smaller tapered six-point blades,
four triangles each rather than two-triangle diamonds. Pine tiers replace broad
arrowheads with paired narrow folded sprays. Both remain opaque geometry, using
the same material/spatial instancing system and no new textures or animation.

All 330 Earth tree positions, rotations, scales and collision recipes are
unchanged. Stem vertices below 2.5m fit within each existing collider's radial
half-width before placement scaling, so the bound holds under all rotations.
Existing eight-metre crown/hazard aprons and route clearances remain verified.
Other realms retain their existing geometry and material treatment.

## Verification and cost

- Final 21 focused canopy, foliage, batching and woodland checks pass (5.731s).
  Includes deterministic geometry, finite normals, trunk clearance, exact
  transformed batch surfaces, server footprint parity and unchanged population.
- Final two Earth/town production-renderer cases pass (35.2s). Inspected High
  desktop and Low phone grove views at `/tmp/eidolon-woodland-reviewed-0929`.
  Baseline: `/tmp/eidolon-earth-trails-final-0929`. Earlier review caught the
  obsolete birch boughs; final captures include their removal.
- Scoped ESLint and whitespace checks pass. No new browser cases or long soak.
- Source leaf crown: 1,024 triangles; pine crown: 840. Final baked birch/pine/
  willow: 2,436/2,938/4,512 triangles in 4/3/3 material batches, with geometry
  attribute storage 257,216/312,064/482,304 bytes (not total scene/GPU memory).
- Grove renderer triangles rise from 200,836 to 328,724 High and 94,594 to
  148,118 Low. Calls stay 217/109 and textures stay 47/34 respectively.
  This is a geometry-for-silhouette tradeoff, not a performance improvement;
  no sustained FPS or actual-phone capacity claim follows from these fixtures.

## Remaining quality gap

These trees are still procedural intermediate art. Sparse mid-height vegetation,
broad empty ground, primitive landmark roots and fallback actors remain visible.
Next address larger connected scene composition or combat feel rather than keep
adding leaf polygons. Human pacing/art acceptance remains open; the pending
1.39/1.40 release-policy question is not answered by these technical checks.
