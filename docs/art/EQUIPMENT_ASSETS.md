# Fitted equipment collection

This owner-requested delivery stages equipment assets for review. The game still
uses its existing equipment renderer. The assets, sources and integration
instructions are published together; publishing them does not enable the new
equipment renderer. See the root README for the integration sequence.

Revision 2 (2026-10-01) replaces all 24 chest fits with full crew-neck coverage,
continuous shoulder yokes and short sleeves under the separate pauldrons. Robe
gores now also measure the pelvis envelope, including the female fits.
The four character sources and all twelve character GLBs have revised default
animations; the existing Fighter runtime therefore receives its revised sword
motion. New equipment and the other classes remain staged for integration.

The collection covers all 36 equippable base items in `BASE_ITEMS`: four weapons,
two offhands, 21 armor pieces, three rings, three necklaces, and three trinkets.
Each has a standard and a separate legendary design. Common, Uncommon, and Rare
share the standard model. Legendary uses the embellished model; Eidolic may reuse
that geometry with the existing violet rarity accent. Materials and currencies
have no wearable model.

## Files

- `assets/equipment/authored/manifest.json`: authoritative item-to-model mapping,
  exact file hashes, triangle counts, rarity policy, and set accent colors.
- `assets/equipment/authored/weapons/`: 12 rigid GLBs, with grip-centered origins.
- `assets/equipment/authored/fits/{Fighter,Wizard,Cleric,Rogue}/`: 60 skinned GLBs
  per character, tailored to the delivered character's actual bind pose.
- `assets/equipment/authored/grip-transforms.json`: socket-relative weapon
  transforms for all four bodies, in glTF/Three.js column-major matrix order.
- `assets/equipment/authored/motion-profiles.json` and `motions/{Class}.glb`:
  four skeletal motion banks with Sword, Dagger, Staff, Mace and Unarmed profiles.
- `output/models/equipment-production/weapons.blend`: editable weapon collection.
- `output/models/equipment-production/{fighter,wizard,cleric,rogue}-equipment.blend`:
  editable armor/accessory collections with their reference characters.
- `output/models/equipment-production/viewer.html`: local interactive review tool.

There are **72 designs, 252 model GLBs and 4 motion banks**. The 30 wearable designs in each tier
have four separate body fits; the six rigid weapon/offhand designs are shared.
Each file contains one logical mesh, split into material primitives as required.
The Blender sources keep pieces in `EQUIPMENT | individual fitted pieces`, named
`item-id__tier__Class`. Toggle the desired items for editing; source character
files are preserved separately.

## Review locally

From the repository root, run the existing static server:

```powershell
$env:PORT='4189'
node scripts/serve-static.mjs
```

Open `http://127.0.0.1:4189/output/models/equipment-production/viewer.html`.
Select a character, armor family, rarity and movement clip. The individual-piece
controls allow mixed outfits and accessory inspection. The viewer uses the real
GLBs, character skeletons, embedded materials, and bloom. It is separate from the
game and does not change saved inventory or gameplay.

## Binding and coverage

GLBs use metres, Y up, and +Z forward. All fitted pieces carry the matching
53-joint character skin and exactly matching inverse bind matrices. Reuse the
existing character bones by name, keep skinned meshes at the character scene
root, and retain the supplied inverse bind matrices. Do not attach skinned armor
to a hand or torso socket. Equipment has no duplicate animation clips.

Rigid weapons attach to `socket_mainHand` or `socket_offHand`. Their origins sit
at the grip. Apply the supplied class-specific local matrix to the imported GLB
scene. These transforms are calibrated to the fist center and handle axis of
each body. Play the corresponding weapon profile so the wrist and curled fingers
carry the weapon naturally; no per-frame weapon correction is needed.

Motion banks provide profile-specific Idle, CombatIdle, Walk, Run, Attack and
Block, plus the existing default clip names. The sword uses an anticipatory
wind-up, diagonal cut, and follow-through; the dagger uses a compact slash, the
mace a heavier stroke, and the staff a supported cast. Attack contact remains at
14/30 seconds for the existing Fighter gameplay timing. Walk and run use separate
stance/swing phases, foot roll, pelvis height and counter-rotation. The reviewer
crossfades state changes over 180 ms and composes supported left-arm tracks when
a dagger is paired with an offhand. Import animation tracks onto existing bones
by name; do not add the bank's duplicate skeleton to the rendered character.

Headwear replaces visible hair/scalp. Chest pieces replace the undertop, and
trousers/greaves replace the undershorts and their seams. Skirts retain the
undershorts. Robes cover the shorter Silk Skirt completely; suppress that inner skirt's
rendered mesh while both are equipped to prevent overlapping hems in motion.
Underlying covered body triangles should be masked for opaque
armor, boots and gloves, especially during movement. The reviewer's
`updateCoverage` provides a conservative reference mask using rest coordinates
and bone influences. It does not alter source character geometry. Recompute any
index mask for the body LOD being used; do not copy high-LOD triangle indices to
another LOD. Mixed outfit and combat integration should retain this coverage
contract.

Ring files fit the left ring finger (`ring_01_l`). For the right ring slot, mirror
bind-space X, reverse winding and swap left/right bone names, using the target
joint inverse bind matrices. Hip trinkets can be mirrored similarly for the
second trinket slot. Necklaces use the shared character skin.

## Materials and integration limits

Standard equipment uses restrained iron, leather, wood and cloth materials.
Legendary versions add crystal settings, raised trim, rune inlays, layered
shoulders, crests and enlarged weapon details. Cleric plate uses an ivory/gold
palette; the other plate fits use blue steel. Cloth uses blue/gold, and legendary
leather uses dark violet. Set items reuse the legendary base design; the
manifest preserves the game's eight set accent colors as material overrides.

All materials are embedded glTF metallic-roughness PBR materials. Legendary
emission uses `KHR_materials_emissive_strength`; the glow halo requires bloom in
the consuming renderer. There are no external texture dependencies. Surface
detail is modeled geometry and material separation, not a baked texture atlas.
This delivery contains one authored LOD per piece. Runtime batching, additional
LODs, weapon-profile selection in the game, cloth simulation and final mixed-gear combat QA
belong to the integration pass. The skinned robes already have separated panels
and movement slits; they are not simulated cloth.

## Verification and reproducibility

`validate_equipment.mjs` runs Khronos glTF Validator on all 252 exports and
compares every inverse bind matrix by bone name against the matching delivered
character. Per-file validation reports sit beside the GLBs. The aggregate report
is `assets/equipment/authored/validation-summary.json`.

`viewer-qa.mjs` loads all three complete outfit families in both tiers on all
four characters, then samples bind pose, Walk, Run, Attack, Block and Hit at
multiple times, checking for invalid or exploding skin coordinates. Results are
saved to `output/models/equipment-production/animation-qa.json`. Three accessory
combinations in each tier on every character also exercise all fitted rings,
necklaces and trinkets against the Attack pose. This numerical
check complements the front, angled and rear Blender renders and viewer
screenshots; it is not a claim that every possible mixed outfit is collision-free.

Revision 2 also uses `review_all_v2.mjs`: 20 character/weapon combinations,
1,860 sampled poses, 72 unobscured chest views, and actual Fighter runtime grip
comparisons. `inspect_motion_v2.mjs` checks adjacent quaternion continuity and
loop closure. `verify_revision_v2.mjs` checks all twelve character files against
the preserved originals: mesh attributes, morphs, weights, inverse bind matrices
and textures are byte-identical; local node serialization differs only within
0.00001. Reports and pose images are in `revision-v2/`.

The editable motion libraries are
`revision-v2/{fighter,wizard,cleric,rogue}-animation-review.blend`.
The normal character `.blend` files and equipment reference scenes contain the
updated default clips. These editable sources are tracked with Git LFS; run
`git lfs pull` before opening them. `delivery-files.json` lists the published
source/review artifacts. The pre-revision character/source files and the live
Blender scene remain local backups under `revision-v2/before/`; they are excluded
from the published package. The preservation report records that local comparison.

Authoring scripts in `output/models/equipment-production` rebuild meshes through
Blender 5.2. `inventory.mjs` reads the actual game catalog, `armor.py` fits against
the delivered body and underclothes, and `weapons.py` authors the rigid pieces.
The live Blender MCP addon was used for initial access; bulk exports and renders
use the same installed Blender executable in background processes.

Run Node scripts from the repository root after `npm ci`; the validator is a
pinned development dependency. Blender authoring scripts resolve the checkout
from their own location and require Blender 5.2. For example:

```bash
blender --background --python output/models/equipment-production/rebuild_chests_v2.py
node output/models/equipment-production/validate_equipment.mjs
node output/models/equipment-production/package_assets.mjs
```

These rebuild commands overwrite the corresponding final exports and sources;
commit or copy intended manual Blender edits before regenerating procedural pieces.
