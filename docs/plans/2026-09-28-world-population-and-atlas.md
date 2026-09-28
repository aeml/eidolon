# World population and atlas delivery contract

Requested September 28, 2026. Required scope under the
[1.11–1.99 roadmap](2026-09-28-alpha1-11-to1-99-release-roadmap.md), not a separate
optional art project. Current status: first pass in progress. The1.14 atlas is
accepted live;1.15 Lanternhold/Earth and1.16 Water/Fire population are accepted
live.1.17 Air/Dark Realm population is also accepted live atfbc3929a;
1.18 local equipment/ground/material and minimap integration checks are complete.
See version receipts for exact evidence. These early passes do not approve final
modern-art quality or the full B1 gate.

## Outcome

Replace long stretches of undifferentiated terrain with a deliberately composed,
inhabited dark-fantasy world. Players should recognize where they are, see where
they can travel, encounter reasons to explore, and use a map that describes the
actual game. More repeated trees, higher enemy counts or colorful map rectangles
alone do not satisfy this requirement.

The user supplies actor models only. Environment geometry, scenery, materials,
lighting, interaction implementation, map artwork and integration remain our work.
Use original Eidolon art and lore; Diablo/PoE are quality references, not assets
or layouts to copy. Preserve existing characters, quests, earned discoveries,
instance IDs, progression rules and gameplay authority.

## Starting inventory: preserve before extending

- `src/world/WorldGenerator.js` and procedural architecture/foliage already build
  world scenery. Recent Lanternhold materials and birch leaves are local only;
  the comparison scene is not an accepted populated-world implementation.
- `src/data/chronicleInvestigationSites.json` already defines two investigations
  per elemental realm. Give them surroundings, approach routes and map context;
  do not reset or duplicate their saved objectives.
- The Dark Realm already has districts, discoveries and residents. Reconcile
  that content before adding more; do not advertise existing content as new.
- `src/ui/WorldMap.js` already supports pan/zoom, touch gestures, town services,
  party markers and dungeon progress, and delegates Dark Realm rendering to
  `DarkRealmMap.js`. `Minimap.js` shares town-service data. Preserve these paths.
- Map backgrounds, boundaries, level strips and several labels still live in
  independent static tables. Audit them against world/server/content definitions;
  differing art-theme names and location names require intentional reconciliation,
  not a blind global rename.

## 1. Location/content manifest

Create a validated, stable-ID world-location registry shared by world placement,
map/minimap, quest directions and discovery presentation where appropriate.
Use generated client/server projections when runtime sharing is not possible;
never make the browser authoritative for eligibility, rewards or collisions.

Each meaningful location records realm/instance, canonical name, position and
footprint, category, purpose/lore, visual recipe, approach/exit, interaction,
existing quest/discovery references, map visibility/unlock policy, collision and
hazard clearances, content owner, intended milestone and acceptance status.
Distinguish decorative scenery from actual usable services and encounters.
Validate references, bounds, duplicate IDs and mismatched coordinates in CI.

Inventory and visually inspect every existing environment family: Lanternhold,
four elemental realms, border passages, dungeon entrances/interiors, crystal
raids, Dark Realm districts/Nexus/court, both casino floors, and existing PvP
maps/lobbies. Link existing evidence; do not unnecessarily rebuild finished rooms.

## 2. World population requirements

### Composition and navigation

- Connected roads/trails, worn approaches, signs, gateways and recognizable
  landmarks lead from town to story sites, realm passages and dungeon entrances.
  Bridges/stairs only where both rendering and authoritative traversal support
  them; no painted route through a wall, unreachable ledge or lethal shortcut.
- Break repetition with terrain/material transitions, rock formations, varied
  woodland edges, clearings, embankments, ruins, fences, debris and small props.
  Avoid covering the ground uniformly or hiding enemies in foreground clutter.
- Compose near/middle/distant silhouettes at the actual camera angle. Reserve
  readable combat spaces, loot visibility, accessible interaction radii, portal
  landings, town-service approaches and existing hazard/spawn clearances.
- Establish route-by-route density: each named travel segment needs readable
  orientation and a purposeful vista, landmark or activity. Record empty/repetitive
  stretches in normal travel reviews; do not mandate an arbitrary prop every N meters.

### Meaningful places and life

- Lanternhold: distinct service courtyards, paths, market/workshop dressing,
  inhabited corners, resting/social spaces, signs and the resonance-portal plaza.
  Add ambient residents/idle activity without duplicating named functional NPCs.
- Each elemental realm: at least **eight distinct named points of interest** by
  B1, including at least two major visual landmarks, its two existing story
  investigation sites, two inhabited/abandoned camps or structures, and two
  optional interactive discoveries/activities. A location counts once toward
  eight even if it serves multiple roles. Existing qualifying sites count after
  inspection; scattered props and renamed duplicate camps do not.
- Earth: ruined woodland settlements, pilgrim/grave roads, broken shrines,
  forestry remnants and crystal-root disturbances.
- Water: drowned moorings, frost shelters, exposed bells, ice formations,
  wreckage and altered tides; readable traversable shoreline versus hazards.
- Fire: abandoned kilns, ash settlements, mining/forge remnants, cooled flows
  and command scars; safe crossings clearly distinct from active lava.
- Air: observatories, wind shrines, storm anchors, weatherkeeper remnants and
  exposed heights; no visual implication of unsupported vertical traversal.
- Dark Realm: inspect every existing district and connect its camps, witnesses,
  discoveries, Nexus approach and royal court through distinctive streets,
  occupation remnants and evidence of Malachar's interference. Reuse the existing
  discoveries and expedition; quality and placement matter more than another count.
- Dungeon/raid rooms: environmental purpose, entrance/exit identity, optional
  lore/rest corners where valid, and the repaired-crystal visual aftermath.
  Dressing must not obscure boss telegraphs, door triggers or checkpoints.

### Interaction and rewards

- Optional readable lore, inspectable objects, small local encounters, caches
  or existing-event hooks give selected locations a reason to visit. Noninteractive
  props must not advertise quest/service affordances.
- At least two optional interactive sites in each elemental realm must work
  end to end before B1, not merely display a placeholder prompt. Reuse existing
  discovery/quest/event systems where possible instead of building a new framework.
- Any reward is server-authorized, bounded, replay-safe and compatible with party
  credit, reconnect and save persistence. No repeat-inspect Gold/XP farm.
- Optional exploration is not extra mandatory campaign grind. Preserve the
  approximately 112-hour target and do not inflate drops/XP merely to populate
  scenery. No EP-to-power rewards or monetization expansion.
- Ambient particles, wildlife/idle residents and sound reinforce realm identity.
  Cap their density/cost; keep hostile/neutral distinctions and essential sounds clear.

## 3. World map / minimap overhaul

- Replace debug-like rectangles as the dominant presentation with original
  dark-fantasy cartography: terrain, coast/ice/lava edges, roads, passages, forests,
  settlements and landmarks derived from real world data. Decorative artwork
  must not invent traversable geography. Maintain contrast and readable labels.
- World overview, regional detail, town, Dark Realm and current dungeon/raid
  views share a consistent visual language and retain instance separation.
  Casino floor views and PvP views must identify the correct current space.
- Canonical names, danger/level guidance, dungeon/raid entry requirements,
  safe-zone extents, discovered sites and portal states agree with actual rules.
  Clearly distinguish the entrance from the instance's interior or crystal site.
- Legend and filters for services, quests, discoveries, entrances, events and
  party; icon shapes as well as color. Cluster/cull labels by zoom and priority.
- Tracked quest destinations/areas, available versus ready-to-turn-in states,
  player/facing, visible eligible party members and reconnect-safe marker updates.
  Never leak hidden enemies, private instances or undiscovered story spoilers.
- Search known locations; select a marker for its name, purpose, availability,
  unmet requirements and directions. Add a personal waypoint with an offscreen
  direction/distance cue and clear/remove control. This is guidance, not automatic
  movement or a new teleport entitlement. Party-shared pings belong to 1.53.
- Preserve known/discovered state per character where saved. Unknown optional
  discoveries can stay hidden; do not erase known essential services/entrances or
  introduce punitive map fog that makes existing quests unusable.
- Mouse drag/wheel, keyboard navigation/close and touch pan/pinch/tap all work.
  Readable text and touch targets at normal phone scale; accessible DOM controls
  and an equivalent location list for essential canvas-only information.
- Map gestures never issue attacks/movement underneath. Minimap and atlas agree
  on axes, coordinates, icons, instance, waypoint and applicable visibility rules.
  Updating markers should not regenerate the whole terrain artwork every frame.

## 4. Delivery schedule and acceptance

| Version | Required contribution |
| --- | --- |
| 1.11 | Inventory/gap register, canonical-location audit, per-realm placement plan, existing map baseline and representative populated-scene direction. Record actual gaps; no claim that a reference vignette fills the world. |
| 1.12 | Location-registry foundation, physical resonance plaza/portal and accurate map/quest entry references; retain existing fallback and eligibility. |
| 1.14 | Atlas first pass: geography/road data, readable cartography, legend/filters, marker detail/search and personal waypoint; integrate the milestone's feedback/reporting flow. |
| 1.15 | Lanternhold and Earth populated first pass, coherent story approaches and functional optional discoveries; map and onboarding tell the same story. |
| 1.16 | Water and Fire populated first passes; preserve existing investigations, account/reconnect and discovery continuity. |
| 1.17 | Air and Dark Realm populated first passes; distinctive dungeon/raid approaches, preparation and party meeting points. |
| 1.18 | Complete B1 location/content coverage, map/minimap/instance and supported-input integration; culling/LOD/resource budgets and normal gameplay review alongside actor/equipment visuals. |
| 1.20 | B1: all above first-pass world/atlas requirements usable and reviewed; disclose actual limitations. No empty marker-only locations counted as finished. |
| 1.22–1.30 | Region-by-region activity/lore/pacing refinement from player feedback, crystal-restoration consequences and endgame coherence. |
| 1.42 / 1.45–1.50 | Full environment art/map-interface refinement, accessibility, mobile, performance and lifecycle signoff. |
| 1.53 / 1.57 | Party pings/meeting guidance and existing world-event integration in the actual locations and map. |
| 1.80 / 1.98 | Content coverage freeze and final cross-check of promised locations, working interactions, map truth and known limitations. |

Use cheap structural tests for registry/world/map agreement, IDs, clearances,
unlock/instance visibility and persistence. Browser-check changed map controls,
normal-scale scenery/readability and essential touch layouts. Brief gameplay
routes confirm travel and interactions; do not replay the whole campaign.

Measure populated scenes, not only empty galleries. Set per-profile instance,
triangle, shader, shadow, particle, memory and frame/hitch budgets before acceptance;
include dense town/forest, combat and zone transitions. Use spatial batches,
culling/LOD, deterministic placement and quality fallbacks. The new birch canopy
cost is explicitly unaccepted at full-world scale. Never remove essential warnings
or restore misleading collisions to hit a benchmark.

Completion requires linked code/checks and scene/map comparisons, then deployed
version/commit, CI success and live smoke. Actor source delivery and owner-only
beta/launch decisions remain explicit dependencies, not invented approvals.
