# Alpha1.41 fitted characters — rigid draw integration

Integrated the existing01be9903 rigid-batch implementation into the original
fitted-equipment candidate, without its town changes or later attack-contact,
recoil, gait or ability-animation work. Four production class factories opt in;
source galleries retain unbatched construction. No new batch algorithm, game
timing, authority, selection size, equipment value or save contract.

Only immutable constructor-owned meshes sharing a material/parent/shadow/layer/
body-mask contract can combine. Animated leaves, anchors, transparent/skinned/
morphed meshes and reflection transforms stay separate. Baked static buffers
are shared; per-actor appearance/stealth remains independently owned. Adding
merged nonindexed buffers increases cached geometry memory; fewer draws is not
a zero-memory-cost or universal FPS claim. Authored models remain outside it.

Reused original geometry-equivalence, equipment masking/clear, pooling, cache,
stealth and animated-leaf regression checks. The recoil assertions from the
later integration remain in1.43; this baseline does not contain that system.
45 focused batch/rig/stealth/gallery-lifecycle checks pass4.156s. The first local
command could not run because this old worktree lacked node_modules; connected
the existing patched dependency installation and prepared browser vendors.
Scoped lint and whitespace pass.

Two hardware-Chrome High/Low comparisons pass10.8s. Idle/Run/Attack/Death retain
the same surfaces and triangle counts, with126fewer High draws and63fewer Low
draws across four default class actors. Maximum mean channel-error per pixel
is0.0001745High/0.0002327Low; fraction changing by more than8channel values is
at most0.000003232High/zeroLow. Inspected both captures. These are rendering
equivalence/draw results, not multiplayer performance or final art acceptance.
Artifacts: /tmp/eidolon-1-41-batches-0930.

Registered the reused two-case comparison in test:e2e:animations, the existing
native predeploy browser stage. No broad outfit/raid/campaign rerun; earlier
fitted-gear evidence is retained. Runtime stays1.38 in this unversioned art
preview. After1.39 and1.40 acceptance, integrate the original gear commits plus
this bounded batch change in order. Final actor GLB/art/device review stays open;
no new model request, terrain activation, beta transition or live write.
