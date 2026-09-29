# Lanternhold gathering court — September 29

## Casino exterior integration

Follow-up afteradc2c6d3. The casino's old upper glazing sat atz7.82 behind
the front wall'sz8.25 face, leaving most of the building blank. The exterior
now has20 recessed arched windows across the front and both sides, limestone
surrounds/sills/supports, restrained amber panes and narrow glazing bars. A
rose window and solid overdoor wall prevent the old shell's upper interior
from showing above the sign. A long hipped ridge replaces the roof's single
point, preserving its eaves/peak bounds. Existing town placement, five wall
colliders, five-unit opening, door target, cutaway and shared interior remain.
Ground-level front relief stays within the old pilaster'sz8.475 envelope.

Verification: final16 casino controller/navigation checks passed2.212s,
including real post-batch raycasts at all20 panes, visible supports/jambs,
overdoor closure, outward roof normals, old roof bounds and unchanged door
hover/click admission. The first added roof-normal assertion accidentally
included vertical wall-top vertices; restricted it to the roof's slate batch,
retaining the outward-normal requirement. Scoped lint/diff checks passed.

Two browser cases passed19.9s, each visiting court, market, smithy and entrance
at normal zoom. Final High desktop and Low phone entrance images inspected:
`/tmp/eidolon-casino-facade-final-0929`. Baseline entrance images are in
`/tmp/eidolon-town-square-reviewed-0929`. These are production-renderer
presentation fixtures, not a connected casino session or real-device FPS test.

Cost: exterior cutaway5→7 material batches and416→7,210 triangles; total
structure14→16 batches, below the retained18-batch check. Shared stone/slate
maps remain; no extra dynamic lights. This is deliberately more constructed
geometry, not a claim that detail is free. The broad roof, repeated stonework,
sparse surroundings and procedural actors still need wider quality work.
Local candidate only; ordered release gates and final art acceptance stay open.

## Normal-scale review: replace the oversized radial platform

Follow-up after67c7e248. The earlier radial courses still read as a giant
target-like platform in the connected desktop capture. Replaced them with
1–2m staggered flagstones, worn/chipped corners, occasional repaired slabs,
small fractures, mineral variation and traffic wear. A small, non-emissive
Fourfold engraving crosses the joints; no large border rings. Rectangular
relaid paving blends into the existing connected court mask rather than a
pale circular disk. All gameplay geometry, open gathering space, routes,
texture dimensions and ground draw count remain unchanged.

The casino's oversized always-on-top billboard becomes a facade plaque above
the unchanged door. Its two-line Lanternhold / Casino lettering is larger
within the smaller sign, which uses ordinary depth testing. Same sign mesh
name, clickable door, hover title/prompt and independent door material.

The browser fixture omitted the runtime's player-following shadow update.
Corrected the fixture before the comparison baseline; this is not a shipped
lighting fix. The final fixture also asserts initial shadow focus and visits
the casino approach at normal zoom15 alongside court/market/smithy views.

Verification: five map/material checks passed25.711s (physical High/Low
registration, boundary alpha, unit normals/roughness, small joint courses,
unchanged shader/depth/ownership). Final14 casino controller/door tests passed
1.658s; scoped lint and whitespace checks passed. Final two High desktop/Low
phone browser cases passed16.8s, covering four town positions each. Reviewed
the court and entrance captures. The first narrow one-line facade lettering
was too small; the final two-line design keeps the place name and emphasizes
Casino. No FPS or connected gameplay claim from these presentation fixtures.

Comparison baseline: `/tmp/eidolon-town-flagstones-focused-before-0929`.
Final: `/tmp/eidolon-town-square-reviewed-0929`. The unfocused earlier baseline
is not used for the lighting comparison. Paving texture dimensions and ground
draw count remain unchanged; the sign canvas is640×180 rather than768×112.

Remaining: broad flat ground, sparse inhabited edges and procedural actors
still limit the town. This is not final modern-ARPG approval or a live release.
Next composition work should address the occupied edges and approach framing,
not keep repainting this square. No full campaign soak or new CI queue.

## Earlier radial implementation — superseded above

Local continuation after a072d68b. Runtime stays1.38.0; no deployment or
release identity change. Full ordered roadmap remains active.

The central gathering square now uses authored-in-code radial stone courses
with varied slab tones, uneven worn joints, sparse fractures, one outer
limestone border and a small fourfold centre inlay. Existing cobbled service
routes and earthen verges remain. The first preview was too target-like;
removed its inner dark ring, varied course widths and reduced joint contrast.

Implemented as two bounded maps on the existing opaque town ground material:
albedo/coverage and packed normal/roughness. No extra mesh, draw, collider,
raised floor, emissive decoration, reward or navigation rule. High uses two
512px maps (2MiB base RGBA storage); Low two256px maps (512KiB), before mipmaps.
Physical pattern and derivative sampling retain scale across quality.
Material disposal frees both owned maps once; shared albedo ownership unchanged.

Verification:
- Four focused unit tests passed13.892s: map bounds/transparent outer edges,
  physical registration across quality, finite unit normals, roughness range,
  shader wiring and owned/shared texture disposal.
- Scoped lint and whitespace checks passed.
- Final prepared desktop1280×900/High and phone390×844/Low HUD views, plus
  existing town masonry depth checks: three browser tests passed15.4s.
  Artifacts: /tmp/eidolon-town-court-final-0929.
- Initial depth test failed its brightness assertion, not its covered/uncovered
  equality. Its render target was reading linear bytes against a display
  brightness threshold. Set its target to sRGB; preserved both assertions and
  the same sampling positions/zooms. The visible well paving was inspected.
- Final desktop and phone court screenshots inspected. These use the real
  renderer, buildings and normal zoom15 but prepared actors, not connected
  gameplay. No campaign run, FPS improvement or real-phone acceptance claim.

The square has a distinct readable identity, but its broad flat footprint and
procedural character remain obvious. It is not final Diablo/PoE-level approval.
Next priority: composition around routes/building edges and environmental
storytelling, plus combat/equipment quality, not further tiny stone tweaks.
High performance gate and pending1.39/1.40 release decision remain open.
