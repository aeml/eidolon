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

The current Fighter runtime is procedural. This file is staged for integration;
placing it here does not change the active class renderer. Final controller,
equipment and performance checks are still required in the game.

The anatomical source, skin and brows include MakeHuman/MPFB CC0 assets. See the
included provenance and license files. Detailed validation and animation notes
are in `output/models/fighter-production/README.md`.
