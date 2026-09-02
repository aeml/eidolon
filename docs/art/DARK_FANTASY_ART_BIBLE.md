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
