# Garment source records

The delivered collection contains twelve complete outfits and six held designs:
96 outfit GLBs (four supplied class fits, High and Low) and twelve held GLBs
(High and Low). These are the eighteen distinct VIP looks delivered through
Alpha 1.79.58. Later returning-session and Rogue offhand integration preserve
the same modeled catalog.

The complete outfits are Iron Oath Regalia, Nightglass Cowl, Dawn Reliquary,
Astral Sovereign, Winterthorn Revel, Hollow Court, Rosebound Vow, Lantern Envoy,
Springbloom Jubilee, Solstice Pyre, Gilded Harvest and Midnight Masque. The first
four have class-inspired designs; all twelve have the four supplied body fits.

Held designs are Grovekeeper Blade, Skyweaver Dagger, Hearthkeeper Staff,
Tidekeeper Mace, Grovekeeper Shield and Skyweaver Tome.

## Inputs and reproducibility

- [Outfit registry](../../src/assets/garments.generated.js) records every output
  file, byte length and SHA-256, plus 672 source references to 168 distinct fitted
  equipment inputs. [The outfit generator](https://github.com/aeml/eidolon/blob/master/scripts/generate-garment-models.mjs)
  derives the outfits from that delivered equipment and its skin bindings, with
  project-specific materials and ornaments. It does not modify the supplied
  equipment inputs.
- [Held registry](../../src/assets/heldGarments.generated.js) records the six
  designs, their twelve outputs and twelve delivered grip-coordinate/size
  references. [The held generator](https://github.com/aeml/eidolon/blob/master/scripts/generate-held-garments.mjs)
  produces the corresponding rigid appearances.
- [Equipment delivery records](../equipment/authored/manifest.json) identify the
  supplied equipment. Runtime derivatives are recorded in
  [their manifest](../equipment/runtime/manifest.json). Source integrity and
  binding information are distinct from licensing decisions.

## Retained source notices

The supplied class provenance and source-component notices remain alongside
[Fighter](../archetypes/Fighter/PROVENANCE.md),
[Rogue](../archetypes/Rogue/PROVENANCE.md),
[Wizard](../archetypes/Wizard/PROVENANCE.md) and
[Cleric](../archetypes/Cleric/PROVENANCE.md). Those records distinguish the
MakeHuman source components from project-specific additions.

The repository's [ASSET-LICENSE](../../ASSET-LICENSE) states the terms for
project-authored visual assets and editable art sources; code in the generators
uses the separate [software license](../../LICENSE). Supplied components retain
their own notices. This source record adds no new grant or independent rights
verification for supplied equipment or derived garments. The final
shipped-catalog rights review remains open. Matching hashes establish file
identity, not redistribution rights. See the
[content provenance inventory](https://github.com/aeml/eidolon/blob/master/docs/art/CONTENT_PROVENANCE.md) for the
broader notice scope.
