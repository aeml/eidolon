# Lanternhold starter road — local environment composition

Continuation after4eaab230 enemy-health feedback. Full ordered roadmap active;
no deployment, version bump, release-gate waiver or final visual acceptance.

## Changes

The real first authored enemies are east of town at125/180,130/215 and125/250.
The old165m circular vegetation exclusion left them in almost bare ground,
despite their being outside the rectangular town fence. Low understory now
starts along the east approach and respects the actual town plus a5m apron,
the road, quest places and10m starter fighting clearings (plus plant radius).
The ground and plants share a composed green verge rather than disconnected
scatter. Existing trees, trunks, collision contracts and safe-zone rules remain.

A stranded household wagon sits at136/191: individual planks, spoked/ironbound
wheels, three bent canopy hoops, half canvas cover, a boarded trunk and tied
bedding. It is scenery, not clickable loot or a new quest/reward. The body and
two shafts have separate client walking solids, also generated into server
spawn exclusions/admin landing geometry. This uses the existing scenery
contract, not a new projectile-cover or enemy-AI routing system. The opt-in
raised-ground sampler grounds the cart/solids together; flat production stays
flat. No global terrain-profile activation or saved-character rewrite.

The first cart placement was visible on desktop but outside the phone view.
Moved it toward the foreground while keeping road/fighting clearance. The
fixture now asserts its projected centre is comfortably in both views.

## Bounded evidence and cost

- Added two actual east-gate/starter views and prepared Skeleton meshes at the
  three authored positions to the existing Earth/town renderer fixture. These
  are not connected enemies, AI simulation or earned encounter clears.
- Initial Low baseline passed; High failed a dynamic module fetch. After its
  terminal result, a High-only retry passed21.5s with no source workaround.
  Baselines: `/tmp/eidolon-first-road-before-0929` (Low) and
  `/tmp/eidolon-first-road-before-high-0929` (High).
- Final13 approach/understory/ground checks passed34.919s; earlier13 checks
  also included world-population generation. These overlap, not26 unique tests.
  Final three approach tests passed12.615s, additionally exercising ordinary
  movement out of a saved position inside the cart in four directions.
- Four focused server spawn/starter/landing regressions passed0.295s.
- Final two Earth/town browser cases passed37.1s, including existing reading
  interactions, dungeon arrivals and prepared attack timeline checks. Both
  starter captures inspected at `/tmp/eidolon-first-road-reviewed-0929`.
- Cart: four owned material batches,3440 High /2800 Low triangles, no extra
  textures/lights/animation. Understory:12024 High /6845 Low plants, up from
  11864/6756, sharing the same two geometries/material and spatial batches.
  Low retains an exact High subset. No FPS improvement or device-capacity claim.
- Generator now contains459 spawn exclusions (+3) and the same eight optional
  readings. Client tree placements are unchanged. Scoped lint/whitespace pass.
  No new browser cases, CI stage, runner queue or soak.

## Next visible weaknesses

The broad old orange rail fence dominates these views and is still visibly
primitive. Improve its material/construction while preserving gate access and
matching collisions. Ground beyond the planted verge remains sparse and actor
art remains fallback quality. Do not treat this cart or another grass adjustment
as completion of the connected modern-ARPG environment/combat target.
