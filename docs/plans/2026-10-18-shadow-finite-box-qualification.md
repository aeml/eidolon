# Shadow bounds without temporary coordinate arrays

Runtime source `2a061903a` replaces the actor shadow policy's array-based
finite-box test with six scalar Number.isFinite checks, matching the existing
neighboring view policy. Its Box3 instances and coordinates are policy-owned.
The original empty-box test remains first. No bounds cache, matrix update,
light validation, culling rule, geometry, material, shadow flag or threshold
changes. The preceding actual equipped Wizard diagnosis measured1.2ms median
instance-bound work inside2.0ms shadow filtering, with304validated batches.

All127focused checks pass across five existing suites in1.993s, including
current float32 instance matrices/count, changed positions, unknown lighting,
invalid data, deformation fallbacks, ordinary batching and cleanup. Changed-file
lint and diff checks pass. No additional implementation-mirroring tests are added.

A controlled one-CPU comparison runs the actual original/candidate policy over
the same304three-instance batches and current matrices/lights. Each arm warms
150calls and measures1000calls. Median/p95 milliseconds:

| Arm | Median | p95 |
| --- | ---: | ---: |
| Original | 0.322239 | 0.550181 |
| Candidate | 0.228031 | 0.382653 |
| Candidate | 0.228883 | 0.387633 |
| Original | 0.327780 | 0.559007 |

All arms retain identical shadow-flag hashes,304checked batches,234omissions,
307light nodes and no unknown illumination. Original flags restore after each
arm. The reference module comes from the parent commit; only its relative
import paths are adjusted for the private benchmark location. These are
synthetic CPU results, not a whole-scene or device FPS claim.

Four unchanged native High/Low Skeleton/Imp component cases pass in14.2s.
All34pose/lighting states have zero changed and unstable RGB channels against
the existing unfiltered reference, original draw/triangle ceilings, restored
source flags and stable resource cycles. Unknown point shadows retain the
original fallback. Every injected render failure restores state. The High
Skeleton capture was visually inspected and contains both visible actors and
incoming offscreen shadows. This is a prepared component, without gameplay HUD
or earned campaign coverage.

The native container uses a private network, two CPU limit and2GiB memory;
it retires and all guarded inputs remain unchanged. No backend, production
service, credentials, soak/stress or physical phone is involved. Private26file
inventory under `.qa-shadow-finite-box`:
`7686a8f49dc05f56f53d9ad3e2967c16894570985438de9c605315c33dd295b2`.

The code is selected into the isolated movement-audio integration as `6e9aa6298`.
The changed source now requires the original complete six-case actual gameplay
gate; its prior failure and all original thresholds remain. This component does
not close whole-game performance, art/device/readiness or beta gates, and is not
yet deployed. Pending81 must be accepted before another release is published.
