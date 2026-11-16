# Returning Scar: environmental story clues

Follow-up to the connected starter-route review and Keeper cottage pass.
Inspected the existing Earth/town captures before editing: the grove boundary
read as brick-painted eggs, and its three clues used identical circular
plinths with generic poles, green crystals and luminous horizontal bars.

The three Earth clues now express their actual dialogue:

- Severed root: a substantial cut trunk, exposed growth rings, splinters and
  twisting surface roots rather than four upright sticks.
- New growth: a branching sapling with folded leaves, bending toward the
  command stone instead of green crystal placeholders.
- Marked stone: a weathered slab with four curved marks interrupted by the
  straight fifth cut and a broken courier seal beneath it.

The surrounding five boundary stones use irregular beveled slabs with damp
lower faces and natural grain, not a painted brick grid. Lower branching roots
sit closer to the soil; sparse planting connects the stones to the ground.
No extra scenery material batches, lights or textures. Clue construction uses
3/3/4 material batches and 2,336/1,884/992 triangles respectively (base models,
excluding the unchanged personal restoration/beacon groups). Geometry detail
costs more than the primitive clues; no frame-time improvement is claimed.

All clue IDs, world positions, bounds metadata, inspection/progression logic,
beacons, restoration behavior and wall lists are preserved. The boundary's
five historical solids are reproduced exactly. No server, reward, navigation,
terrain profile or save changes. Geometry and materials are site-owned and
disposed with the existing Chronicle lifecycle.

## Verification

45 focused Chronicle, new clue and world-population checks passed in9.277s:
finite attributes, bounded geometry, deterministic generation, disposal,
entity picking ownership, existing path margins/footprints and the unchanged
40-batch scenery ceiling. Scoped lint and diff checks passed. Exported landing
collision parity passed before the final non-solid root/leaf refinements;
the final WorldPopulation tests separately passed exact footprint parity.

Existing Earth/town production-renderer browser cases passed desktop High and
390px Low in44.1s. The prepared hero now stands at an inspection approach,
not inside the marked stone. Rays toward each of the three clues first hit
its own visible entity. Both final normal-camera captures inspected:
`/tmp/eidolon-returning-scar-final-0929`.

These are prepared scene/picking checks, not an earned three-clue quest,
continuous route, physical-phone acceptance or final modern-ARPG art approval.
The broad muddy terrain remains sparse and actor art remains intermediate.
The remaining connected grove-to-dungeon route still needs review. No campaign
soak, runtime bump, deployment, readiness-gate waiver or milestone sign-off.
