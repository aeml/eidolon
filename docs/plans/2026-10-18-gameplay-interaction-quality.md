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

A seventh actual-process case is prepared for schema27 snapshot recovery. It
creates an ordinary saved roof drop, stops its writer, takes a real Mongo gzip
archive and copies the stopped private journal, restores into a distinct fresh
disposable Mongo, then logs in and picks up the exact restored item through the
ordinary protocol. It checks full saved-character/ledger equality before login,
roof floors in the first scene, exact item metadata, wallet/checkpoint custody,
original expiry and the untouched source database. Ownership checks require the
launcher's paired loopback containers, each capped at1CPU/512MiB. The launcher
owns cleanup even if the test process is interrupted. Private account archives
stay outside the workspace/upload roots. This case compiles with one explicit
opt-in skip; it has not run, and does not qualify production backup destination,
retention, RPO/RTO or operator handoff. API41 and native42 supersede the unexecuted
API39/native40 controls and require seven actual API passes before native input
qualification. Active self-hosted CI still owns the shared GPU host.

Snapshot checks also retain base progression and equipped metadata after the
restored ordinary pickup. Final preparation compiles with an explicit opt-in
skip. The native quality-reload fixture now seeds preferences only on first
entry, requires Settings to store Low, and reloads without injecting another
Low setting. Earlier High/Low roof views verify those bodies/floors, but do not
independently qualify saved quality preferences. The successor must prove that
through the ordinary UI as well as complete the original movement/timing gates.

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

## Cached-client admission and current recovery qualification

The deployed1.79.80 client still teleports optimistically on recall. An actual
pre-guard socket test reproduced its admission into the new cast/roof world
(session50: one failed case, one disposable server/account, complete cleanup).
Current join/resume requests now declare `stationary-actions-roofs-v1`; the
server refuses absent/unknown capabilities before world entry or resume-token
lookup/consumption. It uses the previous client's existing world-access response
with a readable reload instruction. Authentication/account help remain available;
this creates no moderation record. Login and resume acknowledgements advertise
the capability so a newly loaded page also refuses an older rolling-deploy
server. Compatible patch releases keep reconnects. The new page offers a deliberate
Reload game button and retires it during ordinary recovery. Current fixtures
explicitly declare support; the genuine legacy packets remain unchanged.

82client checks/three suites pass, including missing/unknown login and resume
capabilities, token/state rejection, initial join declaration, normal reconnect,
moderation recovery, and reload-button lifecycle. Focused Go-race session,
identity, password-rotation and token checks pass; lint passes. The actual
corrected cached-client/reused-token route still requires execution.

API41 passed the six original gameplay cases with the1.2second flight cap. Its
new snapshot case failed before dump/restore because the fixture asked for100
projection rows from a50-row API; this was a fixture error, not waived production
validation. The fixture now asks for50. The failed attempt retained13owned server
logs/eight disposable accounts, and removed both capped Mongo containers with
protected inputs unchanged. No private archive was reached. API41/native42 are
superseded; the next attempt must pass all eight actual cases, including snapshot
recovery and cached-client refusal, before the six native gameplay routes run.
Alpha1.79.80 CI is now terminal success and the public frontend/backend agree;
its owner recorded the experimental Fighter acceptance separately.

This component remains isolated and unpublished. No full native, physical-phone,
production backup, campaign or beta acceptance is implied. Soak/stress is deferred.

The first guarded eight-case run passed the original six cases and failed the
two new fixtures. The denial writer intentionally closes a transport after its
readable message; the cached-client fixture now opens a compatible connection
and reuses the same retained token. That actual route passes in7.04seconds.
Two anonymous system-Chrome reload flows pass at1280/390px in4.5seconds, with
a real requested navigation, no premature world entry and normal login after
the server capability matches. This is viewport coverage, not physical-phone
qualification. The snapshot diagnostic run reached archive/restore, retained
all progression/gear/wallet/floor/expiry/receipt checks, and isolated the wrong
expected generation: a fresh drop is0 and its first pickup is1. The fixture
now requires the exact next generation and one account-checkpoint advancement.
Its corrected actual route still needs to run. Negative runs and cleanup remain
retained; no production custody validation or transport policy was weakened.

The corrected API63 run passes all eight actual cases without skips in88.210s
onc01c7781472fd59cb45d6f108d4cf366c6a2c101. It uses15owned server processes and
nine disposable accounts, restores a real14424-byte gzip archive and two private
journal files, preserves exact item/progression/equipment/wallet/floor/expiry
custody, and advances the restored pickup generation/checkpoint exactly once.
Both Mongo containers were removed and all protected inputs remained unchanged.
The25-file receipt inventory hashes to7860dea76edd2e896cd58318f212a383459af217cc02b6902d71ed3b4bff3a0e.
Private archive bytes remain outside workspace/upload roots; this is not owner
approval of production backup destination, retention, RPO/RTO or handoff.

Native64 passes all four class roof/walk/eave/jump/recall cases, including the
original1500ms landing gate and the Fighter's real Low preference/relogin and
dragged-window flows. High/Low close roof captures were reviewed. Its phone case
stopped before interaction because the fixture incorrectly required an explicit
zero investigation mask: the ordinary JSON omits that zero field. The fixture
now accepts the omitted zero representation and additionally requires Count0
before/after cancellation. The Earth case did not run. The complete route remains
failed until its corrected successor passes. Driver64 terminated with143 after
the Go/browser failure; its owned Mongo cleanup was recovered after exact
container identity verification, with source inputs unchanged and ports free.
No cause for the driver's termination is established.
