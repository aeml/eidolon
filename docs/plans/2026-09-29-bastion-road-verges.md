# Bastion road: connecting the empty intervals

Extended the existing Earth/town scene review with normal-camera road samples
at x340, x520 and x720, z200. Before captures showed almost bare screenfuls
between the authored locations, including the milestone junction and Bastion
turn. These are prepared route samples, not continuous browser walking.

Two independent presentation causes were found:

1. Low understory inherited a blanket exclusion of14m plus2.2m plant reach on
   both sides of cardinal roads, in addition to the authored path clearance.
   Removed that redundant strip. Plants still remain outside every path's
   half-width plus2.2m reach plus2m shoulder. Starter fight, town, cart and
   landmark clearings remain unchanged. Trees and their colliders are unchanged.
2. The broad meadow noise left long road intervals bare even after that fix.
   Added irregular meadow shoulders following the actual Bastion road, fading
   in beyond the starter area and out at its final approach. Ground shading
   and physical planting share the same field. All paths, including the
   intersecting milestone route, retain worn clear centres. No extra decal,
   texture, light, plant geometry, material or shader sample was introduced.

The first exclusion-only comparison was insufficient visually; retained the
shared meadow composition only after inspecting the next comparison. It reads
as a connected verge instead of occasional tufts beside a giant dirt clearing.
This does not replace the need for stronger landmarks and natural large forms.

## Verification and cost

12 focused ground/understory checks passed in25.817s. Includes deterministic
High/Low subsets, all authored path and landmark margins, actual starter fight
clearings, grounded instances, finite smooth field boundaries, shared terrain
mask parity, preserved worn junctions and disposal. Scoped lint/diff passed.

Final existing Earth/town High1280 and Low390 browser cases passed in45.3s.
Inspected desktop woodland and junction plus Low turn captures. Existing diary,
grove clue, dungeon gate, town and optional-lore checks remain in those cases.
Evidence: `/tmp/eidolon-bastion-road-before-0929` versus
`/tmp/eidolon-bastion-road-meadows-0929`.

Total understory instances increase12024→13087 High and6845→7439 Low; the
existing16000 High ceiling remains. Added instances share existing geometries,
materials and resource ownership. Terrain-map generation does additional CPU
field sampling; there is no new per-frame CPU planting work.

Measured High road views (all scene draws/triangles, not just understory):

| View | Draw calls before→after | Triangles before→after |
| --- | --- | --- |
| Woodland x340 | 171→180 | 191187→216338 |
| Junction x520 | 178→190 | 223183→251177 |
| Turn x720 | 201→203 | 241216→258563 |

Texture and geometry resource counts at these samples are unchanged. This
increases rendering work; it is not an FPS win or acceptance of unmet frame/
triangle budgets. No navigation, spawn, reward, save or terrain-height change.
No long soak, earned campaign traversal, physical-phone acceptance, runtime
bump, deployment, release-gate waiver or final environment sign-off. Connected
play beyond the first fight and overall world quality remain incomplete.
