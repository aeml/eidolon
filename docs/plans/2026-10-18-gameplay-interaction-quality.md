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

Four actual-process session cases are prepared for roof walk/jump/drop/pickup
and cold recovery, recall deadline/movement cancellation, and inspected story
evidence saved before acknowledgement and retained across restart. The fourth
starts from a prepared retained partial quest-item pickup, then checks that a
cancelled three-second pickup creates no reservation or grant; a real retry
keeps the original expiry, saves the exact remaining quantity, survives restart
and refuses replay. This fixture does not stand in for an earned enemy kill.
The existing actual quest-reward case also explicitly rejects any interaction
cast during ordinary manual NPC turn-in. The roof
case can additionally exercise a real previous schema26 executable's preflight
and startup refusal. The first actual attempt failed before gameplay because
the launcher supplied the Git source as its build identity while the unchanged
readiness helper requires the executable basename. That failure is retained.
With the launcher identity corrected, five of six actual cases passed in59.055s,
including roof/drop cold recovery, recall cancellation, saved discovery, ordinary
ground recovery and immediate NPC turn-in/reward choice. The remaining partial
quest pickup exposed a real reconnect defect: bag hydration migrates stat scale
while a retained ground remainder keeps its immutable old payload. Stack
compatibility now compares the known migration on copies, retaining original
ledger/fingerprint bytes and rejecting changed affixes, descriptions and unknown
versions. The reproduced three CPU failures and actual negative are retained.
The unchanged six-case actual successor now passes in74.140s with no skips:
twelve real owned server processes, seven fresh synthetic accounts, saved-state
restart/replay and previous25/26 writer refusals of27. Credential scans and
owned Mongo/port/input cleanup pass.110related focused Go-race checks also pass,
with two explicit opt-in skips. These do not claim an earned campaign or native
visual acceptance. Native motion, roof picking and fence/window presentation
remain open.

The current isolated roof/item source passes168focused Go-race outcomes across
three packages (main6.248s, game13.945s, database1.104s), with six explicit
actual-process/Mongo opt-in skips. The corresponding client leaf passes101checks
in five suites5.371s, seventeen changed JS files lint, and the shared roof
generator's read-only check passes. These are scoped checks. The earlier broad
Go run remains a terminal negative: one now-corrected durability case plus its
parent failed, and the game package reached its existing aggregate ten-minute
deadline while actively constructing world/fence fixtures. No full-suite pass,
deadline increase or unchanged retry is claimed.

All17content groups subsequently passed in15.292s with7830tracked input hashes
unchanged. The first external-symlink setup was correctly refused by the existing
copied-geometry safeguard; an owned asset checkout corrected the setup without
altering the validator or regenerating outputs. Final session preparation
compiles with five explicit API opt-in skips (no actual process pass). The client
leaf still passes101checks/five suites4.132s after aligning the scaled melee
strike-center calculation with the server.

Further network review reproduced full-state and delta packets leaving the
local player suspended after an edge fall when horizontal drift was zero.
The client now consumes server fall heights through the final fractional step
and ground contact, follows pitched support at the predicted walking position,
and preserves active jump presentation. A floor transition uses its server
edge position; subsequent fall packets keep ordinary horizontal prediction.
Scene/recall cleanup retires that fall owner. Existing server snapshot times
prevent an older packet restoring a departed roof. Both reproduced failures
remain retained.182related client checks/five suites4.989s pass after correction;
connected/native proof remains required.

Six opt-in actual native routes are now prepared: four equipped class roof
routes through normal mouse/keyboard jumps, pitched walking, edge falls and
recall cancellation; a phone-sized touch Use/cancellation/discovery route; and
a High/Low Earth-boundary view checking actual timber/iron/lantern draws and
retired legacy actor meshes. The Fighter roof route additionally switches
High/Low through Settings and reviews close/overview zoom. Normal outside-world
clicks and real window dragging check character/bag dismissal and remembered
positions. Jump observations retain the original1.5second click-to-confirmed-
rendered-landing requirement. The owned launcher uses one browser with sequential
contexts, no retries and stops at its first failure. These are prepared checks,
not physical-device acceptance. Initial native25 reached an equipped Fighter
on the slate roof, but its fixture incorrectly expected Low actor meshes to
replace owned High meshes without the supported reload. Native27 follows normal
Settings/relogin and restores the saved pitched roof with the actual Low body;
its next failure incorrectly pressed desktopW (camera pan) to move the player.
Both failures and reviewed close High/Low screenshots remain retained; final
arc-clock assertions and the complete routes were not reached. The corrected
fixture uses ordinary ground-click movement for cancellation and retains frame
observations even on failure. Runtime dismissal now distinguishes phone movement
from desktop camera pan.74client checks/four suites2.083s pass after the reproduced
camera-window failure and a corrected mock-camera assertion. Original jump,
deadline, moving-frame, saved-state and authoritative cancellation requirements
remain unchanged; the complete native successor still must pass.

Native32's four preset outside-click targets were all covered by the full
window/HUD, so no dismissal input executed. The fixture now plans one exposed
ground target and its complete clear path before a single click. Landing clocks
use the exact ordinary protobuf jump endpoint, retaining the original.05rendered
arrival tolerance and.2native pointer-intent check. This avoids comparing rounded
native clicks with an unreachable unrounded projected point. Frame observations,
hardware identities and pre-reload data survive failures.

Native34 reached the pitched-roof/Low-reload/eave/jump/recall and both real dragged
Character/Bag outside-click/reopen checks, then failed the unchanged total-latency
gate: the first High jump took1547.9ms. Low return-up1221.7ms and down1480.3ms are
retained; five other cases did not run. The complete native milestone failed.

Maximum client/server flight is now1.2seconds, reserving.3seconds of the owner's
1.5second total for input, replication and rendering; short hops, distance,
height and geometry authority retain their rules. Acceptance of the previous
server's float32-encoded1.3second cap preserves an already shown predicted pose
and animation. The original two reproduced pose/animation failures, their real
float32 counterparts, and initial test-preparation failures are retained.
The corrected source passes125client checks/four suites4.172s,26Go-race outcomes
without skips2.314s, and changed-file lint. The earlier six-case actual API pass
was before this latency change; exact-source API and complete native successors
remain required. No deadline, moving-frame or saved-state requirement changed.

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
