# Understory surface component review

The leaf-surface component is ready for integration checks on current master.
It is not yet merged, deployed or accepted. The earlier two software and two
native whole cases remain failed because their unchanged source and candidate
close views exceed the original scene limits. This review does not replace
those tests, remove their guards or mark those cases passed.

The component adds coherent UVs to rooted bracken and sedge and applies the
existing canopy leaf-vein/roughness treatment to that ground cover. Four
High/Low geometry recipes retain exact position, normal and color bytes and
triangle counts. Canopy shader tokens are unchanged. The actual shared geometry
adds12168High/11064Low aggregate UV bytes; no texture, plant, actor, collision,
wind, terrain-profile or visibility change is introduced. Runtime source:
`4599a8a25d3cce4ae6d49eb59b73ed08f7e136ac`.

All43focused cases/six suites and full lint passed before this review. The four
separately executed UV cases overlap those43 and are not added to the count.
The retained native results independently verify six ordinary static views,
eight exact original-image restorations and48realRAF pose comparisons. Each
class has all14equipment slots without missing/fallback assets; plant counts
remain13087High/7439Low. The ordinary views and48moving frames meet the original
scene limits. Source/candidate/restored draws, triangles and resource counts are
equal; both materials dispose once and canvases retire. Close views remain
410270High/124224Low triangles for both materials. Those failures stay open.

A separate native GPU-cost profile passes its two query/count/cleanup cases
in17.8seconds. Actual AMD/RADV timestamps cover576measured frames across six
ordinary views, using six alternating AB/BA pairs per view and eight-frame query
blocks. CPU submission readings remain busy-host diagnostics. These medians of
block averages are not frame-time percentiles or physical-phone measurements.

| Quality/view | Reference GPU ms | Surface GPU ms | Difference ms |
| --- | ---: | ---: | ---: |
| High gate | 4.91914 | 4.91749 | −0.00165 |
| High road | 4.99420 | 5.11043 | +0.11624 |
| High grove | 5.02953 | 4.96256 | −0.06697 |
| Low gate | 0.99908 | 1.04670 | +0.04762 |
| Low road | 0.96190 | 0.99550 | +0.03360 |
| Low grove | 1.01737 | 0.94957 | −0.06780 |

Negative differences are not claimed as speedups. The largest observed increase
is0.11624msHigh and0.04762msLow on this host. The profile supports a bounded
component-cost review; it does not close whole-game timing or support gates.
There was one execution, with retries0 and no server load test.

The closed software44/native32/GPU10parent packets were reverified before this
review. GPU packet SHA-256:
`c634f7d4b207cea77381bb5477f43d3f766a85ebe9bcc87e8f5c825535b1402d`.
The one-shot component crosswalk has SHA-256
`83ae51bf1317e2e7b38d27ff942e74f345c7745ab1f7e848bd69e4235346bc16`.
Original [findings](2026-10-17-understory-leaf-surface-findings.md) remain intact.
Visual inspection of the High/Low road and moving-HUD captures confirms a
restrained surface finish; it is not final owner approval of the world art.

Next: integrate in an owned detached tree, verify only the three leaf runtime
paths differ from current master, and run the affected existing native lifetime
and moving-HUD cases. Publish only after Alpha1.79.73 is accepted. Keep the full
art, combat/audio, performance, device, operations and beta goal active.
