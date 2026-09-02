# Procedural Art Migration Inventory

Audit date: September 2, 2026

Migration baseline: `Alpha 0.40.0.1`

First procedural-art release: `Alpha 0.41.0.0`

Current migration release: `Alpha 0.41.0.13`

This inventory is the migration ledger for the complete Eidolon dark-fantasy redesign. A category is only marked migrated after its production runtime reference, visual coverage, lifecycle behavior, and representative browser evidence pass. The legacy counts are maximums enforced by `tests/ProceduralArtMigrationGuard.test.js`; they may decrease but cannot increase.

## Legacy dependency baseline

| Dependency | Audited baseline | Release rule |
| --- | ---: | --- |
| Authored GLB models | 106 baseline; 11 current | Count may only decrease from 11 |
| Authored GLB payload | 814,551,864 baseline; 247,179,476 bytes current | Payload may only decrease from 247,179,476 bytes |
| Runtime `.glb` tokens | 225 baseline; 29 current | Token count may only decrease from 29 |
| Runtime files containing `.glb` | 5 | No new referencing module is permitted |
| PNG images | 100 files | Audit and replace by use, not file extension alone |
| SVG gem icons | 49 files | Existing generated vector family; retain or restyle intentionally |

Current legacy runtime references are confined to `MeshCatalog`, `MeshFactory`, `WorldGenerator`, the asset revision manifest, and the static server MIME table. The MIME entry is not an asset dependency but remains inside the guarded surface until final removal.

## Gameplay visual surfaces

| Surface | Current audited scope | Migration state |
| --- | --- | --- |
| Classes | Fighter, Rogue, Wizard, Cleric | All four are code-native: Fighter 0.41.0.1, Rogue 0.41.0.3, Wizard 0.41.0.4, Cleric 0.41.0.5; no player class retains an authored model dependency |
| Class abilities | 52 canonical selectable abilities and 60 rune variants | Authoritative-radius audit complete; full dark-fantasy effect restyle pending |
| Equipment | 36 base families across 14 rendered positions and 18 attachment regions | Descriptor, attachment, local/remote replication, and metadata persistence shipped in 0.41.0.2; proportion-specific fitting and galleries now cover Fighter, Rogue, Wizard, and Cleric |
| Inventory-only types | material, relic, gem | Presentation audit pending; must not be treated as equipment |
| Active world hazards | 19 lava pools, 12 sandstorms, 15 lightning zones, 19 wind gusts | Exact-radius themed boundaries migrated in 0.41.0.0 |
| Overworld areas | Gloamwood Marches, Lanternhold, Moonfrost Expanse, Cinder Wastes, Stormcrown Reach | Theme manifest, lighting/atmosphere foundation, and nine-family realm foliage migrated; terrain and remaining structures pending |
| Dungeons | Thorncrypt, Furnace Below, Shattered Aerie, Drowned Sanctum | Theme manifest complete; room geometry, props, mechanics, and lighting migration pending |
| Actors | players, remote players, NPCs, summons, legacy enemies, procedural realm enemies and bosses | All players, four Lanternhold services, the Avenging Seraph, Gloamwood/Cinder/Moonfrost overworld families, and all four Thorncrypt bosses are code-native; remaining enemy and boss routes use the earlier procedural-spec system and await their bespoke style pass |
| World objects | trees, town buildings, camps, dungeon facades, services, chests, portals, blockers | All realm foliage and services migrated; town buildings, camps, dungeon facades, and legacy chests pending |
| Networked effects | projectiles, traps, persistent zones, auras, statuses, combat feedback | Gameplay contract audit exists; art migration and lifecycle gallery expansion pending |

## Region and hazard identity

| Area | Production identity | Required mechanic audit |
| --- | --- | --- |
| Earth realm | Gloamwood Marches | Gravewind sandstorms, quest routes, early enemies, town approach |
| Town | Lanternhold | Safe navigation, quest giver, vendor, forge, stash, trading house, portals |
| Water realm | Moonfrost Expanse | Conduction fields, ranged silhouettes, ice/water terrain readability |
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

## Fighter vertical slice

`Alpha 0.41.0.1` removes all five Fighter GLBs from the production preload catalog and factory path. The Lanternhold oathguard is a 48-part code-generated actor with reusable geometry/material caches, independent per-actor transform pivots, generated Idle/Walk/Run/Attack/Death clips, and 18 named attachment points covering every equipment region. Pool reuse resets the complete rest pose, while selection hitboxes, nameplates, and party rings consume declared procedural bounds. The superseded authored files left the production tree in 0.41.0.5 after all four class migrations passed; Git history retains them as rollback references.

The vertical slice established the attachment contract and default main/off-hand presentation. `Alpha 0.41.0.2` completes the next Fighter equipment gate: all 36 equippable base families resolve through strict descriptors; all 14 rendered positions occupy the rig's 18 attachment regions; material, rarity, tier, potency, socket, gem, set, and unique-effect identity is layered procedurally; and both local and remote equipment react to stationary swaps and final-slot removal. Binary replication and database conversions preserve complete special-item metadata through equipment, inventory, stash, buyback, and auctions. The gallery audits every family and a coherent full loadout at High and Low quality. Releases 0.41.0.3–0.41.0.5 add complete proportion-specific fitting and galleries for Rogue, Wizard, and Cleric.

## Rogue shadeblade

`Alpha 0.41.0.3` removes all five Rogue GLBs from the production catalog, startup preload, and mesh factory. The Gloamreach shadeblade is a code-native, forward-weighted actor with a masked faceted hood, asymmetrical hooked shoulder, strapped leather jerkin, venom vial, wrist blades, split cloak, and paired fang daggers. A dedicated scanning Idle, prowling Walk, low Run, two-handed Attack, and folding Death motion set drives the same authoritative animation states used by local and remote actors. Explicit 4.25-unit bounds preserve selection and pooling without inheriting assumptions from the old scaled model.

The Rogue implements the full 18-anchor attachment contract. All 36 equipment families and every one of the 14 equipped positions fit the narrower rig, replace the default silhouette cleanly, keep face and eye identity where headwear permits, and reuse the existing item-identity layers. Unit coverage proves finite transforms, independent poses, shared cached resources, complete slot fitting, and removal of Rogue runtime model requests; the system-Chrome gallery captures every core state and a complete local/remote loadout at representative quality settings.

## Wizard hexweaver

`Alpha 0.41.0.4` removes all five Wizard GLBs from the production catalog, startup preload, and mesh factory. The Stormcrown hexweaver is a 51-part code-native caster with a tall rear-weighted silhouette, seven-sided cowl, split rune robes, asymmetric slate mantle, silver high collar, stormstaff, and independently hovering astrolabe. A contemplative Idle, measured Walk, robe-swept Run, two-handed focus-cast Attack, and unraveling Death motion set drive the same authoritative local and remote animation states. Explicit grounded 4.55-unit bounds keep selection, pooling, and party highlighting aligned with the visible form.

The Wizard implements the complete 18-anchor equipment contract with proportion-specific fitting across all 36 families and 14 equipped positions. Main- and off-hand equipment replace the stormstaff and astrolabe without leaving duplicate implements, and removing the final item restores the intentional class silhouette. Unit and system-Chrome coverage exercise cached immutable resources, actor-owned focus motion, pose reset, finite transforms, every animation at High/Low quality, and complete local/replicated loadouts.

## Cleric gravepriest

`Alpha 0.41.0.5` replaces the final authored player-class path. The Lanternhold gravepriest is a 61-part code-native sacred caster with an upright, bell-shaped burial silhouette, iron reliquary cuirass, ivory stole, bronze votive armor, broken-sun crown, oathmace, and independently swinging green-flame censer. Prayerful Idle, processional Walk, driven Run, mace-and-censer Attack, and kneeling Death clips give the support class physical weight while preserving the same authoritative local and remote animation-state contract. Exact grounded 4.55-unit bounds keep its interaction volume aligned through pooling.

The Cleric implements all 18 equipment anchors and class-specific fitting for every one of the 36 equipment families and 14 equipped positions. Equipping either hand cleanly replaces the sacred default tools and clearing the final item restores them. Unit tests cover geometry caching, independent poses, resets, finite transforms, every item family, and loader bypass; hardware Chrome covers every state and complete local/replicated loadouts at High and Low quality. With all four replacements proven, 20 superseded class GLBs totaling roughly 78 MB were removed from the production tree and remain recoverable through Git history.

## Lanternhold service keepers

`Alpha 0.41.0.6` replaces the two remaining NPC model files with four role-specific generated service actors. The Dwarf Merchant is a low ironmonger with a braided beard, forge apron, ember coins, merchant pack, and rune hammer. The Quest Giver is a tall oathscribe framed by an open marked scroll, quill, and broken oath-sun. The Dungeon Guide is a hooded waywarden carrying a teal witchlight lantern, key ring, and map case. The Talent Master is an antler-crowned ash confessor with a mask, memory ledger, orbiting shards, and soul reliquary.

All four share a cached Lanternhold rig vocabulary while retaining independent transforms, subtle role-specific prop motion, pool reset, and explicit grounded bounds. Their entity types, quest and daily eligibility, vendor and sell-all behavior, dungeon routing, talent reset flow, positions, network identity, and persistence remain unchanged. Unit tests prove distinct identity pieces, finite animation, resource sharing, loader bypass, and single-owner hitboxes; system-Chrome galleries capture each service at High and Low quality. The two superseded NPC GLBs totaling 8,659,692 bytes were removed from production after those gates passed and remain recoverable through Git history.

## Avenging Seraph

`Alpha 0.41.0.7` replaces the Cleric's five-file summon set with a 68-part code-generated Lanternhold reliquary seraph. Its airborne sacred silhouette combines a blank burial mask, broken-sun halo, layered bone-and-bronze primaries, spectral inner feathers, reliquary breastplate, oath-spear, chained censer, and an exact ground binding seal. Dedicated hover, glide, driven flight, spear judgement, and folding collapse clips preserve the authoritative `Idle`, `Walk`, `Run`, `Attack`, and `Death` state contract for local and replicated actors.

The visual rig declares a complete 2.8-unit radial and 5.2-unit vertical selection bound while retaining the server's existing 1.5-unit combat radius. Health and Wisdom scaling, ownership, lifetime, targeting, damage, instance containment, cleanup, and replication remain mechanically unchanged. Unit tests prove bounds, identity pieces, all five animated states, independent pose ownership, shared cached resources, loader bypass, and pool-safe hitboxes. Hardware Chrome exercises every state and captures local and replicated summons at High and Low quality. The five superseded GLBs totaling 53,753,388 bytes were removed only after those gates passed and remain recoverable through Git history.

## Gloamwood gravebound and Cinder Wastes ash legion

`Alpha 0.41.0.8` replaces the fifteen authored files behind the three earliest hostile families. Gloamwood Skeletons become 51-piece ossuary pilgrims: articulated bone, a moss-dark burial shroud, grave candle, captive soul lantern, and brass gravesickle create a readable wandering-dead silhouette without borrowing a player rig. Cinder Wastes Demon Orcs become 55-piece kiln-warriors built around a broad furnace cuirass, horned iron mask, ember rifts, cinder cleaver, and chained coal. Imps become 53-piece ember-scavengers with beating coal hearts, long horns, dark articulated wings, spaded tails, claws, and pilfer-forks.

Each family has independent, code-generated `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` motion tailored to its weight and anatomy. The visual rigs declare grounded full-silhouette selection bounds while retaining the established 1.25-unit Skeleton, 2-unit Demon Orc, and 1-unit Imp combat collision radii. Spawn rules, targeting, sight and attack range, movement authority, health, damage, loot, XP, quest credit, elite scaling, death, respawn, persistence, and replication remain on the existing gameplay paths. Unit tests cover grounded bounds, finite transforms in all states, semantic weapon motion, independent poses, cached resources, exact hitbox ownership, explicit catalog routing, loader bypass, and pool safety. Hardware Chrome renders every state, local/replicated instances, and High/Low settings. The fifteen superseded GLBs totaling 73,349,516 bytes were removed after those checks and remain recoverable through Git history.

`Alpha 0.41.0.9` completes the two larger overworld families in those regions. Gloamwood Constructs become grave-reliquaries assembled from cairn stone, old roots, moss, funeral brass, a caged soul, tolling maul, and hanging grave bell. Cinder Wastes Inferno Titans become crucible giants whose black basalt mass is broken by a white-hot furnace cage, shoulder vents, molten crown, caldera cleaver, and chained ash censer. These silhouettes extend the gravebound and ash-legion material languages without scaling or recoloring either starter creature.

Separate heavy-motion sets preserve all five network animation states and stable final death poses. Full generated interaction bounds follow each visible silhouette while the established 2.5-unit Construct and 1-unit Inferno Titan combat radii remain exact—even though the Titan's visible and selectable body is intentionally much larger. Spawn sectors, quest credit, targeting, combat, loot, XP, elite state, respawn, persistence, and replication remain unchanged. Unit and hardware-browser coverage verifies finite motion, semantic implements, shared cached resources, actor-owned pose, loader bypass, pooling, local/remote rendering, and High/Low presentation. The ten superseded GLBs totaled 43,375,224 bytes and remain recoverable through Git history after removal.

## Moonfrost rimebound, drowned cairns, choir, and pale vigil

`Alpha 0.41.0.11` replaces Moonfrost's twenty authored enemy files with four distinct code-native rigs. Mountain Trolls are broad rimebacks defined by fur mantles, jagged ice ridges, tusks, cairn clubs, and aurora charms. Aqua Golems are barnacled drowned cairns with water drips, a caged tide soul, and grave-anchor. Sirens become narrow floating choir-dead with split shrouds, exposed bone strings, voice chimes, spectral notes, talons, crown spines, and crescent blades. Frost Guardians are the armored pale vigil: aurora hearts, broken halos, horned visors, bells, and ice polearms establish a ceremonial silhouette separate from the golem.

Each family owns an intentional `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` motion set while sharing only immutable cached geometry and regional materials. Explicit grounded full-silhouette bounds preserve selection, reset, and pool ownership without changing the common 1.25-unit combat radius. The four overworld level bands and spawn sectors, water-dungeon trash routes, daily quests, movement speeds, pursuit, attacks, health, damage, drops, XP, elite state, death, respawn, and replication stay on their existing gameplay paths. Unit coverage and hardware Chrome exercise all states, local/replicated instances, High/Low settings, loader bypass, exact interaction bounds, and cache/pose isolation. The twenty superseded GLBs totaled 152,037,740 bytes and remain recoverable through Git history after removal.

## Thorncrypt rootbound procession

`Alpha 0.41.0.12` replaces the twenty authored files behind the Verdant Bastion's four sequential bosses. The Rootbound Warden is an ossuary gate given legs, crowned in roots and funerary ivy around a grave maul. The Briar Matron wears a rotating sepulchre of dead petals, a thorn halo, and ritual sickle. The Rustbound Colossus becomes a marching bronze reliquary with procession slabs, pipes, rivets, and a witchlit great hammer. The Hollow Sentinel closes the crypt as an empty ribbed vigil wrapped around one last green light, trailing torn standards behind a long poleblade.

Each boss owns generated `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` performances with grounded construction origins, actor-owned transforms, immutable shared render resources, and full-silhouette interaction bounds. Their distinct 2, 1.5, 3, and 2.5-unit combat radii remain exact, as does the Rootbound Warden's accelerated hit-alignment rule. Dungeon order, room generation, scaling, health, damage, pursuit, rewards, daily-quest credit, death, cleanup, and replication do not move. A separate sync audit removes Guardian Roar's obsolete seven-enemy client allowlist: future and current enemies now default to hostile while player classes, the Avenging Seraph, and service NPCs retain friendly treatment. The twenty removed GLBs totaled 95,083,316 bytes and remain recoverable through Git history.

## Four-realm wilds

`Alpha 0.41.0.13` replaces the last three authored plant files with nine distinct code-generated foliage families. Gloamwood keeps its existing navigational role through pale ossuary birch, black grave pine, and lantern-bearing mourning willow. Moonfrost gains rime pine and drowned silver willow; Cinder Wastes gains ember-lit corpsewood and magma-hearted basalt briars; Stormcrown gains wind-bent gale cypress and captive storm crystals. Each silhouette uses its realm's dark material vocabulary and a small magical identity accent rather than a generic recolor.

The world places 840 deterministic foliage instances through reusable per-part instancing, ten cached geometries, and twenty-eight cached materials. Town walls, all four dungeon entrances, cardinal travel roads, gateway sightlines, and the exact coordinates and radii of all 65 permanent server hazards receive explicit clearings; the hazard contract is compared directly with the Go source and adds an eight-unit visual apron. Only Gloamwood retains foliage collision, preserving prior navigation while new realm dressing stays visual-only. Foliage now appears immediately instead of waiting behind remaining building downloads, and a hardware-Chrome gallery inspects every production family. The release matrix's bounded waypoint protection also becomes server state separate from short gameplay invulnerability, preventing Wizard Teleport Phase and other class effects from shortening the inspection window or stranding a retry behind a death overlay. The three removed GLBs totaled 59,929,820 bytes and remain recoverable through Git history.
