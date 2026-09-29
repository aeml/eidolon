# Lanternhold workshop identity — September 29

Local continuation of e7b1f902. No release/version/deployment change.

Market: replaced the two solid red roof slabs with one cached tensioned cloth
canopy: sag, longitudinal folds, subtle panel shading and scalloped hems.
Adjusted support posts so they no longer pierce the fabric. Replaced a stone
supply box with slatted shipping crates, added a smaller stacked crate and
bound counter bundles. Existing ledgers and service identity retained.

Smithy: added a repair rack with unfinished blades, waiting billets and a
hammer. Preview revealed its old workbench was almost entirely embedded in
the workshop wall. Moved bench, supplies and anvil sign onto the existing
foundation outside the wall, still inside the unchanged building envelope.

No new collider or ground geometry; no changed route or service positions.
One additional cached geometry; material count stays15. Market and smithy
still each10 optimized material draws; the existing total38 landmark/camp
draw assertion passes unchanged. Canopy1408 triangles plus small dressing
geometry: not free and not an FPS improvement claim. No new textures or
per-frame cloth simulation. Cloth vertex colors supported by existing batching.

Verification:
- Final15 geometry, architecture and town collision tests pass3.172s.
  Exact building bounds, cache ownership, unchanged draw counts and resource
  reuse retained; new assertions cover canopy winding/finite unit normals
  and workbench/supplies outside the wall.
- Updated exact geometry cache count17→18 for the new canopy.
- Initial new normal test assumed up>.8; actual folded-roof normals reached
  .798. Replaced that arbitrary angle with a bound derived from maximum
  slope/sag/fold derivatives; no geometry/collision safety assertion removed.
- Scoped lint and whitespace checks pass.
- Final prepared desktop/phone production-camera HUD previews pass10.6s.
  Added views at market and smithy to existing town presentation fixture.
  Artifacts: /tmp/eidolon-town-workshops-final-0929.
- Inspected final desktop smithy and phone market: bench/tools now visible,
  posts no longer break canopy silhouette. Earlier two-view pass10.1s retained
  as intermediate evidence, not final output.

Still visibly procedural and sparse outside these service footprints. These
prepared renders do not prove connected gameplay, human art acceptance,
real-phone performance or the High performance gate. No campaign soak.
Next: broader world composition and combat/gear motion quality; avoid making
the remaining roadmap into endless isolated prop refinements.
Pending1.39/1.40 release decision remains unassumed; full goal active.
