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

The first CI attempt (39105575312) found three unchanged asset-inventory
assertions that omitted the new approved pilot. The correction names exactly
the two pilot files, their runtime/import modules and cache hashes; the retired
asset payload limits remain zero. All other 12,534 Jest checks passed in that
attempt. The corrected source must complete its own CI and live verification.

Final pre-publication review also caught the normal idle tick replacing the
generated reaction on its next frame. The pilot now retains that clip for its
bounded reaction window, then returns to idle. Browser coverage advances the
actual Actor update through both phases; movement/attack selection remains free
to take over. This correction supersedes the queued intermediate source.

## Live acceptance — October 18, 2026

All ten jobs passed in [CI 39106396060](https://github.com/aeml/eidolon/actions/runs/39106396060).
The frontend release manifest and backend health endpoint both report
`Alpha 1.79.80`, commit `f5401eb714d52055ce2fda52091a540109da6197`;
backend status is `ok` and database readiness is `ready`.

Both public GLBs match their complete SHA-256 hashes and exact byte sizes in the
pilot manifest. The public play link was independently checked with system
Chrome on the AMD Vulkan renderer. High/Low skin independence, equipment,
eleven available base/gesture poses, hit retention/recovery, unchanged actor
position, and pool reuse passed without browser exceptions or asset HTTP errors.
The public fixture pins its entry modules to the deployed release, matching the
published modules' versioned sibling imports.

The pipeline additionally passed its live account/persistence, movement,
regional and Verdant dungeon, town recovery, and rest-state routes. This accepts
the opt-in alpha deployment; the shoulder/hand/fitting art caveats above remain.
Documentation acceptance commits do not change the deployed runtime identity.
