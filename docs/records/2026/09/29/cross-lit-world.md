# Cross-lit world and fitted shadow receivers

The main light previously followed(360,500,220), nearly aligned with the
fixed(100,100,100) camera. Both visible faces received similar illumination
and many cast shadows fell behind objects. The key now follows(-320,500,260),
with the existing non-shadowing fill moved to the camera side. Regional light
colors/intensities, exposure, fog, bloom, brightness controls and Low's disabled
shadows are unchanged. No extra lights, effects, geometry or textures.

The first comparison improved visible shape/contact but raised shadow work
substantially: the old symmetric square frustum covered a large unseen region
at this angle. ShadowViewCoverage now fits four independent, quantized edges
to the same complete visible receiver volume(-8 through64m) and camera lag.
It retains12m padding, minimum64m dimensions and existing near/far coverage.
Casters anywhere along each incoming light ray share receiver light-plane
coordinates. World-texel snapping follows the maximum fitted dimension.
No receiver-height reduction, shadow-distance cutoff or smaller map is used.

## Evidence and remaining cost

25 focused lighting, shadow-volume and resource tests passed1.869s. Tests
project all viewport corners at multiple zoom/aspect/receiver-height values,
including offscreen elevated casters, into the actual asymmetric shadow camera.
The previous test's hard-coded absolute light-position inequalities described
the old angle; replaced with exact light-to-target offset checks. Initial
procedural-environment generation/idempotence check also passed36.652s; it was
not rerun for the frustum-only follow-up. Scoped lint/whitespace pass.

Initial side-light review: Earth/town High+Low2 cases passed37.3s; Water/Fire,
Air and Verdant interior High+Low6 cases passed1.1m. Inspected town, grove,
foundry, Abyssal approach, Air projectile and Verdant wall. Final fitted-frustum
Earth/town2 cases passed43.9s; inspected the final service court. These are
prepared scene/input samples, not human gameplay acceptance or all interiors.

Final vs initial side-light costs: service court544→442 draws and
163598→131473 triangles; grove385590→273362 triangles. Versus the earlier
camera-aligned baseline, some costs remain higher: service court392→442 draws,
grove225068→273362 triangles; the road turn improves185885→172805 triangles.
Textures are unchanged. Town draw and grove triangle targets remain unmet;
no FPS improvement, final performance acceptance or relaxed target is claimed.
Further batching/caster work is still necessary before final presentation sign-off.

Evidence: /tmp/eidolon-cross-light-0929,
/tmp/eidolon-cross-light-realms-0929 and /tmp/eidolon-cross-light-fitted-0929.
Earlier comparison: /tmp/eidolon-woodland-culling-0929.
No runtime bump, deployment, terrain/profile activation or prior gate waiver.
