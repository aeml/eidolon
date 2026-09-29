# Lanternhold perimeter — local visual improvement

Replaces the orange rail fence with muted, weathered timber, uneven split
palings, diagonal braces, iron bands and eight caged amber gatepost lanterns.
Uses the existing timber surface shader; no extra textures, point lights or
animation. All four openings and the 184 legacy collision boxes retain their
exact dimensions and iteration order. No saved-character or gameplay changes.

The factory batches by material and 32m spatial cells. An unbatched rendering
reference retains the same construction for triangle/material/shadow checks.
At town size this is 2,824 source parts in 60 batches, 36,096 triangles and
4,257,792 bytes of geometry attributes (not total CPU/GPU scene memory).
This is more geometry than the old rails, not a claimed performance improvement
over the old art. Spatial batching limits the new construction's draw cost.

## Verification

- Final 28 focused fence/canonical-world tests pass (23.619s), including exact
  old collision parity, material/triangle parity, gate clearance and all rendered
  vertices staying inside the old collision envelope.
- Three browser cases pass (42.6s): High desktop and Low phone Earth/town scenes,
  plus new batched/unbatched perimeter pixel and shadow comparison. The latter
  requires fewer than one fifth the reference draw calls and fewer than 0.5%
  materially different pixels; these are comparison bounds, not FPS estimates.
- Desktop starter road, desktop east gate and phone starter road captures
  inspected under `/tmp/eidolon-perimeter-first-0929`.
- Scoped ESLint, whitespace and generated admin-landing collider parity pass.
- Initial tests exposed an obsolete small-layout draw budget tied to the old
  four-box fence and stale town counts predating the cart/street furniture.
  Corrected those expectations; legacy collision assertions remain independent.

## Remaining quality gap

The perimeter now belongs with the town's materials, but the connected scene
still has broad flat ground, sparse ground-cover composition and fallback
actors. This is not final modern-ARPG art or in-motion gameplay acceptance.
Prioritize the route as a whole over further isolated fence detailing. Owner
reaffirmed visual appeal, responsive satisfying combat and competitive player
appeal as the goal; passing tests or adding props alone does not meet it.

Local candidate only. No deployment, version bump, readiness-gate waiver or
closed-beta transition. The full ordered roadmap remains active.
