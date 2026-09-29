# Woodland canopy and forest-floor layers

Local candidate following0a9f9738. Full roadmap active; no deployment or version
change. Previous goal turn was progress: completed Water entrance alignment.

## Presentation changes

Earth trees now have taller crowns and broader overhead foliage while retaining
every trunk placement, horizontal trunk transform and collision recipe.
Broadleaf crowns use smaller leaves in seven branch-tip clusters instead of a
uniform spherical shell. The same256 leaves/512 opaque triangles remain cached.
The enlarged silhouettes remain inside the existing eight-metre sightline apron
at maximum tree scale. No server collider or spawn-manifest change.

The north-grove/east-dungeon reference bands now use low spreading bracken and
fuller sedge. Jittered positions follow the shared meadow field rather than
repeating a multi-plant cluster at each anchor. Low retains an exact High subset.
Whole-plant route/site clearance remains2.2m; maximum scaled height is below
1.05m. Same two shared geometries, one opaque material and spatially culled
instancing; no new textures, alpha cards, animation work or collision blockers.

## Evidence and costs

- Baseline High preview passed11.2s at
  /tmp/eidolon-woodland-composition-before-0929.
- Placement/elevation4 checks passed7.451s; final geometry/crown/batching20
  checks passed2.632s. Earlier woodland placement/manifest checks also passed.
- Initial tree scaling deepened the pine's buried base and failed the existing
  -.35 bound. Preserve each buried part's original minimum rather than relaxing
  the assertion. Final apron/height/bounds checks pass.
- First plant review passed High/Low but cost166068/107877 visible triangles.
  Simplified folds/sections before keeping the final version.
- Final town/Earth and raised-world High/phone-sized Low4 browser checks passed
  48.3s at /tmp/eidolon-woodland-layers-reviewed-0929. Inspected both grove-arch
  views, High shoulder and Low aura/danger view. Interaction-ray, travel,
  grounding, jump, targeting and effect-surface assertions remain unchanged.
- Final cover cost at the fixed preview:24 calls and82524 triangles High,
  24 calls and53659 Low. Baseline High24 calls/31549 triangles. This increases
  visual geometry cost; it is not an FPS improvement or hardware acceptance.
- High11864 plants (was11206), Low6756 (was6426). Shared shapes80/231 triangles;
  33588 CPU vertex-buffer bytes, instance matrices759296/432384 bytes, plus GPU
  storage. Whole-band588/561 culled batches, not all submitted per frame.
- Generator verifies456 scenery exclusions/eight readings; scoped lint and
  whitespace checks pass. No campaign soak, release identity or deployment.

## Remaining quality gaps

The grove has stronger foreground canopy framing; the plants have broader,
lower silhouettes. This still does not meet modern-ARPG acceptance. Broad open
ground remains sparse, tree trunks and landmark masonry are visibly procedural,
and actor silhouettes/materials remain weak. These prepared scenes do not prove
connected combat feel, full-HUD usability or final performance. Continue the
complete playable-route composition and combat review rather than treating
another grass adjustment as completion. Ordered1.39/1.40 release decisions and
human acceptance remain unassumed.
