# Bastion bonded foundation qualification

The Bastion footing now has staggered stone blocks and recessed physical mortar
inside its original envelope. It reuses the existing fieldstone cap material,
with no new material, texture or draw batch. The shared Abyssal shelf remains
byte-exact; other entrances and all non-foundation source parts are preserved.

Source `22beedd81a781deaeac3b9518e596e8d25df5a71`, reference `434d1011bb5118dd09d30596bc3ae8b34cef71d1`.
71 focused checks across six suites and full lint pass. A separate source census
verifies unchanged geometry/material/transform/flags and the default shelf hash.
The new footing adds7,188triangles,14,376with High shadows; the entrance still
uses nine optimized draws. Its bounding envelope and gameplay metadata stay fixed.

Four native High/Low reference/candidate world cases each record180moving
prepared samples at zoom15/30 with an imported fourteen-slot Fighter, HUD and
full scenery. High peaks110draws/121,332triangles and Low63/57,172, within original
submission limits. Every paired view retains identical calls and the exact
triangle delta. Four native Wizard cutaway cases also pass their original rules.
All18owned entrance resources retire, with renderer/context/canvas/actor cleanup.
Workers1/retries0; actual Chrome153.0.8010.36 uses AMD RADV Vulkan.

West-approach High, Low390viewport and grave-road High images were inspected.
The physical block joints read at gameplay zoom and retain the fortress palette.
Bounded component RAF medians remain16.7ms/p95 up to16.8ms; these prepared scene
observations do not establish whole-game FPS or a causal speed improvement.
Original route/cold/device failures and broader world/final owner art remain open.
Normal server-movement integration is still required for the upcoming milestone.

Two initial CPU fixture findings are retained: the owned cache grows39to40 for
the new site-specific geometry, and the first source census incorrectly compared
raw-part names with optimized material-batch names. Corrected checks preserve
submission limits and shared assets. No deadline or original budget was relaxed.

Private evidence root:`/home/aeml/.local/share/eidolon-bastion-bonded-foundation-20261016/.qa-bastion-foundation`.
Frozen106-entry inventory:`evidence-inventory.json`, SHA-256`83957726b697d142c03ac64e2aeee30916262e4244a1679a12df0c91ec85da54`.
[Full receipt](2026-10-16-bastion-bonded-foundation-qualification.json).
Qualified for ordinary master selection and the next coherent world milestone;
not yet deployed. No new soak/stress, production account/value/access change,
beta or full-game completion claim.
