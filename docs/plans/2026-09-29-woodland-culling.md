# Woodland submission cost without removing trees

The previous Bastion-road review still submitted216k–259k High triangles in
views with few visible trees. Earth tree batches covered128m or256m cells,
much larger than a normal camera view. Their incremental sphere unions could
also extend beyond the aggregate geometry box.

Earth's three species now use64m cells and a conservative sphere enclosing
the exact aggregate instance box. Other realms retain their existing batching.
No tree, leaf, material, placement, terrain sample, shadow flag or collider was
removed or moved. All330 Earth trees remain. There is no per-frame rebatching.
Existing shared geometry/material ownership remains unchanged.

This is a tradeoff: total Earth instance batches increase443→605, adding scene
objects and buffer allocations/traversal, while typical views submit fewer
off-screen triangles. It is not automatically an FPS improvement on every GPU.

## Evidence

The existing production generator unit test verifies all original placement
indices exactly once per material batch, exact transforms/material identities,
all330 colliders and conservative bounds. It passed in5.527s. Its obsolete
all-flat-shading assertion initially failed: woodland bark intentionally uses
smooth normals. Kept authored material identity checks rather than reverting
the artwork. Added aggregate-box containment checks for all spatial spheres.
Scoped lint/diff and exported landing-collider parity passed.

Existing populated Earth/town browser cases passed High1280 and Low390 in43.9s.
Compared with the immediately preceding meadow build, same camera/scene:

| View | High triangles before→after | High calls before→after | Low triangles before→after |
| --- | --- | --- | --- |
| Road x340 | 216338→173974 | 180→187 | 115025→93101 |
| Junction x520 | 251177→122215 | 190→175 | 95831→54419 |
| Turn x720 | 258563→185885 | 203→201 | 124022→80074 |
| Grove arch | 332990→225068 | 218→215 | 150402→86914 |

Town well counts are unchanged. Inspected the grove capture. Evidence:
`/tmp/eidolon-woodland-culling-0929`, compared with
`/tmp/eidolon-bastion-road-meadows-0929`.

Expanded the existing foliage culling browser to all three Earth species and
added actual pixel equivalence (previously it only compared cost/screenshots).
Same330 trees, same geometry/materials/transforms, realm-wide baseline versus
production spatial batches, both High/Low. Two synchronous720×500 render-target
captures preserve the same camera, particles and lighting, including shadows;
unrelated time-dependent understory wind is excluded from this comparison.
Fewer than0.1% of pixels may differ by over2/255 in an RGB channel; both passed.
The existing less-than-one-third triangle-cost check also passed. Whole browser
case15.9s, evidence `/tmp/eidolon-woodland-culling-equivalence-0929`.

No full frame-time or physical-phone acceptance. Low grove86914 still exceeds
the existing85000 triangle target, and town draw limits remain unmet. No target
was raised. No campaign soak, runtime bump, deployment, earlier milestone gate
waiver or final environment/performance sign-off. Full roadmap remains active.
