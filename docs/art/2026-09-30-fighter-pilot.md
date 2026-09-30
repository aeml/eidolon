# Fighter authored model pilot

September 30, 2026. The owner delivered a rigged, underclothes-only Fighter in
commit `da02a2a5b35e70b8b890873d36adcf2804433281`. It was preserved by the fresh
remote merge before the 1.53 push. The asset is available for integration; the
current runtime still uses the procedural Fighter. This is intake evidence and
implementation scope, not visual or performance acceptance.

## Verified delivery

The binary at `assets/archetypes/Fighter/fighter.glb` has a consistent GLB 2
header and declared file length of 40,335,020 bytes. Direct inspection of its
JSON chunk confirms one Fighter rig with 53 joints, 11 skinned meshes, eight
materials, 11 embedded images and no external image/buffer dependencies.

It contains 12 named clips: Attack, Block, CombatIdle, Death, Hit, Idle, Jump,
JumpLand, JumpLoop, JumpStart, Run and Walk. Ten attachment nodes cover hands,
shoulders, head, back, chest, feet and belt. The accompanying validation report
records zero errors/warnings, 120,480 triangles and blink morph targets. That
report is preserved as supplied; this inspection is not a fresh validator run
or proof that every clip works in Eidolon.

The supplied README documents 1.90m height, Y-up and +Z forward. Provenance and
the reproduced MakeHuman/MPFB component license are present. Preserve those
notices and the distinction between source-component licensing and application
code. No new licensing declaration or legal clearance is invented here.

The README references a lower-detail export and Blender sources under
`output/models/fighter-production`; that directory is not present in this
workspace. The delivered full-detail GLB is sufficient to proceed with code-owned
integration and derivation rather than asking the owner to produce more assets.

## Integration alongside the next combat-readability milestone

1. Derive and validate runtime-sized geometry/textures as needed, retaining the
   supplied source and provenance. Measure loading/memory rather than making the
   40MB source a mandatory boot download. Preserve a working fallback on failure.
2. Use the existing asynchronous model cache and skeleton-aware cloning. Keep
   scene root, skins and skeleton together; verify independent local/remote and
   character-sheet instances, world scale, forward direction and grounding.
3. Map the provided locomotion, attack, block, hit, death and jump clips into the
   actor controller. Retain authored motion, smooth transitions and current
   gameplay authority; fill any class-skill presentation gaps without silently
   dropping animation coverage.
4. Fit generated weapons, shields, armor, boots, gloves, helmets, shoulders and
   cosmetics to this rig. Check grip/orientation, joint motion, skin clipping,
   equip/unequip restoration and the preview matching the world actor. The owner
   supplies bodies—not an equipment or environment catalog.
5. Compare the actual gameplay camera and character sheet, High/Low settings and
   a shared multi-actor workload. Review appearance and readable combat, not just
   finite transforms or mesh counts, before enabling the model by default.

The procedural-migration guard currently treats this as a staged asset and
prohibits runtime imports. Integration must replace that restriction with a
narrow validated Fighter allowlist, preserving bans on retired legacy assets;
do not broadly disable the guard merely to pass tests. Other class/NPC/monster
deliveries and full modern-art acceptance remain separate requirements.
