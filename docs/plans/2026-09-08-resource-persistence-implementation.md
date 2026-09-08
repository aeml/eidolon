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

## Live race matrix found defects despite green unit tests

On603cd588, full race92756 CLOSED PASS root24.822s/database1.065s/game450.687s.
Actual normal-server handoff and144sessions57781 PASS30.197s; race-built handoff
78650 PASS5.676s with an independently clean server log. These scopes remain
valid, but they were not sufficient to establish race-free live sessions.

The broader race-built144session matrix77433 returned test-process0/176.281s,
but its three server logs show DATA RACE and race-exit summaries: asynchronous
state sends versus hub queue closure (all three phases), plus Join's playerID
assignment versus the broadcast reader (phase1). Treat this as FAILED race
acceptance, not a green result. Logs are
`/tmp/eidolon-compat-session-{3776921393,4283576186,2711711528}/server.log` and
`/tmp/eidolon-resource-matrix-race-sessions.log`. Its disposable Mongo container
was removed and independently confirmed absent.

Follow-up serializes every outbound producer with queue closure, publishes a
write-once player binding under sessionsMu, and guards state-cache resets against
broadcast snapshots. Critical hub messages use the priority lane; state/time
remain lossy and nonblocking. Login/resume recheck transport closure after their
potentially delayed authentication/account-lock work. Focused race70558 passes
1.502s, including concurrent close/send and identity publication tests. An initial
test invocation from the repository root had no go.mod; corrected in server/.

The actual-session harness now FAILS on abnormal/forced server exit or race/panic
log markers, rather than ignoring child status. Re-run the real race matrix on
the correction, then full regressions. Token resume/death recovery, shutdown
drain, delayed-save failures and compatible rollback remain required.

On follow-upa9f5960, full server race67975 PASS root15.786s, other packages cached.
The stricter actual race run22795 CLOSED FAIL213.857s because its handoff test
did not recognize the fresh timestamp; the separate144session matrix PASSED
199.30s with clean normal server shutdown and no race/panic/fatal log findings
in any phase. All four server logs were independently scanned. Evidence dirs
`/tmp/eidolon-compat-session-{1242217804,2876537283,3948687136,2628873907}`;
log `/tmp/eidolon-resource-queue-race-sessions.log`. Disposable Mongo removed and
independently absent. Race binary
`/tmp/eidolon-resource-queue-race-proof-CsK4vU/a9f5960bf3e1176423f90e1256d5bc33fd2adc35`.

Read-only inspection before cleanup confirmed the handoff save existed with
17HP/70mana/alive,1277gold and LastLogout15:17:47.104Z. The local Mongo driver's
DateTime conversion truncates to milliseconds, while the test compared against
a nanosecond clock taken immediately before closing the socket. The corrected
test requires BOTH a strictly newer save than its pre-close Mongo baseline and
a timestamp at or after closure at BSON precision. New tests reject older,
unchanged and missing saves, including unchanged saves in the same millisecond.
This corrects test precision, not runtime persistence or acceptance scope.
Actual handoff revalidation remains due at this entry.

Corrected69d7978: focused timestamp/queue/binding race18465 PASS1.111s. Actual
race-built handoff13939 CLOSED PASS five consecutive runs/23.314s, normal0,
including strict child-exit/log checks and a fresh pre-close Mongo baseline each
time. No gameplay runtime changed from the144session race-tested a9f5960.
Binary `/tmp/eidolon-resource-freshness-proof-6rWCkw/69d7978a4022822467451214c9676dd6532c81c3`;
log `/tmp/eidolon-resource-freshness-sessions.log`. Owned Mongo removed by trap
and independently absent. This closes the observed queue/ID races and the
timestamp-test follow-up at their verified scopes, not the remaining release
acceptance list. No resource release/version was assigned or deployed.

## Token-resume and ordinary recovery acceptance

New opt-in TestResourceActualTokenResumeAndDeathRecovery covers four classes,
each alive17HP/0mana and dead0HP/0mana. Prepared level30/zero Vitality/Wisdom
isolates exact resource state from elapsed regeneration while level bonuses
supply valid maxima. Each case logs in, disconnects with a fresh Mongo save,
resumes using the issued token, verifies rotation and rejection of token replay,
then proves the legitimate resumed connection still works. A second disconnect
must save unchanged HP/mana/death. A subsequent ordinary login must still require
Respawn for dead actors; dead Recall is rejected. Normal Respawn returns145HP/
245mana, while living Recall leaves17HP/0mana. Final saved level/gold/location
remain unchanged. No browser or natural-combat death claim is implied.

Focused26959 PASS1.308s compiles this harness and existing resource tests under
race detection; real execution remains due. Expected error checks require the
specific token/death-recovery rejection, not just any server error.

First actual58400 onb2478ab FAILED20.121s: handoff passed6.29s; all eight token
cases reached the expected replay rejection, then the test decoded the existing
string error payload as an object. Inspection of sendError confirms the string
wire contract. The fixture now decodes that string while retaining the specific
rejection assertions; no runtime or recovery requirement changed. Logs
`/tmp/eidolon-resource-token-sessions.log` and
`/tmp/eidolon-compat-session-{3037911991,3260200571}/server.log`. Actual corrected
execution remains required; owned disposable Mongo removed by the wrapper.

Correctedea5d539 actual95842 CLOSED PASS25.988s: handoff4.79s, all eight token/
recovery cases21.18s. Race-built server, strict log/normal-exit checks, exact saved
resources for alive/dead four-class cases, token rotation/replay rejection and
ordinary Recall/Respawn assertions passed. Evidence
`/tmp/eidolon-resource-token-corrected-sessions.log` and
`/tmp/eidolon-compat-session-{834156718,867286699}/server.log`; independently
scanned clean of race/panic/fatal markers. Both token proof Mongo containers
removed with disposable volumes and independently absent. Binary
`/tmp/eidolon-resource-token-corrected-proof-0vZpDN/ea5d539612d651b93c310968bcdf8473702a4641`.

Merge2e61665 inherits55/8df7dd4 and the exact47 accepted-cast QA correction, only
two QA/evidence files changed. Queued releases retain their own versions and
publication gates. This branch still has no assigned resource-release version.

Browser acceptance now extends the existing disposable death-resource route:
ordinary town Fireball, normal credentialed reload with spent mana preserved,
allowlisted near-death fixture followed by real hostile damage, reload while
dead with the death screen still shown and unchanged0HP/mana, normal Respawn
button, another cast and living Recall/reload without mana refill. Living reload
bounds allow only observed elapsed regeneration plus one fractional-boundary
point; dead resources must remain exact. The HUD must agree with current stats.
No enemy kills/earned progression claims or in-run resource grants are used to
mask reconnect behavior. Lint96349 passed before the final synchronized HUD
assertion; full corrected lint and actual browser remain due at this entry.

On28ebabc, final lint70508 PASS; full Go race71467 PASS root16.156s/other packages
cached. First browser preflight returned1 before any service creation because
this new worktree shared node_modules but lacked generated vendor assets. Ran
the repository's prepare:client (86528 PASS); only ignored vendor files created,
tracked tree unchanged. This was not a gameplay failure or an observation timeout.

Corrected launch11931 CLOSED PASS1/34.3s (test29.6s), QA_SCRIPT_EXIT=0. Actual
town Fireball left70mana, ordinary fresh login4.505s retained100HP/70mana; real
hostile death followed by login3.877s retained0HP/70mana/DEAD and showed the death
screen; normal death-button recovery returned100HP/100mana; another real cast,
living Recall and login5.211s retained100HP/70mana. HUD matched server-derived
stats. No recovery allowance was needed in observed values, though bounded
elapsed regeneration remains allowed for living actors. Credential scan0 and
independent exact-container/image absence confirmed. Log
`/tmp/eidolon-resource-login-death-prepared-gameplay.log`; first preflight log
`/tmp/eidolon-resource-login-death-gameplay.log`. No browser handles remain live.

This is desktop Wizard ordinary login/death/Recall proof with an explicit
near-death fixture followed by real damage, not four-class browser combat,
physical-phone play, PvP or unfinished-instance recovery. Those broader scopes,
shutdown/save-failure behavior and a tested compatible rollback remain open.

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
