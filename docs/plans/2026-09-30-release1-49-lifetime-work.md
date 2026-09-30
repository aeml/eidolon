# Alpha1.49 session-lifetime work

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
