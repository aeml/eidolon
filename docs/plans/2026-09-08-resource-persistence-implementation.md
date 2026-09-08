# Resource persistence implementation candidate — not release-ready

Base6009917 includes queued55 and the inherited46 prepared-fixture fixes. This
work has no new published version and must not be pushed over the release queue.
The root roadmap resource-reconnect contract remains the full acceptance scope.

Implemented initial slice: optional version1 BSON resource snapshot on the same
detached character entity used by persistence; current HP/mana and explicit death
restore AFTER build/maxima hydration. Zero mana is distinct from missing legacy
data. Legacy data retains the previous base-stat login baseline once; subsequent
saves gain a snapshot. Unsupported versions/negative data reject restoration
without overwriting the save. Bonus maximum capacity is preserved; reduced maxima
clamp current bars. Earned pending-level migration can still heal living actors,
never revive a saved death or refill mana.

Disconnected entities no longer regenerate, bank fractions or have their death
state overwritten with IDLE. Disconnect/resume writes use the entity lock.
The first focused checks87396 PASS; first full server race85670 ended FAIL with
ONE test failure in300.843s (root17.364s/database1.039s passed): the old session
fixture had zeroHP but asserted alive/IDLE. The fixture now explicitly starts
alive100HP, retaining the original assertions; new tests cover actual saved death.
Focused corrected race91755 PASS root1.187s/game14.827s, including resource,
snapshot, disconnect/resume and passive-regen cases. Full corrected run remains
required. Inherited280client tests PASS3.663s; initial invocation named a missing
HUD file and failed, corrected invocation uses actual UIManagerHudDiffing suite.

New opt-in144-session Mongo/real-server harness covers four classes, levels1/30/
100, partial/full/zero/dead resources, gear-modified maxima and three process
starts. Default tests skip external services; explicit disposable loopback URI
and absolute built binary required. Actual execution on6cba1eb passed all144
sessions in19.09s, including three fresh server processes. The corrected full
race suite53548 passed root16.082s/game359.606s/database cached. The owned Mongo
container was removed and independently confirmed absent.

## Session handoff implementation — September8 follow-up

Per-account work locks now order commands, login/resume replacement, disconnect
and saves. The global hub schedules cleanup outside its loop; Mongo IO never
holds the global sessions lock. Queued saves capture live state only after
acquiring account ownership, and retired sockets cannot mutate or save a newer
owner's entity. Repeated Join and ordinary login reuse authoritative live state
instead of replacing it from Mongo. Disconnect freezes before snapshot capture.
Transport closure is published atomically; account switching requires a new
socket. Explicit level-command saves use the same complete resource snapshot.
Offline trading refunds update only gold, never replace resource/build fields.

Focused handoff race74977 passed1.440s before the new real-socket test; subsequent
focused non-race7298 passed0.180s including compilation of that test. Initial
gofmt invocation used paths relative to the wrong directory; corrected from the
worktree root, with no behavioral changes. A previous focused race handle77475
was missing when revisited and is not claimed as evidence.

New opt-in TestResourceActualLiveHandoff exercises ordinary Fireball, two repeated
joins, overlapping login, late old-socket cleanup, new-owner input and final
resource save; it also checks atomic gold credit preserves equipment/resources.
Actual execution and final full race validation remain required at this entry.
The shutdown drain still needs an admission/worker lifecycle audit before this
candidate can be release-ready; a WaitGroup alone does not establish safe drain.

## Required work still open — do not publish this slice alone

- Verify the implemented immediate-login, duplicate-session and repeated-Join
  ownership paths with actual concurrent sessions, delayed saves and race checks.
  Preserve live resources without blocking the global hub or reconnect healing.
- Audit all direct repository saves, autosave, resume-window expiry and actual
  resource/death restoration. Verify PvP forfeit/entry/exit and unfinished dungeon
  recovery. Real browser cast/damage/reconnect/death-button acceptance remains.
- Old binaries do not understand this field and replace whole character records;
  rollback could discard snapshots. Define and verify a compatible rollback plan
  before assigning a release version, patch notes and sequential publication.
- Actual saved-session harness passing would establish only its explicit scope,
  not the above concurrent/session/PvP/device acceptance or campaign balance.
