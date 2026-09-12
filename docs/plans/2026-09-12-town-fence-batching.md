# Town fence rendering overhead

The recovered-boot Wizard profile retained up to 2,677 draw calls in town.
This does not identify the fence as the sole cause of slow frames. Source
inspection independently found the 200×200 town perimeter created 184 segments,
each with one post and three rails: 736 meshes and 736 identical materials.

The candidate merges their unchanged indexed box geometry into local 32-unit
spatial buckets: 26 meshes, one material, all 184 colliders preserved. Small
buckets retain spatial culling; local vertices avoid precision loss at distant
world coordinates. Geometry preparation is one-time, not performed per frame.
Intermediate cloned geometries and original box templates are disposed after
merging. Existing material shadow settings, gate gaps and collision placement
remain unchanged. It neither removes decorative detail nor lowers quality.

Tests compare every indexed triangle's world-space position, normal, UV and
winding against the original segment renderer, together with every collider.
Coverage includes canonical town, non-square/offset fences and coordinates
around 20,000. All four new checks failed before batching; afterward two
suites/25 tests passed in 6.729 seconds. Expanded collision, scenery and
environment coverage: five suites/46 tests passed in 13.067 seconds. Browser
baseline enrollment: three suites/21 tests passed in 2.211 seconds. Lint,
client preparation and diff checks passed.

Logs: `/tmp/eidolon-town-fence-{red,green,expanded,lint,assets,enrollment}-20260912.log`.
The enrolled anonymous `town-fence-render.spec.js` renders both the old segment
construction and current batch with the same camera, illumination, shadows and
ground. It retains original/batched images and metrics, requires a fivefold
draw-call reduction, and compares pixels with a small rasterization tolerance.
Its hosted/native results remain pending; authored assertions are not proof
of rendered parity or improved live frame pacing. The prior real Wizard
moving-cast profile must also be repeated after the occupied native party lane
finishes. No release/version change is claimed here.
