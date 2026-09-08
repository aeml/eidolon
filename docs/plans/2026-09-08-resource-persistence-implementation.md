# Resource persistence implementation candidate — not release-ready

## Bounded refund lifecycle — September 8, 17:39 UTC

Runtime8b68f5610a9b382efd6be82c130523213e66ac2c adds one coalesced automatic
worker,10s automatic outage backoff, nonblocking overlapping retry admission,
32-item pass limit and a2s soft budget checked between bounded IO calls. One
failed delivery/ack stops the pass instead of multiplying database timeouts by
the backlog. A sorted round-robin cursor advances even on failure so a bad
recipient cannot permanently starve later accounts. Remaining work stays in
the durable outbox; periodic10s scheduling is separate from autosave. Explicit
RetryPendingRefunds attempts one bounded pass; automatic scheduling honors backoff.

Shutdown seals refund admission before joining commands/loops; an already
in-flight delivery completes, while the rest remain unpaid for recovery.
World.StopBackground also seals admission before draining the worker group.
Auction load errors are retained as readiness errors and main refuses startup
before HTTP admission instead of exposing an empty market. This bounds admitted
work, NOT arbitrary filesystem/OS stalls inside a single delivery.

Focused35917 PASS root2.378/game1.834; expanded17477 PASS2.332/2.151; final10726
PASS2.018/1.731, all race-enabled. Logs
`/tmp/eidolon-refund-lifecycle-{focused,expanded,final-focused}.log`. Includes
1000-intent first-error/fairness/backoff,100-intent finite healthy passes,
100 concurrent scheduling calls while one delivery is blocked, shutdown waiting
for only that in-flight credit, and unreadable-load readiness rejection. The
existing acknowledgement-failure actual test now waits for the committed gold/
receipt before stopping; shutdown no longer guarantees merely queued work starts.
That preserves the intended fault boundary and does not weaken payment assertions.

Actual53929 CLOSED PASS normal0/96.202s on8b68f56, TWO complete repetitions of
the previous offline/failed-save/failed-ack tests plus two new lifecycle cases.
100 prepared one-gold intents with a test-only Mongo failCommand blocking updates
500ms then rejecting them produce exactly ONE failed update before readiness
(under5s); normal SIGINT preserves100 intents and a1235gold/one-receipt pending
character journal over1234gold Mongo. With the failpoint disabled, four bounded
fresh-server passes clear every intent; ordinary login verifies1334gold,100
receipts and unchanged17HP/100mana. Backlog cases12.18s and17.07s. This is delayed
rejected Mongo IO, not a physical power loss or an interrupted full auction.

Unreadable-auction cases3.36s/3.29s insert an explicitly malformed refund-array
fixture into disposable Mongo. Server exits1 with the expected auction-load guard,
not a race/panic; removing ONLY that fixture allows ordinary startup and the
independent valid43gold refund to recover once. Two expected startup-rejection
logs `/tmp/eidolon-expected-startup-failure-{112593399,2412962488}/server.log`.
All32 normal server processes have strict normal exits and independent clean
race/panic/fatal/credential scans with shutdown completion; both intentional
startup failures independently show the expected rejection and clean scans.
Binary `/tmp/eidolon-refund-lifecycle-proof-fvmjUz/8b68f5610a9b382efd6be82c130523213e66ac2c`;
log `/tmp/eidolon-refund-lifecycle-sessions.log`. Exact owned Mongo
`eidolon-refund-lifecycle-proof-20260908-1736` and anonymous volumes removed by
EXIT trap, independently absent. Failpoints were enabled only on this loopback
disposable container. No production player data touched.

Full race **4474 freshly ACTIVE** on frozen8b68f56, log
`/tmp/eidolon-refund-lifecycle-full-race.log`: root14.226s passed; database cached;
game package still running. No whole-suite pass claimed. Re-poll exact handle;
do not restart on observation timeout or edit runtime before terminal. No other
owned local test/browser/Mongo handle remains.48 CI34257070035 remains active:
client/server and browser2/3 pass; browser1/3 and3/3 running at last check.

Next after that exact suite: [durable auction operation recovery](2026-09-08-auction-operation-recovery.md),
starting with pending bid decision → receipted debit → atomic auction/refund
transition and real interruption tests. Buyer items/seller payouts and ambiguous
auction writes are still not atomic; rollout/rollback compatibility and broader
instance/device/campaign acceptance remain open. No56 metadata or release approval.

## Refund implementation and latest acceptance — September 8, 17:26 UTC

Implemented d1e2839661e6b51ed44c6cbb093dbe35cb7c24dd, snapshot race correction
09b56932b5482b50a8d45da83eec3e6358203b7c. Still inherits55 metadata, no56
assignment or permission to publish over the ordered queue.

Auction records now retain PendingRefunds in the same Mongo document update
that displaces the preceding bid. Ordinary outbids, buyouts and cancellations
create a unique refund ID/recipient/amount; final collection cannot delete an
auction carrying unpaid intents. Refund workers serialize outside trading/world
locks, retain failures, and acknowledge/remove an intent only after the character
gold and matching receipt commit. Startup and periodic saves retry the outbox.
UpdateAuction now rejects a missing target instead of claiming successful IO.

GoldCreditReceipts is private persistence state on both Character and Entity,
detached in GetEntityCopy, saved with gold/resources and restored at login.
Same-ID same-amount delivery is a no-op; conflicting amounts, invalid amounts
and integer overflow reject. Receipts are retained, not prematurely pruned.
Delivery holds the per-account work lock, flushes/replays the newest pending
snapshot before credit, and journals the complete credited snapshot. The live
world lookup, mutation and UnjournaledSave pin occur atomically against expiry.
Offline delivery loads only after pending replay and uses the same full journal,
not a gold-only increment beneath an older pending full save. Failed local IO
retains the credited live entity; failed Mongo retains its journal and auction
intent. This fixes the identified one-shot refund and disconnected expiry gap.

Focused98138 PASS root2.869/database1.058/game15.724; expanded89762 PASS3.357/
1.047/15.514; final57054 PASS3.508/1.051/15.344. Logs under
`/tmp/eidolon-refund-{focused,expanded-focused,final-focused}.log`. Initial
compile59146 found a name collision with the existing guild credit method;
the new method is ApplyDurablePlayerGoldCredit. A later compile found fmt was
not imported; corrected to the existing errors.New. Neither failed invocation
is counted as validation. Tests cover outbox persistence round-trip, failed
delivery retention, idempotence, final-claim/buyout/cancel retention, receipt
snapshot detachment, expiry pin/unpin, and a real filesystem rename after the
pre-credit save: Mongo retains100, RAM143 is pinned, restored IO commits143
once with zero mana intact.

Actual29305 CLOSED FAIL normal1/72.457s on d1e2839. All gold/receipt/resource
assertions passed across both repetitions of the three scenarios, but phase74
in evidence `/tmp/eidolon-compat-session-1663948313/server.log` reported three
races: Fireball mana/state and LastAbilityTime writes under World.Mu versus
GetEntityCopy reads after it prematurely released World.Mu. The other17 child
logs were clean; all included shutdown completion. Log
`/tmp/eidolon-resource-refund-sessions.log`, binary
`/tmp/eidolon-resource-refund-proof-XupKah/d1e2839661e6b51ed44c6cbb093dbe35cb7c24dd`.
Owned disposable Mongo/volumes removed and independently absent. Not a full pass.

Correction09b5693 retains World.RLock then Entity.RLock throughout the detached
copy, synchronizing both world-only ability writes and entity-locked tick/work
writes. No IO/callback is performed under the extended snapshot lock. New
regression runs200 real Fireball dispatches against concurrent copying, with
explicit prepared cooldown/resources. Focused26034 PASS root3.628/database1.122/
game16.079; log `/tmp/eidolon-refund-snapshot-focused.log`.

Corrected actual18314 CLOSED PASS normal0/118.569s, three repetitions on09b5693.
Offline prepared900gold/dead0HP0mana pending snapshot replays before43 refund,
yielding943 across three fresh-process credential logins. Ordinary real outbid
tests start from prepared1191gold previous escrow, cast Fireball100→70mana, bid
50 using a second ordinary session, and inject actual Mongo validator rejection:
either users cannot save, or the auction cannot acknowledge an emptied outbox
after a successful credit. The server stops with the fault still active; fresh
startup recovers1234gold/17HP/70mana/one43receipt, preserves exact gear and new
bidder1184gold, clears the intent, and a second fresh-process login pays nothing
extra. These are rejected Mongo writes and controlled SIGINT, NOT a network
outage, forced kill, fully earned escrow or atomic whole-auction proof.
Binary `/tmp/eidolon-resource-refund-corrected-proof-smCf6M/09b56932b5482b50a8d45da83eec3e6358203b7c`;
log `/tmp/eidolon-resource-refund-repeat-sessions.log`. All27 strict normal-exit
child logs independently clean of race/panic/fatal/credential markers, all with
shutdown completion. Exact owned Mongo
`eidolon-resource-refund-repeat-20260908-1720` and anonymous volumes removed by
EXIT trap and independently absent. No production player data touched.

Full Go race **83776 CLOSED PASS normal0**, log
`/tmp/eidolon-resource-refund-full-race.log`, frozen09b5693: root22.691s/
database1.156s/game365.813s, other packages cached/no tests. No owned local test,
browser or actual-Mongo process remains.47 CI34248491147 completed SUCCESS with
final live QA at17:23:30. Fresh exact public identity passed afterward; clean
queued48 was normally fast-forward pushed as7a9869d639659cd6f6173dca16c12ba2487e3221.
48 CI34257070035 (Client/Server Tests running) is the verified external wait;
49 cannot publish before the full48 live gate. Resource candidate stays separate
and unreleased. Full recovery regression does not close the remaining boundaries.

### Required remaining persistence work, not closed by this slice

- Whole-auction atomicity: bidder debit, buyer item and seller payout still cross
  auction and character documents. In particular an ambiguous UpdateAuction
  acknowledgement can leave a committed new bid while the old code rolls RAM
  back; a later auction write could overwrite that state/intent. Need durable
  operation/escrow ordering and recovery, not a claim that refund receipts solve
  every transaction or forced-kill window. Test interruption at each boundary.
- Bound/coalesce retry work under large outboxes and database outages. Current
  workers serialize but can spend repeated5s timeouts across many recipients;
  check shutdown grace and startup availability. Failed auction loading currently
  logs and leaves an empty in-memory market; audit fail-closed/recovery behavior.
- Receipts and journal are incompatible with legacy full-character writers.
  Verified55 CharacterRepository SaveCharacter replaces `characters.$`, dropping
  unrecognized Resources/LastSaveID/GoldCreditReceipts; older auction updates
  can also interfere with pending intents. Require a verified compatibility
  bridge or enforceable roll-forward-only restriction before publication.
- Timed network/storage faults, full instance/raid/device play and broader
  resource/browser regression remain open. The .01 coefficient is unchanged.
  Neither this slice nor47 closes the full1.1–1.10 roadmap or earned campaign.

## Previous acceptance — September 8, 17:05 UTC

Runtime bb11f9bf1da174371fb27d3c75c50f0620ad2b92 fixes two races exposed by
the new actual dungeon/PvP tests (cbc79758a0ca097f13846bb5884d590114a03321).
Party membership mutations now take the entity lock under the world lock.
Enemy targeting snapshots its scene and reads each player's scene while holding
the player lock, rechecking disconnected/dead state against potentially stale
tick player lists. Focused race53093 PASS11.636s includes concurrent party
mutation/copy, scene/disconnect targeting and disconnected-actor attack rejection.

Initial actual16263 FAILED110.162s on cbc7975: the gameplay assertions passed,
but six child processes reported races (CreateParty versus GetEntityCopy, and
arena entry/exit versus enemy targeting). This is not a passing run. Log
`/tmp/eidolon-resource-instance-actual-sessions.log`; bad server evidence dirs
1705177692/1499972318/366519660/3838784945/1789184511/1642187709 under
`/tmp/eidolon-compat-session-*`. Its owned Mongo and volumes were removed.

Corrected actual51943 CLOSED PASS normal0/254.335s, two complete repetitions:
four classes alive/dead in Verdant dungeon, plus practice duel/ranked1v1 forfeit
and maintenance shutdown for both class pairs. Log
`/tmp/eidolon-resource-instance-repeat-sessions.log`; binary
`/tmp/eidolon-resource-instance-corrected-proof-znuMxu/bb11f9bf1da174371fb27d3c75c50f0620ad2b92`.
All56 server processes have strict normal exits and independently clean
race/panic/fatal/credential-marker scans and explicit shutdown-drain completion.
The exact disposable Mongo/volumes were removed and independently absent.
Full Go race26408 CLOSED PASS normal0: root22.706s/game413.453s, other packages
cached/no tests. Log `/tmp/eidolon-resource-instance-full-race.log`.

Dungeon coverage uses ordinary entry and real generated geometry, saves depleted
resources, restarts, checks identical instance/seed/layout/full room progress,
then living Recall or dead Recall rejection followed by Respawn and town save.
The cleared/rewarded room and death are explicitly prepared after the first
server stops, NOT earned boss-clear or party-wipe evidence. Gold/XP/equipment
must not change. Other dungeon families and raid-group/crystal events remain open.

Test-only f064c197297c533eb049c0c4eab288c5f6e13afd adds four-player 2v2 to the
same recovery contract. Ordinary invitations and acceptance form two exact
parties before their leaders queue. All four must enter one arena, repeated
Join cannot escape/refill, Wizard's real cast consumes445→415mana, one teammate's
disconnect restores all four and awards the losing/winning teams exactly once.
Maintenance gives neither team a win. Fresh-process credential logins preserve
145HP/445mana town recovery, original gold/gear and exact ranked profiles.
This is recovery evidence, not an earned complete 2v2 fight or normalization test.

Focused compile90032 PASS1.046s (actual opt-in skipped; initial invocation from
worktree root lacked go.mod and was corrected in server/). Actual91101 CLOSED
PASS normal0/111.671s: three repetitions of 2v2 forfeit and maintenance recovery,
36.55/37.01/37.07s. Binary
`/tmp/eidolon-resource-2v2-proof-o6uBQX/f064c197297c533eb049c0c4eab288c5f6e13afd`;
log `/tmp/eidolon-resource-2v2-sessions.log`. All12 strict normal-exit server logs
independently clean including shutdown completion. Owned disposable Mongo
`eidolon-resource-2v2-proof-20260908-1705` and anonymous volumes removed by EXIT
trap and independently absent. No production player data touched. No owned
local test/browser handles remain. No56 version assigned or publication approved.

Next persistence implementation: auction refunds currently mutate a disconnected
entity after its last save without journaling, or increment Mongo without ordering
against pending full snapshots. Account work ordering, expiry safety, durable
refund delivery and idempotent retry must be addressed together. Merely switching
to gold-only Mongo updates or confirming an already-committed receipt is not
proof that a never-committed older snapshot cannot erase a later refund. Audit
the auction/user cross-document failure window rather than hiding it with retry
logs. Delayed IO, rollback compatibility and broader browser/device/raid play
remain required, as do the whole 1.1–1.10 roadmap and ordered release gates.

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

## Durable failed-save journal — September 8, tested source5cf6acb

The prior implementation logged failed Mongo writes but allowed disconnected
entities to expire five minutes later, losing the only newest snapshot. The
candidate now writes a complete detached BSON snapshot to one private file per
account before Mongo IO: random receipt, payload checksum, version/size checks,
0600 temporary file, file sync, atomic rename and directory sync. Filenames hash
the account name. Older acknowledgements cannot delete a newer pending record.
Mongo atomically stores the character and receipt; replay of an already committed
receipt does not replace a later gold-only credit. Callers serialize by account
and use its newest durable entry; this is NOT arbitrary-old-receipt rejection,
cross-server CAS or a multi-writer design.

Startup replays the journal before exposing readiness or accepting logins. The
existing periodic save pass retries pending users. Expired-entity hydration must
replay first or fail closed. Retry captures a newer live character instead of
replaying an older disk snapshot. The world pins the live entity before journal
IO and leaves it pinned on local write failure; successful local durability
unpins it even when Mongo fails. Confirmed Mongo commits with failed local
acknowledgement cleanup are logged, not misclassified as missing character state:
a surviving file replays idempotently. Corrupt/unsupported files are retained and
startup recovery fails closed; no automatic deletion or stale-login fallback.

`-save-journal-dir` defaults to `logs/character-saves`. In the existing production
Compose layout this is `/app/logs/character-saves`, backed by `./logs:/app/logs`.
Keep that private directory persistent across container replacement and include
it in recovery planning alongside Mongo. Do not delete pending files to make a
failed startup appear healthy, point two active writers at one journal, or roll
back to a binary that silently ignores the pending files. This candidate has not
been deployed; no production journal has been created by this work.

Focused race97355 PASS root1.533s/database1.114s; expanded9285 PASS root1.700s/
database1.139s. Tests cover detached complete saves/reopen, safe filenames/mode,
new receipt identity, stale acknowledgements, corruption retained untouched,
failed database retry, newest live state, actual missing-directory write failure,
expiry pin/unpin, and missing-latest-state hydration refusal. Pure directory
renaming is not a physical disk-full or power-loss test.

Actual race-built33010 on5cf6acb794785ede185a7187e5ea53516c76e6e6 CLOSED PASS45.783s.
Ordinary handoff5.53s; rejected-save/restart6.67s; committed receipt/later credit
3.58s; eight four-class alive/dead token/resume/recovery cases28.95s. An explicitly
owned disposable Mongo validator rejected real production writes while leaving
reads available: ordinary Fireball100→70mana, disconnect journal retained through
failed shutdown retry, then a new process recovered the exact complete snapshot
before readiness and ordinary login preserved17HP/70mana/gear/gold. This is a
rejected-write test, not a delayed network outage. A separate precommitted pending
receipt plus subsequent43gold credit replayed without losing the credit; a dead
0HP/0mana character remained dead/empty through ordinary login and save.

Log `/tmp/eidolon-resource-journal-actual-sessions.log`; binary
`/tmp/eidolon-resource-journal-proof-qcfth6/5cf6acb794785ede185a7187e5ea53516c76e6e6`.
Five server evidence dirs3793709616/795464650/168276058/2545814512/3148458027 in
`/tmp/eidolon-compat-session-*` passed strict normal exit/log checks plus independent
race/panic/fatal/credential scans. Exact owned Mongo container/volumes removed and
independently absent; production data untouched. Full Go race75477 CLOSED PASS
normal0: root17.115s/database1.149s/game342.717s. Actual144 saved-session30872 also
CLOSED PASS normal0/210.581s (test209.55s), four classes/levels1,30,100/partial,
full, zero and dead bars across three new processes. Its evidence dirs4089778075/
1507303130/1092665031 passed strict and independent normal-exit/race/panic/fatal/
credential checks. Exact owned matrix Mongo and disposable volumes removed and
independently absent. Both ran frozen source5cf6acb; logs
`/tmp/eidolon-resource-journal-full-race.log` and
`/tmp/eidolon-resource-journal-matrix-sessions.log`. All owned local test handles
are closed at16:12 UTC. These successes do not close the remaining gates below.

## Shutdown admission and earned-work drain — September 8

Implemented in3efad53dbf4a26622c137a2ed066b84fd425697b; test-only correctiona837acb
retains the accepted cast acknowledgement. Full race and corrected actual
shutdown acceptance now pass at16:39 UTC. No release number assigned.

The old signal path saved active sockets while commands and world updates kept
running, then called Wait on a WaitGroup that could still receive new Add calls.
Stopping the main loop alone was insufficient: attack wind-ups, boss slams,
Earthshaker/Meteor timers, PvP timers, crystal vigils, death rewards and auction
refund callbacks were independently asynchronous. The new zero-value lifecycle
group distinguishes closed external admission from completion-tree draining:
already-admitted parents may enqueue earned child work until atomically sealed
at zero. All detached world mutations/refunds now use tracked work; only Update's
already-joined parallel workers remain plain world goroutines.

Signal handling now marks readiness unavailable and closes/joins command and
WebSocket admission, stops/joins recurring gameplay/save/expiry loops, cancels
unfinished world timers/vigils, and waits for earned world/refund completions.
Completed PvP results resolve normally; unfinished matches cancel without ranked
rewards/deserter penalties, using existing PvP exit resource restoration. The hub
closes transports and retires its clients before queued cleanup/save/weekly/guild/
PvP completion workers drain. Final snapshots include disconnected characters,
since a late earned reward may have changed one since its disconnect save.

Crucially, all final character snapshots reach their private durable journal
before the first final Mongo attempt. A database failure stops further final
commit attempts, leaving files for startup replay instead of repeating a timeout
for every remaining player. Local journal failure keeps the server quiescent and
retrying, not knowingly reporting successful exit with the newest state only in
RAM. HTTP shutdown and normal main return follow the durable final pass. Compose
gets60s grace for this work. This does not guarantee survival of forced SIGKILL,
power loss before the journal write, permanent storage loss, or unfinished
cross-document auction/weekly-reward transactions.

Initial40384 CLOSED PASS focused root0.245s/lifecycle0.009s/game0.032s. Lifecycle
race67491 CLOSED PASS root1.459s/lifecycle1.030s/game1.566s; expanded54309 PASS
root1.917s/lifecycle1.038s/game1.703s. Final focused43001 CLOSED PASS root2.171s/
lifecycle1.041s/game1.650s, `/tmp/eidolon-shutdown-final-focused.log`. Tests cover
concurrent admission closure, waiting for an active tick, nested earned work,
rejected late command/upgrade, cancelled actual attack/vigil, preserving decided
PvP results without maintenance forfeits, disconnected late-reward final saves,
unwritable journal refusal and all8 journals preceding the first database call.

Initial actual handle90112 ran all TestResourceActual cases against race-built binary
`/tmp/eidolon-resource-shutdown-proof-ruYRdB/3efad53dbf4a26622c137a2ed066b84fd425697b`
and explicit disposable Mongo `eidolon-resource-shutdown-proof-20260908-1629`.
Its exact cleanup trap removed only that owned container/volumes. Log
`/tmp/eidolon-resource-shutdown-actual-sessions.log`: handoff6.33s, rejected save/
restart6.70s, committed receipt/later credit3.46s and8 token/recovery cases28.62s
passed, as did144 sessions217.47s. The new live-socket test FAILED12.46s before
its eight-socket SIGINT step: its immediate unknown-skill probe after accepted
Fireball expected locked, but legitimately received global_cooldown with70mana.
Thus90112 CLOSED FAIL1/275.094s, not a whole-run pass. Nine child logs (dirs in the
execution ledger) have clean normal exits/race/panic/fatal/credential scans; the
owned Mongo/volumes are independently absent. Full Go race21550 CLOSED PASS0:
root20.592s/game403.942s/lifecycle1.069s/databasecached, log
`/tmp/eidolon-resource-shutdown-full-race.log`.

Correctiona837acb changes only the new test: the accepted Fireball acknowledgement
already proves living state and exact70mana, so do not immediately probe again
inside its valid global cooldown. All other probes and exact final persistence/
fresh-login assertions remain. No gameplay change, added grants or wait padding.
Focused92471 CLOSED PASS1.705s, `/tmp/eidolon-shutdown-cast-ack-focused.log`.

Corrected49137 CLOSED PASS0/82.378s: **three consecutive** eight-live-socket SIGINT
and fresh-process login runs28.20s/27.25s/25.89s, four classes each alive/dead.
Real living Wizard Fireball100→70mana; other living/dead0mana, exact17HP/0HP,
gold1234/level30. Every final Mongo snapshot was fresh after shutdown began;
healthy shutdown left no pending files, and ordinary logins in a new process
preserved each snapshot. Binary
`/tmp/eidolon-resource-shutdown-corrected-proof-F8f5F1/a837acb9d9c35f082f3c93e32f76608648290015`,
log `/tmp/eidolon-resource-shutdown-repeat-sessions.log`. Six server evidence dirs
4027541671/3472769833/322527122/3880982149/3016411499/2985687568 under
`/tmp/eidolon-compat-session-*` have strict normal exits, explicit drain-complete
logs and independent clean race/panic/fatal/credential scans. Exact owned repeat
Mongo and disposable volumes removed and independently absent; production data
untouched. All owned local test/browser handles are closed. This is controlled
SIGINT proof, not abrupt-kill or general storage/network-fault durability.

## Required work still open — do not publish this slice alone

- Verify remaining delayed IO,
  storage failure boundaries and pending-save versus offline auction-credit
  ordering; a matched receipt alone does not protect every concurrent credit.
- Verify actual PvP forfeit/entry/exit and unfinished-dungeon save/recovery.
  Preserve existing explicit PvP recovery policy, not reconnect healing. Desktop
  Wizard cast/death/login/Recall evidence exists above; broader class/device
  browser acceptance remains open.
- Old binaries do not understand this field and replace whole character records;
  rollback could discard snapshots. Define and verify a compatible rollback plan
  before assigning a release version, patch notes and sequential publication.
- Actual saved-session harness passing would establish only its explicit scope,
  not the above concurrent/session/PvP/device acceptance or campaign balance.
