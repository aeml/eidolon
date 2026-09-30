# Alpha1.49 session-lifetime work

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
