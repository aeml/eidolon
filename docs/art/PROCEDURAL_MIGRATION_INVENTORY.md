# Procedural Art Migration Inventory

Audit date: September 2, 2026

Migration baseline: `Alpha 0.40.0.1`

First procedural-art release: `Alpha 0.41.0.0`

This inventory is the migration ledger for the complete Eidolon dark-fantasy redesign. A category is only marked migrated after its production runtime reference, visual coverage, lifecycle behavior, and representative browser evidence pass. The legacy counts are maximums enforced by `tests/ProceduralArtMigrationGuard.test.js`; they may decrease but cannot increase.

## Legacy dependency baseline

| Dependency | Audited baseline | Release rule |
| --- | ---: | --- |
| Authored GLB models | 106 files | Count may only decrease |
| Authored GLB payload | 814,551,864 bytes | Payload may only decrease |
| Runtime `.glb` tokens | 225 | Token count may only decrease |
| Runtime files containing `.glb` | 5 | No new referencing module is permitted |
| PNG images | 100 files | Audit and replace by use, not file extension alone |
| SVG gem icons | 49 files | Existing generated vector family; retain or restyle intentionally |

Current legacy runtime references are confined to `MeshCatalog`, `MeshFactory`, `WorldGenerator`, the asset revision manifest, and the static server MIME table. The MIME entry is not an asset dependency but remains inside the guarded surface until final removal.

## Gameplay visual surfaces

| Surface | Current audited scope | Migration state |
| --- | --- | --- |
| Classes | Fighter, Rogue, Wizard, Cleric | Legacy GLB rigs; scheduled for shared procedural humanoid rig |
| Class abilities | 52 canonical selectable abilities and 60 rune variants | Authoritative-radius audit complete; full dark-fantasy effect restyle pending |
| Equipment | head, shoulders, chest, gloves, belt, legs, feet, neck, ring, trinket, main hand, off hand | Schema audited; item-family descriptors and attachments pending |
| Inventory-only types | material, relic, gem | Presentation audit pending; must not be treated as equipment |
| Active world hazards | 19 lava pools, 12 sandstorms, 15 lightning zones, 19 wind gusts | Exact-radius themed boundaries migrated in 0.41.0.0 |
| Overworld areas | Gloamwood Marches, Lanternhold, Moonfrost Expanse, Cinder Wastes, Stormcrown Reach | Theme manifest and lighting/atmosphere foundation migrated; geometry and dressing pending |
| Dungeons | Thorncrypt, Furnace Below, Shattered Aerie, Drowned Sanctum | Theme manifest complete; room geometry, props, mechanics, and lighting migration pending |
| Actors | players, remote players, NPCs, summons, early legacy enemies, procedural realm enemies and bosses | Existing procedural enemy foothold audited; remaining actor families pending |
| World objects | trees, town buildings, camps, dungeon facades, services, chests, portals, blockers | Legacy dependencies audited; procedural replacements pending |
| Networked effects | projectiles, traps, persistent zones, auras, statuses, combat feedback | Gameplay contract audit exists; art migration and lifecycle gallery expansion pending |

## Region and hazard identity

| Area | Production identity | Required mechanic audit |
| --- | --- | --- |
| Earth realm | Gloamwood Marches | Gravewind sandstorms, quest routes, early enemies, town approach |
| Town | Lanternhold | Safe navigation, quest giver, vendor, forge, stash, trading house, portals |
| Water realm | Moonfrost Expanse | Conduction fields, ranged silhouettes, ice/water terrain readability |
| Fire realm | Cinder Wastes | Cinder Maw lava pools, ember atmosphere, safe-path contrast |
| Air realm | Stormcrown Reach | Directional wind shear, high-speed readability, storm atmosphere |
| Verdant Bastion | Thorncrypt | Room transitions, encounter telegraphs, reward and boss rooms |
| Molten Core | Furnace Below | Lava/forge language, encounter zones, safe-floor contrast |
| Tempest Spire | Shattered Aerie | Lightning and wind language, room edges, encounter timing |
| Abyssal Well | Drowned Sanctum | Water/abyss language, movement surfaces, encounter timing |

The 0.41.0.0 hazard pass verifies every active overworld hazard entity broadcasts its gameplay radius through `Entity.Scale`, renders a persistent semantic boundary with that exact radius, and has a distinct warning/active language. Dungeon attacks, traps, scripted damage, rogue traps, persistent player zones, projectiles, death cleanup, reconnect restoration, and room unload/reload remain explicit later audit gates; they are not implied complete by the overworld pass.

## Migration order

1. Foundations, region themes, exact world-hazard language, galleries, and legacy-dependency ratchet.
2. Shared procedural humanoid rig plus a complete Fighter vertical slice.
3. All equipment slots, item-family descriptors, local/remote attachment replication, and item galleries.
4. Rogue, Wizard, and Cleric silhouettes, animations, equipment fit, summons, and class effects.
5. NPCs, early legacy enemies, bosses, services, interactables, and remaining actor families.
6. Town and overworld geometry, foliage, props, terrain dressing, portals, and transitions.
7. All four dungeon room families, mechanics, hazards, bosses, and transitions.
8. Full ability/effect restyle, UI/icon consistency pass, legacy runtime cutover, payload removal, and production-wide final QA.

Each stage must leave the live game playable, preserve authoritative gameplay and player data, and ship only after its relevant unit, server, browser, gallery, performance, and production checks pass.
