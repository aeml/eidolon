# Procedural Art Migration Inventory

Audit date: September 3, 2026

Migration baseline: `Alpha 0.40.0.1`

First procedural-art release: `Alpha 0.41.0.0`

Current migration release: `Alpha 0.41.0.21`

This inventory is the migration ledger for the complete Eidolon dark-fantasy redesign. A category is only marked migrated after its production runtime reference, visual coverage, lifecycle behavior, and representative browser evidence pass. The legacy counts are maximums enforced by `tests/ProceduralArtMigrationGuard.test.js`; they may decrease but cannot increase.

## Legacy dependency baseline

| Dependency | Audited baseline | Release rule |
| --- | ---: | --- |
| Authored GLB models | 106 baseline; 0 current | Must remain exactly zero |
| Authored GLB payload | 814,551,864 baseline; 0 bytes current | Must remain exactly zero bytes |
| Runtime `.glb` tokens | 225 baseline; 1 current | Static MIME declaration only; no asset path may return |
| Runtime files containing `.glb` | 1 | Static server MIME table only |
| PNG images | 100 files | Audit and replace by use, not file extension alone |
| SVG gem icons | 49 files | Existing generated vector family; retain or restyle intentionally |

No authored model path remains in production code, manifests, preload lists, service-worker payloads, or the asset tree. The only runtime `.glb` token is the static server's content-type declaration, which is not an asset dependency and remains solely so stale compatibility requests receive the correct MIME type.

## Gameplay visual surfaces

| Surface | Current audited scope | Migration state |
| --- | --- | --- |
| Classes | Fighter, Rogue, Wizard, Cleric | All four are code-native: Fighter 0.41.0.1, Rogue 0.41.0.3, Wizard 0.41.0.4, Cleric 0.41.0.5; no player class retains an authored model dependency |
| Class abilities | 52 canonical selectable abilities and 60 rune variants | Authoritative-radius audit complete; full dark-fantasy effect restyle pending |
| Equipment | 36 base families across 14 rendered positions and 18 attachment regions | Descriptor, attachment, local/remote replication, and metadata persistence shipped in 0.41.0.2; proportion-specific fitting and galleries now cover Fighter, Rogue, Wizard, and Cleric |
| Inventory-only types | material, relic, gem | Presentation audit pending; must not be treated as equipment |
| Active world hazards | 19 lava pools, 12 sandstorms, 15 lightning zones, 19 wind gusts | Exact-radius themed boundaries migrated in 0.41.0.0 |
| Overworld areas | Gloamwood Marches, Lanternhold, Moonfrost Expanse, Cinder Wastes, Stormcrown Reach | Theme manifest, lighting/atmosphere foundation, nine-family realm foliage, and complete Lanternhold architecture migrated; realm terrain and remaining structures pending |
| Dungeons | Thorncrypt, Furnace Below, Shattered Aerie, Drowned Sanctum | Generated shells/atmosphere migrated in 0.41.0.17; server-driven objective, reward-seal, clear-state, return-portal, and exact boss-danger presentation migrated in 0.41.0.18; Furnace Below bosses migrated in 0.41.0.19, Shattered Aerie bosses in 0.41.0.20, and Drowned Sanctum bosses in 0.41.0.21; any future dungeon hazard families remain pending |
| Actors | players, remote players, NPCs, summons, legacy enemies, procedural realm enemies and bosses | All players, four Lanternhold services, the Avenging Seraph, Gloamwood/Cinder/Moonfrost overworld families, all four Thorncrypt bosses, and every current Molten Core, Tempest Spire, and Abyssal Well boss are bespoke code-native rigs; remaining overworld enemy routes use the earlier procedural-spec system and await their style pass |
| World objects | trees, town buildings, camps, dungeon facades, services, chests, portals, blockers | Realm foliage, Lanternhold architecture/services, overworld dungeon thresholds, room-role reliquaries/shrines, reward-state seals, and generated interior return portals migrated; any future authoritative room blockers remain pending |
| Networked effects | projectiles, traps, persistent zones, auras, statuses, combat feedback | Exact four-theme dungeon boss slam presentation migrated in 0.41.0.18; broader ability/effect art migration and lifecycle gallery expansion pending |

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

The 0.41.0.0 hazard pass verifies every active overworld hazard entity broadcasts its gameplay radius through `Entity.Scale`, renders a persistent semantic boundary with that exact radius, and has a distinct warning/active language. The 0.41.0.18 audit confirms the only current server-authored dungeon damage zone is the shared boss ground slam and gives its unchanged radius/duration four region-specific warning motifs. There are no separate active dungeon trap or floor-hazard entity families to imply migrated. Rogue traps, persistent player zones, projectiles, death cleanup, reconnect restoration, and room unload/reload remain explicit later audit gates.

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

## Coherent edge delivery

`Alpha 0.41.0.14` hardens the procedural migration against mixed-version CDN state discovered by the first live 0.41.0.13 gate. GitHub Pages emits the entry script, every local module edge, stylesheet import, and CSS resource with the exact release commit, and production QA opens that commit-qualified document only after both the release manifest and versioned runtime are visible. The asset cache advances to a fresh generation and service-worker updates bypass the HTTP cache.

Three 468-byte-total empty glTF migration bridges remain at the retired birch, pine, and willow URLs solely for already-cached pre-procedural clients. They contain no nodes, meshes, materials, authored geometry, collision, or new-runtime references, are excluded from authored-model totals, and are parsed in regression coverage through the production GLTFLoader. The active game remains entirely on the nine generated foliage families.

## Lanternhold architecture and service relics

`Alpha 0.41.0.15` replaces the seven authored models behind Lanternhold's skyline, outer camps, and object-scale services. The northern Oathhall layers old stone, black-oak framing, amber windows, buttresses, a broken-sun belfry, and slate vigil spire into the town's primary navigation silhouette. The Votive Market, Ashen Smithy, Gilded Compact auction hall, Oathfire Forge, and Wayfarer Reliquary each carry a role-specific shape and semantic detail language. Fifteen outer Pilgrim Vigils combine faceted tents, oathfires, bedrolls, split standards, and lanterns without borrowing a generic building shell.

The complete family uses ten cached geometries and fifteen cached materials across independently owned scene roots. The fifteen camp placements are deterministic while preserving the existing fifty-unit central exclusion and twenty-unit pair spacing. Generated architecture starts beside foliage instead of waiting for the four remaining dungeon facades. Every structure carries an explicit invisible interaction box measured from the production-scaled authored scene it replaces; placement, grounding, collision, service range, picking, and the campsite's narrow navigation collider remain on their prior gameplay contracts. Unit tests contain every visible piece inside those bounds, exercise the live `MeshFactory` routes without `GLTFLoader`, and validate shadow setup, stale-scene rejection, resource sharing, and placement stability. Hardware Chrome renders the seven-family settlement at High and Low quality while asserting zero authored-model requests.

The live settlement renderer collapses each landmark by material and presents all fifteen camp copies through nine instanced batches. That reduces the generated overworld town from 390 visible mesh submissions to 38 before its service entities while leaving the detailed unbatched gallery available for art inspection. A production-runner movement gate exposed the remaining consequence of a delayed render frame: a remote actor could extrapolate ahead, then visibly snap backward when the next authoritative sample arrived. The timestamped transform buffer now carries that overshoot into a bounded continuous correction, including the transition to idle, with deterministic regression coverage for the packet-recovery path.

The same two-account gate also exposed a separate attack-range mismatch: hostile left clicks reused the selected ability's cast range, so the client could play a Cleric or Fighter basic attack well outside the server's four-metre acceptance radius. Basic-attack click, chase, validation, and feedback now use the authoritative four-class table—four metres for Fighter and Cleric, sixteen for Rogue and Wizard—with the same large-attacker and large-target reach allowances used by the server. Ability targeting retains its independent per-skill ranges.

The seven removed GLBs totaled 176,749,884 bytes. Four dungeon-facade GLBs totaling 70,429,592 bytes are the only authored models left in the migration ledger; the three tiny empty plant compatibility bridges remain non-authored and non-runtime as documented above.

## Four procedural dungeon thresholds

`Alpha 0.41.0.16` replaces the final four authored models with distinct region-bound landmarks. The Verdant Bastion is a mossed fortress gate bound in grave roots, witchlight, funeral bronze, and a tall briar-antler crown. The Molten Core is an obsidian kiln with crucible pylons, chained horns, basalt fangs, and molten channels. The Tempest Spire is a narrow, asymmetric storm needle built from floating slate, silver conductors, captive arcs, and a bright sky-eye. The Abyssal Well is a low drowned altar whose black-water eye sits inside coral antlers, anchor-tentacles, moon pearls, and a reliquary arch.

Each root carries an invisible box with the exact production-scaled dimensions measured from its retired scene: Verdant 76.1312 × 61.4690 × 72.8712, Molten 76.2376 × 71.2317 × 75.8718, Tempest 44.4046 × 76.5481 × 48.1367, and Abyssal 76.4783 × 37.4995 × 52.1077. The established world coordinates, grounded origin, circular radius formula, `DungeonEntrance` tag, dungeon type, click target, hover hint, eligibility route, server-authoritative transition, and exit flow stay unchanged. Stale scene ownership is checked before the synchronous set is attached, preventing partial colliders during realm changes.

Eleven cached faceted geometries and twenty-five region-specific materials build 109 inspectable semantic pieces. Production merges each landmark by material into 34 total visible batches—eight or nine per threshold—while the dedicated browser gallery retains the detailed hierarchy for inspection. Unit coverage proves every ID, part family, exact bound, radius, position, resource cache, shadow rule, and loader bypass. Hardware Chrome renders all four together at High and Low quality and fails on any authored-model request.

The four removed GLBs totaled 70,429,592 bytes. That brings the original 106-file, 814,551,864-byte authored-model ledger to exactly zero. `MeshCatalog`, overworld creation, the asset manifest, optional download UI, and service-worker pack generation contain no authored-model route; the named core and dungeon packs complete immediately as built-in code. The three 468-byte-total empty plant compatibility bridges remain explicitly excluded because they contain no nodes, meshes, materials, authored geometry, collision, or production reference.

## Four named deep halls

`Alpha 0.41.0.17` replaces the single authored cobblestone presentation shared by all four dungeon layouts with a generated interior system. The Thorncrypt uses offset funerary blocks, moss, living grave-root seams, witchlight wards, and bronze vigils. The Furnace Below uses black-glass forge plates, branching molten fractures, crucible fangs, and ember seals. The Shattered Aerie uses staggered storm slate, silver conductors, captive sky nodes, and floating fragments. The Drowned Sanctum uses flooded basalt, black-water tide rings, coral antlers, moonlit fonts, and bioluminescent marks. The production dungeon methods no longer await or request either legacy cobblestone texture.

The same factory reads the server's established room metadata and gives `entry_gate`, `treasure_cache`, `restorative_shrine`, `ambush_chamber`, `boss_approach`, `elite_guard`, `boss_lair`, and `route_hall` distinct visual layouts. These props are explicitly visual-only: room and corridor dimensions, forty-unit door openings, fifteen-unit walls, collision boxes, canonical walk rectangles, combat, reward triggers, and room progression remain unchanged. Repeated surface resources are cached per generated instance, detail geometry is merged by material/shadow behavior, and transition disposal deduplicates shared geometry, materials, and procedural texture maps.

This release also fixes dungeon atmosphere selection. The four layouts live at remote server coordinates that previously made position-only routing classify every one as Stormcrown/Air. Render context now overrides that coordinate heuristic while inside an instance, giving each dungeon its declared light, fog, exposure, bloom, and ambient particle family; leaving the instance clears the override and recycles old weather immediately. Unit coverage checks every theme, texture, identity, exact wall collider, loader bypass, context transition, and disposal route. A deterministic hardware-Chrome gallery renders all four surface languages and all eight room identities at High and Low quality while rejecting legacy cobblestone requests.

This is the room-shell and atmosphere portion of migration stage seven. Boss/encounter dressing, damaging dungeon mechanics, reward-state lifecycle, interior portals/blockers, death/reconnect restoration, and room unload/reload behavior remain open and are not implied complete by this slice.

## The last bell opens the way

`Alpha 0.41.0.18` connects the existing authoritative encounter contract to real production combat. A room now clears when the last living enemy whose spawn belongs to that room dies; current positions are deliberately ignored so a kited enemy cannot clear the wrong chamber or strand the chamber it came from. The established one-time chest, shrine, ambush, XP, gold, item, gem, healing, mana, and Sanctuary reward logic now has a production caller rather than test-only reachability. Boss rooms advance through the same state path without receiving the non-boss room payout.

The combat audit also found and closes two instance/reward integrity gaps. Generated dungeon loot now carries the defeated enemy's instance ID, keeping the drop in the party's state stream, and every dungeon trash, elite, and boss spawn carries the selected run level used by its stat scaling into XP and level-qualified loot calculation. Tests cover multiple living enemies, enemies dragged into another room, unrelated enemies in a later room, deterministic dungeon loot, all spawn helpers, and all four boss presentation families.

Generated room dressing now reacts to the replicated server summary without acquiring gameplay authority. Current rooms receive a restrained inner ward; the next uncleared objective receives a rotating crown and exact room-scale halo; cleared rooms receive a settled sigil; chest, shrine, and ambush seals retire when the corresponding server state clears; and the existing entrance carries a dim return aperture that brightens only when `objectiveRoomIndex` becomes `-1`. None of these meshes adds a collider, changes a door opening, moves a portal target, or predicts a clear locally. Scene transition disposal owns the complete hierarchy, and reconnect/late room summaries can reconstruct the same presentation immediately.

The sole current dungeon damage-zone family—the large-enemy boss slam—now carries a server-selected encounter identity. Thorncrypt emits Root Quake, Furnace Below emits Furnace Rupture, Shattered Aerie emits Stormbreak, and Drowned Sanctum emits Undertow Crush. Each client motif is contained by the unchanged authoritative radius and lasts for the unchanged telegraph duration. Player-created delayed spell impacts are explicitly tagged as ordinary danger rather than defaulting to boss language. The label pulse preserves its base dimensions and fits longer names, fixing the prior animation path that collapsed warning text into an unreadable square.

Hardware-Chrome evidence now has two deterministic stage-seven routes: the four-panel interior gallery exercises dormant, current, objective, cleared, reward-seal, and exit-ready states, while the encounter gallery renders all four server-named boss fields from production transient-effect code. Bespoke Molten, Tempest, and Abyssal boss bodies, the remaining general ability/effect restyle, death presentation, and explicit reconnect/unload browser routes remain open; this release does not claim those later gates.

## Five hearts beneath the anvil

`Alpha 0.41.0.19` replaces the generic shape-and-scale presentation of all five Furnace Below bosses with individual generated encounter rigs. Cindermaw is a true articulated quadruped built around a caged rib kiln, horned fire maw, brass teeth, caldera spines, clawed legs, and segmented chain tail. The Scorched Twins deliberately remain one authoritative actor while their visual covenant divides into Ember and Cinder upper bodies, separate masks and halos, a shared heart brand, and split glaive. Forgemaster Pyrax bears a white-hot furnace cage, chain apron, six burning chimneys, crown, and oath-anvil hammer. The Obsidian Guardian seals its heart behind a jagged black-glass crest and branded octagonal bulwark. Lord Infernax closes the procession under eleven crown spires, throne mantle, horned mask, nine orbiting censers, and a caldera scepter.

Each family owns generated `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` performances, including a separate four-leg gait and pounce for Cindermaw. Full-silhouette interaction bounds are declared independently from the common unchanged 1.25-unit authoritative combat radius. The new roots are synchronous, bypass both GLTF loading and the generic shape-spec fallback, share immutable cached geometry/materials, and keep transforms actor-owned through reset and pooling. Dungeon spawn order, room ownership, pursuit, attack range, health, damage, run-level scaling, loot, XP, daily-quest credit, and replication remain on existing gameplay paths.

Unit coverage exercises grounded bounds, semantic identity, every clip, finite transforms, cache reuse, pose isolation, one owner-safe interaction box, explicit factory routing, and generic-spec removal. The deterministic hardware-Chrome actor gallery includes all five bosses in every state at High and Low quality. Bespoke Shattered Aerie and Drowned Sanctum boss bodies, broader ability/effect art, death/reconnect/unload lifecycle routes, and final area polish remain open migration gates.

## The sky remembers its teeth

`Alpha 0.41.0.20` replaces the five generic shape-and-scale bosses of the Shattered Aerie with individual code-native encounter rigs. Windshear becomes a narrow floating wind-razor revenant framed by gale tatters, six crossed vacuum rings, fourteen pressure vanes, orbiting shards, and a white-sky scythe. The Stormcallers remain one authoritative encounter actor but visibly divide into Voltara and Zephyros, each with a distinct mask, storm color, and halo around a shared captive sky and convergence staff. The Roc Matriarch is a true broad flying form with twenty-two long wing feathers, nine tail plumes, crown plumage, silver talons, sky eyes, and lightning breast keel. Thunderlord Kaelix wears a ten-rod conductor throne, captive storm cage, nine-spire bell crown, and massive thunder maul. Zephyrion stands within nine crossed vortex rings, thirteen crown spires, sixteen horizon blades, fourteen orbiting eye shards, and a sky scepter.

Generated `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` motion preserves the existing replicated state contract across floating, striding, paired, and wide-wing silhouettes. Every root declares a grounded full-form interaction volume independently of the unchanged common 1.25-unit authoritative combat radius. Direct synchronous factory routing bypasses both authored loading and the generic shape catalog; immutable geometry and materials remain cache-shared while pose and reset state stay actor-owned. Encounter order, rooms, pursuit, attack range, health, damage, level scaling, loot, XP, daily credit, phase state, enrage state, and network identity are unchanged.

Unit coverage verifies every semantic family, bound, state, finite transform, cache, independent pose, owner-safe hitbox, loader bypass, pooling route, and removal from the generic specification table. The hardware-Chrome gallery renders all five bosses locally and as replicated actors, exercises every state, and captures both High and Low quality. Bespoke Drowned Sanctum boss bodies, the broader ability/effect pass, explicit death/reconnect/unload lifecycle routes, and final area polish remain open migration gates.

## The drowned crown rises

`Alpha 0.41.0.21` replaces the five generic shape-and-scale bosses of the Drowned Sanctum with individual code-native encounter rigs. Tiderend Leviathan is an articulated twelve-scale serpent with broad coral tide fins, maw tendrils, pearl eyes, depth stones, and a reef crown. The Drowned Choir remains one authoritative actor but carries three elevated cantor masks, separate coral crowns, a rib harp, orbiting voice pearls, and a drowned chime. The Abyssal Goliath bears sixteen cairn slabs, anchor fists, grave chain, burial crown, and a coral grave anchor. The Maelstrom Warden is enclosed by layered tide rings, a shell mantle, moon-anchor blade, and orbiting pearls. Thalorath closes the dungeon beneath a thirteen-spire coral crown, sixteen throne tentacles, nine crossed black-tide rings, sixteen throne pearls, and a luminous deep trident.

Generated `Idle`, `Walk`, `Run`, `Attack`, and stable `Death` motion keeps the replicated state contract unchanged. Full-form interaction bounds remain distinct from the common 1.25-unit authoritative combat radius, and each reused mesh owns exactly one current actor hitbox. Direct synchronous factories bypass model loading and the generic shape catalog; geometry and materials are cache-shared while each actor retains an independent pose. Encounter order, rooms, pursuit, attack range, health, damage, level scaling, loot, XP, daily credit, phase state, and network identity stay on their existing gameplay paths.

This audit also found that each of the five boss entity modules constructed a `THREE.Vector3` during idle roaming without importing Three.js. The imports are now explicit, and regression coverage drives the formerly failing timer branch for every class. Unit coverage additionally verifies grounding, declared bounds, detail counts, finite transforms in all states, cache stability, pose isolation, owner-safe hitboxes, factory routing, loader bypass, pooling, and generic-spec removal. The hardware-Chrome gallery renders local and replicated copies in every state at High and Low quality. With every current dungeon boss family now bespoke, the broader ability/effect pass, death/reconnect/unload lifecycle routes, remaining overworld silhouettes, and final area polish remain open migration gates.
