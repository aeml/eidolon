# Alpha 1.79.80 — experimental Meshy Fighter

The owner requested publishing the generated Fighter pilot to master and the
live alpha for hands-on testing from a remote browser.

Open `https://play.eidolonrealms.com/?fighterModel=meshy` and enter a Fighter
character. The query selects the pilot for this browser's Fighter actors,
including previews and remote Fighters. The current appearance remains the
default; `?fighterModel=standard` selects it explicitly. No character save or
equipment identity changes are required.

## Delivered behavior

- Paid Meshy generation and rigging produced a 24-bone body, four Prime motions
  (Idle, Attack, HitReaction, Death), and the included Walk/Run clips. The approved
  pilot used 93 credits. Source task IDs and asset hashes are in
  `assets/archetypes/Fighter/meshy-pilot-manifest.json`.
- High and Low exports are approximately 3.0 MB and 1.4 MB, with 1024/512-pixel
  browser textures. High retains 15,607 triangles; Low simplifies the source.
- Export preparation normalizes the centimeter rig to meters, names its bones
  for the existing equipment/gesture adapters, and removes horizontal pelvis
  travel. Authoritative movement, collisions, hit timing and statistics remain
  owned by the existing game systems.
- The adapter clones independent skeletons and installs equipment mounts,
  existing cast/guard/shout gestures, seated presentation, fixed interaction
  bounds, and reset/disposal hooks. Its pool is separate from the current Fighter.
- Idle Fighters can use the generated hit reaction. Attacks, movement and skill
  actions retain their existing recoil path so incoming hits do not interrupt
  their animations. Reduced-motion and death guards still apply.
- Failure to load the optional export retains the existing equipped procedural
  fallback and does not poison the asset pool.

This is an experimental alpha selection. Shoulder/underarm deformation, open
hand grips and armor fitting still need visual refinement. It does not establish
final character-art approval, complete per-skill authored motions, or a phone
performance qualification.

## Verification

Focused Jest checks cover the exported rig/motions, asset hashes, in-place hips,
reaction scheduling, existing character loading, versions and patch history.
The normal browser fixture loads High and Low through Actor/MeshFactory, renders
equipment and skills, checks independent bones and finite transforms, and
exercises pool reuse and hit presentation.

The dedicated `EIDOLON_ISOLATED_QA_ROUTE=meshy-fighter` route registers only a
disposable Fighter, follows the actual experimental play link, enters the
authoritative world, and checks normal movement and menus. It uses the existing
owned Docker cleanup and credential/artifact policies.

The existing full CI and deployment gates remain required. Deployment acceptance
requires matching public frontend/backend commit identities and a live check of
the experimental Fighter path. Prepared source alone is not a live-tested claim.
