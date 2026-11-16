# Final controlled rendering workload

Targets recorded BEFORE execution on September14. Use the existing
`tests/e2e/raid-scene-performance.spec.js`, not a new benchmark framework.
Current runtime1.9.9 at3481f89a (active documentation descendant6d5ba7a0),
system Chrome/hardware Vulkan on the Ryzen7 5700G host,1440×1000 viewport.
No other local native QA is running; release CI is still on GitHub-hosted
browser shards. Keep this short check separate from full gameplay/phone claims.

Comparable retained baseline: `docs/art/VISUAL_POLISH_PLAN.md` records the same
ten-equipped-hero/Malachar/busy-field workload: final High median16.7–16.8ms,
p9542.6ms initial/18.2ms repeat; Low median16.7ms,p9516.9–17.2ms. Hardware/driver
identity must be recorded again; do not claim an exact before/after speedup
across builds or drivers from these historical measurements.

Acceptance targets for EACH busy and busy-repeat sample:

- High median frame interval≤25ms, p95≤50ms.
- Low median≤20ms, p95≤33.3ms.
- 180frames after60warm-up frames, hardware renderer (no software fallback).
- Repeated busy geometry/texture counts equal the first busy sample; clearing
  the scene reduces draw calls; no browser errors.
- Inspect saved High/Low frames for visible class/gear/telegraph contrast.

These are hardware-specific controlled-scene targets, not universal60FPS, public
network performance, a completed raid, actual physical-phone play or sustained
endurance. A passing script that only records timing is insufficient: compare
the measured timing with these declared limits before accepting it.

## Result — accepted, September 14

The existing test passed in 27.157s, zero retries, started at
2026-09-14T04:20:34.318Z. The terminal HTML report contains the original JSON
attachment and no browser/test errors. Session48057 is now absent; do not restart
this completed workload. The redirected stdout file was inside Playwright's
cleared output directory, so the result was recovered from the embedded report,
not inferred from screenshots or repeated to replace a missing log.

Renderer: `ANGLE (AMD, Vulkan 1.4.318 (AMD Radeon Graphics (RADV RENOIR)
(0x00001638)), radv)`. All samples contain180frames.

| Quality / phase | Median ms | p95 ms | Draw calls | Geometries / textures |
| --- | ---: | ---: | ---: | ---: |
| High busy | 16.7 | 21.3 | 2740 | 289 / 28 |
| High clear | 16.7 | 16.8 | 22 | 244 / 24 |
| High repeat | 16.7 | 19.1 | 2740 | 289 / 28 |
| Low busy | 16.7 | 16.9 | 1431 | 289 / 28 |
| Low clear | 16.7 | 16.8 | 7 | 244 / 24 |
| Low repeat | 16.7 | 17.0 | 1431 | 289 / 28 |

Both busy samples for each quality meet the predeclared median/p95 budgets.
Repeated resource counts match and clearing reduces calls on both presets.
Manually inspected both1440x1000 PNGs: warning rings and labels remain visible
on Low, class silhouettes and held gear remain distinct, and High adds brighter
field effects. The deliberately zoomed-out crowd does not establish detailed
equipment readability or phone usability; some actors naturally overlap fields
and labels. Those broader integrated checks remain open.

Artifacts: `/tmp/eidolon-final-raid-render-20260914-bub31O/`, including
`raid-sized-high.png` and `raid-sized-low.png` in the test subdirectory and the
preserved `render-report.html` with the complete timing attachment. Reuse this
accepted controlled rendering result, not a fresh run for every release.
