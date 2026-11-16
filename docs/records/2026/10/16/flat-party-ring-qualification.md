# Flat party and PvP marker qualification

Qualified source: `686e81a99c5559eb6c9e5abf7b28794461b0971e`.
This selects a bounded rendering correction for the next coherent milestone;
accepted public Alpha 1.79.65 remains unchanged until publication.

The flat party and hostile-PvP rings now use one double-sided rendering pass.
Their geometry, color, opacity, size, height, attachment, visibility, interaction
and disposal rules remain unchanged. Both faces still render. This is an explicit
policy on these two planar marker constructors, not a global transparency rule.

## Evidence and causal scope

The preceding native CPU diagnostic attributes most synchronous CPU time to
world rendering. Two separate metadata questions then identify actual shader
property churn and its geometry; they do not establish the original performance
failure's complete cause. The first 120-call probe records 1,680 cached material
version changes and 761 changes of each instancing/batching flag. The shape probe
identifies three flat party-ring materials, each changing versions twice per
frame, alongside four nonplanar imported surfaces. Those other surfaces retain
their rendering policy. No material cloning, renderer cache or rejected
membership/batching experiment is selected.

Six focused probe checks cover ownership, actual submissions versus existing
batch skips, scene/camera filtering, error/timeout restoration and memoized
read-only shape inspection. Both native metadata fixtures and their Go race/save
checks pass once; they are distinct diagnostic questions, without repeated Water
travel or performance acceptance. Private evidence:
`/home/aeml/.local/share/eidolon-program-attribution66-20261016/.qa-program-attribution66`.
Their closed 16-file inventories are:

- `evidence-inventory.json`: `5796f8430213d1c9d41fb21dd731b3dafe5adb13dd1bb2f73b0f1bccad70fca3`.
- `shapes-evidence-inventory.json`: `e7245e19400dc9ea4b66b57bf2dc16d0da07096cd881d740cbc7298a161baf11`.

## Selected runtime qualification

- 60 existing focused/routing checks across five suites and full lint pass.
- Two native High/Low component cases compare twelve views: party/PvP markers
  from above, near edge-on and below, including the 390px Low viewport. Every
  comparison has zero changed pixels and a visible marker. Each marker saves
  exactly one draw and 64 submitted triangles. Geometry remains unchanged.
  All four marker resources and each renderer canvas retire.
- The complete native four-class/fourteen-slot party and Go race/save fixture
  passes once, with one skipped alternative renderer case and no retries.
  The original/candidate/candidate/original comparison retains the same three
  real remote-party materials, ordinary simulation and 129 stable entities.
  Candidate version deltas are `[0, 0, 0]` in both windows; both original windows
  record `[488, 488, 488]`. Counters bracket profiler warmup as well as the
  180-frame sample, so these are not exact private shader-invocation counts.
  The comparison restores its material policy and profiler hooks.
- Original CPU median/p95 windows are 22.1/28.2 and 22.4/33.0 ms; candidate
  windows are 21.0/27.4 and 22.7/30.6 ms. Frame medians are 16.7–16.8 ms and p95
  33.4 ms. Dynamic draw/triangle totals vary despite stable entity counts.
  These overlapping observations do not prove a sustained whole-scene speedup.

The two component cases (5.1 seconds combined) are included in the existing bounded native
art stage for future releases. No new stage, deadline increase, soak or stress
run is introduced. The first source diff check caught CRLF endings on added
lines; those lines were corrected before native qualification without normalizing
the rest of the mixed-ending source file.

Private selected evidence:
`/home/aeml/.local/share/eidolon-flat-ring-pass-20261016/.qa-flat-rings`.
Verified closed 26-file inventory `evidence-inventory.json`, SHA-256
`65dda89ac6d4d278b06fdd18f5dffc6dc6ace039007f9af636bedeb92d29b957`.
Four synthetic accounts are sanitized in owned logs and copied/original embedded
reports. No image-pixel redaction is claimed; trace/video are off. Owned database
and server ports retire. Mutable continuation and execution stdout are excluded.

Original route, post-Water 33.3/49.9 ms, cold/whole-world and device performance
findings remain open. This is not earned campaign, physical-phone, owner art,
closed-beta or full-game acceptance. Human pacing, phone feedback and soak/stress
remain deferred. The full goal remains active.
