# Alpha 1.43 — combat presentation, local work

Partial independent implementation, not a release. Earlier milestone candidates
and public deployment verification remain outstanding. No balance, saved build,
encounter timing or reward changes are authorized by this visual pass.

## Reduced-motion danger warnings

Source review found that transient telegraphs always oscillated brightness,
rotated/scaled their motif and pulsed the label, even when the browser requested
reduced motion. They now read `prefers-reduced-motion` when created, with an
explicit `reducedMotion` option available to callers. Reduced mode holds motif
rotation/scale and label size/opacity steady. The exact outer radius, contrast
underlay, text, gradual urgency buildup and authoritative duration remain.
Normal mode is unchanged. Existing warnings finish with the preference sampled
at creation; live settings changes and other effects are not covered by this fix.

23 targeted warning/Dark Realm checks passed (2.646s), including browser-option
and explicit-option routes, nondecreasing warning opacity, exact radius, fixed
decorative transforms and cleanup at expiry. Browser tests exercise both media
preferences at High/Low and four phases: two cases passed (23.2s). Inspected
reduced-motion Low at phase0.75 in `/tmp/eidolon-143-warning-motion/`; the edge
and label remain readable among the gallery actors/auras. Scoped lint and
whitespace passed. No new test stage or long soak was added.

## Ground-level effects and dungeon floor depth

The canonical dungeon floor is at y=0.1. Projectile impact roots were clamped
only to y=0.04, burying their ExactField (world y=0.075). Their outer boundary
was just above the floor (y=0.105), not buried. Roots now clamp to y=0.1.
Fireball, Meteor and Explosive Trap retain their exact radius and elevated
origins; supplied positions are not mutated. A real-renderer pixel test failed
before the fix and passed afterward at High/Low and zoom10/30.

The same review found boss telegraphs arriving from the network at y=0. Their
ring, fill and motif were below the same dungeon floor. Added BossTelegraph to
the rendered test: it failed before the fix (visible pixels equaled floor-only
pixels). Telegraph presentation now uses a cloned origin clamped to y=0.1,
keeping the ring, backing, fill, motif and label aligned without changing X/Z,
radius, server hit detection or duration. Unit checks cover all five authored
themes plus unthemed warnings and four starting elevations. An initially
incorrect test theme name was corrected to the actual `umbral_nexus`.

Final 98 warning/projectile unit checks passed in 2.634s. Three browser cases
passed in 25.2s: floor visibility and normal/reduced-motion warning galleries
at High/Low. Scoped lint and whitespace passed. Evidence:
`/tmp/eidolon-143-warning-floor-before` and
`/tmp/eidolon-143-warning-floor-after`. Inspected the reduced-motion Low
phase0.75 capture: warning border, backing, fill and label remain visible among
actors and the larger Spirit Guardians rings. This is representative gallery
evidence, not a full multiplayer encounter or every combination of overlapping
effects. Previous projectile-only before/after evidence is retained at
`/tmp/eidolon-143-impact-floor-before` and `...-after`.

## Lifecycle and camera review

113 existing targeted checks passed in 4.769s across AttachedStatusEffect,
WhirlwindPresentation, GameEngineDungeonContainment, DeathRespawnPolish,
RenderSystemPhoneCamera and RenderSystemShadowCoverage. These cover local and
replicated persistent effects, death/disposal, scene replacement, cast rejection,
stale instance loads, hazard resource ownership, and camera shake settings.
Camera punch already honors OS reduced motion and zero strength; no rewrite
was needed. Instance changes already dispose managed transient effects and
hazards before rebuilding the scene. Status materials do not write depth;
danger borders/backing have explicit higher render order. No newly demonstrated
cleanup or camera defect justified changing those systems in this pass.

## Healing reach and crowded effects review

Extended the real floor-pixel test to Guardian Embrace's exact healing reach.
Before the fix it failed at High/zoom10: the visible pixel equaled floor-only,
while the no-floor control was visible. Ground status seals used y=0.055, also
below the dungeon floor. Default ground seals now use y=0.155; the Well Rested
and respawn-protection secondary rings keep their relative offsets at 0.165
and 0.18. Body ornaments, owner transforms, gameplay radius and shared resource
ownership remain unchanged. Tests check every status at High/Low over three
animation steps, including Guardian Embrace's exact six-unit reach.

79 focused checks passed (4.832s) across AttachedStatusEffect,
EnvironmentalHazardVisuals, AbilityControllerRemoteVisual,
AbilityControllerPendingCast, ProceduralAbilityCasts and CastResourceBounds.
The cast tests cover all 52 canonical identities/layers, authoritative radii,
cache ownership and replicated routing; these are not full earned combat.
Ground-pixel browser passed in 7.8s at both zooms and qualities; evidence in
`/tmp/eidolon-143-healing-floor-before` and `...-after`.

The existing normal/reduced-motion warning gallery now adds nine attached
auras across its three actors plus Fireball/Meteor/Explosive Trap impacts to
the existing Spirit Guardians. High and Low clutter is independently rebuilt
and disposed; roots detach at cleanup. Two cases passed in 22.4s with four
warning phases per quality. Inspected normal High and reduced Low phase0.75:
the danger border/backing and label remain distinguishable, though layered
auras are deliberately busy. Evidence: `/tmp/eidolon-143-crowded-warnings`.
This fixture is not a legal single-build claim, five-player network session,
phone performance acceptance or proof for every possible effect combination.
Scoped lint and whitespace passed. No long ability, dungeon or raid soak added.

## Remaining 1.43 scope and publication

- Representative code-owned presentation review is recorded above. Further
  in-game encounter/art acceptance remains playtest work, not another automated
  campaign soak. Reopen specific visual defects when there is evidence.
- Low quality preserves essential warning/healing boundaries. Other decorative
  motion remains outside this warning-specific reduced-motion fix; do not call
  it universal motion suppression or full accessibility completion.
- Consolidate representative browser/coverage checks, patch notes and exact
  release identity only when the milestone is ready for ordered publication.

Relevant starting points: `TransientEffects.js`, procedural ability casts,
projectiles/impacts/status effects, GameEngine effect dispatch and existing
combat-readability/respawn/phone-action browser fixtures. Reuse accepted
encounter evidence; do not repeat campaign or raid soaks for a material change.
