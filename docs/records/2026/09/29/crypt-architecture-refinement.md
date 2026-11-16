# Verdant crypt architecture — September 29

Local continuation of 1b763541. No release identity change or deployment.

Opaque Verdant walls now have merged stone piers, plinths, cornices and blind
funerary arch frames instead of plain boxes. All detail stays inside the exact
original wall envelope: no new blocked walking space or misleading doors.
Foreground transparent cutaways keep simple boxes to avoid layered blending
over the player. Other dungeon styles retain their existing wall geometry.

The objective crown's large solid triangles are now compact outlined diamond
glyphs. Objective state, placement, animation and combat telegraphs are unchanged.

Cost: one merged geometry/material draw per existing wall mesh, not separate
draws for each stone. Detail adds triangles: measured 612 at width20, 3372 at
width120 and width500; bays are capped at12. This is not an FPS improvement
claim. Geometry remains cached by dimensions and uses existing materials.

Verification:
- Initial dungeon surface/interior batch: 41 passed (14.294s).
- Final crypt geometry/interior batch: 42 passed (15.991s), including exact
  bounds at five widths, finite vertices/unit normals, noncollapsed UVs, cached
  detail, simple cutaways and compact objective glyphs.
- Scoped lint and whitespace checks passed.
- Initial browser batch: 3 passed (11.1s), including canonical corridor joins,
  one floor/continuous mapping and desktop/phone prepared HUD views.
- Fixed the prepared presentation fixture to load the normal environment
  background before capture. Final desktop/phone renders: 2 passed (8.3s).
  Artifacts: /tmp/eidolon-crypt-architecture-final-0929.

Inspected the final desktop wall view: architecture is more articulated, but
the room remains sparse and visibly procedural. This is not modern-ARPG final
art approval, connected gameplay, a dungeon clear, real-device acceptance or
a performance result. Reuse prior connected route evidence for unchanged
navigation; no campaign soak was run.

Next substantive priorities remain cohesive town paving/roadside composition,
richer environmental storytelling and responsive combat/gear presentation.
The wider ordered roadmap and High performance gate remain open.
