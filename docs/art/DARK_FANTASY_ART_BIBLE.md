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
- Idle motion should feel alive without visual noise. Walk and Run must show opposing arm/leg rhythm, Attack must have anticipation and follow-through, and Death must reach a stable final pose. Local and replicated actors consume the same generated clips.
- Equipment mounts are part of the rig contract. Head, chest, belt, neck, main hand, and off hand use single anchors; paired shoulders, gloves, legs, feet, rings, and trinkets use left/right anchors. Attachments follow animated pivots and must never become separate network authorities.
- Shared geometry and immutable materials are cached across actor instances. Mutable pose, equipped-part selection, tint state, effects, nameplates, hitboxes, and party markers belong to the actor instance and must reset on pool reuse.
- At normal isometric zoom, class identity comes first from silhouette, then value grouping, then one restrained magical accent. Fine ornament is optional and may disappear on Low quality; head, hands, weapon, off-hand identity, and locomotion must remain readable.
- Class locomotion is not a shared costume swap. The Rogue keeps a lower hip line, quicker stride, deeper run lean, scanning idle, two-handed attack cadence, and folding death while consuming the same network animation state names as the Fighter.

## Equipment language

- Every equippable base family needs a named descriptor and intentional silhouette. Unknown items must fail coverage visibly; production must not hide an omission behind a generic cube, weapon, or armor fallback.
- Metal, leather, cloth, and wood keep distinct roughness and metalness. A material family establishes the main value block, while a secondary material defines edges, straps, frames, or reinforcement.
- Item tier may strengthen scale very slightly, but never enough to alter perceived reach, collision, or class proportions. Rarity uses one restrained emissive accent rather than recoloring the whole item.
- Potency strengthens the existing rarity accent. Open sockets use dark faceted mounts; filled sockets show no more than three small, color-coded generated gemstones.
- Set identity uses a thin diamond rune. Unique effects use a separate faceted mark with a stable effect palette. These marks are deliberately small and must not resemble world hazards, targets, or cast telegraphs.
- Paired slots remain one logical item but render on every declared attachment region. Equipment follows animated pivots and has no independent gameplay transform or network authority.
- A missing, replaced, or final unequipped item must restore the class's intentional default silhouette immediately. Shared geometry and materials are immutable and cached; attachment groups remain actor-owned and are removed before pool reuse.

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
