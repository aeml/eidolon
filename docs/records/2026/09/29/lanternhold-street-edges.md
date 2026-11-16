# Lanternhold planted street edges — environment candidate

Local continuation after Forge commit e657d8cb, not a deployment or final art
acceptance. The previous goal turn restated priorities without changing code;
this continuation finishes the pending Forge work and adds visible town work.

Two low stone planting beds, plank/iron benches and framed amber lanterns now
edge the smithy/market approaches. Seeded fern/sedge foliage, coping joints,
recessed soil and physical lamp frames complement the existing architecture.
The central court stays open; NPCs, services, casino and stash do not move.
No new interactions, lights, animations, downloaded assets or texture maps.

Furniture attaches through production `WorldGenerator.loadBuildings`, including
staged multiplayer startup. Each assembly has separate planter and bench
solids; four new boxes are also generated into server admin-landing geometry.
High/Low have identical solids and structure; Low reduces leaf geometry.
Cost for both groups: 12 material batches, 4,708 High / 2,284 Low triangles,
six shared group-owned materials. These are geometry costs, not FPS evidence.

## Bounded evidence

- Corrected the existing town review to include replicated service meshes
  (Trading House, Forge, stash, daily NPC, vendor, talent/dungeon NPCs) before
  comparing density. Final views also include Ilyra's Wizard mesh. Prepared
  transforms match town locations; these are not connected players or NPC AI.
  The phone fixture now passes Low to the world generator as well as renderer.
- Before: `/tmp/eidolon-town-streets-baseline-0929`, two cases passed 16.0s.
- First after: two cases passed 18.4s. The separate route test caught the
  planter corner clipping the Forge approach; moved both assemblies 1m north.
- Final five street/courtyard tests passed 22.614s: production attachment,
  finite bounded geometry, matching quality footprints, blocked solid centres,
  unobstructed nine central service approaches for radius-1.25 characters,
  non-overlap with other static boxes, and existing courtyard motion/routes.
  Trading House/Forge/stash oriented colliders are included in the route test.
- Final desktop High / phone Low four-view cases passed 18.5s at normal zoom;
  output `/tmp/eidolon-town-streets-final-0929`. Smithy desktop and central
  phone captures inspected, alongside earlier desktop court/phone market.
- Scoped lint and generated geometry passed. Two focused server teleport
  checks passed (0.242s), including the planted bed/bench obstruction and
  existing elevated landing/durable-apply rules.

The square still needs a fuller connected art/combat review, and procedural
actors remain fallback art. This does not establish final modern-ARPG quality,
mobile performance, a completed 1.42 milestone or permission to bypass earlier
release gates. Keep subsequent work focused on meaningful connected scenes,
not repeated small adjustments to these two benches.
