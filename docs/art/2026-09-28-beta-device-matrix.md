# Eidolon device and rendering evidence

The 1.18 measurements below are historical workload evidence, not closed-beta
approval or a current universal support promise. The owner has not selected a
formal supported hardware/OS list. Do not convert browser emulation into a
real-phone certification. Later qualified performance and lifetime results are
linked from the [1.50 integration review](../plans/2026-09-30-release1-50-presentation-review.md).

## Evidence matrix

| Configuration | Evidence and current status |
| --- | --- |
| Linux, system Chrome153, AMD Radeon/RADV Vulkan | Primary automated reference on this host. Actual hardware rendering, desktop keyboard/mouse and instrumented browser touch routes. Record workload/version with each result, not a blanket performance promise. |
| Desktop Chrome/Brave on other GPUs or operating systems | Candidate beta targets; this Linux result does not certify them. No new minimum GPU/RAM claim. |
| Phone-sized390px portrait and landscape in desktop Chrome | Responsive layout and browser-input checks; useful regression coverage, not phone GPU, thermal, browser chrome or battery evidence. |
| Owner's phone Chrome/Brave | Owner reported general UI comfortable. Model/OS, actual dungeon/party controls and sustained combat performance explicitly deferred. Do not repeat the request or block unrelated code work. |
| Firefox, Safari/iOS, tablets and controllers | Not certified by this pass. Firefox has rendering fallbacks in source, which are not test evidence. No controller support claim. |

## Existing quality behavior, now explained in Settings

High remains the default; it enables the richest available lighting and effect
detail. Desktop dynamic shadows use4096px maps, Medium2048px; Low disables
dynamic shadows and post-processing. Effect-density scales are1/.78/.52 and
bloom scales1/.66/0 respectively. Phone mode disables dynamic shadows and normal
post-processing at every quality, caps pixel ratio at1 and disables renderer
antialiasing. Desktop pixel ratio is capped at1.5 (Firefox1).

Terrain maps have authored High/Low variants; Medium uses the High surface set.
Quality must not remove collision, interactables, boss warnings or objective
markers. Brightness remains an independent control. Low is the first suggested
setting for uneven performance, not a promise that any particular phone can run
the game. No silent automatic quality downgrade is introduced here.

## Bounded populated-world acceptance budget

Declare before the1.18 run; retain the previously used frame-time targets.
`tests/e2e/populated-earth-world.spec.js`, opt-in
`EIDOLON_E2E_POPULATION_PROFILE=1`, covers four views per fixture: dense town/Earth,
Water/Fire settlements and Air landmarks/camps. Each view warms30 frames and
samples120 animation-frame intervals plus CPU submission time. High1280×844;
Low390×844 uses actual phone rendering policy on the desktop GPU.

| Budget per sampled view | High | Low / phone policy |
| --- | ---: | ---: |
| Median frame interval | ≤20ms | ≤33.4ms |
| p95 frame interval | ≤33.4ms | ≤50ms |
| Submitted draw calls | ≤350 | ≤200 |
| Submitted triangles | ≤250,000 | ≤85,000 |

Draw/geometry ceilings leave explicit headroom above earlier1.15/1.17 observed
scene counts (e.g. Earth Low159calls/62,496triangles; Air High228calls/142,240).
They are regression ceilings for these views, not arbitrary global production
limits. Already-warmed repeat visits must grow neither geometries, textures nor
shader programs. Existing spatial foliage batches and scene-owned disposal stay
intact. No essential content may be deleted to manufacture a passing result.

Record renderer, browser, counts and actual output. Busy-host results are not a
quiet-host acceptance; do not repeatedly rerun until lucky. This fixture has a
hero, populated scenery and working readings, not server combat or a crowded
multiplayer realm. The separate ten-hero field test checks busy-scene resource
return; it records timings without claiming a universal raid FPS floor.

Full modern-art approval, imported actor fit and actual-device support remain
separate gates. These checks must not be used to declare the entire B1 contract
finished by themselves.

## Local 1.18 result

Final six cases passed in2.0 minutes on Chrome153.0.8010.36, ANGLE/Vulkan AMD
Radeon Graphics (RADV RENOIR). Artifacts: `/tmp/eidolon-118-ground-final/`.
This supersedes `/tmp/eidolon-118-population-profile/` with the final equipment
surface maps and regional ground dressing included.
All24 sampled views meet the declared frame/call/triangle budgets; every warmed
repeat retained the exact geometry/texture/program counts. Worst values across
each four-view group:

| Views | Quality | p95 ms | Calls | Triangles | Resident geometry / textures / programs |
| --- | --- | ---: | ---: | ---: | --- |
| Town/Earth | High | 16.8 | 240 | 165,899 | 270 /44 /36 |
| Water/Fire | High | 16.8 | 211 | 138,620 | 303 /41 /34 |
| Air | High | 16.8 | 215 | 142,058 | 201 /37 /34 |
| Town/Earth | Low | 16.8 | 144 | 62,784 | 264 /31 /23 |
| Water/Fire | Low | 16.8 | 111 | 36,657 | 282 /27 /20 |
| Air | Low | 16.8 | 115 | 39,999 | 176 /23 /20 |

No concurrent local browser workload was launched during this measurement;
the client unit suite started during the final Air/Low case. These are bounded
regression checks, not a quiet-host before/after speed comparison.
These are fixed-camera scenery samples, not sustained combat or real-phone
measurements. No extrapolation to full-world server capacity or all GPUs.
