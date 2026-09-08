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
and absolute built binary required. Actual execution remains due at this entry.

## Required work still open — do not publish this slice alone

- Immediate login, duplicate-session replacement and repeated Join can race the
  existing asynchronous disconnect save. Re-join currently removes live state
  before loading the database; old cleanup can affect a new binding. Preserve
  authoritative live resources and serialize handoff/save ordering WITHOUT
  blocking the global hub on Mongo IO or introducing a reconnect heal.
- Audit all direct repository saves, autosave, resume-window expiry and actual
  resource/death restoration. Verify PvP forfeit/entry/exit and unfinished dungeon
  recovery. Real browser cast/damage/reconnect/death-button acceptance remains.
- Old binaries do not understand this field and replace whole character records;
  rollback could discard snapshots. Define and verify a compatible rollback plan
  before assigning a release version, patch notes and sequential publication.
- Actual saved-session harness passing would establish only its explicit scope,
  not the above concurrent/session/PvP/device acceptance or campaign balance.
