# Rogue unequipped character

Adult female, 1.68 m; lean athletic build, dark tied-back ponytail with both eyes visible, dark green undertop and shorts. Cast and StealthIdle gestures. No armor, weapons, or accessories are included.

| Export | Triangles | Payload |
| --- | ---: | ---: |
| `rogue.glb` | 133,044 | 20.84 MiB |
| `rogue-runtime-high.glb` | 77,968 | 5.96 MiB |
| `rogue-runtime-low.glb` | 50,932 | 3.83 MiB |

Every variant retains a 53-joint skinned skeleton, 14 animation clips, two blink
morphs, ten `socket_*` attachments and embedded PBR textures. The bone names,
core animation names and sockets match the Fighter contract. Each character has
its own bind matrices and proportions; use its supplied skin and clips together.
glTF is Y-up, forward +Z, with metre units and its origin at ground level.

Use the high or low runtime export for gameplay. Preserve the complete imported
scene hierarchy and clone it with Three.js `SkeletonUtils.clone` for independent
actors. Data textures retain lossless compression; the runtime variants use
`EXT_texture_webp`, consistent with the Fighter derivatives.

This delivery is staged for integration. The active Wizard, Cleric and Rogue
renderers and equipment adapters have not been changed. Their equipment offsets,
skill animation mappings and in-game performance still need integration testing.
The Cleric braid and Rogue ponytail follow head/neck/back skinning; they have no
physics simulation.

Editable source: `output/models/rogue-production/rogue.blend` tracked with Git LFS. Run `git lfs pull` before opening it; textures are packed.
Local anatomical checkpoints and backup renders are excluded from the delivery.

See `character-report.json`, `deformation-validation.json`, the runtime manifest
and each export's `.validation.json` for the delivered geometry and checks.

Animation revision 2 supplies the updated default clips; additional weapon
profiles and calibrated grips are in `assets/equipment/authored/`. See the root
README for the integration sequence.
