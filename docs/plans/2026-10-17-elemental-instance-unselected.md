# Elemental actor instance delivery: unselected

The first bounded CPU comparison rejects automatic selection of the guarded
High-only actor-instancing extension at `7010327fcbb4ef4380494cc19c99f81bbcdbdf56`. Production
Alpha 1.79.68 does not include it. Draw-call reduction alone does not qualify a
performance improvement; original whole-game targets remain open.

The prototype registers the ten constructor-batched Fire/Air families, gated by
the existing High singleton setting, live WEBGL_multi_draw support and enabled
per-instance culling. Missing/disabled delivery, Low/Medium, array cameras,
transparent or unsupported leaves retain their source path. Supplied and unknown
families remain outside this extension. It does not change the source models.

First normal-RAF A/B/B/A comparison on native AMD/RADV RENOIR, Chrome 153:

| Four walking factory actors | Source CPU medians | Candidate CPU medians | Source / candidate draws | Triangles |
| --- | --- | --- | --- | --- |
| SandstormDjinn | 1.7 / 1.4 ms | 2.3 / 1.8 ms | 188 / 43 | 15,009 / 15,009 |
| ThunderRoc | 1.6 / 1.5 ms | 2.0 / 1.5 ms | 188 / 37 | 7,777 / 7,777 |

Each window samples 32 actual RenderSystem.render calls, with eight warmups
outside timing; equal walking mixer work is outside CPU timing. Both Djinn
candidate medians exceed both source windows. Roc is inconclusive. All frame
medians are approximately 16.7 ms. These 256 samples are component CPU diagnostics,
not GPU-duration or whole-game/device FPS proof. No favorable timing rerun was
made and no soak/stress test was run.

138 focused checks across four suites pass, including seventy new real-family
animation, distant transform, unsupported-path and restoration cases. Two native
High image cases cover 96 views across five ordinary clips, far run, nonuniform
scale and transparent stealth, each at two phases and three directions. Existing
mean-error/fraction thresholds, exact reference restoration, unchanged-or-lower
triangle counts and render-failure restoration pass. The stored state PNGs show
the restored reference; candidate comparison is in the recorded pixel metrics.
Focused lint and unchanged geometry-worker build pass.

This does not qualify all ten families, Low, broader culling extremes, dynamic
whole-world CPU/resources or supported devices. Further instancing work requires
a distinct measured cause and new evidence. Keep this runtime isolated; do not
merge it to reduce worktree counts or treat passing image tests as CPU acceptance.

Private closed evidence: `/home/aeml/.local/share/eidolon-elemental-instance-review-20261017/.qa-elemental-instances`. Frozen 35-file inventory
SHA-256 `ad4a865ff03044bf2208bb0b5d4700167ebec037063d728df4229fac014c63d0`. The processor has run once; execution stdout and mutable
continuation are excluded. Full original goal active. The selected ten-rig
constructor milestone and its retained performance limits are documented in
[the rigid-part qualification](2026-10-17-elemental-rigid-parts-qualification.md).
