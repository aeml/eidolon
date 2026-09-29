# Modern dark-fantasy ARPG — closed-beta visual contract

User direction, September 28: Eidolon is currently open alpha. Continue toward
a game ready for an intentional **closed beta**, with substantially better 3D
characters, equipment appearance and fit. Diablo and Path of Exile are mood and
quality references: modern dark-fantasy ARPG presentation, not a requirement to
copy their proprietary characters, items or environments.

This supersedes the earlier art bible's low-poly/faceted finish as the final
target. Existing procedural geometry is an implementation starting point, not
an aesthetic constraint. A passing mesh manifest or the historical September 4
visual closeout does not establish this newly requested visual quality.

Timing update: the owner now requires closed beta only when the game is nearly
complete, not at1.20. Keep code-owned art work early and ongoing. A1/A2 are
open-alpha foundation gates; final approved modern presentation is required
for Q and the near-completion CB gate, targeted at1.90 subject to readiness.
This changes beta timing, not the requested visual scope or quality bar.

## Art ownership — user supplies actors, implementation supplies the world

### September 29 owner priority — player experience over milestone count

The owner reaffirmed that incremental improvements are not yet enough: the
world and combat should earn players' attention alongside modern dark-fantasy
ARPGs. Treat Diablo/PoE as direction for cohesion, atmosphere, readability and
responsiveness, not a claim of equivalent production quality or copied assets.

Use Lanternhold → Earth → the first dungeon as the playable reference:
judge it at ordinary gameplay zoom, in motion and with the actual interface.
Improve composition, material scale, grounded architecture, vegetation and
landmarks together; do not substitute darker lighting or more particles for
finished scenery. Combat review must include attack anticipation/contact/
recovery, movement responsiveness, sound, readable threats and a satisfying
single-specialization kit. Equipment must fit and remain recognizable in motion.

Passing technical checks establishes correctness, not final art or fun.
Concentrate bounded tests on changed behavior, compare visible results, and
carry honest remaining gaps forward. Do not advance visual acceptance solely
because a version shipped. Preserve ordered release gates and owner-deferred
playtests; this priority does not silently approve those gates.

The September 29 integrated terrain preview still shows broad muddy surface
variation, conspicuous repeated plant clumps, angular rock shelves and small
procedural actors. These are concrete remaining art gaps, not approved modern
ARPG presentation. Review scene composition and material frequencies next to
the remaining audio integration; retain clear enemy warnings and usable Low
settings. A faster renderer alone does not close these visual gaps.

Latest user direction: do as much environment, texture, lighting and shader work
as possible in code so the user's external asset work is limited to **player
class models, monsters, bosses and NPCs**. This is the production division of
work, not merely an optional way to divide a larger outsourced asset list.

| User-provided model scope | Code/integration work owned by implementation |
| --- | --- |
| Fighter, Rogue, Wizard and Cleric bodies/base appearances | Actor import/validation, rig/animation integration, equipment anchors, material assignment, previews, LOD/resource budgets, local/remote appearance and fallback behavior |
| Monster families and named bosses | Enemy instancing/pooling, animations/integration, materials, hit/selection bounds, attacks, warnings, death effects and encounter lighting |
| Town/story/service NPCs | NPC material/animation integration, placement, interaction bounds, names, quest markers and dialogue presentation |
| No requested environment asset production | Terrain, buildings/interiors, dungeon/raid rooms, props, foliage, rocks, roads, water, sky, portals, crystals and casino furniture/machines |
| No requested environment texture/shader production | Code-generated surface textures and PBR maps, terrain blending, lighting, reflection/atmosphere, shadows, weather, VFX, UI/item icons and quality/performance controls |
| No requested per-item armor/weapon modeling campaign | Procedural equipment families, fitted modular layers, weapons/shields/accessories, cosmetics and adaptation to approved actor rigs |

Actor geometry remains the user's creative contribution. Prefer neutral-pose
models and keep source files; supply a rig/UVs if available. The implementation
owns the engine integration and generated material work. The preferred technical
handoff below is a compatibility checklist, not a demand that the user author
environment assets, paint every texture, or solve the engine's rigging code.
If a model's topology/pose prevents sound animation or equipment fit, identify
the exact required mesh correction; code cannot guarantee repair of arbitrary
broken geometry. Prove one actor end-to-end before asking for a full catalog.

### Code-owned environment workstream

1. Establish a consistent generated material library: stone/mortar, soil/moss,
   timber/bark, cloth/leather, worn metal, ice, ash/obsidian and magical crystal.
   Base color, physical surface relief and roughness are separate signals.
2. Improve town and realm ground using seamless, registered surface maps and
   larger-scale variation; prevent repeated grids and noisy sparkling detail.
3. Refine buildings, landmarks, dungeon/raid interiors, props and vegetation
   with meaningful silhouettes, layered construction and matching collisions.
4. Integrate region-specific key/fill light, reflection response, contact
   grounding, fog, sky/water, weather and restrained emissive effects. Preserve
   combat readability and avoid expensive full-screen effects as a substitute
   for better geometry/materials.
5. Keep ability/projectile/impact/portal/crystal/casino effects and interaction
   feedback code-owned and tied to authoritative state.
6. Compare representative daylight/dark-interior/elemental scenes at normal
   gameplay zoom, High/Low and supported viewports, with bounded resource cost.
   Higher-quality screenshots alone do not prove sustained device performance.

Start with Lanternhold's stone and Earth soil material response using the actual
production terrain builder. This does not wait for imported actor models, change
collision heights, or require downloaded texture packs.

## Target

- Grounded heroic anatomy: believable shoulder/hip balance, neck/head joins,
  faces, hands and feet; distinct class silhouettes without disconnected solids.
- Sculpted surfaces and intentional hard edges. Smooth anatomy and rolled metal
  where appropriate; bevels, thickness and construction seams where they belong.
- Fitted equipment: breastplates follow the torso, pauldrons protect rather than
  overwhelm shoulders, belts sit at the waist, boots meet legs and ground, and
  gloves hold weapons. Mixed pieces must look like they belong to the same body.
- Material identity: worn steel, leather, cloth, wood, bone and restrained magic
  differentiated through shape, roughness and lighting, not only flat colors.
- Deliberate cloth volume, weight and articulation. Robes, skirts, capes and
  straps remain clear of limbs and weapons throughout ordinary movement.
- Atmospheric world lighting with readable characters and threats: contact
  shadows, controlled highlights, region-specific mood and coherent exposure.
  Dark fantasy does not mean hiding combat in black shadows or bright clutter.
- Weighty, responsive movement/casts/impacts and restrained layered effects;
  authoritative ranges, collision, timing and remote animation remain unchanged.
- Actual gameplay-camera quality and a satisfying equipment/character close-up.
  High/Low settings preserve silhouette, materials and important warnings.

## Implementation sequence before the closed-beta gate

This is an early parallel workstream in 1.11–1.20, **not postponed to 1.41**.
The later presentation band remains for player-driven refinement and broader
device polish. Do not rename the current alpha a beta merely to meet a number.

1. Capture and inspect the four current classes: default, individual/mixed/full
   equipment, front/side/back, idle/run/attack/cast and normal gameplay distance.
   List visible problems rather than relying on attachment-count assertions.
2. Complete one coherent Fighter visual slice: anatomy/head, layered armor,
   gloves/weapon/shield grips, boots and animation, shown under real lighting.
   Review that direction before multiplying it across the entire item catalog.
3. Apply the accepted quality bar to Rogue, Wizard and Cleric while preserving
   their identities. Do not treat a recolored Fighter as class completion.
4. Fit all equipment families and supported slots to those rigs, including
   mixed gear, low/high tiers, cosmetics, local/remote equipment changes, and
   unequip/pool restoration. Fix actual clipping/floating and stale appearances.
5. Integrate material/lighting and environment/major-NPC quality with the new
   characters; inspect one ordinary group fight and town at gameplay scale.
6. Record visual approval and relevant render/fit results for the complete
   slice and class coverage. Unapproved or partial work remains an alpha task.

Do not rebuild all assets blindly or run a full campaign for art-only changes.
Keep geometry/material ownership, draw budgets, cache reuse and cleanup intact.
Existing tests remain valuable for regressions but do not judge visual appeal.

## Optional authored-model pilot and artist handoff

Owner update: the first Fighter model is not available yet. The owner plans to
provide one neutral-pose GLB body with source/licensing information, rig and UVs
when ready. Do not repeat the request or ask for the whole actor catalog now.
Continue code-owned environment and equipment improvements meanwhile. This
defers the handoff, not the eventual model-integration or visual-approval checks.

The user may supply models made in Meshy or another tool. This is an option to
evaluate, not a claim that an external generator produces game-ready assets or
that importing a single mesh finishes equipment/animation integration. No paid
tool use, bulk asset purchase or production loader migration is authorized here.

Before commissioning/generating a whole set, use **one user-supplied Fighter body**
as the pilot. Implementation supplies and fits its procedural armor set; the user
is not being asked to model equipment, environments or texture packs. Agree the
visual silhouette in neutral front, side and rear views first. The game
integration needs:

- Editable source plus a proposed glTF/GLB handoff, with recorded provenance and
  redistribution rights appropriate for this open-source project. Validate the
  actual tool/export/license rather than assuming all generated assets qualify.
- Consistent scale, axes, grounded origin and neutral bind pose, aligned to a
  supplied reference rig. Current rigs are rigid procedural hierarchies, not a
  ready-made guarantee of compatibility with an arbitrary skinned character.
- A body that can accept swappable equipment, not a fully armored inseparable
  character mesh. Implementation supplies equipment and body masking/layering
  for covered skin, hair, helmets, gloves, boots and long cloth. Prefer a neutral
  pose; a rig and UVs are useful if available, not a requirement for the user to
  solve the engine integration before submitting the pilot.
- A shared skeleton/retarget plan and explicit attachment mapping. Preserve the
  production state vocabulary and canonical equipment anchors from
  `src/art/ProceduralHumanoid.js`; support both hands, shield, head, torso, neck,
  waist and paired shoulder/glove/leg/foot/accessory locations.
- UVs, useful normals/tangents, physically based base-color/normal/roughness/
  metallic inputs as appropriate, with no baked directional light mistaken for
  material color. Keep skin, cloth and metal separable for sensible shading.
- Deliberate topology around shoulders, elbows, hips and knees; test the real
  motion range. A good still render does not prove that armor deforms or fits.
- Measured triangle/material/texture/download budgets and lower-detail variants
  based on the existing browser workload. Do not choose arbitrary huge textures
  or promise console-quality assets will fit a phone budget without measurement.
- Representative locomotion, attacks/casts, hit/death and seated poses; correct
  hand grips, footing, root motion policy, bounds, pooled cleanup and remote
  replication. Missing animations/retargeting are integration work, not free.

Only promote the pilot after it looks materially better at the actual game
camera, fits the equipment system, loads within the approved budget and has
clear provenance. If suitable, add a specific authored-asset integration task
and update procedural-only production checks intentionally. Do not secretly
restore the old large asset library or delete the current fallback beforehand.

## Closed-beta acceptance additions

- [ ] Four classes meet the approved modern dark-fantasy direction at normal
  game scale and in the character preview; named remaining visual defects exist.
- [ ] Representative default/mixed/full/cosmetic outfits fit across normal
  animations without obvious holes, floating armor or body/weapon intersections.
- [ ] All equipment families/slots have reviewed coverage, with actor identity,
  tier/rarity readability and local/remote appearance preserved.
- [ ] Town/world lighting, important NPCs and a representative group encounter
  are coherent with the characters; essential combat information remains clear.
- [ ] High/Low and supported-view regressions pass; no unbounded per-actor
  material/geometry cost or missing disposal introduced by higher detail.
- [ ] Visual review is recorded as visual review, separate from functional tests
  and server performance. Owner feedback is incorporated before claiming finish.

## September 28 first local slice — not deployed

Inspected production Fighter front/side views at 1440×1000. Equipped pauldrons
were oversized solid polyhedra. Replaced steel/reinforced shoulder armor with
smaller hollow shells, an overlapping lower plate and rolled contrasting rim;
socket positions now follow the narrower surface. Selective smooth shading uses
a distinct cached material key, without changing other plate families.

These are cached rigid pieces on the same animated anchors, with no stats,
server rules, saved-item schema or body rig changes. Cloth mantles retain their
current design. This is a small construction/fit improvement, not completion of
the modern character pass or a promise of authored-quality anatomy.

Before/after captures and checks: `/tmp/eidolon-beta-fit-20260928-2sMeL9/`.
Temporary local artifacts are not durable published release evidence; preserve
chosen captures with the release before relying on them for long-term acceptance.

Focused verification:224 equipment/garment tests and scoped lint pass. All four
class browser fit routes pass (44.7seconds), covering both local and replicated
14-slot loadouts in fixed idle/run/attack front/side/back poses. Final front
views of all four classes were inspected, plus Fighter attack-side construction.
These checks verify attachment/motion and the small visual change, not full
modern-art acceptance, Low/mobile coverage or performance on the busy host.

## September 28 environment slice — local, not deployed

The production town/Earth terrain materials now generate normal and roughness
maps alongside existing albedo. Town relief uses the same stone/mortar shape as
its color texture; Earth relief uses its periodic soil fields. Darkness is not
treated as height, so painted stains do not become holes. Linear surface maps
and sRGB albedo stay separate. High/Low share canonical physical features and
normal strength; no displacement, extra ground polygons or collision change.

Maps are created with the environment/material, not per actor or frame. Extra
raw map storage across both production surfaces is1MiB at High /256KiB at Low,
before mipmaps/GPU overhead. Material disposal frees its private maps while
leaving caller-owned albedo alone; preview quality swaps remain stable.

Verification:19 terrain/environment unit checks pass, including deterministic
High/Low registration, normalized-vector byte quantization, map ownership and
unchanged realm footprints; scoped lint and whitespace checks pass. Two browser
routes pass (21.8seconds) and inspect four town/Earth High/Low views. Town High/Low
and Earth High images were visually reviewed against the baseline. Generated
materials compile without reported browser failures and retain two ground
triangles. These bounded gallery observations are not launch-performance proof.
Artifacts: `/tmp/eidolon-beta-surfaces-20260928-vXtBZd/` (before/after).

Remaining: larger-scale surface variation, architecture/prop materials,
vegetation, water/ice/fire/air treatments, lighting/atmosphere integration and
scene-wide review. This initial shader-input improvement does not complete the
environment redesign or modern closed-beta visual gate.

## September 28 Lanternhold/Earth scene pass — local, not deployed

The first representative scene combines the production batched Trading House,
smithy and stash with production town/Earth ground and instanced ossuary birches.
It is a controlled material-comparison vignette, not the actual town layout or
evidence of live navigation/interaction acceptance.

- Shared architecture materials now have world-scale staggered masonry,
  overlapping slate courses, weather variation and subtle timber fibres. The
  standard-material shader retains lighting, shadows, fog and normal maps;
  joints are derivative-filtered and fade when subpixel. Instancing and merged
  structures use physical world coordinates rather than stretched box UVs.
- Town/Earth key and fill colors now separate warmer light from cooler shadows.
  Town exposure is slightly reduced; lanterns retain their warm navigation accent.
- Ossuary birch crowns use deterministic folded leaf geometry with per-leaf
  color variation instead of solid polyhedra. Each crown remains one shared
  opaque instanced mesh (no individual leaf draw calls or alpha-texture sorting).
  Other tree species are deliberately not marked redesigned.
- No layout, picking volume, walking collider, quest, combat or saved-data change.
  No downloaded textures or per-frame shader updates were added.

Verification: 23 focused tests pass across surface hooks, leaf geometry,
architecture, foliage and regional themes; scoped lint and whitespace checks
pass. The final bounded browser route passes in 6.7 seconds with no reported
browser/shader failures. High and Low both render all three surface variants;
the comparison switches ground texture resolution to 256/128 respectively.
Final screenshots on both settings were inspected. Draw observations for this
fixture: High 182 calls / 19,979 triangles, Low 88 calls / 10,051 triangles; 33 textures each.
These are fixture observations, not a full-world/mobile performance acceptance.

Artifacts: `/tmp/eidolon-lanternhold-scene-20260928-zH7KRj/`, with `before/`,
`after/` (building/lighting only), `leaves/` and `final/` captures. These temporary
local files must be preserved with release evidence before long-term reliance.

Cost/remaining work: the shared leaf geometry is 108 KiB of attributes and 1,024
triangles per crown. Two crowns across 120 world birches add 237,120 submitted
triangles versus the old 36-triangle crowns when the complete instance batches
are drawn, before shadow passes. Keep this cost explicit; measure the populated
world and add spatial batching/LOD if needed before release. This small scene
is not proof that every realm meets its frame budget. Broad ground repetition,
town-edge transitions, richer silhouettes/props, other vegetation species and
realm-specific water/ice/lava/air/dungeon/raid/casino treatment remain open.
The modern-art gate and owner scene review are not complete.
