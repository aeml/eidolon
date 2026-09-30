# Fighter authored model pilot

September 30, 2026. The owner delivered a rigged, underclothes-only Fighter in
commit `da02a2a5b35e70b8b890873d36adcf2804433281`. It was preserved by the fresh
remote merge before the 1.53 push. The asset is available for integration; the
current runtime still uses the procedural Fighter. Runtime candidates and an
independent-skeleton adapter are now implemented and tested locally. This is
partial integration evidence, not completed visual or performance acceptance.

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

## Verified runtime preparation

The reproducible `scripts/derive-fighter-runtime.mjs` uses pinned glTF Transform
4.5.1 commands to weld, resample, simplify, resize and encode WebP textures.
The source hash is pinned, its original export/notices remain untouched, and
attachment leaves are never pruned. Commands follow the
[upstream optimization documentation](https://gltf-transform.dev/).

The generated manifest records High at 4,987,852 bytes and 56,226 triangles,
with textures capped at 1024px; Low is 2,670,240 bytes and 23,918 triangles,
with textures capped at 512px. Both retain 53 joints, all 12 clips, ten sockets,
11 skinned meshes and both blink targets, with no external dependencies. Fresh
validator runs found zero errors/warnings and the same three unused-tangent
informational notices. This proves structural retention, not final appearance.

`AuthoredFighter.js` clones the complete skeleton/skin hierarchy, shares immutable
geometry and textures, normalizes to the existing 4.5-world-unit height above the
feet, retains authored motion and keeps a resettable per-instance pose. It does
not yet replace the default class factory or claim full class-skill coverage.
The migration guard now allows exactly these two derived exports, their adapter
references and the pinned derivation script; retired assets remain prohibited.

The native Chrome pilot rendered two independent actors for each quality, all
11 skinned meshes per actor and decoded bounded textures. Idle, Run, Attack,
Block, Death and Jump samples were finite; the run passed in 10.0s. Screenshots
were reviewed for Idle, Attack and early Death. The desktop pilot is not an
equipped gameplay-camera/character-sheet test or a final GPU/memory benchmark.

Review found visibly noisy skin microdetail and Low scalp/shorts artifacts.
Investigate material detail and simplification before accepting those surfaces;
the validator and finite transforms do not qualify them as modern finished art.
Artifacts are in `/tmp/eidolon-1-54-fighter-pilot-0930`. One synthetic clone test
initially distinguished JavaScript negative zero from zero; the numerical
assertion now tolerates signed zero while retaining independent-skeleton checks.

## Remaining integration alongside combat readability

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

Other class/NPC/monster deliveries and full modern-art acceptance remain
separate requirements. Default Fighter activation still requires generated
equipment fit, class-skill gestures and moving casts, fallback/cache/pool
lifecycle, current gameplay camera and character-sheet review, and measured
High/Low multi-actor performance. No new owner model request is needed.
