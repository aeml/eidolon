# Unequipped Wizard, Cleric and Rogue delivery

The owner requested three Blender character models to accompany the integrated
Fighter and chose simple underclothes with no equipment. This delivery stages
an adult male Wizard, adult female Cleric and adult female Rogue in their class
folders under `assets/archetypes/`.

The Cleric follows the owner's appearance direction: an adult white woman with
fair skin, bright flaxen-blonde braided hair, blue-gray eyes and a soft oval face.
The Rogue wears her dark hair in a tied-back ponytail, with both eyes visible.

Each class has a full-detail GLB plus high and low runtime derivatives. Each
retains the Fighter's 53-joint naming convention, ten equipment sockets, the
twelve shared movement/combat clip names, two additional class gesture clips,
and `Blink_L` / `Blink_R`. Proportions, facial shapes, hair and skin materials are
distinct. Use each character's own bind matrices and animation set.

Animation revision 2 (2026-10-01) updates the default movement and combat clips
in each editable source and all three GLB quality levels. Separate Sword,
Dagger, Staff, Mace and Unarmed motion banks, calibrated grips and review scenes
are described in [the equipment delivery](EQUIPMENT_ASSETS.md). Character mesh,
weights, morphs, inverse bind matrices and textures are preserved.

Editable packed Blender sources are tracked with Git LFS; review renders are
delivery evidence. Fetch LFS sources before opening the following files:

- `output/models/wizard-production/wizard.blend`
- `output/models/cleric-production/cleric.blend`
- `output/models/rogue-production/rogue.blend`
- `output/models/class-bases/character-roster.blend`

The class asset folders include provenance, the MakeHuman CC0 license,
geometry/weight reports, sampled deformation checks, Khronos glTF validation,
Three.js import/independent skeleton checks and runtime derivation manifests.
Deformation checks sample nine times per clip; the clothing test checks hidden
skin boundaries against the garment's outer surface and a capped envelope to
avoid treating concave folds or open hems as automatic penetrations. These are
bounded checks, not a claim that every possible blended pose was verified.

This records the original base-model delivery, not the current integration state.
All four authored class adapters and fitted equipment are now connected through
the catalog; see [the current integration contract](../../README.md#connect-the-assets-to-gameplay).
New revisions still need character-specific rig, fit, animation, lighting and
performance checks. Preserve the explicit migration allowlist and procedural
fallback. Full-detail source GLBs must not become boot dependencies; load the
appropriate runtime derivative on demand.
