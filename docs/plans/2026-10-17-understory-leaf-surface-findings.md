# Rooted leaf surface experiment — October 17

Private source: `4599a8a25d3cce4ae6d49eb59b73ed08f7e136ac`, based on qualified
court/elemental/Player Guide head `40750f368a82e46d1d53cb7f0e9824e72a95e558`.
**Unselected, not merged/pushed/deployed.** Native surface/cost review is pending;
the software diagnostics fail original close-camera triangle budgets.

The existing canopy shader has coherent leaf veins and roughness variation.
Rooted sedge/bracken previously shared its diffuse lighting but had no UVs or
surface detail. The candidate adds a continuous root-to-tip UV field to every
existing ribbon and a separate midrib/shoulder/tip field to each fern pinna.
The existing leaf surface shader composes with rooted wind and stock batching;
it adds no textures, transparency, plants, triangles, blockers or animation.
Canopy shader tokens remain identical apart from whitespace after extracting
the shared surface function. All four High/Low geometry recipes retain exact
position, normal and color bytes and original triangle counts.

43 checks in six focused suites pass; four UV cases also run separately after
the initial runner launch to remove test-file timing uncertainty. Those four
overlap the43, not47distinct checks; twelve unmatched cases in that second
selection are skips. New UV checks cover shared-face/ribbon continuity and
centered collapsed tips. Existing silhouette hashes, population, scale/tint,
wind/reduced motion, spatial batching and canopy lighting checks remain intact.
Scoped/full lint pass. The source audit compares every geometry attribute with
the exact previous factory and both normalized canopy shader programs.

Two software-rendered cases collect paired original/candidate/restored views
with actual flat-profile Earth scenery, all four supplied fourteen-slot classes
and the HUD. Every slot is present without fallback. All8static restoration
images are exact; every comparison retains identical draws, triangles and
geometry/texture counts. Surface differences affect4,962–48,213pixels High and
674–4,923Low across ordinary gate/road/grove and close views.48realRAF motion
frames also retain matching source/candidate/restored submissions and actual
changing Run poses. These are not continuous-cadence/frame-time measurements.
Reviewed High road/grove and close images show a subtle surface finish; they
do not establish final vegetation/world composition or owner art approval.

Both software cases **fail**, despite complete diagnostic capture: the supported
zoom5four-actor close view reaches410,270triangles High against250,000 and
124,224Low against85,000. The original wind material has exactly the same
counts. Ordinary zoom15views and motion fit their original limits. No close
view was dropped, no limit was relaxed and no content was removed. Investigate
the unchanged actor geometry selection/close-camera path; source has42/47pixel
thresholds, but their exact contribution requires a direct owner observation.
This finding is not proof that changing those thresholds preserves appearance.

The software field has13,087High and7,439Low plants. Its two unique geometry
buffers gain12,168High/11,064Low UV bytes; native spatial batches may copy that
attribute into additional owned buffers and need measurement. No zero-VRAM or
unchanged GPU cost claim is made. Original/candidate material ownership retires
once each and the renderer canvas retires in both completed captures.

Closed software/source packet:44files in the owned tree's
`.qa-understory-surface/software-evidence-inventory.json`, SHA256
`a176245c5054bc1a9900b13b14f4f892289f98c56e6ac8cebecb0ea8fdd73380`.
It includes both failed cases, source-matched reference factories, source audit,
CPU/lint logs, private setup/config/spec and all images/results. It excludes
stdout and future native/cost files. Do not mutate or rerun that closed packet.

Next: after release72live QA frees the GPU, inspect this same surface on native
rendering and collect bounded same-scene GPU-cost observations where supported.
Keep the close-camera finding open. A separate private comparison of full versus
already prepared actor indices may investigate it without changing production
thresholds, geometry, visibility or assets; require actual pose/pixel evidence
before any runtime selection. The full modern-world/performance/device/owner/
beta/1.99 goal remains active. Human pacing/physical-phone feedback and
soak/stress remain deferred.
