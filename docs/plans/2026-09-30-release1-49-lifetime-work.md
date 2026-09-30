# Alpha1.49 session-lifetime work

## Integration with148 production-default batching — September30

Merged148candidatea3edf4e7 into149 as98203fb9, resolving the single interface
script conflict by retaining all UI-owner, engine/casino-lifetime and actor
appearance cases. This is local preparation, not permission to publish149
before148's own exact CI/public acceptance. Runtime currently1.48;149metadata
and mandatory deployment gates remain separate.

Nine impacted owner/network/instance/render/casino/skill suites114checks pass
5.180s. Add native assertions specifically for newly enabled batching: player
root remains registered through each instance/recovery, real buffers exist at
full-venue views and their warm-repeat counts match; final owned helper releases
all roots/buffers/group and clears the RenderSystem link. Prior resource and
game-interface assertions remain intact. No changed rendering threshold,
economic action, campaign rerun or new soak.

Eight High/Low native cases pass50.8s, artifacts:
`/tmp/eidolon-1-49-batched-lifetime-0930`. All warm geometry/texture values match
the previous declared lifetime receipts. Full casino50instance batches on each
floor and16on town return, unchanged on warm repeats. Entire92-station/232-seat
catalog, four visible guests perfloor,30interface activations perquality and
active50-spin queues retain their original retirement checks. Final helper/
owned context/furniture/panel retire, while application-owned transport stays
open. Reconnect69/28High and64/14Low remains exactly stable for all three
recoveries. Player is chunk-tracked, scene-attached and batching-registered;
borrowed callbacks/retry timers retire. Scoped lint/whitespace pass.

This closes the changed-default integration gap without extending these local
fixtures into proof of authenticated saves, handset FPS, driver/heap byte usage,
casino settlement/fairness or universal leak freedom. Metadata/history, own
mandatory exact-source CI and public source matching remain release gates.

## Full casino catalog and active-interface lifetime — September30

Replace shell-only venue coverage with a bounded native-Chrome check of the
canonical92-station,232-seat catalog: each floor has4 blackjack,4 poker,
2 roulette,4 baccarat and32 slots. Snapshot exported directly from CasinoTables;
an always-on Go parity check compares every JSON value with the current server
catalog. Frontend jobs read the checked-in snapshot rather than compiling Go.
Go parity passes0.015s. Existing opt-in export was initially skipped without
its explicit flag, then rerun with the flag to obtain the real catalog; the
skip is not counted as catalog evidence.

Two final native-Chrome cases pass15.2s at High/Low. Each performs three full
casino→town visits, replacing the complete catalog on ordering changes,
rendering both full-hall overviews, and retiring eight equipped four-class
prepared patrons per visit. Four guests remain visible on the selected floor;
the opposite four stay cut away. All92 stations/232 seats remain represented
with exactly one cached furniture root, including on town return. The cached
venue is intentionally retained but hidden between visits, then detached at
controller retirement; do not claim zero venue residency outside the casino.

Each quality exercises30 interface activations: blackjack, poker, roulette,
baccarat and slots on both floors across three visits. Cards use active round
data and running UI clocks. Slots start a50-spin queue and receive an immutable
prepared outcome, activating reel/landing work; leaving cancels that queue,
pending/animation work and game-owned intervals. No real wagers, accounts,
VIP entitlement changes, saves or economic writes. This proves local scene/UI
ownership, not multiplayer settlement, casino odds, all machine bonuses,
audio correctness, real-player crowd capacity or device-FPS behavior.

An initial fixture exposed two fixture errors rather than production defects:
it counted the page-owned analytics sampler as a leaked game interval, and
mutated a previously delivered slot view so revision comparison could not
observe the new outcome. Scope interval tracking to exact IDs installed after
engine creation, preserving the verified pre-existing application owner; send
a new immutable outcome as real WebSocket JSON does. Keep strict zero-owned-
interval, real animation/queued-spin and resource assertions, not numeric
allowances or disabled animation. Correct the prepared VIP exit height too.

After warm-up, cycles1 and2 exactly match:

| Scene | High geometry/texture | Low geometry/texture |
| --- | --- | --- |
| Public full-hall overview |273/44|272/30|
| VIP full-hall overview |414/44|413/30|
| Town return, cached venue hidden |456/67|445/53|

First visit warms additional resources; no growth on the measured repeated
visits. All game-owned intervals retire after each interface and at teardown;
patrons/models/borrowed seated poses and cutaway references retire on exit.
Final owned context, furniture and panel are released. No browser failures.
Artifacts: `/tmp/eidolon-1-49-full-casino-lifetime-final-0930`. Scoped lint and
whitespace pass. Fixture joins the existing interface CI selection, not a new
job; partition validation discovers234 cases exactly once, no omissions or
duplicates. No unchanged campaign, native FPS benchmark or soak was replayed.

Local bounded client-lifetime evidence now covers named1.49 zone/equipment/
dungeon/casino-floor/death/reconnect/session paths alongside the source owner
audit and reproduced fixes below. This remains representative High/Low Chrome
resource evidence, not a heap/driver-byte census, production authentication,
actual-phone or universal no-leak promise. The code candidate stays runtime1.47,
unpublished behind148's controlled frame gate. Ordered metadata/patch notes,
normal own CI and exact live acceptance are still required before1.49 release.

## Final timer-owner audit follow-up — September30

Source audit of core/UI/audio timers confirms two further real retirement gaps.
Three loot cases fail before changes1.275s: an old pending deadline deletes a
new request sharing its ID after a scene change; confirmation leaves the old
deadline scheduled; and terminal retirement leaves three callbacks alive.

Pending pickup deadlines now belong to their exact request records. Cancel on
confirmation or scene retirement and compare record identity before expiration,
so an old callback cannot erase a replacement. Track confirmed-loot suppression
timers separately as session owners, releasing them at terminal teardown.
Preserve the existing10-second request deadline, retryability, five-second
phantom suppression across zone transitions and inventory-confirmation authority.
No loot rewards, drops, actual inventory or server behavior changes. Five
loot/auto-loot/entity/instance/teardown suites43 checks pass4.384s.

Three skill-window cases fail before changes0.74s: transient combo feedback and
its second timer stage survive retirement; the respec overlay/Escape listener
remains installed; and retired callbacks can reopen them. SkillTreeUI now has an
idempotent session disposer invoked by the existing UIManager child teardown.
Own only transient notification timers/nodes and the exact respec close callback;
retire persistent owned events, preserve shared skill-window markup and the
single cached stylesheet, and never close a replacement owner's menu. Late
notification/respec callbacks cannot publish after retirement. Keep normal
1500ms display plus300ms fade, combo text, menu content and authoritative respec
pricing unchanged. Five affected skill/menu/mobile/respec/combo suites128 checks
pass5.872s. Scoped lint and whitespace pass for both changes.

Other reviewed owner paths retain their existing retirement contracts: startup
yield callbacks check isDestroyed; scenery generations invalidate asynchronous
rebuilds; initial-view RAF work is cancelled by renderer retirement; network
retry and deferred binary decoding reject retired transports; SocialUI stops
GroupFinder refresh, playtest/report/admin/trading timers have owner disposers,
card-table/slots/celebration timers clear on table/controller retirement, and
audio/context/map owners retire with the engine. This is source ownership review,
not new runtime evidence for every feature or a proof that no bug can exist.

The bounded native zone/reconnect evidence above is retained, not replayed for
unchanged scenes. Casino-floor resource evidence so far covers shells, not the
full table/machine catalog and active game UI; that remaining representative
venue path needs a bounded lifetime check before the broad1.49 gate closes.
Runtime remains1.47,149 unpublished behind148. Own synchronized metadata,
normal CI and exact live acceptance are still required; no new soak/deployment,
FPS claim or roadmap completion follows from these timer checks.

## Reconnect transport and borrowed casino-pose retirement — September30

Two pre-fix network cases fail0.513s: replacing a transport retains the old
socket's owned callbacks, and destruction misses its owned handlers when the
current socket was externally replaced. Centralize identity-checked detachment
before switching the captured transport and during disposal. Never erase a
replacement manager's or application-owned callbacks. Borrowed disposal still
leaves the application transport open; explicit disposal still closes once.
No authentication, token policy, retry/backoff or protocol changes. Network,
scene teardown and navigation selection64 checks passes1.3s.

Two native-Chrome cases pass14.8s, three transport interruptions/recoveries
each at High/Low using browser WebSockets, the real NetworkManager, real queued
enter_instance handling, full local GameEngine/model/renderer ownership and
death/respawn. Routed protocol responses rotate fixture tokens and rebuild the
prepared arena; default1000ms reconnect delay is unchanged. Each cycle clears
prior owned socket callbacks, consumes the ordered instance message and retains
the attached, chunk-tracked equipped player. High geometries/textures69/28 and
Low64/14 stay exact across all three recoveries. Final engine destruction
releases the context, retry timer and current owned callbacks while the borrowed
transport remains open until its fixture owner closes it. Six connection-state
events per quality alternate reconnecting/connected; exactly three resumes and
the current token per request. No browser failures. Artifacts:
`/tmp/eidolon-1-49-transport-resources-0930`.

This proves bounded client transport/scene ownership and resource recovery, not
server authentication, saved progress, production resume or phone/FPS behavior.
No real accounts, credential requests, combat or economic actions. Existing
authenticated/rejection/profile evidence remains distinct, not replaced by this
routed fixture. It is not a new campaign or soak test.

The remaining callback audit also reproduces a stale casino pose reference:
after an instance change, rendering the next model owner restores the old
patron's hip height1.9 over its new2.3 pose (one failing check1.507s). Restore
and forget borrowed seat bones/cutaway roots before scene retirement can return
models to their pool, not after another entity acquires them. Reuse the same
idempotent presentation cleanup on casino disposal. New proof checks restoration
before disposal and no later pose corruption; four impacted instance/casino/
navigation/teardown suites31 checks pass4.413s. Scoped lint and whitespace pass.
No wager, chair timeout, visibility rule, reward, stat or casino protocol change.

Runtime stays1.47 and149 remains unpublished behind ordered148 acceptance.
Broader callback/lifetime audit and this version's release metadata, own CI and
exact public acceptance stay open. Do not infer a whole milestone or full
roadmap completion from these targeted checks.

## Normal instance transitions and warmed resources — September30

The actual instance-entry path retained actors owned only by dormant chunks.
The first corrected real-ChunkManager fixture reproduces two failures before
the fix (2.905s): an old actor is not disposed, and its late model completion
binds to the replacement scene. The offline persistent-NPC case already passes.

Reuse scene-owner teardown for normal instance entry, preserving the live
player and the transition's already-advanced scenery generation. Retire all
prior authoritative actors, including dormant/cache-only owners, clear pending
loot and delayed-hit timers, and reject entry into an already-destroyed engine.
Keep historical offline persistent residents. Reset the player's old chunk
membership and activate the actual landing chunk before reinsertion, including
same-coordinate instance changes. An intermediate fixture caught the player
being detached by real ChunkManager.addEntity; fixed landing activation rather
than weakening player attachment assertions. No saved progress, stat, currency,
15-minute expiry or server authority changes.

Final initial five-suite instance/residency/ctrl-click/room-state/teardown
selection38 checks passes5.26s. Two additional delayed-timer/destroyed-entry
checks bring the focused instance suite to5 passing checks2.749s. Scoped lint
and whitespace pass. These new cases do not require a long campaign run.

Two native-Chrome High/Low tests pass19.6s. Each performs three real local
instance cycles: populated generated town, two complete14-slot Rare loadouts,
death/respawn, the canonical checked-in Verdant dungeon layout, an equipped
actor placed only in a dormant chunk, and public/VIP casino shell floors.
All24 recorded checkpoints retain the visible, chunk-tracked player with
invisible/non-color-writing interaction hitbox. Dormant actors are retired on
the next transition. Geometry/texture counts exactly match cycles1 and2:

| Prepared scene | High geometry/texture | Low geometry/texture |
| --- | --- | --- |
| Town after death |168/69|137/55|
| Verdant dungeon |91/55|87/41|
| Public casino shell |115/47|84/33|
| VIP casino shell |122/47|90/33|

First-cycle town/dungeon geometry counts are one lower, consistent with
warming; neither texture nor geometry counts grow on the measured repeat.
Artifacts: `/tmp/eidolon-1-49-transition-resources-0930`.
This is bounded local owner/resource evidence, not authenticated recovery,
server gameplay, a cleared dungeon, populated casino tables, driver-memory
bytes, actual-phone performance or an FPS claim under the active CPU soak.
No accounts or economic actions are used.

Runtime remains1.47,149 unpublished. Connected-recovery resource evidence,
remaining callback audit, ordered148 acceptance and149's own metadata/CI/live
gates stay open. Owner reports the public page is back up; do not infer an
IPv6/nginx change or full roadmap completion from that report.

## Delayed attack callback retirement — September30

Callback audit finds the ground-attack timeout unowned and reading whichever
player/model/instance happens to be current when it runs. Three pre-fix
cases reproduce damage after player replacement, model replacement and an
instance change. The initial destruction fixture lacked CollisionManager.clear;
correct that fixture, not production collision handling or its assertions.

Timers now belong to the engine, delete themselves on completion and are
cancelled immediately on engine destruction. Delayed hits capture player,
model and instance identity and reject retired/dead/inactive or changed owners.
The existing500ms timing, damage formula, animation, targeting/range and
server-versus-local authority remain unchanged. No combat balance or saved
character mutation. This fixes the confirmed callback path, not every callback
or the complete transition/resource gate.

Final ctrl-click/intent/scene-teardown selection36 checks passes2.195s; scoped
lint and whitespace pass. New cases check four owner transitions, immediate
timer retirement and a valid local strike at500ms with unchanged damage.
No long browser, campaign or production account test was needed for this
specific timer path. Remaining full1.49 gates below stay open.

## Current safe predecessor integration — September30

Merged safe148 ca7412a0 through b3edeecf, including cached rigid local matrices
and the independently accepted147 receipt. Rejected shadow, cross-surface and
GPU matrix-texture experiments remain excluded. Runtime is still1.47;
148 High busy budget and149 remaining real transition/resource evidence are
open. No milestone or deployment acceptance follows from this merge.

Impacted body/pool/preview selection135 checks passes5.665s on the actual149
merged tree. Includes all four-class animation surfaces, corrupted-owned-vertex
rejection, cached rest-pose recovery, model-pool cleanup and preview-owned
geometry disposal. Earlier unchanged UI/context browsers are not replayed.

Prepared on the safe1.48 performance branch63168425; runtime still1.47,
unpackaged and unpublished. This is not full lifetime or milestone acceptance.

Four new tests reproduce actual pre-fix gaps (all four fail1.545s): session
destroy leaves live actors in remote/dormant chunk registries, effects/hazards
and pending creation/loot/raycast references; late model completion still binds
the old scene. Destruction is now idempotent. Snapshot and deduplicate owners
from player, remote map, all chunks including dormant/cache-only entries,
effects and hazards; invalidate all before any disposer, clear queues/maps and
scene-generation work, then dispose actors/effects before the renderer.
A broken entity disposer is reported without skipping other owners or the
renderer. Colliders are cleared after entity-specific collider callbacks.
Existing Entity load-generation rejection returns a late model to its proper
pool rather than attaching it; no new global cache invalidation or save change.

Network teardown now retires queue/time/retry/resume callbacks without closing
the application-owned authenticated socket. Capture only handlers installed
by this manager, including reconnect-open callbacks; detach only when their
identity still matches. Destroying an old manager cannot erase a replacement
manager's handlers or an application authentication callback. Explicit normal
dispose still closes its socket once. No resume token, expiry, authentication
or server-side dungeon behavior is changed.

Three initial scene/audio/recovery suites17checks3.112s pass after scene fix.
Final network/scene/audio/recovery selection66checks2.143s passes, including
three new borrowed-socket/retry/explicit-dispose checks. Scoped ESLint and
whitespace pass. These are targeted ownership tests, not sustained browser
heap/texture measurements or proof of all transition paths. Full1.49 still
needs real zone/equipment/dungeon/casino/death/reconnect/session browser
resource trends and remaining listener/callback teardown audit, plus ordered
predecessor publication, synchronized release metadata and own CI/live gates.

## Persistent UI/session ownership

A new real-Chrome fixture reproduces a separate lifetime bug before the fix:
after three prepared UI sessions, one settings click invokes all three owners
instead of only the current one (3.5s failing case). Shared chat handlers also
allow a retired session to consume a new message, and instance-created PvP
windows, wardrobes, wallets and loadouts accumulate. This fixture prepares UI
instances on the real document without accounts; it is not an authenticated
relogin or sustained heap measurement.

Persistent control and window/document listeners now have an explicit UI
owner and matching capture-aware removal. Mechanical conversion covers158
registration sites across17 UI classes; the shared audio-click handler,
keyboard-reset control and phone settings/navigation routes are owned too.
Do not put transient item, quest or social rows into this registry: retaining
every removed row until logout would itself leak memory. Disposal is
idempotent and does not remove another owner's handlers. A disposed owner
cannot install late listeners.

GameEngine now delegates to the UI session disposer rather than disposing
its children a second time. It retires observers, previews, pending trading
reads, PvP refreshes, delayed tooltip binding, combat callouts and both toast
dismissal stages; removes only instance-owned panels; and preserves shared
inventory, journal, chat and settings markup for the next session. Standalone
UI instances dispose owned audio; engine-provided audio remains borrowed.
Phone navigation reuses its existing layout but rebinds to exactly one live
owner. EP intentions/currency, items, builds, account data and server balance
are unchanged.

Targeted12-suite148-check selection passes17.714s. Expanded ownership,
engine-teardown, friends/trading/loadouts and HUD/settings selection passes
9suites153checks10.799s, including audio ownership, timer retirement and
replacement phone routes. Scoped ESLint and whitespace pass. Final Chrome
selection passes5cases30.9s: desktop and phone-shaped three-session ownership
plus portrait/landscape two-thumb interruption and visual-viewport editors.
It verifies one of each owned panel while live, zero after retirement,
preserved shared controls, only current-owner settings/chat behavior, and no
browser failures. An intermediate preservation assertion used a nonexistent
fixture ID; corrected to the real `quest-journal`, retaining that assertion.
Final artifacts: `/tmp/eidolon-1-49-ui-ownership-final-0930`.

The ownership fixture is included in the interface CI selection. No1.49
deployment or milestone completion is claimed. Representative browser
resource trends across world/dungeon/casino/death/reconnect and the remaining
callback/lifetime audit are still required, as are ordered publication and
this version's own release gates.

## Map, context and preview teardown follow-up

The next audit found GameEngine never invoked the existing WorldMap disposer,
and Minimap had no disposal path for its owned wrapper, buff tooltip or phone
status panel. A new engine teardown test fails before the fix1.773s, with both
map disposal calls absent. Engine retirement now disposes both map owners;
WorldMap disposal is idempotent, aborts listeners/observers and clears only its
own container-owner link. Minimap retires its own status panel and removes only
its owned HUD/tooltip, releasing its engine reference. Three scoped map/engine
suites34checks pass2.309s.

A real Chrome three-engine fixture then shows another explicit lifetime gap:
all three removed game canvases still have live WebGL contexts (4.7s failing
case), although fixed maps/listeners/panels are retired correctly. Each engine
creates its own renderer and does not reuse it after destruction. RenderSystem
now releases its own context after owned resource/renderer cleanup, using the
supported context-loss API when available; does not force loss on a borrowed
renderer or a global cache. A unit check preserves idempotence and disposal
order. This is terminal cleanup, not a mid-session graphics fallback.

Preview audit also reproduces undisposed per-loadout rigid geometry on class
replacement (1.224s failing test). CharacterPreview already releases its owned
context; it now clears owned procedural equipment before replacement and
retirement, preserving shared body/equipment geometry, materials and caches.
The new full14-slot test checks both replacement and final cleanup and keeps
shared-source non-disposal assertions.

Final map/engine/renderer/preview selection6suites57checks passes4.602s.
Final real-Chrome4-case selection passes17.3s: three full engine constructor/
equipped-render/destructor sessions each at High/Low, plus the desktop/phone
UI-owner regressions. All six engine sessions retain exactly one minimap while
live, zero HUD/tooltip nodes after retirement, cleared map ownership, aborted
map listeners, inactive player, detached canvas, released WebGL context and
an open borrowed application socket. Pre-retirement geometry/texture counts
stay56/27 at High and55/13 at Low across the three sessions. This measures
prepared local owners, not full world residency, a driver-memory byte census,
authenticated reconnect or actual-phone performance. No accounts or network
actions are used. Scoped lint/whitespace pass. Artifacts:
`/tmp/eidolon-1-49-engine-ui-final-0930`. The bounded engine fixture joins the
existing interface CI stage, not an extra deployment job.

Remaining1.49 evidence is unchanged: actual repeated populated-zone,
dungeon/casino-floor, gear/death and connected-recovery resource trends and
remaining callback audit, followed by synchronized metadata and own CI/live
gates. It is not complete or deployed from these teardown checks.
