# Keeper cottage and abandoned garden

Local environment follow-up to the connected starter-route review. Mara's
diary site now has individual weathered masonry courses, broken flagstones,
fallen roof timbers and slate, a hearth, nursery pots, curved roots and a
braced planting table with a written ledger. Removed the floating green
placeholder stones. The neighboring abandoned garden gains low framed beds,
folded and wilted leaves, deliberate empty planting spaces and a constructed
wheelbarrow with a vertical wheel.

The diary remains at its existing interaction position. All three cottage
collision boxes and garden solid footprints are unchanged; the open southern
approach remains clear. No quest, reward, server, terrain-profile or save change.
No added light, texture or global resource cache. Cottage base construction
uses seven material batches and 3,926 triangles, versus 29 meshes and 568
triangles before; this is a geometry/detail tradeoff, not an FPS improvement
claim. The eight Earth scenery recipes retain their existing 40-batch ceiling.
An initial 41-batch result was corrected by sharing the garden's opaque soil
with the existing rough vertex-colored plant material, not raising the limit.

## Verification

- Cottage/Chronicle checks: 37 passed, 2.613 seconds. Exact old collisions,
  finite positions/normals, bounds, picking IDs, owned-resource disposal and
  seeded plant geometry covered.
- All-eight-recipe High/Low geometry, spawn-footprint and batching check:
  passed in 1.824 seconds after the material consolidation.
- Exported landing-collider parity, scoped lint and diff checks passed.
- Existing Earth/town desktop High and 390px Low browser cases: two passed
  in 40.2 seconds. Both cottage captures inspected with normal production
  camera/lighting; a ray to the diary hits its expected interaction entity.
  This capture precedes the final material consolidation (same soil color
  and roughness, shared double-sided material). Evidence:
  `/tmp/eidolon-keeper-garden-0929`.

Prepared-scene visibility is not earned quest completion, physical-phone
acceptance, measured frame-time performance or proof of campaign quality.
The prior connected town-to-fight route remains separately documented; this
pass did not rerun it or add a campaign soak. Broad ground composition, the
remaining grove-to-dungeon connection, actor art and human combat-feel review
remain open. No runtime bump, deployment or release-gate waiver.
