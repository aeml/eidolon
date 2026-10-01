# Fighter character export

`fighter.glb` is the full-detail export of
`output/models/fighter-production/fighter.blend` from the open Blender session.

- 53-bone skinned rig, 12 animation clips, and `Blink_L` / `Blink_R` morphs.
- 120,480 triangles; 1.90 m character height; glTF Y-up and forward +Z.
- Skin, shorts, hair, eyes and embedded PBR textures; no armor or weapons.
- Ten `socket_*` attachment nodes are included for future equipment.

The GLB is self-contained. Keep the imported scene root, skeleton and skinned
meshes together. Use `SkeletonUtils.clone` for independent Three.js instances.
The 43,405-triangle alternative remains at
`output/models/fighter-production/fighter-lod1.glb`.

Since Alpha 1.54, the normal Fighter renderer and character preview use optimized
High/Low copies derived from this source. Each character has an independent rig;
animations and all fourteen equipment slots are integrated. A fully equipped
procedural fallback remains available if loading fails. The full-detail export
is not downloaded as a gameplay boot dependency.

Animation revision 2 (2026-10-01) updates the existing twelve clips in the source,
High and Low GLBs: calibrated closed-hand grips, a diagonal sword cut with
wind-up/follow-through, and revised walk/run contacts. Geometry, skin weights,
inverse bind matrices, morphs and textures are preserved. The additional weapon
profiles and their review sources are documented in
[the equipment delivery](../../../docs/art/EQUIPMENT_ASSETS.md).

See [the integration record](../../../docs/art/2026-09-30-fighter-pilot.md) and
[verified release](../../../docs/plans/2026-09-30-release1-54-acceptance.md).
This is scoped alpha integration, not final armor art, physical-phone performance
or full-world capacity approval. Blender paths above describe the source export;
the final packed source is included through Git LFS. Run `git lfs pull` before
opening it in Blender.

The anatomical source, skin and brows include MakeHuman/MPFB CC0 assets. See the
included provenance and license files. Detailed validation and animation notes
are in `output/models/fighter-production/README.md`.
