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

## Roof implementation staged; integration still required

The isolated implementation derives19placed roofs from8954actual support
triangles across five current architecture families: fifteen homes, smithy,
market, auction hall and casino exterior. Shared generated server JSON/client
module data keep the slate/canopy/hip surfaces and original placements. The
read-only content gate now checks this seventeenth generated content group.

The server resolves reachable roof heights, ignores forged movement/jump Y,
retains roof support while walking, falls after an edge crossing, restores valid
saved roof positions and clears support on scene recovery. An additive public
protobuf field129 carries the current floor and explicit clearing; no new
persisted character field or wire-version change is introduced. Client pointer
selection, pitched grounding, wall collision and jump interpolation use the
same surfaces. Melee admission/impact and client range guidance include roof
height separation. The focused checks caught and corrected the general public
state copy's missing floor field; the combat test explicitly removes fixture
safe zones and retains a ground-contact positive control.

Review also caught raised-terrain jump takeoff and mesh presentation resetting
the roof height to terrain. The reproduced takeoff failure remains retained;
the corrected prediction, rendered arc and landing checks pass in both flat and
raised terrain.124focused client checks passed before the following item-floor
extension, and101focused client checks cover the extension and related movement.

Durable item drops now prepare a version3 immutable ledger decision only for a
supported roof, carrying its height and surface identity through publication,
partial pickup and restoration. Ground delivery remains version2; original
version1/2 fingerprints are checked against hashes generated with the actual
pre-roof struct. All formats keep the existing ordered checkpoints and exact
item metadata. Unknown retained roofs refuse projection rather than silently
placing an item on another floor. Roof pickup range includes vertical separation;
client loot grounding and pickup selection follow the same floor. Schema27
adds a writer fence without backfilling ledgers or changing existing items.

Three actual-process session cases are prepared for roof walk/jump/drop/pickup
and cold recovery, recall deadline/movement cancellation, and inspected story
evidence saved before acknowledgement and retained across restart. The roof
case can additionally exercise a real previous schema26 executable's preflight
and startup refusal. These cases have not yet executed against Mongo/API;
their opt-in skips are not connected qualification. Native motion, roof picking,
fence/window presentation and the complete current content gate remain open.

The current isolated roof/item source passes168focused Go-race outcomes across
three packages (main6.248s, game13.945s, database1.104s), with six explicit
actual-process/Mongo opt-in skips. The corresponding client leaf passes101checks
in five suites5.371s, seventeen changed JS files lint, and the shared roof
generator's read-only check passes. These are scoped checks. The earlier broad
Go run remains a terminal negative: one now-corrected durability case plus its
parent failed, and the game package reached its existing aggregate ten-minute
deadline while actively constructing world/fence fixtures. No full-suite pass,
deadline increase or unchanged retry is claimed.

These are CPU/race and controlled source checks, not connected visual acceptance.
Actual mouse/touch jumps, rendered feet/slates, edges, network prediction,
reconnect, floor changes, item custody and complete integrated gameplay remain
required before this component is selected for publication.

Integration must verify roof-aware pointer selection, jump trajectories,
grounding, wall collision and presentation; authoritative reachable landing
height and continued support; rejected movement-packet Y; edge falls; and
admission/reconnect and scene cleanup. Check that melee cannot strike through
a roof from the ground. Preserve
ordinary terrain, dungeon floors, casino stairs, jump timing and service access.

Review normal equipped gameplay in motion, entry and return, roof-to-roof jumps,
edges, high/low views and ordinary mouse/touch input. Keep the full roadmap,
art, performance, persistence and beta gates open until their actual evidence
exists.
