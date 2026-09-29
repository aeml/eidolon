# Alpha 1.37 — level-cap rewards and Resonance

Isolated 1.37.0 candidate prepared; no deployment or milestone acceptance.

## Actual progression receipts

Boss and room rewards passed total XP into their summaries even when the
recipient was capped or crossed level 100. The server granted Resonance
correctly, but both chat and combat callouts labelled it ordinary XP.

The common experience grant now returns its exact ordinary/Resonance split.
Solo and party boss summaries and room-clear summaries include that receipt.
The existing total `xp` field remains for rolling compatibility; updated clients
use the optional `progression` object, never infer conversion from the current
character level or count total XP again. Old summaries still render as before.
No XP rates, Gold, Resonance thresholds, rank benefits or saves changed.

Scoped server checks passed in 1.160s, exercising actual solo/party boss death
and room-clear reward paths at levels 30, 99 and 100, including cap overflow,
Resonance-rank rollover and room replay. Existing progression, quest receipt,
room and boss-budget checks were included. These are reward-path tests, not
evidence of beating an encounter or of satisfying endgame pacing.

Eleven client checks passed in 1.238s for the new receipt, legacy payloads,
boss/room feedback and existing quest rewards. Scoped lint and whitespace
checks passed. No production players or long campaign runs were used.

## Weekly delivery candidate

The published callback claims first, grants in memory and saves only if a client
exists. The local candidate instead prepares a pending entitlement in the same
weekly-lockout collection, grants under the account work lock, persists the
whole character and a per-week receipt through the existing character journal,
then acknowledges delivery. Startup and bounded periodic recovery process
pending entries, including characters with no live entity. Legacy lockouts
without the pending marker are treated as already delivered, never reissued.

The receipt is cloned in world snapshots, persisted in BSON and hydrated on
login. Schema 15 fences older full-character writers which could drop it;
this is a new future 1.37 migration, NOT part of 1.33–1.36. No backfill or
currency reset is introduced. Existing cache amounts/full-bag compensation stay.

Local fake-store/real-journal checks cover offline recipients, failed character
commits, lost acknowledgement, world-to-offline recovery, detached receipt
maps, under-level rejection and twelve concurrent completions paying once.
Scoped character/progression/weekly checks passed (main .288s, game .861s,
database .006s). Final six delivery cases passed with race detection (1.408s).
These original receipts preceded the real-database integration below. No live
database migration or reward grant has been performed.

## Disposable database and production-process integration

Dedicated loopback Mongo container `eidolon-weekly-137-qa-20260929` used
port 32777; no production database was connected. The first database test
caught BSON decoding into the attempted insert retaining `DeliveryPending=true`
when a legacy lockout omitted that field. Decode now uses a zero-valued record,
so older completed lockouts cannot reopen. Final prepare/duplicate/legacy,
defer/due/acknowledgement and real-journal failed-save recovery tests passed
(main .115s). Schema15 migration replay passed.

The production binary test passed in 5.605s: startup delivers an offline
entitlement, a real logged-in socket receives periodic delivery, ordinary
disconnect saves and restart retain exactly two grants/receipts, and an invalid
recipient does not prevent readiness. The initial invocation failed the harness
identity check because the binary lacked its expected build-commit tag; it was
rebuilt with the tag, not accepted by weakening readiness. Final process logs:
`/tmp/eidolon-compat-session-2751101040` and
`/tmp/eidolon-compat-session-21233774`. The schema14 1.33 binary's read-only
preflight rejected this disposable schema15 before writes (expected exit1).

Failed recipients retain their pending entitlement with a one-minute retry
time and leave room in subsequent bounded batches. A storage failure while
deferring stops the batch rather than multiplying database timeouts. Startup
logs unresolved weekly entries and permits unrelated accounts after the existing
character-journal replay gate; account locks serialize later delivery with
login. Eight local delivery cases passed with race detection (1.595s), including
bad-recipient fairness and one offline Gold-source record across ack retry.
Metrics are still best-effort: a crash/failed commit may omit a source event;
character receipts, not telemetry, establish ownership.
The exact owned test container was stopped and confirmed absent; its disposable
database was removed. Evidence logs and the isolated test binary are retained.

## Initial-write handoff recovery

The character now records its first eligible completion time at boss death,
before asynchronous delivery. The existing character-save journal persists
this outbox before the first entitlement request. Recovery uses the original
UTC week, clears the outbox only after confirming the entitlement, and retains
the existing per-week delivery receipt. This reuses character persistence;
it does not add a second journal or change weekly eligibility/reward amounts.
Schema 15 also creates the outbox and pending-delivery query indexes.

Failure-injection checks cover failed character commits and failed initial
entitlement writes, journal replay after restart, and crossing a weekly reset
without consuming the new week's eligibility. Solo and four-player kill paths
record their completion before the asynchronous event. Race checks passed
(main 1.924s, game 1.419s). Real Mongo prepare/legacy/defer, save-failure and
original-week recovery checks passed together in 4.141s. Testing exposed short
saved inventories being mistaken for full bags during offline delivery; the
restored bag now receives normal empty-slot capacity before granting items.

The production-process integration now starts with only the character outbox,
not a pre-existing entitlement. Startup preparation/delivery, periodic online
delivery, disconnect and restart passed in 5.720s. Evidence logs:
`/tmp/eidolon-compat-session-871352632` and
`/tmp/eidolon-compat-session-1743351360`. This used only the disposable loopback
Mongo container `eidolon-weekly-outbox-137-qa-20260929` on port 32778.
The owned container was stopped and confirmed absent; only its temporary
test database was removed, while evidence logs remain.
Durability begins with the journal write; these checks do not claim recovery
from a process crash before that write, disk failure, or arbitrary corrupted
outbox data. No production migration or reward grant occurred.

Follow-up review found that a failure in outbox discovery/preparation returned
before checking already-recorded pending entitlements. Recovery now reports
that failure and stops further preparation attempts in the batch, but still
attempts the separate pending-delivery query. Two injected discovery/preparation
failure cases verify delivery of an existing entitlement while preserving the
unprepared completion and returning the original error. The focused weekly
delivery/completion suite passed with race detection in 1.917s. This is not a
promise to skip or repair every malformed outbox, nor a reason to discard it.

## Required follow-up before closing 1.37

- Publish in roadmap order after 1.35–1.36, pass CI and independently verify.
  Human reward-value feedback remains open.

## Exact isolated package checks (September 29)

The 1.37 selection is prepared on the 1.36 candidate and carries the 1.35 town
depth fix forward. It excludes the separate 1.38 party-presence/dead-level-up
changes. Runtime versions and cumulative notes are aligned. Five reward/sheet
checks plus the original version suite passed together (315 checks, 3.831s);
after adding the town browser-coverage assertion, all 311 version checks passed
(2.817s). Scoped lint and whitespace checks passed.

The first scoped race run stalled in test cleanup because the boss fixture also
triggered room-clear grants into its bounded event channel. Captured the stack
and stopped that owned test process. Boss tests now retain a living room guard;
the separate room case still checks actual room rewards. Unexpected extra
events fail instead of blocking cleanup. The corrected exact package passed
focused weekly delivery/completion, capped reward and schema-fence race checks:
main 2.474s, game 3.637s, database 1.046s. Opt-in Mongo/process cases were not
rerun; their unchanged earlier disposable-database evidence remains above.

Prepared /tmp/eidolon-release-1-37-verify.mjs for exact public frontend/backend
identity, database readiness, login/cache key, cumulative history and deployed
reward/character/town client assets. It is syntax-checked, not a live receipt.
The owner's public DDNS currently resolves to the wrong IPv4; publication is
held without changing DNS or bypassing the release order. Schema15 rollback
limits are documented in the release plan.

## Reward sources and cosmetic boundary

Reviewed the actual production callers of `awardExperienceLocked`: solo/party
combat, dungeon rooms and manual quest turn-ins. Public events use ordinary
enemy/party rewards and calmer roads, not a second completion purse. Repeat
raid kills still award ordinary combat XP; only the separate weekly cache is
weekly-limited. Daily quests are an optional additional source, not an admission
gate to earned Resonance. Existing world broadcasts synchronize changed
Resonance without reopening the menu or relogging.

The character sheet now explains level-100 XP conversion, optional dailies,
one point per Resonance level and that EP cannot buy trait points. Five receipt
and sheet checks passed in .700s, including crossing the cap, disabled spending
without points and the existing 50-rank limit. Scoped lint passed.

Source review confirms EP exchange only debits Gold at 1,000,000 per EP; there
is no reverse operation. Casino EP has separate receipts and balances. The
cosmetic vendor writes only EP and appearance ownership, not equipment or
Resonance. Existing focused broadcast, quest/rank receipts, event completion,
cosmetic purchase/application, one-way exchange and EP-ledger boundary checks
passed (main .316s, game .988s, database .005s). These are scoped boundary
checks, not a new whole-economy audit, reward-value verdict or human pacing run.
No reward rates, trait power, payment integration or premium benefits changed.
