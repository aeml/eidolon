# High actor material qualification

Selected source: `72324f0c99ad051810ad4d4d6290d8004d1481a0`. High quality
now gives each actor multi-draw runtime its own supported material variants.
Low and Medium retain borrowed materials. Built-in appearance values synchronize
once per source per frame; textures and geometry remain borrowed. Unknown shader
callbacks, complex metadata and metadata with custom prototypes retain the
existing path. Owned materials retire on removal, source disposal, quality or
extension fallback, and runtime disposal. This is not a global renderer cache.

The preceding metadata diagnostic found shader instancing/batching flags changing
between ordinary actor draws and their existing BatchedMesh proxies. Separate
material ownership removes that specific churn without changing emitted geometry.
This selects a bounded High correction; it does not close whole-game FPS gates.

## Qualification

133 distinct focused checks across nine suites and full lint pass. Initial test
fixture failures (missing animation metadata, then missing batch draw metadata)
are retained alongside their corrected fixtures. A later negative metadata case
proves inherited serialization callbacks cannot run through the supported path.

Fourteen native High/Low component cases cover Skeleton, Inferno Titan, Demon
Orc and four town NPC types. All 52 paired poses have exact pixels, draw counts
and submitted triangles; all 130 owned materials retire. Four additional default
activation cases cover High/Low/Medium quality cycles. Four copied published
engine Skeleton/Demon Orc cases assert active variants in High, zero in Low and
complete retirement after engine destruction. Their line reporter retains pass
logs but no body attachments; no exact copied-engine hash/count is inferred.
Two representative component cases join the existing bounded native art stage.

An actual four-class, fourteen-slot native party uses borrowed/owned/owned/borrowed
windows, ordinary simulation, 180-frame samples and separate 120-call metadata
probes. Go race/save and browser checks pass without retries. High has 122 stable
entities; CPU median/p95 milliseconds are:

| Window | Borrowed 1 | Owned 1 | Owned 2 | Borrowed 2 |
| --- | --- | --- | --- | --- |
| High | 36.5 / 56.7 | 34.1 / 56.5 | 34.7 / 51.7 | 35.3 / 55.6 |
| Low | 19.6 / 26.4 | 15.2 / 20.1 | 13.6 / 17.0 | 14.6 / 17.8 |

High borrowed probes record 480 changes of each shader flag; both owned windows
record zero. Twelve variants are created and retired; the initial policy restores.
The 960 other material version changes remain. Moving windows differ by roughly
14 draws/770 triangles; the exact original cause is unproved. A distinct
synchronous same-pose comparison holds all four renders at 256 calls/198,825
triangles with stable actor transforms and geometry. It does not reproduce a
persistent policy emission regression. Its six variants retire.

Low's 119-entity windows show warmup/time drift and overlap with the restored
reference. They do not prove consistent net benefit. Low/Medium stay unchanged;
no timing retry is used to obtain a favorable result. Low same-pose comparison
holds all four renders at 144 calls/78,701 triangles; all variants retire.

## Evidence custody and remaining gates

Private evidence is in
`/home/aeml/.local/share/eidolon-batched-material-variants-20261016/.qa-batched-materials`.
Closed inventories, including retained findings and sanitized synthetic-account
records, have SHA-256:

- High profile, 39 files: `9aa697b83537b6e09040fcf5516991977cc9c6ea26a34e5ff1e0b4f5630ada81`.
- Same-pose question, 15 files: `942af52a6327e4793fc1aa12db48f90e6fe09cac9b25c2cf0ba1aa1197a7d28c`.
- Low question, 14 files: `d44c6ac9c62398cf953d171746865eda3c56eccf5a8d7b3e77b728d3fdc86539`.
- Selection, 17 files: `e1a3f34887cc5e13dffd8cf97e419653de80f25b780268a92f15817217ed87e9`.

All 68 prior frozen files were verified before selection. Mutable continuation
and still-open execution output are excluded. Source preparation is not deployed
acceptance. Original route/FPS/cold/device, broader art/game/readiness, owner and
beta gates remain open. Human pacing/physical-phone feedback and soak/stress
remain deferred. No rejected town batching or older renderer-cache experiment is
selected by this change.
