# Cold Communal Kiln — location composition

Local integrated candidate; not a deployment or final modern-ARPG art approval.
The previous goal turn completed the Water/Fire review: the production-renderer
fixture passed, but kiln-yard screenshots exposed simple capped cones, uniform
cup racks and isolated props on largely empty ground. That evidence selected
this location rather than another small Earth prop iteration.

## Draft player-facing change

The Cold Communal Kiln now has built masonry furnaces, recessed arched fireboxes,
grates and hollow iron flues. Pottery dries on slatted two-tier shelves, with
varied hollow vessels and stored clay. Broken loading-yard paving links the
working areas. Hessa's smaller quest kiln shares the same construction and its
workshop walls/wood gain physical-scale surface detail.

These are cold furnaces: no perpetual fire was added to contradict the story.
The personal restoration flame, ledger, beacon and saved-state visibility remain
unchanged. Roads, realm coordinates and all exported collision footprints are
unchanged. Low ground dressing is visual only, excluded from the quest room,
road widths and environmental warning clearance. No new texture maps or lights.

## Implementation and review

- New `KilnWorkshopGeometry.js`: scene-owned geometry with baked vertex colors,
  individual radial courses, arch stones, recessed soot-dark firebox and hollow
  flue. Regional meshes remain merged by material. The kiln material uses the
  existing fieldstone treatment rather than projecting a brick grid over
  already constructed curved masonry.
- First after-image exposed side gaps around the arch and a too-bright regular
  checkerboard floor. Added masonry returns and rebuilt the paving as chipped,
  muted, coherent working strips/loading bays with eroded edges.
- The yard has five meshes/material batches including ground wear/chips, versus
  six before. Geometry increases: final High yard 18,862 triangles including
  pottery and paving; each large furnace has 4,344 masonry +860 iron triangles.
  This is a geometry budget disclosure, not measured FPS improvement. Low uses
  reduced round-vessel/flue segments; static masonry is shared in shape.
- The quest model owns/disposes its own geometry and materials as before. Its
  furnace is scaled into the existing small-kiln envelope; no new collider or
  interaction volume is introduced.

## Verification

- 46 tests across kiln geometry, ElementalPopulation, ChronicleSite and world
  placement/elevation passed in 8.469s. Tests cover finite positions/normals/UVs/
  colors, bounds, actual ray passage into the firebox, uncapped chimney, rack
  envelope, road/hazard exclusion, saved footprint parity, site interactions,
  restoration and disposal through existing Chronicle coverage.
- Scoped ESLint and `git diff --check` pass.
- Production-renderer Water/Fire desktop High and phone-sized Low review:
  2 passed in23.6s. Baseline1 passed15.2s; initial revision2 passed22.9s.
  Final captures: `/tmp/eidolon-kiln-workshop-final-0929`; baseline:
  `/tmp/eidolon-elemental-review-0929`. Desktop and phone final kiln views
  inspected. This fixture traverses locations/readings, not connected combat.

Remaining: broad terrain still looks flat/noisy, the site needs stronger regional
context and environmental composition beyond this workshop, and procedural
actors remain below the desired final presentation. No physical-phone, crowded
party, new performance, human enjoyment or Diablo/PoE-quality acceptance claim.
Water was reviewed but not changed in this pass. Full ordered roadmap remains
active; no runtime version bump or deployment bypass.
