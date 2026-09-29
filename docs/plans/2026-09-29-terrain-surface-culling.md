# Terrain and ground-cover culling — September 29

Local candidate based on 854a434c, runtime Alpha 1.38.0. No deployment or
release-gate waiver. Raised terrain remains explicitly QA-only.

## Implementation

Partition the canonical raised Earth surface into 224 spatial tiles. Every
original triangle appears exactly once, with bit-identical position, normal,
UV and winding. Nothing is resampled or simplified; physics data, terrain
recipe, movement and picking remain unchanged. Tiles share the original
material. Their geometries are scene-owned and covered by existing recursive
disposal. Flat worlds and other realms retain their single ground mesh.

Earth fern/sedge batches use 16m cells instead of 32m. All 13087 High / 7439
Low placements, geometry, material, clearance and wind envelopes are retained.
This applies to flat and elevated Earth. The tradeoff is more scene objects,
instance buffers and visible draws, in exchange for less off-screen geometry.
High grows from 624 to 1738 batches and Low from 595 to 1604; this is not free
CPU/memory work.

## Evidence and limits

- 24 distinct focused checks pass: exact triangle/attribute equivalence,
  tile/gate raycasts, unchanged flat meshes, renderer profile integration and
  idempotent preload, canonical heightfield, plant placement and wind bounds.
  Initial 17-test selection 41.701s; final four preload checks 79.78s; five
  understory/placement checks 15.037s. No repeated campaign or dungeon clear.
- Final High desktop / Low phone-sized browser preview passed in 24.7s.
  Movement, jump, targeting and combat effects still match the terrain.
- Synchronous pixel comparison at the outer fold: tiled ground with normal
  plant culling versus the canonical unsplit ground with all plants submitted.
  Wind phase frozen between draws. Zero pixels differ by more than 2 channel
  values out of 270080 pixels at either quality. This proves that sampled view,
  not all cameras or physical-phone frame time.
- Inspected the Low western-bank capture. This is appearance-preserving
  optimization, not a claim that the procedural art is finished.
- Scoped lint/diff whitespace pass. Updated the phone-combat terrain inspector
  to count tile vertices recursively; that combat route was not rerun because
  this changes render partitioning, not gameplay or network geometry.

## Submitted geometry comparison

Matched camera/quality views against the immediately prior bank candidate.
Counts include ordinary render passes; no FPS claim or relaxed budget.

| View | High draws / triangles before → after | Low draws / triangles before → after |
| --- | --- | --- |
| Western bank | 292 / 356416 → 304 / 294151 | 118 / 115166 → 135 / 76990 |
| Woodland cut | 284 / 328042 → 306 / 278521 | 110 / 104761 → 132 / 72024 |
| Outer fold | 268 / 316861 → 289 / 264470 | 124 / 130543 → 143 / 84769 |

Low is now below the existing 85k triangle / 200 draw targets at these three
views. High remains above 250k triangles, though below 350 draws. Terrain
tiling alone removes approximately 24k triangles per view; tighter plant
batches account for the remaining reduction. Median/p95 frame-time acceptance
is still open, particularly because the scene now contains more cullable nodes.

Baseline: `/tmp/eidolon-bastion-banks-after-0929`.
Terrain-only: `/tmp/eidolon-terrain-tiles-0929`.
Final: `/tmp/eidolon-terrain-culling-final-0929`.

Next work remains stronger terrain/material composition, actor/equipment
quality, combat feel and remaining High cost. This does not advance version
identity or declare the 1.42 milestone accepted.
