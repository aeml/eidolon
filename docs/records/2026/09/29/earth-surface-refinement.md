# Earth surface and outcrop refinement — September 29

Local combined reference based on 59f40e3a; no release identity change,
push, deployment, progression acceptance or final art approval.

## Changes

- Forest-floor detail now contains tileable, spatially coherent soil aggregates
  instead of pure texel noise that disappeared into its average at play zoom.
  Keeps existing texture count, resolution tiers and registered High/Low data.
- Meadow/canopy boundaries use that detail for material breakup. Exposed slopes
  retain soil between mineral patches instead of becoming fully grey paving.
- Outcrops use eroded shoulders, irregular side heights and a smaller planar
  cleaved crown instead of alternating deeply inset horizontal slabs.
  Cooler stone separates rocks from surrounding heath.
- Same eighteen collision polygons, six merged formation meshes and geometry
  triangle budget. No movement, terrain-height, server cover, reward or
  population changes. Crown remains planar to prevent near-collinear cap
  triangles acquiring near-vertical normals.

## Review and checks

First rock attempt failed an existing upward-cap-normal assertion; corrected
geometry, did not relax the assertion. Initial render also retained slab-like
ledges. Revised the shoulder construction, then reduced the overly dominant
mineral replacement observed in the next render.

Final relevant unit results: seven ground-composition checks (11.044s),
two outcrop checks (8.1s), nine unchanged surface-detail checks passed in the
initial selection. Added High/Low coherent-noise and tile-edge regressions.
Existing tests verify all rock vertices remain inside the collision hulls,
finite unit normals, upward caps, buried bases and route/site clearances.
Scoped lint and whitespace checks passed.

Final prepared High/Low browser preview passed (10.6s):
 /tmp/eidolon-ground-rock-final-0929

Two earlier bounded render iterations were used to inspect changes; no
campaign/raid soak or repeated deployment checks. Inspected final High rock
formation and Low shoulder. Slab slots are gone and paving contrast is lower;
the scene is still sparse, procedural and below the requested final visual
quality. No FPS or human play-feel conclusion. Grounding, targeting and
effect-placement browser assertions remain unchanged.

## Next

Review the complete town/woodland/dungeon composition with the real gameplay
camera and HUD: stronger focal points, forest silhouette and material response
remain important, along with the outstanding High performance gate. Avoid
endless micro-adjustments to one prepared clearing as a substitute for this
whole-route review. Audio integration is already in c61a5c09.
Owner-deferred 1.39/1.40 gate decision remains unassumed.
