# Distinct room-purpose masonry — candidate

Code: `cf95328ebf9c3328846fd889be5ae07863735890`, based on corrected
Alpha 1.79.77 `e0f52f658d929dd2a3caf98b01fa55e1a95ec960`.
Status: CPU qualification only; native visual/copied-build verification pending.
This remains isolated and unselected. It is not part of prepared 1.79.78.

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
claim. Per affected room's baked stone/triangle count is unchanged. Renderer
memory, visible output and original scene limits still need native evidence.

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
Two private native source/candidate/restored comparison cases are prepared for
all eight identities and five themes in High/Low, with actual supplied/equipped
Fighter, real HUD, foreground marker probes, original scene limits and cleanup.
They have not run while current release native/live QA owns the GPU. The two
existing copied published-floor cases also need execution on the new source;
their semantic plan lists are updated without changing any original limits.

The change adds 13 client checks and no suite, module or permanent browser case.
Expected client total if selected alone: 802 suites / 12,465 tests; if later
combined with the separate recovery component: 804 / 12,515. Prepared recovery
release 1.79.78 currently remains 804 / 12,502 and excludes this candidate.
Final visual selection, publication and exact CI/deployment acceptance remain
required. Room architecture/dressing depth, moving combat, actor fit, whole-game
performance, supported devices, owner review and full F1–F5/beta/1.99 scope stay
open. Human campaign/phone feedback and soak/stress remain deferred, not passed.
