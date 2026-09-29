# Rooted woodland wind — local 1.42 environment follow-up

Earth's existing instanced bracken and sedge beds were completely static.
They now follow a restrained common breeze with spatial phase variation,
slow gusts and smaller flutter. Random plant rotations are accounted for so
neighboring plants share a world-space breeze rather than swaying in unrelated
directions. Height-squared bending leaves roots planted; analytic shear normals
retain coherent lighting. Trees and location-specific planting are unchanged.

One shared opaque material uses render-time uniforms; there are no new plants,
textures, lights, draw batches or per-plant CPU updates. This does add vertex
shader arithmetic and a shader variant, not a claim of zero GPU cost. The
existing non-shadow-casting policy is unchanged. CPU culling bounds now include
the full shader displacement, and all moving vertices remain inside the
existing 2.2m placement clearance. Flat and elevated-ground anchoring remain.
OS reduced-motion changes take effect on the next render, without listeners
or timers requiring cleanup. No gameplay, collision or terrain-profile change.

Six focused tests pass across wind material and understory suites. Coverage
includes shared uniforms, live preference changes, finite time fallback,
normal deformation, rooted vertices, analytic worst-case clearance, expanded
culling bounds, deterministic placements/Low subset and sampled elevations.
Scoped lint and whitespace checks pass.

The existing populated Earth/town desktop and phone browser cases passed in
40.1 seconds. Actual production shader renders at times 0 and 1.25 seconds
differed at 1,117 desktop and 1,280 phone pixels (RGB difference greater than3).
Reduced motion yielded zero differing pixels in both views. Within each view,
animated and still modes retained identical calls/triangles:283/331451 High,
144/149405 Low. These are scene counts, not a frame-time acceptance result;
the previously unmet triangle budgets are not waived. No new browser job,
campaign soak or claim of physical-phone acceptance.

Inspected both grove captures at `/tmp/eidolon-woodland-wind-0929`. The effect is
subtle ambient movement, not a remedy for primitive silhouettes, sparse areas
or the remaining lighting/composition work. Connected player-controlled route
review and modern-ARPG visual acceptance remain open. This is a local candidate
with patch notes, not a deployment or an earlier release-gate waiver.
