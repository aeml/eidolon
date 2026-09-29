# Distinct ability gestures — September 29

Local continuation of8108e858. No release identity change or deployment.

Added five one-second authored pose clips to the shared procedural class rig:
Cast (off-hand release), Channel (sustained raised focus), Guard (defensive
off-hand), Shout (open posture), Bless (raised support gesture). Values are
relative to each class's actual resting pivots, preserving different anatomy
and attachments. Clips contain upper-body rotations only, with rest endpoints;
no root translation, lower-body motion or new geometry/material/effect.

Mapped existing cast/heavy-cast/channel/buff/shout/summon/bless presentation
profiles to those clips. Existing profile durations are unchanged; Actor
continues scaling the selected clip to that duration. Basic Attack, charge,
spin, throw, volley and compatibility fallbacks retain their current paths.
Rigs lacking the new clips still select Attack through existing fallback.
This is not a new gameplay cast time or a projectile-release timing change.

The moving-cast gait correction remains active under these upper-body actions.
Player animation manifests now explicitly list the added clips; regenerated
ANIMATION_COVERAGE also refreshes previously stale effect/state rows from
the already-integrated source. No user-facing version bump.

Verification:
-86 tests in five suites pass2.137s: humanoid rigs, ability/actor manifests,
 animation state and moving casts, including the synthetic older-clip fallback.
-39 tests in three suites pass3.624s: new ability clips, actual animated
 surface equivalence/batching and basic cadence. Covers finite/rest-bound
 tracks, all five distinct poses per class, intended skill selection and exact
 profile duration/time scale. Existing geometry/grip anchors unchanged.
-Scoped lint and whitespace checks pass; coverage generator succeeds.
-Prepared desktop1280×900/High and phone390×844/Low frame-sequence browser
 checks pass10.8s. Moving shout/cast/blessing and stationary
 Guard/Channel/Bless reviewed with the normal camera and HUD.
 Artifacts:/tmp/eidolon-ability-gestures-0929.
-Inspected desktop cast/support and phone support views. These distinguish
 support/caster gestures from basic weapon strikes but are not final character
 art, human feel, all-equipment fit or connected combat acceptance.

No campaign soak, balance adjustment or FPS claim. Prior six-site High pass
remains evidence for its specific scene/revision; broad performance/visual
acceptance and the pending1.39/1.40 release decision stay separate and open.
Continue the full ordered roadmap and integrated modern-ARPG reference work.
