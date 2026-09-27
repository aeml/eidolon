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
