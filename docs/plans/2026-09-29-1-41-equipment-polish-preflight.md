# Alpha 1.41 — character/equipment finish, local work

Partial code-owned polish, not a versioned release or final art acceptance.
1.35–1.38 still await ordered publication after the owner's DDNS correction.
1.39/1.40 human pacing/readiness evidence remains open. This independent art
work does not skip those gates or imply beta admission.

## Wrist silhouettes and visible grips

Inspected the accepted ordinary Fighter outfit capture from the 1.18 gallery
and current equipment/rig source. Equipped gloves were solid dodecahedra
around the wrist; the rig already has shared curled fingers and a thumb below
that anchor. Keeping a mesh's visible flag did not establish that the glove
shell left those fingers readable.

Replaced the equipped wrist mass with a tapered hollow cuff and rolled rim,
using a modeled inside and smooth normals. Metal, leather and silk keep their
existing palette/material distinction. The fingers, weapon anchors, animation
tracks, equipment fit scales, saved items and gameplay stats are unchanged.
Three glove sockets now follow the curved cuff instead of extending off one
side of the wrist; rarity accents remain. Geometry/material caches and normal
opaque batching are retained. No per-frame geometry or physics added.

255 focused garment/equipment/socket tests passed in3.709s. New checks inspect
finite positions/normals/UVs, bounded dimensions, a real axial opening, shared
geometry, smooth materials and socket contact with the actual cuff surface.
Existing four-class grip visibility and equip/unequip checks remain. Scoped
lint and whitespace checks passed.

Hardware-Chrome ordinary Fighter/Rogue comparison cases passed in25.2s:
default/full/mixed outfits, High/Low, close/gameplay views and cast/seated/death
poses. Root inspected Fighter full and Rogue cast screenshots at
/tmp/eidolon-141-cuffs-preview/. Fingers are exposed below the fitted cuff;
this is a visible local improvement, not a full modern-character sign-off.

Follow-up Wizard/Cleric ordinary comparisons and the enhanced-gear Fighter
local/remote Idle/Run/Attack gallery passed (3 cases,35.6s). Root inspected
Wizard casting and Fighter side-attack views in /tmp/eidolon-141-cuffs-followup/.
The paired Fighter grips and sockets remain attached during the attack pose.

## Remaining 1.41 scope

### Footwear follow-up

Equipped leather/iron boots now use a rounded toe, rising instep, open ankle,
closed outsole and a toe overlay sampled from the same upper. Smooth seam
normals avoid a lighting split along the front. Original foot anchors, animation
tracks, fit scaling and sole elevation remain; no movement or collision changes.

Socket and set/unique ornaments follow the new upper through a shared profile
sampler. Sandal ornaments now sit against the strap rather than above the shoe.
Rarity colors, gem identities and earned effects are retained. Default class
boots were addressed in the subsequent integration below.

262 garment/equipment/socket checks passed in4.372s, including finite/bounded
geometry, outward outsole, open ankle, shared seam normals and actual ray-cast
contact for sockets/set/unique ornaments on leather, iron and sandals. Scoped
lint and whitespace passed. Fighter/Rogue ordinary views passed in25.0s at
/tmp/eidolon-141-boots-preview/; the final seam/ornament follow-up passed three
Wizard/Cleric ordinary and enhanced local/remote Fighter cases in35.6s at
/tmp/eidolon-141-boots-final/. Root inspected Fighter ordinary, paired enhanced
Fighter front and Cleric ordinary full outfit views. This is not final art,
device-performance or complete 1.41 acceptance.

### Default class outfits integrated

All four default outfits now use the same fitted boot/cuff geometry families,
with class-specific widths, palettes, toe trim and existing wrist details.
Cleric foot ornament placement follows its new boot. Meshes remain children of
the original equipment anchors; foot/wrist transforms and animation tracks are
unchanged. Smooth default materials are cached clones, leaving the original
shared armor/skin materials untouched. Default geometry remains shared across
instances and is hidden/restored by the ordinary equipment lifecycle.

284 humanoid/garment/equipment/socket checks passed in7.451s. Four new class
cases explicitly verify shared meshes/materials, hidden defaults while equipped,
exact restoration after unequip and unchanged anchor transforms. Lint and
whitespace passed. All four ordinary browser comparisons passed in51.7s at
/tmp/eidolon-141-default-fit/ (default/full/mixed, High/Low, close/gameplay,
cast/seated/death); root inspected Fighter and Wizard default close-ups.
No authored actor model, stats, collision or networking changed.

### Shoulders, cloth mantles and Fighter helmet

All four default shoulder sets now use fitted shells or draped cloth instead
of solid polyhedra. Fighter spikes/rivets, Rogue asymmetry, Wizard runes and
Cleric seals/palettes remain. Default shoulder anchors and animation tracks are
unchanged, and the ordinary equipment lifecycle hides/restores all new pieces.
Wizard and equipped Velvet Mantles share bounded cloth folds and a matching
hem, with joined lighting normals across the UV seam. Smooth double-sided
cloth uses cached cloned materials without changing shared body materials.

Inspection found the existing metal shoulder profiles wound inward: the
outside could be culled while the inner surface showed. Reversing the profile
fixes shell/rim/lame face orientation without changing their dimensions. All
three equipped shoulder families now seat sockets and set/unique ornaments
against their actual surface, sampled once at item construction, not per frame.
The Fighter default great helm uses a rounded crown and smooth surface while
preserving its brow, nose guard, paired eyes and crest.

300 focused humanoid/equipment/garment/socket tests passed in4.918s. Added
coverage checks outside-facing shoulder/helmet triangles, bounded mantle data,
continuous seam lighting, hem clearance, both-handed socket/identity contact,
default shoulder cache/hide/restore and Fighter eye clearance. Scoped lint and
whitespace passed. Four ordinary Chrome visual comparisons passed in48.0s at
/tmp/eidolon-141-shoulder-fit/ (all classes, default/full/mixed, High/Low,
close/gameplay, cast/seated/death). Root inspected all four default close-ups
and the equipped Wizard. This improves the current procedural silhouettes;
it is not final actor-art acceptance or a new performance/hardware claim.

### Articulated leg equipment and default leg silhouettes

Inspection found that leg items replaced only the thighs, leaving the default
shin/greave appearance underneath every replacement. Added two shin anchors
to the existing knee bones and split leg visuals into upper and lower sections.
All three leg families now replace both sections: plate/leather get fitted
calves and curved front guards; skirts get a matching dark lower layer. Gems
and identity ornaments remain on the upper sections, not repeated per bone.
Unequipping restores the original class kit. Item count stays14; a full outfit
now occupies20 articulated anchors rather than18. No save/network/stat changes.

Default four-class thighs/calves use shared shaped profiles and smooth cached
materials; Fighter/Rogue pointed shin cones become curved half-shell guards.
Wizard default robe panels now have modeled folds. Knee/foot pivots, motion
tracks and class proportions remain. The visual gallery's identity-region
counter now requires an actual ornament, not just inherited item metadata.

307 focused humanoid/equipment/garment/socket tests passed in4.850s; another19
replication, migration-guard and surface-map tests passed in1.852s. New checks
cover all four classes swapping all three leg families, exact lower-layer
restoration, unchanged feet and independent knee articulation, plus bounded
geometry and outward faces. Scoped lint and whitespace passed.

Eight hardware-Chrome comparisons passed in1.5m at/tmp/eidolon-141-leg-fit/:
four enhanced local/remote Idle/Run/Attack front/side/back cases and four
ordinary default/full/mixed High/Low close/gameplay/cast/seated/death cases.
Root inspected Fighter and Wizard side-running paired actors, Fighter full
ordinary outfit and Wizard default folded robe. This is local integration
evidence, not a phone check or completion of the full1.41 art contract.

### Leg ornaments, Cleric vestments and headwear clearance

The shared once-at-construction armor surface sampler now also places thigh
sockets, set/unique runes and knee marks on the actual plate/leather/cloth
surface. It no longer uses the former cylindrical-leg offsets. Lower sections
still do not duplicate the upper ornaments. Cleric default vestments now use
folded cloth and gold trim sampled from the exact bottom two cloth rows, with
matching transforms and a2mm offset. Class colors, shortened vestment length,
sunplate motif and equip/unequip behavior remain.

311 focused tests passed in4.790s before adding the headwear clearance check;
the expanded equipment suite subsequently passed242 cases in2.563s. The four
new class cases check both eyes against all three headwear families at item
levels1/30/100, from front and angled views, including rendered merged meshes.
No eye-obstruction correction was required by those cases. These checks prove
eye clearance, not all hair/skin intersection or final face-art acceptance.

Four Chrome cases passed45.8s at/tmp/eidolon-141-leg-details/ (enhanced paired
Fighter/Wizard/Cleric movement poses and ordinary Cleric default/full/mixed
High/Low close/gameplay/cast/seated/death). Root inspected the Cleric default
folded vestment and hem. Scoped lint and whitespace passed. No production
write, version claim, saved-item change or per-frame fitting work was added.

### Rogue identity, hood and necklace layering

Found and fixed a lifecycle bug: equipping any head item hid the Rogue's nose,
lips and eyebrows with the replaceable hood. Those facial details and hanging
hair locks/braid now remain, while the hair cap/default hood correctly hide.
Replaced the default inverted-cone hood with the shared open-face hood, retaining
the previous overall height envelope, attachments and class palette.

Pendant/Necklace chains are now continuous draped tubes meeting front-facing
focus pieces. Initial checks exposed overlap with the raised plate keel/sigil;
the final shorter, forward placement clears the chest decorations without
hiding them. Tests check actual chain-to-focus triangle contact and front
clearance for all four classes, three chest families and both extreme mixed
level pairs (level1 chest/100 necklace and the reverse). Shared resources and
ordinary equipment lifecycle remain; no per-frame fitting or stat changes.

Final322 focused tests passed6.555s, lint/whitespace passed. Three Chrome cases
passed42.4s at/tmp/eidolon-141-head-neck-fit/ (Rogue enhanced local/remote poses,
Rogue/Cleric ordinary outfits). After retaining Rogue hanging hair, its ordinary
case passed17.9s at/tmp/eidolon-141-rogue-hair/. Root inspected Rogue default/full
and Cleric necklace views, plus the final Rogue with hair visible under its cap.

### Consolidated remaining work

The preceding boot/cuff, shoulder, leg, cloth, eye/face and necklace checks are
completed local evidence. Do not rerun them one slice at a time without changes.

- Small accessories are integrated and a clean preview candidate is staged
  below. Do not reopen the completed boot/cuff/leg/shoulder slices without new
  evidence. The final enhanced gallery still shows legacy head/chest decoration
  offsets; review those mounts before claiming the full ornament pass complete.
- Reuse accepted galleries and lifecycle checks for candidate review rather
  than another broad soak. Do not infer phone hardware acceptance.
- The supplied Fighter GLB pilot is still an open handoff, not an existing
  asset. This work improves the procedural fallback and integration; it does
  not replace rigid anatomy with authored characters or prove final modern-ARPG
  art quality. Do not invent a rig, licensing or owner art approval.
- Ordered publication and real live verification remain pending the earlier
  releases and public DDNS correction. 1.39/1.40 human gates also remain open.
  No 1.41 version or full-milestone completion is claimed by this preflight.

### Small accessories and unified equipment check

All twelve ring/waist/trinket/neckwear variants now have scaled socket/identity
settings fitted to actual supporting surfaces. Ring sockets face upward into
their mount; a bridge supports ring stones across the finger opening. Necklace
and trinket settings provide a real backing where the old open torus had none.
Trinket frames now face outward around their focus. Gem colors, identities,
empty sockets and set/unique effects retain existing data; fitting runs only
at construction, before cached batching.

334 focused tests passed4.907s, including all twelve accessory variants at
levels1/100 with three sockets and both identity markers. Settings are checked
against actual surface intersections, not only bounding boxes. Another25
gallery cleanup/replication/migration/surface-map checks passed2.226s. Lint
and whitespace passed.

The combined hardware-Chrome check exercised every one of36 equipment families
on all four local/replicated classes and full outfits in High/Low. It first
passed21.2s, but screenshot review found stale cast effects obscuring the Cleric
equipment view. Entering single-item or full-outfit preview now cancels those
effects and any preview jump. The final run passed19.9s at
/tmp/eidolon-141-integrated-clean/. Root inspected all four earlier enhanced
views and the final clean Rogue/Cleric captures. Prior ordinary/movement checks
above remain applicable; the gallery is not an all-device performance claim.

The isolated art candidate is based on prepared1.38, separate from the root's
pending gameplay WIP, and includes draft unreleased patch notes. Its runtime
version remains1.38 deliberately: no publication or skipped1.39/1.40 gate.
Candidate files are byte-matched to the tested root files before committing.
