# Alpha1.48 — client performance work

Implementing on prepared1.47; runtime remains1.47 until a complete candidate
is packaged. Not a deployment, Q closure or physical-phone performance result.

## First trial, declared before measuring

Question: which submissions dominate High woodland's retained250k triangle
miss, and does the current production-renderer frame pacing meet its existing
target on this named machine? The existing populated-scene profile omitted
the actual road woodland despite its known cost. Add woodland/junction/turn
to its six existing town/grove sites and diagnostic draw breakdowns; report
120 measured RAF frames after30 warm-up frames per site, CPU median/p95,
frame median/p95/p99, hitches over50ms, draw/triangle counts, renderer and
resource residency. No game content or quality behavior changed for baseline.

Initial workload: one System Chrome1280x844 High Earth/town prepared scene
on r7-server. Flat production terrain, existing zoom15, lighting/shadow frame,
world geometry and scene setup. Mandatory hardware renderer check rejects
SwiftShader/llvmpipe. This is scene render/submission, not earned multiplayer,
entity/network load, actual Android or universal FPS acceptance.

Retain existing High median≤20ms/p95≤33.4ms/draws≤350/triangles≤250000;
Low comparison later retains median≤33.4ms/p95≤50ms/draws≤200/triangles≤85000.
Report p99/hitch counts without inventing a passing threshold after observation.
Repeated resources must remain unchanged. One bounded initial trial, maximum
120s test timeout. A miss stops that trial and directs a specific fix or
identified contention; no indefinite sampling, target relaxation, unrelated
workload shutdown or automatic quality downgrading to manufacture a pass.

Subsequent controlled comparisons must preserve original tree transforms,
collision/walk/interaction and essential warning/enemy visibility, with pixel
and geometry evidence appropriate to any rendering change. Startup, shaders,
entity/effect/network rendering and quality fallback still need scoped review.

## Baseline result

Terminal trial43.0s (failed retained budget assertions, not a timeout).
Hardware renderer:ANGLE AMD Radeon Graphics, RADV RENOIR/Vulkan1.4.318;
System Chrome149,1280x844, High. All nine120-frame samples report median
16.7ms/p9516.7–16.8ms and zero intervals over50ms. This is capped scene RAF
pacing, not uncapped throughput, multiplayer headroom or phone acceptance.

| Scene | Draws | Triangles | Retained target miss |
| --- | ---: | ---: | --- |
| Town well |385|96500|High350 draws |
| Menders yard |357|96931|High350 draws |
| Trading roof |449|128923|High350 draws |
| Foresters yard |171|83861|None in named sample |
| Returning Scar |178|84667|None in named sample |
| Grove arch |298|236314|None in named sample |
| Road woodland |284|261372|High250000 triangles |
| Road junction |249|221729|None in named sample |
| Road turn |230|180974|None in named sample |

Residency stable across repeat:391 geometries/53 textures/63 programs.
Evidence:/tmp/eidolon-1-48-earth-baseline-0930, frame-profile.json,
scene-counts.json and draw-breakdown.json. The test correctly fails first on
the well's385 draw calls; later misses are retained in the complete profile.
No thresholds were changed, no successful-performance milestone claimed.

Draw diagnosis: the rigid procedural Fighter is53 color plus53 shadow draws.
Town well includes90 off-camera Skeleton shadow draws in this prepared
scene, and communal courts28 color/28 shadow draws. Woodland includes27
Earth-tree color submissions and93 shadow submissions. This prioritizes
actor/static render batching and shadow spatial submission, not removing
trees, hiding enemies/warnings, reducing shader quality automatically or
altering collision. Any shadow/culling change must retain visible shadow
pixels; prepared-scene off-camera entities do not by themselves prove a
production streaming bug. Entity-budget review still needs the runtime path.

## First rendering change:16m tree cells

Reduced only Earth's static tree batch cells32→16m, retaining every material,
leaf/trunk surface, instance transform, tree count and walking collider. No
per-frame rebatching or reduced High crown detail. Four placement/render/
saved-position suites26checks pass23.464s, including all original placements,
391 colliders and1564 escape directions. High/Low spatial appearance comparison
passes9.2s with the existing less-than0.1% altered-pixel criterion, including
tree shadows. No appearance tolerance was weakened.

The same High9-site hardware profile completes43.8s and still correctly
fails the unchanged town draw limit. Tree cells do not affect town draws.

| View | Draws32m→16m | Triangles32m→16m |
| --- | ---: | ---: |
| Woodland |284→312|261372→254680 |
| Junction |249→253|221729→189997 |
| Turn |230→250|180974→170946 |
| Grove arch |298→324|236314→226770 |

All samples remain capped16.7ms median/16.7–16.8ms p95, but High woodland
is still4680 triangles over target. More precise static bounds cost additional
scene/instance objects and draws:1179 Earth batches. Do not present this as a
complete performance pass or universal FPS win. Evidence:
/tmp/eidolon-1-48-tighter-woodland-0930. Further bounded optimization and town/
runtime-entity work remain; do not iterate unmeasured quality downgrades.

## Posed courtyard residents

The two scenery-owned adult residents now each render9 rather than23 meshes.
This is constructor-time baking of their fixed working pose, not frozen player/
service/NPC animation. Moving forearm and head remain separate pivot boundaries;
each batch preserves material, shadow, attributes, render order and layers.
Original fixed rig nodes remain, but unused owned geometry clones are disposed
once. No persistent merged cache is introduced. Scene teardown owns the retained
and new geometry; imported/player/service rigs are explicitly rejected.

Exact world position/normal/UV/material/shadow comparisons at three motion
states, unchanged courtyard collision/reachability/motion and owned-resource
disposal pass5checks9.996s. Scoped lint and whitespace pass. The same High
renderer profile42.9s preserves triangle counts and changes only submission
cost: well385→357, menders yard357→315, trading roof449→421 draws. Inspected
the well capture: resident/well materials, working pose, ground contact and
cast shadows remain. Evidence:/tmp/eidolon-1-48-courtyard-batches-0930.

Residency becomes377 geometries (from391), still53 textures/63 programs and
stable on repeat. Named capped frame samples remain16.7ms median/16.7–16.8ms
p95. The test still fails the well's unchanged350-call target; the trading
view and woodland triangle target also remain unmet. This is concrete resource
and submission progress, not complete1.48 acceptance or an FPS guarantee.
