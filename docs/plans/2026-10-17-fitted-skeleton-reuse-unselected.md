# Fitted body-skeleton reuse — unselected prototype

Prototype source: `42791517bdeedd7a1000eefa8f83b63331095d83`, based on accepted Alpha 1.79.70 runtime `668c34652`.
**Runtime is not selected or merged into master.** No unchanged native timing retry.

Raw GLB census finds identical bone order/inverse matrices for 480 class/quality
skin references across 248 files. The prototype lets compatible final fitted
surface unions borrow their live actor skeleton; incompatible bindings retain
owned unions. Assets, geometry, weights, bind matrices and materials stay intact.
59 focused checks/two suites pass, including replacement, clear, mode changes,
animated surfaces, borrowed-owner survival and incompatible-binding fallback.
The initial finite-array assertion and comparison-clone fixture errors remain
retained with their specific corrections.

The first native High/Low comparison computes 140 exact RGBA pose comparisons
across four supplied classes, Rare/Legendary gear, mixed layers and Rogue stealth/
restoration. Both baseline repeat and candidate byte deltas are 0; triangles match.
Visible skeleton identities fall 5→1, but Fighter submissions increase 53→56 High
and 26→29 Low. Other classes retain calls. Combined moving party calls rise
177→180 High / 103→106 Low. The unchanged-call assertion fails in both cases.

One normal-RAF ABBA render-CPU sample per quality is mixed:

| Quality | A1 | B1 | B2 | A2 |
| --- | ---: | ---: | ---: | ---: |
| High median ms |5.6|4.6|6.2|5.1|
| Low median ms |2.8|3.3|2.3|2.6|

Each window has 120 samples after 30 warmups, with four Run mixers at logical 1/60
steps. The predeclared paired 5%/0.1ms margin is not met for either quality; Low
candidate maximum CPU p95 also exceeds baseline 4.3 vs 4.2 ms. Frame medians 16.7 ms
and p95≤16.8 ms describe only this prepared scene, not live parties or whole-game
performance. No cherry-picked speedup or final budget claim.

All four pool cycles release to exactly 128 geometries / 90 textures with 0 attached
actors. Active textures 94 minus 90 released are 4, while the prepared actor-owned
transient-bone counter records 0. That allocation classification is incomplete;
ownership of the four extra active textures was not established. The lifecycle
case fails its allocation assertion. This is not evidence of a leak. All three
native cases therefore remain failed, even though their 140 pixel rows are exact.

Neither fewer skeleton identities nor green CPU tests justify runtime selection
against mixed cost/increased submissions and the failed allocation assertion.
Further work would require a substantive renderer/ownership diagnosis, not an
unchanged favorable-timing replay. Grounding work continues with the existing
renderer. Full game/art/performance/beta/1.99/handoff scope remains active;
human pacing/physical-phone feedback and soak/stress remain deferred.

Private evidence: `/home/aeml/.local/share/eidolon-fitted-skeleton-review-20261017/.qa-fitted-skeleton`. Frozen 75-file inventory SHA-256:
`fa640a12825351241048d980e79494e79c7aad9fa02318584060521453ccc793`. Do not rerun the frozen processor or mutate listed payloads.
