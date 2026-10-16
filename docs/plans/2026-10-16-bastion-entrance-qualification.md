# Bastion entrance scoped qualification

The hall now has a real recessed pointed doorway, weathered wall edges and a
merged staggered flagstone ramp. Geometry stays within the former wall/ramp
envelopes and uses existing materials, portal, collision and entry boundary.
Root material uses existing averaged normals. One cached geometry is added;
the existing nine-draw entrance cap and30materials remain unchanged.

35CPUchecks/three suites pass. Four native world/reference cases inspect120
moving samples each at gameplay zoom15/30 with full scenery, Earth lighting,
HUD and14-slot imported Fighter. Four native cutaway cases pass at workers1/
retries0, retaining25%initial occlusion/80%recovery/zero outside-pixel changes.
The former sample is partly exposed by the weathered wall; old-source native
comparison proves that change. The first replacement failed phone coverage;
the final reachable sample behind intact masonry restores all31/33/50/44pixels.
Failures and exact old-source proof remain in the [receipt](2026-10-16-bastion-entrance-qualification.json).

Prepared High tops out at78draws/65298triangles; Low42/29061, with unchanged
draw counts. These are scene counts, not whole-game frame acceptance. Initial
separate paving material exceeded the existing draw cap and was removed.
An initial private teardown expectation incorrectly required dead-renderer
statistics to reach zero. Final checks observe all18entrance resource dispose
events, detached canvas, actor release and context loss; original nonzero
counter failures remain retained. No production cleanup code changed.

High/Low ordinary-zoom images show improved doorway depth and paving joints.
Large plinth/root silhouettes and broader world art remain unfinished. This
prepared scene is not server movement/campaign/physical-device/FPS evidence.
The full goal and all original frame/triangle/operations/owner/readiness gates
remain open. Ready for ordinary master merge; deployment qualification pending.
