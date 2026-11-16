# Alpha1.48 — client performance work

## Mandatory CI correction — conservative sheared foliage bounds

Exact initial CI36720351298/a3edf4e7, Jest109903566296, fails one canonical
foliage assertion;600suites/8705checks otherwise pass. Deployment is not accepted.
Locally reproduce5.573414>5.449277 (focused failure2.249s). The old oracle
requires the entire aggregate AABB's empty corners inside a deliberately tighter
crown sphere. Correct it to independently transform EVERY actual geometry
vertex at every instance placement, requiring containment by BOTH the sphere
and box at the same1e-6 tolerance. Retain all placement/material/count/collision
assertions; this is not permission to clip actual foliage.

That stronger oracle exposes a genuine source defect: crooked mourning willow
trunk's actual radius4.670694 exceeds4.668199 (focused reproduction5.298s).
Composed nonuniform scales and rotations introduce shear; Sphere.applyMatrix4
uses largest column length, which underbounds sheared spheres. An independent
shear fixture also fails by0.202950 before the source fix0.650s.

Use a conservative upper singular-value bound from the row sums of A^T A,
including absolute off-diagonal terms, for transformed source spheres. Ordinary
orthogonal transforms retain their tight scale; the existing aggregate-box
radius remains the other conservative cap. Constructor/quality-change work
only, no per-frame vertex scan, changed geometry, palette, placement or collider.

Four foliage/canonical/visibility suites63checks pass24.765s, scoped lint and
whitespace pass. Three changed-source native cases1.5m (9.2/43.6/34.3s) pass
High/Low source-vs-spatial pixel checks and original nine-site world budgets:
medians16.7/p95<=16.8,Highdraws<=298/tri<=234568;Low<=137/61458. High0sampled
>50ms hitches, Low1 (reported, not hidden or a new invented passing limit).
Resource repeats remain exact315/71/71High and303/58/51Low. Artifacts:
`/tmp/eidolon-1-48-shear-bounds-0930`. No unchanged busy-raid/campaign/soak
replay; those actor/performance receipts remain retained. Normal corrected
source CI and public acceptance are still required;147 remains accepted live.

## Production-default integration — locally verified, unpublished

The verified candidate is now merged on the release branch and enabled by its
RenderSystem owner. Rejected shadow-caster, surface-pivot and per-anchor texture
experiments remain excluded. Native paired appearance now requires the actual
constructor default, and cleanup uses that same owner. The raid fixture admits
its prepared subtree via normal entity-group events; ordinary diagnostic runs
no longer disable production batching. Two appearance cases join the existing
mandatory interface CI selection, without another runner/job.

Eight affected unit suites336checks pass5.489s; scoped lint/whitespace pass.
Four native default appearance/cold-start cases pass19.3s. Prepared loading
builds41High/24Low programs, stable through all60subsequent frames; preparation
526.1/424.8ms, first subsequent render CPU33.8/9.4ms. This is not zero startup
cost, end-to-end login timing or a perfect first-frame promise. Artifacts:
`/tmp/eidolon-1-48-default-instances-0930`.

Two changed-default populatedEarth/town cases pass1.3m (42.6/35.1s), including
nine120-sample locations perquality and warm-repeat resources. All High medians
16.7ms,p95<=16.8,draws<=298,triangles<=234568; Low390px medians16.7,p95<=16.8,
draws<=137,triangles<=61458. Zero>50ms hitches. Trading281drawsHigh/107Low;
the original350/200 submissions and250k/85k triangle bounds pass everywhere.
Resource repeats remain exact315geometry/71textures/71programsHigh and303/58/51
Low. Native RADV RENOIR desktop, not physical-phone FPS certification. Artifacts:
`/tmp/eidolon-1-48-default-earth-profile-0930`.

Browser discovery verifies226cases exactly once/no omission or duplication.
The later149 tree has its own additional lifetime cases; this148 count is not
that tree's234baseline. Metadata, mandatory exact-source CI and public matching
assets still gate publication/acceptance. No player data or balance changes.

## Controlled comparison result — September30

### Distant-coordinate correction and changed-code confirmation

Added a seventh paired pose at(50000,0,20000), with the real camera/shadow
follow behavior. High fails the unchanged changed-pixel bound (0.001094>0.001),
Low passes; mean error0.0450, unchanged triangles. A fractional distant-transform
unit independently fails0.000356>0.00001. Float32 instance attributes carrying
full world positions discard equipment/animation offsets. Use the existing
64m-cell world origin as the batch model transform and upload cell-relative
attributes. Ordinary source transforms, borrowed surfaces and frame visibility
remain unchanged. No relaxed image thresholds or fixed simulated frame timings.

The existing parent-transform unit now reconstructs the actual world matrix
instead of demanding the old internal scene-relative representation. Five
affected suites42checks pass1.720s. Two native High/Low cases9.3s pass all seven
strict pose comparisons and the mid-render failure restoration; artifacts:
`/tmp/eidolon-1-48-cell-origin-instances-0930`.

One changed-source controlled comparison45.7s (test44.4s) reconfirms the original
declared gate, without an unchanged replay or auto retry. High baseline/candidate
RAF medians20.9→18.4 and22.4→18.5ms, candidate p95s23.7/24.3, render CPU
19.8→16.9 and21.4→17.2 (14.6%/19.6% benefit). Low RAF16.7→16.7 and16.7→16.6,
p95s18.9/20.1, CPU13.2→12.6 and12.8→12.2. All zero>50ms hitches; exact original
2454→800/1288→461 draw totals, triangles and341/54,340/40 resources retained.
Same-mode median repeat differences<=7.2%, paired host-busy differences<=1.7
percentage points. Both satisfy the predeclared comparability/benefit/frame
limits. Artifacts:`/tmp/eidolon-1-48-cell-origin-paired-0930`.
This confirms this corrected candidate on this native desktop, not all-device
FPS, a dungeon campaign, supported-player capacity or full148 acceptance.

One declared interleaved comparison passed in46.2s (test44.5s), System Chrome
native GPU, same11-model equipped busy scene. Artifacts:
`/tmp/eidolon-1-48-paired-instances-0930`. Values are milliseconds; pairs share
the same warmed browser, exact triangles and geometry/texture residency.

| Quality/mode | RAF median/p95/p99 | Render CPU median | Draws | Host busy |
| --- | --- | --- | --- | --- |
| High baseline |21.4/26.2/28.4|20.0|2454|88.30%|
| High candidate |17.9/25.5/28.2|16.3|800|91.45%|
| High baseline repeat |20.7/27.1/34.4|19.5|2454|90.31%|
| High candidate repeat |17.6/23.8/25.3|16.4|800|90.74%|
| Low baseline |16.7/20.2/22.4|13.4|1288|88.05%|
| Low candidate |16.7/19.0/19.8|11.9|461|87.97%|
| Low baseline repeat |16.6/19.4/20.9|13.3|1288|87.47%|
| Low candidate repeat |16.5/20.3/22.6|12.7|461|90.07%|

All eight phases report zero>50ms hitches. High retains166327 triangles and
341 geometries/54 textures; Low85546 and340/40. High render CPU improves18.5%
and15.9%, meeting the predeclared10% benefit gate and actual20/33.4 frame
target twice. Low CPU improves11.2%/4.5%; RAF is approximately display-limited,
not a claimed FPS improvement. Same-mode RAF medians repeat within3.3%; paired
host busy differences are at most3.15 percentage points, within the declared
comparability limits. Nested preparation/shadow spans must not be summed.

The scheduled soak remains running, without owner cancellation approval.
These interleaved controls provide specific comparable local evidence despite
background work, not proof of universal performance, capacity or precise causes
of older timings. The candidate may proceed to remaining integration/scene
coverage; it is not yet default-enabled, packaged, pushed or accepted as148.

## Interleaved instance comparison — declared before measurement

Use opt-in EIDOLON_RAID_INSTANCING_COMPARE=1 together with the instance probe.
Same browser, viewport, quality, complete11-model/14-slot-equipped workload,
four fields and four essential telegraphs. Measure baseline→candidate→baseline
repeat→candidate repeat at each quality,180 actual RAF samples after60 warmup.
Warm candidate programs/buffers before measuring either side. Reset the prepared
animation/field clock and use a fixed1/60 visual step only in this comparison
fixture, so every side presents the same frame-by-frame animation work; RAF
timings remain measured, not synthesized. No production simulation change or
removed detail. Disable batching in-place for the baseline, retaining warmed
shared resources/programs. Default diagnostic behavior remains unchanged.

Record host CPU totals/busy fraction, load and Linux pressure at both boundaries
of every phase. Add optional candidate-preparation CPU attribution; nested
renderer/shadow/composer spans are not additive. Require exact triangles and
geometry/texture counts across modes/repeats and fewer candidate submissions.
Native renderer guard remains mandatory. This changed comparison closes the
unpaired-candidate measurement gap; it is not an unchanged profile replay.

Before a performance conclusion, require both same-mode median repeats within
15% and paired host busy fractions within10 percentage points. Otherwise treat
the timings as contention-affected, not accepted. Require at least10% High
render-CPU median improvement in both pairs, preserve High actual-frame median
<=20ms/p95<=33.4ms for both candidate phases and the existing Low comparison
median<=33.4ms/p95<=50ms with no>10% render-CPU regression. Report p99 and
>50ms hitches; do not invent a passing hitch limit after observation. One bounded
comparison, no auto retries. Timings stay recorded/manual rather than a fragile
general CI FPS assertion. No source enables batching by default from green
diagnostics. Own appearance/ownership and other148 gates remain independent.

Current host's load has eased to15.97/16.19/18.19, CPU some pressure19.94/20.39/
20.59, but scheduled soak109836999629/run36664933512 is verified still running.
No cancellation approval or mutation. Interleaved controls/host samples are the
new comparability mechanism; reject unstable evidence rather than assuming the
machine is quiet or attributing all previous slowdowns to that soak. No result
or performance acceptance is claimed in this pre-measurement declaration.

## Opt-in render ownership integration — September30

Close the candidate's previously identified integration gaps on the isolated
actor-instance branch only. RenderSystem now owns activation, scene reset and
disposal; normal constructors keep it disabled. Scene/entity-group child events
register actors after model loading, remove retired actors and re-register
streamed actors without per-frame scene discovery. Clear scene-owned instance
buffers immediately on instance reset, preserving borrowed surfaces. Remove
only owned hooks/listeners on disable or retirement. Retain dynamic gear,
transparency, animation and spatial-cell compatibility checks.

RenderSystem's outer frame finally restores source visibility even when a
renderer or composer pass throws before Scene.onAfterRender. Six new integration
cases exercise both failure paths, actual Group streaming, scene reset,
borrowed-resource preservation, default-off/disposed guards and hook retirement.
Five impacted suites41 checks pass2.042s; scoped lint and whitespace pass.

Two changed native-Chrome cases pass10.0s with the actual RenderSystem owner
activated before the ten equipped actors are added. Six animated poses each
at High/Low preserve paired images, exact triangle totals, shadows and stealth;
draw submissions remain fewer. Each quality also throws from a real floor
onBeforeRender while original actor parts are hidden: the caught failure
restores all original visibility and frame-stat policy, and the next render
works. No account or economic actions. Artifacts:
`/tmp/eidolon-1-48-integrated-instances-0930`.

Read-only job109836999629/run36664933512 still in progress this turn; host
load30.95/28.61/29.84 on16 threads, CPU some pressure44.58/44.36/44.57.
Do not take this as a controlled FPS benchmark or precise attribution of past
timings. Cached candidate timing stays pending comparable host conditions.
Owner's specific soak cancellation question is unanswered; no job cancelled,
schedule changed or unrelated process stopped. Safe release branch remains
ca7412a0; candidate remains isolated, default-disabled, unpublished. No148
milestone acceptance, release metadata bump, public deployment or universal
performance claim follows from these ownership and appearance tests.

## Standard actor-instance probe — pending controlled timing

Isolated on work/alpha-1-48-actor-instances-probe-20260930; NOT enabled by
default, merged to the release branch, pushed or deployed. The later opt-in
owner integration is documented above.
Standard InstancedMesh attributes borrow exact shared geometry/materials;
combine compatible opaque rigid character parts inside64m spatial cells.
Original actor visibility changes only within the synchronous render frame,
then restores before input, gear, stealth or other game updates. Retain
transparent/custom/skinned/morph/mirrored/unmatched normal rendering and all
animation transforms, silhouettes, layering and shadow flags. Owned instance
buffers are retired without disposing borrowed surfaces or replacement hooks.

Initial14 unit checks pass4.348s; two native Chrome appearance cases13.8s pass
six ten-hero pose pairs eachquality including stealth, equal triangles and
restored visibility. High image inspected. Initial busy probe43.2s records
High800draws166327tri341geometry54textures, Low461/85546/340/40; resources
repeat-stable and no matrix/indirection texture increase. Yet High26.2/26.8ms
median,44.3/42.9ms p95, Low20.4/19.2 and30.3/30.4 do not prove faster gameplay
or meet High20/33.4. Draw reduction alone is not performance acceptance.

One changed-code follow-up caches grouping rosters, refreshing on actor
membership, material/geometry/state flags, spatial cell and gear revision.
Forced same-signature gear refresh increments its visual revision on clear.
Keep live visibility and unsupported-material guards and current animated
matrices each frame. New roster unit catches nonprocedural eligibility after
registration; fix the production guard, not its assertion. Equipment/stealth
288checks pass in the mixed selection; corrected instance15 checks0.665s
pass. Two cached Chrome appearance cases11.6s retain the same strict contracts.
Scoped lint/whitespace pass. No cached timing result is claimed yet.

Read-only host evidence changes the next action:16 threads, load33.24/33.07/
29.04 and CPU pressure some avg10=40.19/avg60=51.97. Active scheduled soak
run36664933512 exact7ee8c07b818c251800ae6eac461c39b0ceaae0db, job109836999629
started10:03:15UTC; 100-client24h step started10:10:39. Verified server/loadtest
working directories belong to eidolon-soak runner; observed server344% CPU,
loadtest67.5%. Do NOT claim this proves the precise cause of previous timings.
Defer the cached comparative timing rather than replay under known contention.
Owner was asked to cancel only this run; no approval received or cancellation
made. Existing authorized Luna follows this exact job read-only. Schedule and
other processes remain unchanged. The later owner integration above closes
frame-exception restoration and actor add/remove registration; the isolated
candidate still needs its controlled performance gate before release.

Artifacts:/tmp/eidolon-1-48-actor-instances-appearance-0930,
/tmp/eidolon-1-48-actor-instances-busy-0930,
/tmp/eidolon-1-48-cached-instances-appearance-0930. Safe release remainsca7412a0.

## Cached rigid local transforms — September30

Keep constructor-owned rigid mesh leaves' already computed local matrices.
Actor roots, pivots, all named animation targets and skinned parts stay dynamic;
parent world transforms still propagate normally. Batched equipment similarly
caches unmerged opaque rigid leaves, preserving translucent behavior and all
visible geometry/materials. Rest-pose reset refreshes cached matrices explicitly.
No added render pass, buffer, shader, texture, dropped detail or balance change.

An unrelated pre-existing surface test demanded geometry identity for newly
owned per-loadout pivot buffers. Four cases fail on unchanged6188da41 baseline
in2.072s. The corrected comparator retains shared-source identity checks but
compares every attribute, item size, normalization, index and world transform
for owned buffers. A deliberately corrupted vertex proves it still rejects
changed geometry. Four suites315 checks pass8.555s; two added corruption/reset
checks pass1.077s. Explicit guards show cached leaves do not recompose each
frame, animated meshes do, and moving parents and pool reset remain correct.
Scoped lint/whitespace pass. An initial new fixture picked an item without a
common-pivot batch; use the real full-slot catalog, retaining the existence and
corruption assertions rather than skipping either.

Six System Chrome appearance cases27.9s pass: equipped21 poses eachquality,
independent unbatched equipment reference/equal triangles/exact stealth,
four-class body poses and Skeleton poses at High/Low. High Fighter image
inspected. Evidence:/tmp/eidolon-1-48-static-transforms-appearance-0930.

One changed-code native raid workload38.4s: High busy/repeat median23.4/26.0ms,
p9531.4/35.7ms, zero>50ms hitches,2454 calls/166327 triangles/341geometry/
54textures. Low17.7/17.9ms median,23.7/26.7ms p95, zero hitches,1288 calls/
85546triangles/340geometry/40textures. Residency is repeat-stable. No concurrent
test command during this measurement. This is a safe local composition saving
with no measured resource or appearance regression, not a controlled percentage
FPS claim. High still misses20/33.4ms; do NOT declare1.48 complete. Evidence:
/tmp/eidolon-1-48-static-transforms-busy-0930. Do not replay unchanged workload.

## Shadow probe outcome — September30

Rigid shadow-caster experiment archived locally on
work/alpha-1-48-shadow-casters-probe-20260930 at360d612b, not merged, pushed
or deployed. Its46 focused and394 equipment/loader/preview checks pass;
eight Chrome cases45.9s retain21 equipped poses each quality, equal triangles,
exact stealth and visually intact Fighter shadow. High maxmean0.000342857/
maxchanged0.000003175, Low0.000439683/0.000006349. Functional/image correctness
does not override measured gameplay performance.

One changed-code busy workload51.8s keeps resource counts stable across repeat
but High busy/repeat38.2/30.2ms median,66.9/42.8ms p95 and Low24.7/23.2ms,
36.2/36.4ms do not improve the safe implementation. Initial High overlaps the
unit command, so no precise initial slowdown attribution. Later phases also
miss improvement. High1725 draws/166327 triangles/524 geometry/54 textures;
Low1423/85546/523/40. Three0.181.2 does not early-return for zero drawCount;
shadow-only proxies add135 Low colour submissions/program setups despite
zero visible vertices. Do not ship the resource increase or weaken20/33.4ms
and4096 High settings. Safe72fc0db2 source restored, no unchanged replay.
Evidence:/tmp/eidolon-1-48-shadow-appearance-0930,
/tmp/eidolon-1-48-shadow-busy-0930. Full probe reasoning remains archived.

## Busy render attribution — September30

A new opt-in `EIDOLON_RAID_CPU_PROFILE=1` records renderer/shadow/composer
pass CPU spans and the eleven-actor animation/field updater. It changes no
model, visibility, target, rendering setting or resource assertion. One
bounded native-Chrome diagnostic passes39.2s on RADV RENOIR. High busy/repeat
frame medians24.0/26.1ms, p9535.5/45.5ms still miss20/33.4; unchanged2454
draws/166327 triangles and341/54 geometry/textures. Render CPU22.2/24.2ms,
shadow span7.0/7.7ms, bloom0.3ms and raid animation/fields0.2ms median.
Low busy/repeat19.3/18.3ms, p9530.8/27.4,1288 draws/85546 triangles and340/40
resources. Overlapping spans are attribution, not additive independent costs
or a precise driver diagnosis. Initial sample included warmup counters;
median/p95 exclude that single outlier, and final instrumentation drains
counters on every warmup frame as well. No claim of improved code timing.
Evidence:/tmp/eidolon-1-48-busy-cpu-attribution-0930.

Tested changed-code approach (rejected above): ordinary geometry batches for compatible rigid
opaque shadow casters beneath authored animation barriers. Preserve visible
rendering, alpha-tested/translucent/custom-depth exclusions, animation pivots,
shadow silhouettes and source-resource ownership. Do not downgrade4096 High
shadows, remove equipment or reenable rejected GPU matrix/surface-color
experiments. Validate functional and image/shadow equivalence before a single
changed-code busy measurement; this is not full1.48 acceptance.

## Rejected additional cross-surface extension

Keep the plain6faff8d1 pivot implementation. Its additional nested-mesh/
cross-surface color folding experiment preserves all21pose pairs eachquality,
equal triangles and exact stealth;301checks5.339s and twoChrome15.1s pass.
However its actual busy High/Low timing regresses despite38/19 fewer draws.
One shared-material changed-code follow-up24checks2.177s and50.4s workload
still fails to outperform the plain-pivot result. No precise driver/material/
host-load cause is proved. Full source/tests/failed receipt archived locally
on work/alpha-1-48-surface-pivot-probe-20260930 f4d35740, not pushed/deployed.
Release branch returned clean to63168425; no extension remains enabled.
Evidence:/tmp/eidolon-1-48-rigid-surface-appearance-0930,
/tmp/eidolon-1-48-rigid-surface-busy-0930,
/tmp/eidolon-1-48-rigid-surface-shared-busy-0930. No unchanged replay needed.

## Rigid common-pivot equipment — September30

Replace the rejected dynamic-matrix approach with ordinary immutable merged
geometry only beneath the nearest authored animation target. All clips define
barriers, including equipment foot rotations; static item/anchor fit transforms
are baked below that pivot. Material identity, geometry attributes, shadow,
layers, render order, transparency, morph/skinning and mirrored transforms
remain barriers. Named sources stay attached for inspection and transparent
stealth. Suspension reuses geometry, restores source-piece alpha ordering and
resumes the opaque batches on restoration. Gear clear/refresh and model-pool
return dispose only the owned merged geometry, never source cache resources.

Four existing equipment/refresh/replication/stealth suites301checks14.240s
pass. Twelve new pivot/fit/barrier/suspension/ownership/pool checks join the
equipment/stealth suites:299checks5.990s. Scoped ESLint/whitespace pass.
Two System Chrome cases18.9s retain all21 four-class poses perquality and the
independent unbatched constructor reference; equal triangles in every pose.
High maxmean0.000346032/maxchanged0.000003175, Low0.000439683/0.000006349;
stealth pixel-identical with equal submissions. High idle source→optimized
Fighter468→228/Rogue478→216/Wizard442→214/Cleric478→246, Low227→107/
232→101/214→100/232→116. Fighter screenshot inspected. Evidence:
/tmp/eidolon-1-48-rigid-pivot-appearance-0930.

One bounded unchanged-content busy/repeat test45.1s retains all ten equipped
heroes, Malachar, four fields/warnings and original resource assertions.
High2454calls/166327triangles (previous2592), median/p9529.1/45.9ms and
repeat29.7/45.2;3/5hitches>50ms. Low1288calls/85546triangles (previous1357),
20.8/33.7 and repeat18.7/30.0;zero>50ms hitches. Residency repeat-stable
High341geometries/54textures, Low340/40; extra merged geometry is owned and
released on gear/pool clear. No dynamic GPU matrix/indirection textures.
Observed timings improve relative to the prior bounded color-packed result,
but High still misses20/33.4ms; this is not universal FPS or1.48 acceptance.
Same RADV RENOIR desktop host, not phone hardware. Evidence:
/tmp/eidolon-1-48-rigid-pivot-busy-0930. No unchanged repeat soak needed.

The current accepted1.45,146 camera correction and prepared147 have been
merged into this branch (3093caee), preserving startup preparation and native
browser zoom. Runtime remains1.47 pending ordered predecessor acceptance.
Follow-up explicit loader/moving-cast/hit-reaction suites142checks4.005s pass;
the pooled-model cleanup retains the existing animation/reaction seams.

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
