# Eidolon Dark-Fantasy Art Bible

## Identity

Eidolon is a stylized dark-fantasy action RPG seen from an isometric gameplay camera. Its visual language is built from sculpted, faceted forms; dark neutral materials; strong silhouettes; restrained regional palettes; and one bright magical accent per gameplay concept. The look should feel handcrafted and adventurous rather than photorealistic, muddy, toy-like, or neon-saturated.

The production target is code-generated geometry, materials, shaders, particles, icons, rigs, and animation. Geometry must be cached and reused. Visual detail should come from silhouette, layering, color blocking, surface rhythm, controlled emissive accents, and motion—not huge textures or excessive mesh density.

## Readability rules

- Characters, enemies, loot, interactables, hazards, and exits must remain identifiable at the normal camera zoom.
- Friendly, neutral, hostile, elite, boss, loot, and hazard visual channels must not rely on color alone.
- Bright emissive color is reserved for magic, weak points, loot identity, telegraphs, and active hazards.
- A damaging footprint ends exactly where its authoritative gameplay radius ends.
- Ambient particles may create mood but must not imply a false collision or damage boundary.
- Major animation anticipation and impact poses must read from the character silhouette.
- Low quality may reduce particles and secondary ornaments, but never removes a gameplay boundary, attack cue, target marker, or interactable indicator.

## Regional themes

| Area | Theme | Core materials | Accent and atmosphere |
| --- | --- | --- | --- |
| Earth Realm | Gloamwood Marches | weathered stone, black oak, moss | grave-lantern gold, drifting dust |
| Town | Lanternhold | charcoal timber, old iron, worn masonry | amber windows, protective runes |
| Water Realm | Moonfrost Expanse | moonlit ice, drowned stone, silver reeds | cyan moonlight, violet storm energy, snow |
| Fire Realm | Cinder Wastes | black glass, furnace iron, charred bone | ember orange, molten gold, ash |
| Air Realm | Stormcrown Reach | storm slate, silver banners, fractured peaks | cold blue, arcane violet, wind wisps |
| Verdant Bastion | Thorncrypt | root-bound masonry, tarnished bronze, funerary ivy | witchlight green, spores |
| Molten Core | Furnace Below | obsidian vaults, chains, forge architecture | lava orange, sparks, heat distortion |
| Tempest Spire | Shattered Aerie | floating slate, broken arches, conductors | lightning blue, violet charge |
| Abyssal Well | Drowned Sanctum | flooded basalt, drowned reliquaries, coral | bioluminescent teal, deep-blue motes |

The executable palette, lighting, particle, and hazard definitions live in `src/art/darkFantasyTheme.js`. New area art must consume or extend that manifest instead of introducing unrelated hard-coded palettes.

## Hazard language

Every damaging area has three readable layers:

1. A subtle interior field that identifies the affected space.
2. A precise animated rune boundary whose outer edge equals the server radius.
3. A themed vertical or directional motion layer that explains the threat: rising embers, spiraling gravewind, electrical strikes, or lateral storm shear.

Hazards must survive chunk residency changes and must dispose all geometry and materials on dungeon transitions, death teardown, reconnect replacement, and engine shutdown.

## Humanoid language

- Player silhouettes share a named transform hierarchy but not a costume silhouette: hips, chest, head, upper/lower arms, hands, thighs, shins, and class-specific secondary motion remain independently animatable.
- The Fighter is the reference scale and first production vertical slice: roughly 4.5 world units tall, broad at the shoulders, plated, shield-forward, and grounded by large boots. Rogue, Wizard, and Cleric proportions may vary, but collision and interaction dimensions must remain explicit metadata rather than assumptions about model scale.
- The Rogue is the agile counter-silhouette: roughly 4.25 world units tall, narrow through the shoulders, pitched forward, asymmetrical, and divided into sharp diagonals by hood, mask, straps, wrist blades, split cloak, and paired daggers. Gloamreach poison green is a controlled identity accent, not a full-body tint.
- The Wizard is the arcane counter-silhouette: roughly 4.55 world units tall, narrow and rear-weighted, framed by a seven-sided cowl, split rune robes, asymmetric slate mantle, silver collar, stormstaff, and independently hovering astrolabe. Storm cyan identifies focused power while arcane violet traces the supporting runes; neither becomes a full-body wash.
- The Cleric is the sacred counter-silhouette: roughly 4.55 world units tall, upright and bell-shaped beneath burial vestments, reliquary armor, a broken-sun crown, oathmace, and swinging censer. Lantern gold marks vows and authority while pale spirit green is reserved for the censer flame and restorative magic.
- Idle motion should feel alive without visual noise. Walk and Run must show opposing arm/leg rhythm, Attack must have anticipation and follow-through, and Death must reach a stable final pose. Local and replicated actors consume the same generated clips.
- Equipment mounts are part of the rig contract. Head, chest, belt, neck, main hand, and off hand use single anchors; paired shoulders, gloves, legs, feet, rings, and trinkets use left/right anchors. Attachments follow animated pivots and must never become separate network authorities.
- Shared geometry and immutable materials are cached across actor instances. Mutable pose, equipped-part selection, tint state, effects, nameplates, hitboxes, and party markers belong to the actor instance and must reset on pool reuse.
- At normal isometric zoom, class identity comes first from silhouette, then value grouping, then one restrained magical accent. Fine ornament is optional and may disappear on Low quality; head, hands, weapon, off-hand identity, and locomotion must remain readable.
- Class locomotion is not a shared costume swap. The Rogue keeps a lower hip line, quicker stride, deeper run lean, scanning idle, two-handed attack cadence, and folding death while consuming the same network animation state names as the Fighter.
- The Wizard keeps a taller hip line, measured stride, robe-swept run, contemplative idle, two-handed focus cast, independently orbiting astrolabe, and unraveling side-fall while consuming those same authoritative state names.
- The Cleric keeps a processional stride, prayerful idle, driven run, mace-and-censer attack, independent chain swing, and kneeling collapse while consuming those same authoritative state names.

## Equipment language

- Every equippable base family needs a named descriptor and intentional silhouette. Unknown items must fail coverage visibly; production must not hide an omission behind a generic cube, weapon, or armor fallback.
- Metal, leather, cloth, and wood keep distinct roughness and metalness. A material family establishes the main value block, while a secondary material defines edges, straps, frames, or reinforcement.
- Item tier may strengthen scale very slightly, but never enough to alter perceived reach, collision, or class proportions. Rarity uses one restrained emissive accent rather than recoloring the whole item.
- Potency strengthens the existing rarity accent. Open sockets use dark faceted mounts; filled sockets show no more than three small, color-coded generated gemstones.
- Set identity uses a thin diamond rune. Unique effects use a separate faceted mark with a stable effect palette. These marks are deliberately small and must not resemble world hazards, targets, or cast telegraphs.
- Paired slots remain one logical item but render on every declared attachment region. Equipment follows animated pivots and has no independent gameplay transform or network authority.
- A missing, replaced, or final unequipped item must restore the class's intentional default silhouette immediately. Shared geometry and materials are immutable and cached; attachment groups remain actor-owned and are removed before pool reuse.

## Lanternhold service language

- Town services share charcoal cloth, worn iron, old leather, faceted anatomy, restrained emissive identity, and a thin circular service sigil. Their silhouettes and held props must still identify the service without reading a nameplate or relying on hue alone.
- The Dwarf Merchant is the low, broad ironmonger: braided beard, forge apron, merchant pack, coin row, and rune hammer. Ember amber is reserved for trade and active forge craft.
- The Quest Giver is the tall oathscribe: open scroll, quill, and broken oath-sun. Warm gold marks a route or obligation but never imitates an ability footprint.
- The Dungeon Guide is the hooded waywarden: witchlight lantern, key ring, map case, and colder travel-worn layers. Teal light means navigation into dangerous spaces, not a safe gameplay zone.
- The Talent Master is the antler-crowned ash confessor: masked face, memory ledger, orbiting shards, and a violet soul reliquary. Its orbit is local ornament with no collision or network authority.
- Every service owns an exact, grounded interaction bound spanning its full generated silhouette. Role-specific motion stays subtle, all render resources are cached, and pool reuse restores the complete rest pose without changing quest, vendor, dungeon, or talent state.

## Sacred summon language

- The Avenging Seraph is not a winged copy of the Cleric. It is an airborne Lanternhold reliquary: blank burial mask, broken oath-sun, suspended vestments, layered bone-and-bronze primaries, spectral inner feathers, oath-spear, and censer flame.
- Summons remain readable beside players through a broader silhouette, open negative space under the wings, a visible ground binding seal, and restrained mint soul-light. Ornament never masquerades as a damage footprint or changes authoritative combat reach.
- `Idle`, `Walk`, `Run`, `Attack`, and `Death` keep their network state names but express hover, measured glide, driven flight, spear judgement, and folding collapse. Wings, weapon, censer, head, halo, and body are independently animated actor-owned pivots.
- Generated selection bounds cover the entire apparition while combat radius remains server-owned. Geometry and materials are cached and immutable; every summoned instance owns its pose and pool reset.

## Regional enemy language

- Hostile families inherit their region's materials and magical accent, but each must also read through anatomy, posture, weapon, and motion with emissive color disabled. A regional palette is a relationship, never a whole-body tint.
- Gloamwood gravebound are remnants carrying their own rites. Skeleton ossuary pilgrims combine exposed articulated bone, moss-dark burial cloth, a grave candle, a captive soul lantern, and an asymmetrical gravesickle. Their walk is loose and processional; attacks pull the entire frame behind the sickle; death settles into a stable scattered-bone silhouette.
- Greater Gloamwood gravebound look assembled by the landscape itself. Grave-reliquary Constructs pair cairn stone and old roots with moss, funeral brass, a caged soul, tolling maul, hanging grave bell, and funerary mask. Their width, deliberate cadence, and massive implement keep them distinct from the narrow processional dead.
- Cinder Wastes ash-legion creatures look forged or scavenged rather than merely red. Demon Orc kiln-warriors are broad furnace bodies contained by black iron, horned masks, hanging chains, and brutally rectangular cleavers. Imps are small, sharp scavengers identified by beating coal hearts, bat-like wings, spaded tails, claws, and stolen fork weapons.
- Inferno Titans are the ash legion's walking crucibles: towering basalt and obsidian frames organized around a white-hot caged furnace, vented shoulders, a molten crown, caldera cleaver, and chained ash censer. Emissive seams reveal contained heat; they never replace the dark mass needed for a readable giant silhouette.
- Enemy ornament stays inside the full-silhouette interaction bound and never changes combat collision. Persistent base marks identify faction presence but remain far smaller and dimmer than authoritative hazard or ability boundaries.
- All enemy rigs preserve the shared network state vocabulary—`Idle`, `Walk`, `Run`, `Attack`, and `Death`—while expressing family-specific weight, anticipation, follow-through, and collapse. Geometry/material resources are cached; pivots, animation state, ownership, hitboxes, and pool resets remain per instance.

## Migration baseline — 2026-09-02

- Authored asset payload: approximately 963.33 MiB.
- Authored GLB payload: 106 files, approximately 776.82 MiB.
- Authored raster images: 100 PNG files.
- Generated vector gem icons: 49 SVG files.
- Existing procedural foothold: 25 fire, air, and water enemy/boss specifications with cached shapes and generated standard animation clips.
- Existing player ability manifest: 52 canonical abilities plus rune variants.
- Active world hazards: 65 total — 19 lava pools, 12 sandstorms, 15 lightning zones, and 19 wind gusts.
- Equippable schema slots: head, chest, legs, feet, shoulders, belt, ring, trinket, main hand, off hand, neck, and gloves. Material and relic are inventory-only categories.

This baseline is a ceiling, not a target. Each migration patch may reduce legacy files and runtime references but must never add a new authored 3D dependency.
