# Ilyra wizard outfit

`ilyra-archmage.glb` is a dedicated, permanently dressed appearance for
Archmage Ilyra, including his town and story projections. Player Wizards still
use their own body and inventory equipment. Empty NPC equipment updates cannot
remove this outfit. If the asset fails to load, Ilyra uses the dressed procedural
wizard instead, and a later load can retry the authored appearance.

The outfit has indigo woven robes, a plum mantle, aged-gold trim, a circlet,
four elemental stones and an ebonwood staff with a resonance crystal. Clothing
and staff are skinned to the delivered Wizard rig. Only the Idle animation is
included because Ilyra is a stationary, friendly quest giver. His gold quest
marker remains above the outfit.

## Asset source

The head, hands, hair, eyes, skeleton and Idle motion derive from the project's
[`wizard-runtime-low.glb`](../../archetypes/Wizard/wizard-runtime-low.glb).
See the existing [Wizard provenance](../../archetypes/Wizard/PROVENANCE.md) and
[MakeHuman CC0 notice](../../archetypes/Wizard/LICENSE-MAKEHUMAN-CC0.txt).
Those source notices remain applicable; this document does not separately
relicense project-specific additions.

The robes, mantle, ornaments, staff and woven fabric texture were generated in
Blender for Eidolon using the checked-in script below. Covered anatomy was
removed from the imported NPC copy, not from the player model. No downloaded
third-party clothing, external textures or viewer runtime are included.

## Rebuild in Blender

Execute [`create-ilyra-outfit.py`](../../../scripts/blender/create-ilyra-outfit.py)
through Blender MCP or Blender's Python console with `EIDOLON_ILYRA_ROOT` set
to the absolute repository path. The script creates its own scene, leaves other
scenes and player files unchanged, and exports only the NPC. Shared-session
object suffixes are normalized in the generated GLB, not in other scenes.
The preview camera and lights are added after export and are not game geometry.

After regeneration, validate the GLB, update its content hash in
`src/assets/assetManifest.js`, and run `AuthoredIlyra.test.js` and
`tests/e2e/ilyra-archmage.spec.js`. Inspect front, side, back and isometric
screenshots before accepting changes. The runtime shares immutable geometry
and materials while cloning bones and animation clips per NPC.

## Validation and publication

The asset is 1,548,340 bytes, has 53 joints, 11 meshes, 20 material
primitives and embedded images. Structural validation found zero errors and
12 warnings: the retained normal-mapped skin uses runtime-generated tangent
space, and skinned meshes retain the imported rig hierarchy. Browser rendering
is checked separately rather than treating structural validation as visual
acceptance. It is published in Alpha 1.58.5, exact source
`397bd41d0a8209eb466204aa9b8ccf64024a933e`. All ten CI jobs passed,
including native predeployment and live character QA. The public NPC GLB hash
matches this file; the player Wizard source hash remains unchanged. See the
[public acceptance receipt](../../../docs/plans/2026-10-02-release1-58-5-public.json).
The checked-in generator and existing source notices make subsequent outfit
changes reproducible without altering player bodies or unrelated Blender scenes.
