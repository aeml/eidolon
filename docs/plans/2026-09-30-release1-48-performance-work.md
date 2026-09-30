# Alpha1.48 — client performance work

## Rejected animated multi-draw approach — September30

Do not publish the attempted cross-anchor animated BatchedMesh optimization.
It preserves the21pose comparisons perquality, including exact stealth, and
reduces the actual busy workload2592→1572High/1357→847Low submissions, with
all triangles/warnings/equipment retained. However frame times regress:
High57.4median/114.1p95ms, repeat58.3/97.7;Low39.8/73.6, repeat37.7/67.7.
Both miss original targets. Per-material actor matrix/indirection buffers
raise repeat-stable residency High301/54→475geometries/520textures and
Low300/40→474/506. Functional312checks/7.368s and twoChrome pose cases15.0s
do not override the observed regression. One unchanged-transform cache/
attribution follow-up46.7s still missesHigh53.5/99.9,repeat58.7/101.4;
743matrixwrites/frame, updater3.3/3.2ms median, renderer51.0/56.3ms median.
This does not prove the precise driver/upload/shader cause.

The whole experimental implementation,14finalhelper cases1.334s and detailed
receipt are preserved locally on work/alpha-1-48-equipment-multidraw-probe-
20260930 at998115b4 (docs/plans/2026-09-30-rejected-equipment-multidraw-probe.md).
Release branch returned to safe d1da7467, with no prototype import/hook left
enabled. Artifacts:/tmp/eidolon-1-48-animated-equipment-0930,
/tmp/eidolon-1-48-animated-gear-busy-0930,
/tmp/eidolon-1-48-animated-gear-upload-cost-0930. No remote experimental push,
production deployment or further unchanged busy replay. Next approach must
avoid hundreds of per-material dynamic GPU textures (shared actor skeletal
transforms or folding only genuinely rigid common pivots are candidates),
retain original visibility/appearance/lifetime requirements, and demonstrate
actual frame-time benefit before integration.1.48 remains incomplete.

## Actual first-view preparation — September30

New opt-in cold-town probe creates the production renderer, procedural
environment, startup models, town base and nine normal service/player models
in a fresh page with no gallery loop or prior rendered world frame. Record
all first60frames rather than throwing away a warmup. No accounts, network
outcomes or progression are manufactured. This is controlled renderer entry,
not end-to-end authenticated login or future instance-shader readiness.

Two System Chrome baseline cases13.9s start at frame0/programs0. High's first
render costs529.1ms, second39.3ms, programs33→35; Low437.4ms then10.7ms,
programs20. Environment generation costs1938.8/635.1ms before these frames.
KHR_parallel_shader_compile is absent; native multi-draw present. Device
remains RADV RENOIR at1280x844. Evidence:/tmp/eidolon-1-48-cold-town-baseline-0930.

Prepare two real current-view frames while loading, before binding controls,
Ready, server join and loop entry. Yield through requestAnimationFrame so the
loading text can paint. Actual rendering also prepares texture uploads,
shadow and composer passes; scene compileAsync alone omits those. No fixed
GPU-ready delay, visibility/quality reduction or all-future-assets guarantee.
Deduplicate in-flight preparation; dispose cancels and resolves it even when
the browser stops delivering frames. Failure rejects the entry normally;
cancelled sessions cannot bind controls or join. Disposal during rendering
cannot enqueue a later frame.

Eight new startup/preparation cases fail before implementation1.796s. Final
five startup/preparation/graphics/boot/recovery suites36checks pass2.473s,
scoped lint/whitespace pass. An intermediate command named nonexistent
BootRecovery and failed; it is not claimed as successful verification. Use the
actual MainAssetBoot and SessionRecovery paths in the final explicit run.

Two prepared Chrome cases17.1s complete the same35High/20Low programs under
loading. First subsequent render14.0/25.4ms, with no newly compiled programs
through60frames. Preparation wall time656.6/514.8ms includes the work moved
under loading, not total load-time savings. Subsequent interval median/p95
High20.4/39.7ms (still misses20/33.4), Low16.9/27.6ms;2/1hitches>50ms.
No universal FPS, sustained gain, GPU execution-time or phone-hardware claim.
Town capture inspected; evidence:/tmp/eidolon-1-48-cold-town-prepared-0930.
Production prepares its currently built view; later server-replicated actors,
equipment and zone/effect shaders can still introduce work. Mandatory eventual
authenticated CI remains required. Busy timing/network rendering and ordered
predecessor publication remain open; runtime still1.47, unpublished.

Planned patch note: the loading screen prepares the initial rendered view,
including shadows and postprocessing, before handing over controls; leaving
during preparation cancels its callbacks cleanly.

## Compatible equipment colors and transparent ordering — September30

Combine diffuse-color variants only when constructor-owned surfaces have
identical remaining PBR/shadow/order/layer state. Bake original linear colors
into immutable vertex attributes, keeping the exact geometry, UVs, normals,
maps, emission, roughness, metalness, fit and skeletal anchor. Unknown material
instances retain UUID isolation. Shared cache materials remain unchanged.

The new Iron Sword regression fails before implementation; five equipment/
loader/replication/surface suites418checks pass8.503s. An independent unbatched
constructor reference compares all four classes, fourteen equipped slots,
five animated poses and both High/Low quality. The initial opaque comparison
passes14.0s with equal triangles and negligible pixel changes.

Adding Rogue stealth exposes alpha-order differences in merged fragments;
do not remove that pose or loosen pixel thresholds. During stealth, reveal the
retained named source pieces and hide rigid batches; restore original visibility
and materials on expiry, removal and disposal. Repeated updates retain one
owned appearance; replacing materials retains original visibility ownership.
Input-only hitboxes and shared material/geometry caches remain unchanged.

Final two equipment/stealth suites287checks pass4.695s, scoped lint passes.
Two System Chrome cases14.1s compare21 pose pairs per quality: max mean error
High0.000338095/Low0.000428571, max changed fraction0.0000031746/0.0000063492.
Stealth is pixel-identical with exactly equal calls/triangles; every opaque
pose has fewer calls and equal triangles. Fighter capture inspected. Evidence:
/tmp/eidolon-1-48-equipment-alpha-order-0930. The prior final attempt failed
only its inappropriate universal draw-saving assertion after alpha equality
was restored; the final contract requires equal submissions for stealth.

One bounded busy-scene check47.7s preserves ten equipped actors, Malachar,
all four fields/warnings and unchanged lifetime assertions. Opaque High calls
2758→2592, triangles166327 unchanged; Low1440→1357, triangles85546 unchanged.
Repeated residency High301geometries/54textures, Low300/40 remains stable.
However High still misses20/33.4ms:31.6/56.0ms and repeat33.1/53.7ms, with
14/13 hitches over50ms. Low23.4/34.5 and24.5/38.8 meets33.4/50 with0/1hitches.
These observed High timings are worse, not an FPS improvement or evidence
of a particular cause. Busy screenshot inspected; no unchanged soak replay.
Evidence:/tmp/eidolon-1-48-color-packed-busy-0930. Busy performance and actual
cold startup/shader/network evidence remain open; runtime1.47, unpublished.

## Receiver-fitted sun depth — September30

The remaining measured High town cost included enemies behind every visible
receiver still submitted into the sun shadow map. Fit far to the same existing
camera-corner/height[-8,64] receiver volume, with12units padding and16unit
quantization. Near remains1: off-screen roofs/trees toward the sun remain
eligible. Horizontal/unsupported camera and vertical-sun fallback keep the
legacy1400 depth. This is not arbitrary actor-distance or shadow-quality culling.
Scale normalized depth bias to preserve the original world-space contact bias
at each quality setting. Camera lag, zoom and viewport fit remain dynamic.

Eleven new/expanded coverage cases failed before implementation. Final three
shadow/graphics suites27checks pass1.558s, scoped lint/whitespace pass. The
existing procedural-environment suite also passed in the initial four-suite
31check run75.056s; it is not repeated for the subsequent bias/test assertions.
One System Chrome case4.5s compares legacy/fitted rendering at zoom5/15/30,
High and Low, including a real many-part Skeleton and a deliberately off-screen
tall caster whose shadow reaches visible ground. All six comparisons have
zero changed pixels; High retains16777/4066/1025 tall-caster shadow pixels.
At normal zoom, total shadow+color submissions36→6 and triangles1271→62;
Low remains3draws/26triangles, unchanged. Inspectable fixture image reviewed.
Evidence:/tmp/eidolon-1-48-shadow-depth-0930.

One bounded populated High9site profile passes49.8s on the same Chrome149/
RADV RENOIR/1280x844 device, with all original targets retained. Town well
335→261calls, menders272→241, trading367→305; woodland310→292. Trading has
114633triangles,16.7ms median/33.3ms p95; all other p95 values16.7–16.8ms.
All sites report zero>50ms hitches in these120sample windows. This single new
window does not prove the cause of the prior junction hitch or sustained FPS.
Repeated residency is stable315geometries/71textures/70programs. Real town
capture inspected; controlled fixture pixel equality is not a whole-world
appearance or campaign acceptance claim. No target relaxation or extra soak.
Evidence:/tmp/eidolon-1-48-shadow-depth-profile-0930. Runtime remains1.47;
Low/device, representative busy/network/shader/startup work and ordered
predecessor publication still remain before1.48 can be accepted.

The subsequent bounded Low/390x844 nine-site Earth/town check passes40.6s on
the same desktop GPU. Every120sample window has16.7ms median,16.7–16.8ms p95,
zero>50ms hitches,85–149calls and20565–61458triangles, within the original
33.4/50ms/200calls/85000triangle targets. Repeat residency stays303geometries/
58textures/50programs. This earns a phone-sized rendering/quality-fallback
comparison, not actual-phone FPS or owner dungeon/party playtest. Evidence:
/tmp/eidolon-1-48-low-earth-profile-0930. No repeated campaign/soak run.

Planned patch note: camera-fitted sun depth avoids shadow submissions that
cannot reach the view, preserving visible contact and off-screen roof/tree
shadows rather than reducing scene detail.

## Next bounded busy-scene check

Reuse the existing ten fully equipped heroes/Malachar/four fields/four essential
warnings fixture rather than a campaign soak. Record each180sample busy/clear/
repeat phase separately, including first-frame/warmup CPU cost and p99/>50ms
hitches previously omitted. Retain60frame warmup and unchanged resource checks.
Before observing results, use the same named desktop's High median20ms/p9533.4
and Low median33.4ms/p9550ms as comparison targets. This larger scene has no
predeclared350/200draw cap; report actual submissions, not a retroactive cap.
The1440x1000 Low-quality window is desktop hardware, not phone hardware proof.
Shared CI keeps resource/assertion gates; local timing is an opt-in review,
not a universal machine-dependent CI rejection. Misses require a concrete
follow-up and do not make1.48 ready or justify hiding equipment/warnings.

### Observed busy-scene result

The bounded Chrome check passes its unchanged repeat/resource assertions40.5s,
but **High misses the predeclared timing comparison**: busy28.1ms median/
41.1ms p95 and repeat26.9/38.0ms, versus20/33.4. High submits2758draws/
166327triangles, with4/1>50ms hitches across the two180sample windows. Clear
falls to22draws and16.6ms median. First reported render CPU24.4/37.9ms,
warmup maxima41.2/39.4ms. These callbacks start after the fixture is constructed
and after the gallery already renders; they are not cold-login or shader-
compilation latency receipts. Do not attribute those costs to compilation.

Low busy19.0/25.7ms and repeat17.8/25.1ms meet33.4/50;1440draws/85546triangles,
0/2>50ms hitches. High repeats307geometries/54textures; Low306/40, matching
their first busy phase exactly. No universal sustained/phone performance claim.
Per-phase reports and screenshots:/tmp/eidolon-1-48-busy-scene-profile-0930.
All10heroes retain14equipped slots; four fields/four essential warnings and
the actual animated Malachar remain. No workload hidden to manufacture a pass.

Next measured issue is the much larger animated actor/equipment submission
workload. Existing rigid humanoid and per-item batching already apply; do not
claim a new fix by enabling those twice. More detailed attribution and a safe
visibility/pose/appearance-preserving change are needed before accepting1.48.
Actual startup/shader evidence is also still open. This is concrete progress
and an actionable miss, not completed performance or a reason for a new soak.

A read-only Node24 source probe reconstructs the same ten gallery loadouts,
including rarity, potency, sockets, sets and unique markers, through the
production batched class factories and existing equipped-item application.
Each hero has117–128visible meshes, of which102–105are equipment, with56–63
materials; Malachar has42meshes/9materials. Sources hidden by existing batching
remain hidden (67–93perhero), not accidental duplicate draws. This identifies
equipment as the dominant potential submission improvement, not proof that
any new batching policy preserves poses/materials/stealth/masks or improves FPS.
The first source probe accidentally used system Node18 and failed toReversed;
only the explicit supported Node24 run supplies these counts. No browser/raid
soak repeated for this attribution.

## Planted street edges — September30

Submit the existing two static street-rest cells together per material with
Three's BatchedMesh, retaining independent camera/shadow culling, exact source
geometry and placement, procedural surface shaders and all four collision
footprints. No actor animation, equipment, interaction or gameplay changes.
Ordinary per-cell submissions remain the actual extension-free fallback;
do not substitute a broad merged bound that draws an off-camera planter.

Two geometry/layout and four render-resource checks plus the two expanded
street equivalence checks pass8checks14.574s; lint/whitespace pass. Instance
matrix assertions account for actual Float32 storage, not bit equality with
the source's double-precision sin(pi). Two System Chrome comparisons with
native extensions and the extension explicitly absent pass13.9s. Three views
(both edges and each close edge), including sun shadows, retain zero changed
pixels and identical triangle counts. Native both-edge color+shadow draws
25→13, close-edge19→13; fallback retains25/19. Initial raw renderer counters
reset before color, so final comparison explicitly resets once before rendering
and includes both shadow and color passes. Twelve batch-owned textures release;
zero geometry remains after scene cleanup. Inspectable images/metrics:
/tmp/eidolon-1-48-street-cell-render-counted-0930 (earlier images inspected in
/tmp/eidolon-1-48-street-cell-render-final-0930).

One bounded nine-site High profile59.5s records trading374→367calls and
menders278→272, with unchanged triangles at every site. Geometries321→315;
the matrix/indirection buffers add12 small textures (59→71), shader programs
68→71; all315/71/71 remain stable across revisiting. This is a submission/
resource tradeoff, not free memory savings or a universal throughput claim.
Source-vs-batch controlled pixels are equal; the full trading PNG is not
byte-identical to the prior capture, so no whole-scene byte-equivalence claim.

Performance remains FAILED. Trading367>350. First assertion again sees
33.400000000001455ms p95 above33.4; junction also has a genuine66.6ms p95,
83.3ms p99 and8>50ms hitches. Medians remain16.7ms. A short render comparison
overlapped this profile and live CI was active; these timings are not a clean
comparative FPS experiment, and contention is not proven as the cause of the
junction miss. No threshold relaxation, automatic downgrade or repeated soak.
Evidence:/tmp/eidolon-1-48-street-cell-profile-0930. Next work must address the
remaining measured submissions/hitches and broader shader/startup/device scope.
Runtime still1.47; no1.48 release/acceptance claim.

## Retire hidden town-casino interior — September30

Production town casino already uses a clicked door and separate shared scene,
but its exterior still constructed/drew the retired walk-in stairs, small VIP
lounge, carpets, floor inlays and stair markers. Remove only those unused
town-shell surfaces and the controller's per-tick legacy cutaway lookup.
Preserve all exterior masonry/window/roof geometry, Lanternhold Casino plaque,
isolated hovered door, physical wall/door collision data and the actual two
full-sized shared gaming floors. Do not change wagers, EP, seats or VIP access.
Retain the cloned door material because the exterior cornice also uses wood;
new reference-identity assertions catch accidental shared hover tint. Do not
construct the removed lounge's unused velvet material.
Final reference-identity check caught a draft that shared door/cornice wood;
restore the isolated clone before committing. All29checks pass2.914s after
that correction. Compare references rather than deep Three.js object equality
(the latter triggered an unavailable VideoFrame getter in the test runner).

Retired six-unit town-stair fixture replaced by real shared0/8-unit floor
boundaries and a production-sized blocked town door with approach clearance.
Existing window/roof/door-picking tests retained. Chrome seating fixture now
renders actual shared interior, not old town shell. Its initial run exposed
old fixture occupants lacking required playerId; server CasinoOccupant contract
requires it, so restore IDs rather than changing production settlement/UI.
Final controller/navigation/map suites29checks pass5.164s; three Chrome seating/
phone/desktop-VIP checks pass28.2s. Uncredentialed casino-zone route is skipped;
do not count this as an earned multiplayer/wagering campaign. Scoped lint and
whitespace pass. An initial wrong-case benchmark grep found no tests; corrected
exact benchmark name, no waiting on that stopped handle.

Same High9-site120-sample workload records town trading392→374calls, casino
19color+21shadow→11+11, GPU geometries331→321 with59textures/68programs stable
across revisit. Menders288→278calls; woodland and other unaffected sites retain
their prior draw/triangle counts. Trading screenshot PNG is byte-for-byte equal
to preceding crown-bounds baseline; both images visually inspected. Hidden
interior cost removed without an exterior appearance tradeoff.

Benchmark remains FAILED: trading374>350 draw target. It first fails a p95
boundary33.400000000001455 versus33.4; thresholds have not changed. Concurrent
live CI may affect timing, so no clean comparative FPS claim: medians16.7ms,
p95 range16.8–33.4ms and one junction>50ms hitch recorded. Artifacts:
/tmp/eidolon-1-48-casino-exterior-profile-0930 and
/tmp/eidolon-1-48-casino-facade-final-0930.
Not a completed performance milestone. Runtime still1.47; package/patch-history
publication awaits remaining performance work and ordered earlier acceptance.

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

## Perimeter spatial multi-draw

The existing32m material cells are retained, including every surface, local
transform, per-cell bound and all184 ordered legacy colliders. Three material
BatchedMesh objects now own these cells. Camera and shadow per-object culling
remain enabled; opaque cells do not sort each frame. Browsers supporting
WEBGL_multi_draw submit visible cells together; Three's actual extension-free
path still renders ordinary cell draws. No gameplay object is hidden to fit a
budget. The unoptimized art and the former cell renderer remain test references.

Full world-space triangle/normal/UV/color/material stream equality at three
layouts,32m bounds, gates, replicated fence ownership, shadow/resource cleanup
pass35checks across six suites6.544s. The already-corrected1.42 reflection fixture
was carried into this candidate: initial0.325 radiance and normalized0.65 remain
tested, rather than rolling lighting back. Scoped lint/whitespace pass.

Two actual System Chrome cases pass6.1s with native extensions and with
WEBGL_multi_draw explicitly unavailable. Whole-fence320px comparison: zero
changed pixels against both unbatched art and original cells. Tight gate view
including sun shadows differs by just1pixel under the unchanged0.5% tolerance.
Unbatched2825 calls; former cells61; multi-draw4 including ground. Extension-free
batch remains61, not an unsupported performance promise. All six batch-owned
matrix/indirection textures are released; zero geometries remain after scene
cleanup. Renderer still owns one generic null-sampler texture, so no global
zero-texture claim. Both instance clear and final renderer teardown deduplicate
owned geometry/material/texture disposal; final teardown is idempotent.
Evidence:/tmp/eidolon-1-48-perimeter-render-final2-0930.json.

Same bounded High9-site hardware profile finishes43.4s. Well357→335,
menders315→288, trading421→392calls; triangles at these sites unchanged.
Well now meets its original draw budget, but trading still exceeds350 and
woodland remains254680triangles. All named120-frame samples remain capped
16.7ms median/16.7–16.8ms p95 with zero intervals over50ms. Residency stable
on repeat:331 geometries/59 textures/68 programs. Relative to posed residents,
this replaces46 geometry allocations with six data textures and five shader
programs. Inspected trading exterior capture; no appearance acceptance inferred
from the prepared character's fixture position. Evidence:
/tmp/eidolon-1-48-perimeter-profile-0930. Runtime stays1.47, not deployed or
performance-complete; trading/woodland and broader runtime workload gaps remain.

Follow-up teardown review: shared geometry references can precede their batch
owner in a scene. Defer ordinary geometry disposal until owners have released
their buffers/data textures, removing traversal-order dependence. Both child
orders across instance clear and idempotent renderer teardown are now explicit
tests. Final six suites37checks pass6.495s; scoped lint/whitespace pass. This
changes only resource release, not any rendered profile or scene budget.

## Crown bounds without changing foliage

Spatial cell box spheres include empty corners around rotated crowns. Retain
the same center and choose the smaller conservative radius from the aggregate
box and transformed cached geometry spheres. This is constructor/quality-swap
O(instances) work, not per-frame vertex scans, new cells, removed trees or lower
High detail. High/Low tests inspect every transformed vertex at large coordinates
for one/multiple rotated/scaled instances; source buffers and boxes unchanged.
Four placement/grounding/render suites32checks pass19.546s, including391 saved
tree colliders/escape paths and empty cells. Scoped lint/whitespace pass.

High/Low real-browser static image-and-shadow equivalence passes9.8s under the
unchanged0.1% tolerance. Hardware High9site profile43.9s still correctly fails
trading392calls, but woodland254680→247120triangles/312→310calls now meets its
original250k target. Grove226770→220626; junction189997→177237; turn170946→164802.
No residency change:331geometries/59textures/68programs, stable on repeat.
Named samples stay capped16.7median/16.7–16.8p95; well has one>50ms interval
and trading p9933.3ms. CPU time is recorded, not presented as a measured FPS gain.
Added the previously omitted trading-view draw breakdown to opt-in diagnostics.
Evidence:/tmp/eidolon-1-48-crown-bounds-appearance-0930 and
/tmp/eidolon-1-48-crown-bounds-profile-0930. Trading and runtime budgets remain.

## Preserve gameplay information under network VFX load

Reproduced two failing receive/drain checks: damage/attack bursts discarded both
telegraphs and room transitions from the16-entry cosmetic tail. These messages
are now in the existing ordered lossless control stream with enter_instance;
current state still receives its reserved drain slot and decorative effects
remain bounded/supersedable. No expiry clock, damage, instance or reconnect
protocol changed. Lossless control traffic is not claimed universally bounded.

Seven queue/room/warning/HUD suites116checks pass3.202s. Two constructor mocks
were missing InputManager.subscribe after1.47; corrected fixture interfaces
without changing gameplay assertions, also recorded in the1.47 candidate.
One actual Chrome case passes6.1s: three queued circles survive600 interleaved
cosmetic/state messages and retain their radius6/duration2/attached geometry
at High and Low. Inspected Low capture. The gallery initially lacked the pinned
protobuf script required by network imports; fixture now loads exactly the
index.html runtime. This is prepared receive/drain/render seam evidence, not an
earned raid, server damage or real network latency result. Evidence:
/tmp/eidolon-1-48-warning-queue-final-0930. Scoped lint/whitespace pass.

## Bound decorative remote contact feedback

Compact remote contact cues now retain at most64 simultaneous effects at High,
32 at Low. The next compact contact retires the oldest eligible contact effects
and removes them from the engine's active array. Their existing disposal path
releases the scene roots while retaining shared art resources. Ordinary counts
are unchanged; changing quality applies the smaller budget on the next compact
contact rather than changing any gameplay event or timer.

The explicit contact-kind allowlist excludes healing/restoration, periodic and
hazard feedback, future unknown kinds, local source/target involvement, full
feedback, ability/projectile presentations and authoritative/radius shapes.
Boss warnings, casts, actor visibility, damage, HP and combat logs never enter
this quota. Essential admissions also skip the decorative array scan. This
is not a universal cap on essential effects, nor a claim that all scene draw
targets or100-player capacity are achieved.

Six relevant feedback/telegraph/network suites176checks pass4.202s. Two actual
Chrome admission/render checks pass14.2s at High/Low: repeated200-contact bursts
retain the latest64/32 compact cues and every interleaved warning/local contact/
healing/Fireball radius effect; both warnings retain radius6. Active roots and
renderer geometry/texture residency are stable on repeat. The previously fixed
receive/drain warning-flood seam still passes. Evidence:
/tmp/eidolon-1-48-compact-feedback-final-0930, including compact-contact-budget.json.
Scoped lint and whitespace pass. These are prepared render/admission checks,
not an earned multiplayer encounter, appearance acceptance or frame-rate proof.
Town trading392draws and the broader representative startup/entity/device
performance work remain open. Runtime still1.47; candidate not published.

## Bound every entity-creation dequeue

The intended five-entry tick limit counted only ordinary actor creation.
Hazards, duplicate entries and discarded loot bypassed the counter. New actual
GameEngine.update tests reproduced both High/Low hazard bursts creating seven
entities at once and a stale twelve-loot burst draining in one update.

Count immediately after each dequeue, including failures and discard paths.
Keep the existing five-entry limit, FIFO, pending-ID tracking and hazard state,
position, radius and boundary attachment; remaining entries resume next tick.
Boss-warning message admission is unchanged. This bounds entries processed,
not the time to create any one entity or all queue/network residency.

Five movement/hazard/containment/loot/jump suites104checks pass2.625s. High/Low
tests construct real environmental hazard meshes and verify all seven retain
their boundaries after two updates. Duplicate, stale-loot and creation-failure
paths also yield after five entries. The plain player fixture reuses the
already accepted1.42 Actor grounding method/engine-owner correction; no
production grounding change or gameplay assertion was removed. Scoped lint
and whitespace pass. No new long encounter replay; broader performance and
the trading-view draw target remain open, runtime still1.47, unpublished.

## Startup follows actual work and respects cancelled sessions

Removed the fabricated1000ms silicon-readiness wait and trailing100ms delay.
The five existing50ms progress-paint yields remain, along with selected actor/
nearby Skeleton preloads, timeout policy, town generation, deferred scenery,
controls and the normal server join. This removes1100ms of unconditional entry
latency; it is not a measured total login-time or shader-warmup claim.

After each awaited startup stage, stop if the engine was destroyed. Reject an
already cancelled entry and suppress late asset progress callbacks. A ready
callback that cancels the session cannot send a stale join or start a loop.
Existing loader requests are not aborted by these checks; shared inflight
assets and further session/resource-lifetime validation remain separate work.
The current createTownBase attaches synchronously before returning its promise.

Six initial regressions fail before this change1.637s, including fabricated
1350ms total fixed wait and continuation after cancelled environment/models/
town/controls. Final coverage includes the compatible generator awaits and
ready callback. Five startup/loader/boot/recovery/ability suites146checks pass
5.305s. Four old loader assertions assumed only five clips although1.43 added
Cast/Channel/Guard/Shout/Bless. They now require the exact ten clips; emergency
fallback models retain their five-clip expectation. The same fixture correction
is included in prepared1.43 (two suites122checks3.634s), avoiding a known later
CI failure without rolling back new animation or weakening coverage. Scoped
ESLint and whitespace pass. Mandatory eventual CI will validate actual login;
no extra campaign soak. Trading draw target and shader/device workloads remain
open; runtime still1.47, candidate unpublished.

## Asset-load ownership across chunk disposal and reentry

Entity.dispose is intentionally used to unload render resources from still-live
entities; setting isActive=false there would incorrectly prevent normal chunk
reentry. Instead, invalidate a model-load generation and clear its load guard.
Capture generation/type when ensureMesh starts. A stale result returns to its
captured type's pool without attaching, and an old finally block cannot clear
the guard for a newer request. Inactive entities start no work; ordinary
concurrent calls retain their existing single-request behavior. Existing shared
factory fetches are not aborted or globally discarded.

Six genuine pre-change lifetime failures were reproduced, including actual
ChunkManager unload/reentry attaching an old result after the newer model.
The first draft's unrelated transform expectation was corrected to call the
real Entity.render step, which already owns transform application; production
transform behavior is unchanged. Final nine lifetime cases cover late success/
failure, current request ownership, inactive/removal paths, type changes and
normal transforms. Five lifetime/chunk/loader/batched-rig/startup suites150checks
pass8.116s; scoped ESLint and whitespace pass. The actual chunk callback keeps
exactly one current scene child after out-of-order completion. No browser art
or global session-leak/FPS acceptance is inferred from these focused checks.
Further1.49 lifecycle and representative1.48 shader/device/draw work remain;
runtime still1.47, candidate not published.
