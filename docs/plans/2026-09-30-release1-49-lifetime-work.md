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
