# Expanded casino — bounded hardware frame profile

Contract recorded before execution. This supplements the accepted September20
software screenshots, not a repeated casino gameplay or settlement test.

Use the existing `casino-busy-floor.spec.js` with
`EIDOLON_CASINO_FIXTURE_CATALOG=1 EIDOLON_CASINO_PROFILE=1`. One test, zero retries,
system Chrome/hardware Vulkan on the shared Ryzen7 5700G host at1440×1000.
Wait for CI36285496845 and its native browser jobs to finish first. Do not overlap
another owned GPU workload. No production account, wager or database is involved.

The existing full-hall camera shows the actual92 stations/232 seats,40 equipped
prepared models/20 visible per floor, and Well Rested auras updated each frame.
Only one floor and its actors/effects may be visible. This deliberately wide
camera is not ordinary player zoom or an actual40-client network session.

For each High/Low public/VIP view, warm up60 frames and record180 frames using
the existing render loop. Record hardware renderer, visibility, frame median/p95,
render-submission CPU, draw calls, triangles and geometry/texture residency.
Require hardware rendering, visible document, all180 samples and no browser errors.

Reuse the existing September14 hardware-specific targets, without relaxing them
after measurement: High median≤25ms/p95≤50ms; Low median≤20ms/p95≤33.3ms.
These are controlled-scene targets, not universal60FPS or Internet/phone capacity.
Collect all four views once even if a timing target fails; retain failed samples
and investigate a demonstrated bottleneck instead of retrying until green.
Inspect screenshots for floor isolation and readable circulation. Existing
currency, multiplayer-game and persistence evidence remains separate.

Status: instrumentation prepared; native execution not started. This changes QA
only and is not part of the immutable1.10.2 candidate8b2b955f. No performance
acceptance or production optimization is claimed before the measurements exist.

## Result — September27, Low median target not met

One run at QA-onlye88c8538 started01:50:08UTC after all ten release jobs passed;
terminal96388 exited1 in29.2seconds, zero retries. System Chrome renderer:
`ANGLE (AMD, Vulkan 1.4.318 (AMD Radeon Graphics (RADV RENOIR) (0x00001638)), radv)`.
All four views collected180 frames with a visible document and valid counts.

| View | Median ms | p95 ms | Render CPU median ms | Draw calls | Geometry / textures |
| --- | ---: | ---: | ---: | ---: | ---: |
| High public | 22.3 | 26.6 | 21.2 | 2702 | 363 /23 |
| High VIP | 22.6 | 28.4 | 21.4 | 2658 | 486 /23 |
| Low public | 20.1 | 24.1 | 19.0 | 2635 | 486 /23 |
| Low VIP | 20.3 | 24.5 | 19.4 | 2591 | 486 /23 |

Both High views and all p95 values meet their predeclared targets. Both Low
medians exceed20ms, so the performance gate remains failed. The small miss can
be sensitive to shared-host scheduling; it is not proof of a specific bottleneck,
and no unchanged retry or relaxed threshold is justified. First inspect draw
submission/scene work; do not assume an optimization before locating it.
The first-public→first-VIP geometry increase is not a leak measurement: this
run did not repeat views or perform a resource-lifetime sequence.

All four screenshots were inspected: only the selected floor is visible,
public/VIP carpet treatment is distinct, lanes between tables remain clear,
seated patrons and their auras appear on the correct floor. The wide overview
does not prove table-hand UI or ordinary-camera readability. No visual failure
was observed; the two Low median assertions are the reported failures.

Evidence: `/tmp/eidolon-casino-native-profile-20260927-whiOZK/`, containing
`run.log`, `report.json`, four view screenshots and the frame-profile attachment.
The owned4189 listener is gone after terminal cleanup. No production account,
wager, balance, runtime setting or game code was changed.

## Hidden-floor animation follow-up — local, not deployed

Source inspection confirmed that all attached effects on the invisible floor
still traversed/animated every frame. Regression first failed with30 hidden
traversals where zero were expected. Commitd44273ee keeps elapsed and deferred
delta time but skips invisible pose/mote updates, then catches up exactly once
when the floor becomes visible. All defined status effects at both qualities
match the continuously updated reference's position, quaternion, scale and
instanced matrices after reveal and the following visible frame.34 focused
status/controller/VIP tests pass2.078s; lint and whitespace pass.

One changed-build hardware check ran for29.1seconds, zero retries, terminal55462
exit1. Same renderer, workload and limits. High public22.1/26.3ms median/p95;
High VIP22.6/27.4ms; Low public20.3/25.0ms; Low VIP19.7/23.2ms. Draw calls,
triangles, geometry and texture counts match the original corresponding views.
Low public still misses the20ms median target, so acceptance remains open.
This proves removed invisible work, **not a uniform frame-time improvement**;
the remaining result is consistent with frame submission still dominating.
Do not retry unchanged or claim that the optimization closed the performance gap.

Artifacts: `/tmp/eidolon-casino-native-profile-r2-20260927-9JdN9Z/`. The Low public
screenshot was inspected: floor isolation, tables, clear lanes and visible auras
remain intact. All four floor/count checks pass; only the Low public median
assertion fails. The4189 listener is gone. No test is running.
Future patch note: “Effects on the hidden casino floor no longer animate
unnecessarily; their appearance catches up when you change floors.” Batch this
small optimization with the next gameplay release; live remains1.10.2.

## CPU attribution — diagnostic only

One29.9-second diagnostic run on the same runtime captured a5.43-second Chrome
CPU profile of the Low/public sample,4155 samples. Terminal78152 exited1; the
trace lives in the `casino-low-public-cpu-diagnostic` JSON attachment under
`/tmp/eidolon-casino-cpu-diagnostic-20260927-v5mAxm/report.json`.
Profiler overhead makes this run unsuitable for timing acceptance, regardless
of any individual timing assertion. It is not an unchanged acceptance retry.

Largest exclusive sampled costs: `updateMatrixWorld`17.5%, `projectObject`8.4%,
`multiplyMatrices`6.7%, `renderObjects`6.0%, `renderBufferDirect`5.7%,
`copyArray`4.9%, `getParameters`4.5%, frustum intersection3.7%, shader program
selection3.3%, render-list sort3.2%. These are sampled CPU attribution, not GPU
timings. Matrix multiplication also occurs outside world-transform traversal;
do not assign its entire6.7% to hidden actors without checking call stacks.

Source inspection confirms the casino architecture/furniture already merge by
material. Three's world-matrix traversal still visits hidden descendants, and
equipment keeps hidden original pieces for named inspection/bounds. Blindly
freezing or removing those originals can break world-space inspection or future
equipment changes. The next investigation should target redundant transforms
while preserving movement, animation, floor transitions, picking and bounds;
do not replace the renderer or reduce visible detail merely to pass this gate.
The prior Low/public20.3ms miss remains open. No further run was started.

## Hidden actor traversal — candidate, not accepted or deployed

Commitaa054304 keeps live hidden-floor actors out of the render scene while
leaving their authoritative positions, equipment and ordinary updates intact.
Only scene-owned roots are detached; nested meshes retain their original parent.
Changing floor restores the current live mesh. Streaming absence restores
visibility without reinserting the actor, and retired/replaced meshes are never
resurrected. Actual ChunkManager move-out/move-back/removal coverage is included.
Three new lifecycle reproductions failed before the change;38 focused controller,
status and VIP checks pass2.861seconds afterward. Lint and whitespace pass.
No renderer or equipment-resource ownership API was replaced.

One native run on this changed build ended with terminal35403/exit1. Every view
retained the same draw/triangle/resource counts and passed floor visibility,
seating and aura counts. Hardware identity is unchanged. Timings failed:

| View | Median ms | p95 ms | Render CPU median ms |
| --- | ---: | ---: | ---: |
| High public | 32.6 | 42.0 | 30.7 |
| High VIP | 31.9 | 45.3 | 30.0 |
| Low public | 28.8 | 40.8 | 27.0 |
| Low VIP | 28.3 | 43.6 | 26.1 |

Immediately afterward (02:06UTC), the16-logical-CPU shared host reported load
40.02/31.27/24.13. The process list included active server/loadtest, ccwat/ccnews,
Plex transcoding and PalServer work. None was stopped or changed. This supports
a contention concern, not a measured causal attribution for the regression;
no comparable within-run host profile was recorded for either baseline.
Do not count this as a performance pass, infer a speedup from fewer matrix calls,
or launch repeated trials on this loaded host. Preserve the candidate and test
when a suitably uncontended window is available, without relaxing the targets.
The production optimization remains unshipped pending that evidence.

Artifacts: `/tmp/eidolon-casino-native-profile-r3-20260927-z7mpmQ/` with logs,
JSON frame attachment and screenshots. The owned4189 listener is gone; no
deployment or native profile is running. Live remains verified1.10.2.

### Resource recheck — hardware retest held

At02:07UTC the host remained loaded (34.78/31.73/24.89). A subsequent five-second
`vmstat 1 6` probe, excluding its since-boot first row, observed24–42 runnable
tasks and only3–7% aggregate CPU idle on16 logical CPUs. GPU busy was0% when
read afterward. This establishes current CPU contention, not its exact effect
on any prior profile or a GPU bottleneck. No hardware rerun, deployment, process
termination or priority change was made. A quiet CPU window is needed for a
useful changed-build comparison; do not spend runs against this condition.

The non-GPU source check of shared-realm party rewards found no missing fix:
`partyKillUsesDungeonPresence` excludes the Dark Realm, and the existing party
credit tests cover its110-unit boundary and distant-district exclusion. Retain
that coverage; no redundant reward test run or gameplay change was made.
