# Distinct room-purpose masonry — candidate

Code: `cf95328ebf9c3328846fd889be5ae07863735890`, based on corrected
Alpha 1.79.77 `e0f52f658d929dd2a3caf98b01fa55e1a95ec960`.
Status: CPU, native visual and copied-build component qualification complete;
selected for later assembly. This remains isolated until that assembly is
published and accepted. It is not part of current 1.79.78.

Five room identities previously reused the same court floor. The candidate
gives the treasure cache an elongated vault court with side aisles, the font
an octagonal chapel, the ambush room broken corner galleries, elite guards four
connected sentry courts and ordinary passages parallel aisle courses. The entry
nave, boss approach and boss arena keep their exact original attribute bytes;
the former court remains available as the unknown-identity fallback.

All five replacements retain the original court's 44 stones / 440 triangles,
vertex count and footprint. Relief stays below ordinary ground markers; no
floor geometry enters the central objective area or existing cache/font paving
envelopes. Existing physical UV scale, materials, shadows, batching, walkable
geometry, collision, interactions and game rules remain. The production builder
still bakes each room into its existing material batches.

Eight used plans replace four cached plans. This adds 232,320 bytes of cached
CPU attribute arrays per fully populated kit; it is not a zero-memory-cost
claim. Per affected room's baked stone/triangle count is unchanged. The native
observations below retain exact visible submission counts and cleanup; they do
not establish whole-game frame-time acceptance.

65 checks pass across the floor-composition and procedural-interior suites,
including distinct physical buffers, complete-triangle central/service clearance,
original bounds/stone budgets, small rectangular rooms, material sharing,
batch bounds and exact-once disposal of all eight compositions. Changed-file
lint and whitespace checks pass. The four original plan attribute arrays are
byte-identical. The earlier 58-check run preceded final footprint tightening
and seven extra budget/service-clearance cases; it is retained as intermediate.
The new distinct-purpose check fails against unchanged source (one failure,
11 skipped), retained in the four-file negative inventory SHA-256
`9798b5f3abbbf9e07bf8f8e91c37ff668b5f3b6afd2f50654b446b12503a0226`.

Private evidence directory:
`/home/aeml/.local/share/eidolon-dungeon-room-floor-review-20261017/.qa-room-floors`.
Frozen nine-file CPU inventory SHA-256:
`3e19481b2422e491a3537c7899b6338917a928ec7cd5d5265431187df9d8202c`.
Two private native source/candidate/restored cases pass in 46.8 seconds, retry0,
using AMD/RADV, all eight identities and five themes in High/Low, the supplied
fourteen-slot Fighter and real HUD. All80 source restorations are exact; the50
changed-purpose views differ and30 retained-plan views remain exact. Visible
draw/triangle counts match source in every comparison and retain original
Low200/85,000 and High350/250,000 limits. Idle/Run clips prewarm; each room plays
twelve real animation/render frames with changed pose and unobstructed actor
placement. Foreground marker probes pass the original green-channel threshold;
buried-marker negative controls reject visibility. All ten theme/quality cleanup
observations return to the exact geometry/texture baseline.

Both existing copied published-floor cases pass in24.0seconds, retry0, on the
unchanged candidate source. All five real generated dungeon themes retain their
original material/texture/program, collider, bounds, composition and resource
checks with the updated semantic floor-plan lists. No permanent browser case or
limit was added or relaxed.

Manual review inspected ten source/candidate pairs: molten treasure vault,
abyssal shrine chapel, Verdant broken ambush galleries, Umbral sentry courts and
Tempest parallel passage aisles in both High and Low. Distinct masonry remains
visible around the actor and service paving. This is a bounded floor-composition
selection; the broad rooms still need richer architecture/dressing. These views
do not constitute final modern-art, moving combat, whole-game performance or
physical-device approval.

The first native observer used an opaque foreground probe; later opaque draws
overwrote it. Its18-file failure inventory SHA-256 is
`7ac94c5165aed0011e1000bb0d6935d89a6809e6f28af5703d549e57f4732960`.
Making it transparent matched ordinary marker ordering, but the postprocessed
sample still failed the unchanged green threshold because grading changed the
channels. That18-file failure inventory is
`88469337695be5640b12fa90c9ad3044fea1e1fca29b45a46e91a8f74dac1fae`.
The corrected observer reads an untonemapped/unfogged linear offscreen target
and adds the buried negative control; main-renderer art hashes remain separate.

A subsequent55.4-second native run passed but manual review found that its
local-origin floor was obscured by overworld ground. That172-file packet is
superseded visual evidence, not the final selection; SHA-256
`3e7f5fe6fd0cd1da5184666eafcb647d1e86cd4d1d443ed115a5dd1908f035c8`.
The final fixture uses canonical remote dungeon origins and explicitly compares
base-floor-visible/hidden pixels before creating room props. All ten controls
differ. Candidate runtime code did not change during observer corrections.

The final177-file native/copied-build inventory, including the fixture, source
reference, observations, reviewed images, reports and parent crosswalk, is
`qualified-native-evidence-inventory.json`, SHA-256
`6247caa3b2faeaa1eda9f4048588a3034b04f450baf1fd2d18491217acc0de4f`.

The change adds 13 client checks and no suite, module or permanent browser case.
Expected client total if selected alone: 802 suites / 12,465 tests; if later
combined with the separate recovery component: 804 / 12,515. Prepared recovery
release 1.79.78 currently remains 804 / 12,502 and excludes this candidate.
Combined-source qualification, publication and exact CI/deployment acceptance
remain required. Room architecture/dressing depth, moving combat, actor fit, whole-game
performance, supported devices, owner review and full F1–F5/beta/1.99 scope stay
open. Human campaign/phone feedback and soak/stress remain deferred, not passed.
