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

The user may supply models made in Meshy or another tool. This is an option to
evaluate, not a claim that an external generator produces game-ready assets or
that importing a single mesh finishes equipment/animation integration. No paid
tool use, bulk asset purchase or production loader migration is authorized here.

Before commissioning/generating a whole set, prepare **one Fighter body and one
matched armor set** as a pilot. Agree the visual silhouette in neutral front,
side and rear views first. The game integration needs:

- Editable source plus a proposed glTF/GLB handoff, with recorded provenance and
  redistribution rights appropriate for this open-source project. Validate the
  actual tool/export/license rather than assuming all generated assets qualify.
- Consistent scale, axes, grounded origin and neutral bind pose, aligned to a
  supplied reference rig. Current rigs are rigid procedural hierarchies, not a
  ready-made guarantee of compatibility with an arbitrary skinned character.
- Separate body and swappable armor regions. Do not bake every equipment item
  into one inseparable character mesh. Agree body masking/layering for covered
  skin, hair, helmets, gloves, boots and long cloth.
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
