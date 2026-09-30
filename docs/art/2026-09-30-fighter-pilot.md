# Fighter authored model pilot

September 30, 2026. The owner delivered a rigged, underclothes-only Fighter in
commit `da02a2a5b35e70b8b890873d36adcf2804433281`. It was preserved by the fresh
remote merge before the 1.53 push. The asset is available for integration; the
live runtime still uses the procedural Fighter. The unpublished normal factory
and character preview now select derived, independent rigs on demand. This is
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
4.5.1 SDK functions to weld, resample, selectively simplify, resize and encode
WebP textures, followed by CLI validation. Its development dependencies are
locked in the repository rather than loaded through another worktree.
The source hash is pinned, its original export/notices remain untouched, and
attachment leaves are never pruned. Commands follow the
[upstream optimization documentation](https://gltf-transform.dev/).

The revised manifest records High at 7,333,168 bytes and 64,150 triangles,
with textures capped at 1024px; Low is 3,641,656 bytes and 36,498 triangles,
with textures capped at 512px. Both retain 53 joints, all 12 clips, ten sockets,
11 skinned meshes and both blink targets, with no external dependencies. Fresh
validator runs found zero errors/warnings and the same three unused-tangent
informational notices. Only the body is simplified; hair, shorts, seams and
layered eyes preserve their original triangle counts. Normal and packed
material maps use lossless encoding. The larger revised budgets preserve fit
and data quality while retaining substantial savings over the 40.34MB source.
Structural validation alone does not establish final appearance.

`AuthoredFighter.js` clones the complete skeleton/skin hierarchy, shares immutable
geometry and textures, normalizes to the existing 4.5-world-unit height above the
feet, retains authored motion and keeps a resettable per-instance pose. It now
feeds the unpublished default Fighter factory. Five runtime skill clips cover
Cast, Channel, Guard, Shout and Bless: gestures convert world-space rotations
through the delivered bones rather than copying procedural Euler tracks;
Guard retains the supplied Block animation. The original 12 clips remain.
An explicit quaternion/vector mask supports moving casts without blending Run
into the skill's upper body. Recoil moves the common skin/skeleton wrapper.
The migration guard now allows exactly these two derived exports, their adapter
references and the pinned derivation script; retired assets remain prohibited.

The native Chrome pilot renders two independent actors for each quality, all
11 skinned meshes per actor and decoded bounded textures. Revised Idle and
Attack screenshots show intact scalp/shorts and clean skin. The studio fixture
now uses the game's existing shadow bias instead of a zero-bias light, which
can produce self-shadow acne. Geometry, map encoding and fixture lighting
changed together; this is not an isolated measurement of each cause.

The corrected six-pose route passed in 8.7s; adding five skill samples passed
in 10.8s. Idle, Attack, Shout and Channel screenshots were reviewed. Four focused
JS suites passed 41 checks in 3.191s, including quaternion gait isolation,
source-pose preservation and common-wrapper recoil. Artifacts are in
`/tmp/eidolon-1-54-fighter-skills-0930`; metrics are saved as JSON, not merely an
ephemeral reporter attachment. The four-actor studio measured 49 draw calls
and 202,066 rendered triangles including the floor, with a 1.596s combined
local loading/setup sample from the earlier corrected run on RADV RENOIR.
These are local fixture measurements, not internet-load, frame-rate or final
GPU/memory qualification. Equipped gameplay-camera/character-sheet tests remain.

The expanded native route then passed in 10.4s using ordinary `Actor` instances
for both quality levels. Guardian Roar retained its Shout action while the
thighs moved; the compared upper-arm, forearm and spine quaternion components
matched a control with its gait layer disabled, and authoritative positions
remained unchanged. A normal hit request selected the common visual wrapper;
disposing the temporary actors completed without browser errors. This checks
the current adapter/controller path, not default-factory or equipment activation.
Evidence is in `/tmp/eidolon-1-54-fighter-controller-accepted-0930`. The first
comparison used angular distance on slightly non-unit Float32 source rotations;
it now compares components directly. Recoil is checked after its normal lazy
initialization, not assumed to exist before a hit.

## Equipped Fighter adaptation

The shared equipment dispatcher now supports authored and procedural bodies.
Ordinary Actor refresh/disposal, MeshFactory release and CharacterPreview
equipment calls use that dispatcher. The normal Fighter factory now selects
High/Low derived exports with a fully equipped procedural fallback on failure.

Six clothing slots use shaped pieces fitted in neutral bind space and weighted
to the delivered skeleton. Eight rigid slots use calibrated sockets or finger
mounts. Existing item variants, rarity, potency, gems, set/unique markers and
cosmetic descriptors remain available. Fitted geometry and conservative body
masks are shared without item-ID cache keys; copied ornaments are disposed on
unequip without disposing shared body/garment geometry. Original source geometry
and the supplied GLB remain unchanged.

The delivered body has no waist faces beneath its shorts. Equipped pants retain
that fitted coverage as an underlayer instead of exposing a hole when hiding
the original shorts. Body masking stays inside covered regions to avoid jagged
collar/upper-arm gaps, and robe/skirt layers use distinct dimensions. GLTFLoader's
interleaved skin attributes are copied through component accessors rather than
raw-array slicing, which initially corrupted joint indices in the native test.

The final native Chrome route passed in 20.4s with ordinary Actors: two High and
two Low instances wear four complete 14-slot loadouts covering plate, leather,
cloth, sword, dagger, mace, staff, shield and tome. All clothing pieces use their
actor's skeleton; no slot is missing. The route samples equipped Idle, Run,
Attack, Guard, Shout and Death, then checks restoration and ordinary disposal.
Idle, Run, Guard and early Death renders were reviewed across the recent runs.
The current render removes collar holes and separates cloth layers. This is
baseline fitting, not final modern armor art or complete clip-duration review.
Evidence is in `/tmp/eidolon-1-54-fighter-fit-reviewed-0930`, including durable
equipment/metrics JSON and screenshots. Six focused authored-model checks passed
in 1.973s, including interleaved accessors and shared/owned geometry disposal;
changed-scope lint passed. Earlier consumer regression checks passed 433 tests.

Shield grip now follows the hand while its face follows the torso instead of
turning edge-on with the supplied unarmed wrist poses. Reviewed Run/Guard renders
show the intended orientation. Tome poses retain their original mount behavior.
The normal Actor mixer and static character-preview render apply this adjustment
without changing authoritative transforms.

The normal asynchronous entity path now chooses quality-specific pools, resets
rest poses on reuse, and falls back on missing/invalid/slow exports. A timed-out
observation retains the actual in-flight download instead of duplicating it.
Temporary fallback Fighters are not pooled as permanent replacements. The two
derived asset URLs use their content hashes for cache invalidation. Discarded
instances and preview disposal release owned skeleton textures without disposing
shared source geometry/materials. A late preview result cannot replace another
class or a disposed preview, and installation uses the newest equipment snapshot.

Nine targeted JS suites passed 196 checks in 11.992s; changed-scope lint passed.
Four native browser cases passed in 43.7s: the pilot now loads all four Actors
through ordinary ensureMesh/factory calls, creates independent High/Low static
CharacterPreview instances with matching 14-slot equipment signatures, and
checks character-sheet controls at 1280/900/390px. Reviewed High/Low preview,
isometric and Guard screenshots are in
`/tmp/eidolon-1-54-fighter-integrated-0930`, with durable metrics JSON.

A 60-frame four-equipped-actor sample using the game's isometric view direction
recorded CPU animation/render submission p50 10.4ms and p95 15.1ms on RADV RENOIR,
285 draws, 165,536 rendered triangles, 221 renderer-tracked geometries and
85 textures. Local combined loading/setup was 1.665s. These are fixture counts
and CPU submission timings, not GPU memory bytes, guaranteed FPS, internet load,
physical-phone performance, full-world gameplay or 100-player capacity evidence.

One newly identified activation gap remains: CasinoController still seats only
procedural Rig_* bones. The authored Fighter needs a real seated pose and exit
restoration before deployment. Full clip-duration/clipping review and the normal
RenderSystem/gallery consumer path also remain; rigid equipment uses the existing
simple forms. This work does not certify final Diablo/PoE art quality.

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
4. Finish the remaining generated-equipment review above: inspect full clip
   durations and clipping, adapt casino seating/restoration, and check the normal
   gallery/RenderSystem consumers. The owner supplies bodies—not an equipment or
   environment catalog.
5. Compare the actual gameplay camera and character sheet, High/Low settings and
   a shared multi-actor workload. Review appearance and readable combat, not just
   finite transforms or mesh counts, before enabling the model by default.

Other class/NPC/monster deliveries and full modern-art acceptance remain
separate requirements. Default Fighter activation still requires generated
equipment motion/fit acceptance, integrated skill/controller acceptance, fallback/cache/pool
lifecycle, current gameplay camera and character-sheet review, and measured
High/Low full-world performance. The first independent preview and equipped
four-actor fixture checks pass; they do not close all those requirements.
No new owner model request is needed. Markdown was source-reviewed; no rendered
documentation preview was available.
