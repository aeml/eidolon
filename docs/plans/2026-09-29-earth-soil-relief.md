# Earth soil response — local 1.42 candidate

Review of the existing Earth route captures showed that exposed ground retained
a blurry brown/green wash. Fine normal relief was mostly restricted to forest
litter and mineral patches. Ordinary soil now has two world-scale aggregate
layers, registered color/roughness variation and shallow lighting relief;
meadow coverage retains broad composition with quieter small moss variation.
Existing forest leaves and stone remain separate material contributions.

The first experiment used coarse, high-contrast clods and was visually rejected
despite passing renderer checks: the ground became blotchy. Final detail uses
smaller features and restrained contrast. Desktop first-road, grove and Bastion
views plus the phone first-road capture were inspected in
`/tmp/eidolon-earth-soil-fine-0929`. This improves surface response but does not
resolve the route's larger empty spaces, primitive silhouettes or overall
modern-ARPG art acceptance. Do not mistake this for a completed environment.

No texture allocations, geometry, collisions, navigation, elevations or game
rules changed. The shader adds two samples of the existing detail texture and
some arithmetic. Initial road/grove/Bastion render counts match the previous
woodland captures at both qualities. Examples: High grove217 calls/328724
triangles/47 textures; Low109/148118/34. This is not an FPS acceptance claim;
existing draw/triangle budgets still require a separate performance decision.

Verification:34 terrain/composition/trail unit checks passed158.682s. The broad
terrain suite dominated136.296s; do not repeat every realm's generation checks
for subsequent Earth-only shader tuning. Final two existing High/Low renderer
cases passed44.2s, including ordinary hit/attack references and clear/readable
dungeon arrival. No extra cases or campaign run. Shader regression assertions
also cover the ordinary-soil contribution and new cache identity.

Local only. Runtime1.38, ordered release gates and full goal remain unchanged.
Raised terrain/rocks remain an opt-in QA profile, not activated by this change.
