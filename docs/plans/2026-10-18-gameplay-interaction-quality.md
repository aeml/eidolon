# Recall, quest objects, windows, melee, roofs and Earth perimeter

Owner requirements added October18. These are required before beta. The owner
explicitly limited quest casting to **quest objects only**; NPC acceptance and
turn-in keep their existing immediate, manually confirmed persistence flow.

## Prepared implementation

- B/menu recall starts a server-owned three-second stationary cast. A visible
  progress bar explains movement cancellation. The client does not teleport on
  request or local timer expiry. Only the matching authoritative completion
  performs the existing town handoff and movement-context reset.
- Chronicle inspection and dropped Chronicle collection items use that same
  three-second deadline. Movement, jumping, scene changes, death, disconnect,
  charging and stuns invalidate the action. Accepted attacks/abilities
  cancel it. Identical idle/rotation packets preserve it. Completion consumes
  one action token under the same locks as its effect. A cancelled action grants
  no discovery and reserves no item. Existing journal/save and durable ground
  transfer barriers still precede confirmed quest/bag feedback.
- World mouse/touch actions close registered windows and transient item details
  before movement/interaction. Manual movement closes windows too. Existing
  remembered positions survive dismissal. Native dialog backdrop clicks close
  the dialog through its owner; inside controls remain usable. Listener and
  progress-timer ownership retire with the UI session.
- Fighter/Cleric basic melee reach follows the two authoritative body radii plus
  half a world unit: three units for ordinary bodies. Both attack admission and
  delayed impact enforce contact. Client pursuit and offline melee share that
  reach. Wizard/Rogue ranged basics and authored ability ranges remain intact.
- The Earth boundary uses Lanternhold's weathered timber, cross rails, iron
  bindings and gate lanterns, batched by existing spatial cells. Posts match the
  authoritative Earth grid and strict gate endpoints. Network fence identities
  remain; loaded or pending legacy rectangles retire when the environment owns
  their presentation. Initial entry and return from instances construct it.

This is isolated implementation, **not a published or fully accepted milestone**.
Focused CPU/race evidence exists in the owned worktree. The initial changed
movement expectation, two threshold-fixture failures and persistence-barrier
fixture failure remain retained with their corrections. No stress/soak or
physical-device pass is implied. Actual connected API/Mongo cast/reward custody,
native movement/visual review and deployment remain required.

## Roof work still required

Town roofs are not implemented yet. Complete landing, walking and jumping down
for the actual permanent town buildings, including the residential wards,
smithy, market, auction hall and casino exterior. Derive shared landing surfaces
from the current authored architecture and placements, including pitched roofs;
a bounding-box top would leave characters floating above slates.

The client needs roof-aware pointer selection, jump trajectories, grounding,
wall collision and presentation. The server must own reachable landing height
and continued support, reject arbitrary movement-packet Y, and resolve leaving
a roof without snapping or trapping the player. Admission/reconnect and scene
cleanup must preserve valid floors. Melee needs roof/ground height separation so
neither player nor enemy can strike through a roof from the ground. Preserve
ordinary terrain, dungeon floors, casino stairs, jump timing and service access.

Review normal equipped gameplay in motion, entry and return, roof-to-roof jumps,
edges, high/low views and ordinary mouse/touch input. Keep the full roadmap,
art, performance, persistence and beta gates open until their actual evidence
exists.
