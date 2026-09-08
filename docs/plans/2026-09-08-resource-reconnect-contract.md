# Resource reconnect defect — required before 1.1 acceptance

Status: confirmed defect with an unreleased implementation candidate, not yet
release-ready or assigned a published patch. Preserve .01 passive regen.

## Latest implementation checkpoint — September 8, 22:30 UTC

The [execution ledger](2026-09-05-roadmap-execution.md) records the authoritative
queue and evidence. Bridge56 is9aec835; resource candidate is7886278, still
unpublished and carrying inherited56 metadata, not a separately approved release.
The full merged client passed240 suites/3404 tests; both final server race suites
pass. Two fresh actual schema7→8/crash/refused7/recovered8 sequences pass with
all eight child logs clean. The earlier combined run exposed a bridge Join/world
snapshot race, now corrected and reverified; that failed run remains recorded.

The target binary now provides a read-only `--check-schema` preflight, invoked
before the deployment script replaces the live API. Actual schema7/8 preflight
tests accept compatible databases and reject future formats without save/index/
file writes. Deployment documentation specifies supported roll-forward targets,
one writer, and consistent Mongo plus pending-journal backups; it explicitly
rejects forcing older writers by deleting migration markers. Startup still
checks independently. Preflight is not a multi-deployment lock or a substitute
for compatible-writer and backup/restore verification.

49 CI is in predeploy gameplay with Go/Jest/three browser shards passing; live
client/server remain48. Remaining publication work: the ordered CI/live gates,
separate resource version/notes packaging, and the documented pre-upgrade backup
and exact compatible recovery target. Broader instance/device/raid/roadmap
acceptance and Well Rested remain open. Passive regen stays .01.

## Historical implementation checkpoint — September 8, 21:40 UTC

Staged bridge56/dff080b and resource288b623 (test4321e69) now pass TWO complete
actual schema7→8/crash/refused7/recovered8 sequences with preserved zero mana,
HP/XP/gold/equipment/receipts/journal and once-only listings. Details, failed
attempts and exact evidence are in the roadmap ledger. Both full race suites
pass; actual runs uncovered and fixed the resource AI state reader race and
bridge send/close race. Bridge final version231 checks, lint and rendered notes
also pass. The bridge fence is integrated into resource as153fbcb.

Neither candidate is published. Ordered49 CI has failed dungeon-recovery
navigation, and later releases must wait. Supported deployment-target restrictions
and final queue ancestry remain open; no resource patch number is assigned.
This does not close broader gameplay/device/raid/roadmap acceptance.

## Historical implementation checkpoint — September 8, 21:06 UTC

The authoritative release/test state is in
[the roadmap execution ledger](2026-09-05-roadmap-execution.md). Bids, refunds,
seller payouts, item claims/returns, buyouts, listing escrow, stale selection and
publication-delay duration handling now have actual recovery acceptance in the
unpublished resource candidate.46ea069's full race and two combined listing
recovery repetitions passed;84 child processes were independently audited.
These results supersede earlier open-item statements below for those slices.

Compatible rollout/rollback remains open. A separate schema7 bridgef2238ce based
on canonical queued55 now refuses schema8 before migration/index writes and
server admission; its actual refusal proof passed and its full race suite is
active. It is not yet released or integrated into the resource candidate.
Broader dungeon/raid/device and full roadmap gates remain open; no resource
release is assigned and .01 per-stat regeneration is unchanged.

## Historical checkpoints

Historical18:40: corrected bid acceptance37895 CLOSED PASS0/439.525s, THREE
repetitions of six actual SIGKILL boundaries, ordinary same-bidder raises,
simultaneous equal bids/repeated requests and all earlier refund fault/lifecycle
cases. All115 child logs independently clean:18 intentional kills/97 normal
shutdowns, plus three expected startup rejection logs. Owned Mongo/volumes gone.
Fullrace1501 PASS on runtime030ec67 (root20.900/database1.129/game367.539s).
Test correctiona09ac66 targets Mongo write faults by namespace after combined
15368 correctly failed an intended-boundary assertion; that failed run remains
recorded, not counted as success. Candidate docs now at37e01a1, still unreleased55
metadata. No local resource test handles remain. Bid recovery does not close
buyout items, listing deposits, seller payouts/returns, rollback or broader
instance/device acceptance.48 CI34257070035 failed predeploy Seraph acquisition;
no deployment ran and public client/server still match healthy47.

Historical18:23: runtime030ec67 adds durable bid decisions in a unique-per-auction
operation collection (schema8), signed character debit receipts and atomic
auction/refund finalization. First actual six-boundary SIGKILL recovery run
PASS73.117s; all18 logs independently clean, six expected kills/12 normal exits.
Original decision rejection preserves prior funds; other five boundaries recover
one debit and one preceding escrow refund across two fresh logins. No unsaved
combat-tick/buyout-item/seller-payout durability claim. Fullrace1501 and repeated
combined actual15368 remain active on frozen sources. No release approval.

Historical17:47: runtime8b68f56 coalesces/bounds refund retries and outage backoff,
seals new delivery on shutdown and refuses unreadable auction startup. Actual
53929 PASS96.202s across two repetitions: a100-intent backlog makes one500ms
delayed rejected update, preserves its journal/intents on shutdown, then all100
pay once across bounded recovery passes; an explicitly corrupt auction produces
the expected startup exit1, followed by recovery after removing only that owned
fixture. All32 normal child logs/exits and two intentional rejection logs clean.
Focused race checks pass; fullrace4474 CLOSED PASS normal0, root14.226s/
game245.257s. Whole-auction operation/debit/item/payout and ambiguous-write recovery,
rollback and broader acceptance remain open. Earlier slices follow.

Latest17:26: refund candidate d1e2839 adds durable auction intents and private
character gold receipts, pending-save-before-credit ordering and atomic expiry
pinning. Actual first run29305 FAIL72.457s exposed Fireball versus snapshot races;
09b5693 keeps world/entity read locks through the copy. Focused26034 PASS and
corrected actual18314 PASS118.569s for three repetitions of pending offline
snapshot/refund, rejected character save and rejected refund acknowledgement
across fresh server processes. Exact bars/gear/gold and single payment preserved;
all27 corrected child logs/normal exits clean, disposable services removed.
Fullrace83776 CLOSED PASS normal0 (root22.691/database1.156/game365.813s).
Whole-auction debit/item/payout crash atomicity,
ambiguous auction updates, bounded outage retries, old-writer rollback and broader
instance/device acceptance remain open. No56 release approved. Earlier slices:

Latest acceptance17:05 UTC: runtimebb11f9b fixes party-write and enemy scene-read
races found in actual instance sessions; fullrace26408 PASS(game413.453s), and
corrected actual51943 PASS254.335s twice through four-class alive/dead Verdant
recovery plus practice/ranked1v1 forfeit and shutdown. Layout/seed/full prepared
room progress and exact resources/gold/XP/equipment survive restart. Prepared
cleared rooms and death do not prove earned boss combat or a full party wipe.
Test-onlyf064c19 extends ordinary two-party 2v2 recovery: actual91101 PASS111.671s,
three forfeit/shutdown repetitions with all four players' town resources and
exact nonduplicated ranked results verified after fresh-process login. All68
corrected instance/2v2 child logs clean and normal exits enforced. Owned local
test services removed; no release approval. Actual other dungeon families,
raid-group/crystal events and broader device play remain open. Next is durable
auction-refund ordering against pending snapshots and disconnected expiry,
plus delayed IO and rollback compatibility. Historical slice details follow.

Candidate `work/resource-persistence-20260908` atac53b2c (tested runtime3efad53,
browser-tested28ebabc,
token-tested ea5d539, runtimea9f5960) implements versioned resource restoration and per-account
session/save ordering. Broader live tests found and fixed close/send and character
ID publication races that a green unit suite missed. The corrected race-built
server passes144 saved sessions and five consecutive ordinary Fireball/two
repeated Joins/overlapping login/old cleanup/new-owner command/final-save runs.
The harness now fails on abnormal child exit or race/panic log markers and checks
fresh saves at BSON timestamp precision against a pre-close baseline. All eight
four-class alive/dead token-resume and ordinary recovery cases pass. Actual
desktop Wizard browser casts, ordinary password logins, hostile death/death-screen
login, Respawn button and living Recall also pass with depleted/dead bars retained.
The candidate now journals complete pending saves before Mongo writes, retries
before stale hydration and pins the live copy if local journaling fails. Actual
race-built Mongo rejection/restart recovery and already-committed receipt replay
with a later gold credit pass, as do the repeated handoff/token cases. This is
not arbitrary crash/network-outage or concurrent offline-credit proof. Full Go
race75477 passed (game342.717s) and144-session matrix30872 passed210.581s on5cf6acb,
both normal0 with actual child exit/log checks enforced. No owned local test
handles from that journal slice remain active.
Shutdown now closes/joins admission and gameplay loops, cancels unfinished timers,
drains earned completion trees, avoids maintenance PvP forfeits, and journals ALL
final players before the first Mongo attempt. Full race21550 passes(game403.942s).
Actual90112 passes prior handoff/journal/token/144 sessions but fails the new
shutdown test on a global-cooldown probe assumption; no whole-run success implied.
Test-only correctiona837acb uses the already accepted Fireball/70mana reply.
Actual49137 passes three consecutive eight-live-socket SIGINT/fresh-process login
runs82.378s, four classes alive/dead with exact resources and gold retained.
All actual child exits/logs are checked; no owned local handles remain at16:40 UTC.
This controlled shutdown proof does not establish forced-kill/network/storage
failure safety. Delayed network/storage failures, pending-save versus
offline-credit ordering, PvP/instance recovery, broader device/class play and
rollback still remain open; the whole acceptance list is not closed.
Execution details and exact handles are in the roadmap execution ledger and
the candidate's `2026-09-08-resource-persistence-implementation.md`.

On release46/45df969, actual fixture reuse had2575HP/1685mana before disconnect.
The next normal login returned2080HP/1190mana with the SAME2575/1685maxima.
Both deficits equal495, exactly the level100 flat resource bonus `(100-1)*5`.
The QA fixture log is `/tmp/eidolon-release46-prepared-fixture-gameplay.log`.
The first prepared-fixture browser test passed29.2s; its following Verdant route
was still active when this defect was recorded. No whole-route pass implied.

`server/client_dispatch.go` initializes current HP/mana as saved Vitality or
Intelligence multiplied by10. Recalculation then includes the flat level bonus,
gear and other modifiers in maxima. `database.Character` has no current HP/mana
or alive/dead resource snapshot; `characterSnapshot` therefore cannot preserve
them. Reconnect may remove resources from a full character or replenish a
depleted one. The earlier explanation that release46's starting deficit came
only from preceding casts was incomplete: login reconstruction itself supplies
1190mana. The initial predeploy1216mana sample follows normal regeneration.

## Implementation and acceptance

- Persist a versioned, optional authoritative resource snapshot, distinguishing
  missing legacy data from valid zero mana/zero health. Take it under the same
  lock/snapshot as the rest of character persistence; cover autosave, disconnect,
  duplicate-session replacement and explicit save paths.
- Restore after canonical level/equipment/talent stats are loaded. Clamp only
  when the resulting maximum has genuinely changed; do not manufacture a full
  bar or a base-stat-derived value on each login. Preserve unrelated equipment,
  quests, XP/Resonance, points, gold and active dungeon progress.
- Define/test one-time legacy migration, ordinary death/reconnect/respawn,
  interrupted instance recovery, PvP entry/exit and max-stat changes. Zero HP
  must not produce an alive unplayable character or bypass normal death recovery.
- Keep fractional regeneration transient and .01 per stat. Do not introduce
  offline regeneration, reconnect healing, or a new gameplay recovery policy as
  an incidental effect. Audit rollback compatibility before publication.
- Verify actual Mongo/WebSocket save/load for all four classes, levels1/30/100,
  empty/partial/full resources, gear-modified maxima, zero mana and dead state;
  repeat login cycles must not accumulate resources. Use real browser casts,
  incoming damage, ordinary reconnect and death-screen recovery as well as unit
  and race checks. Record elapsed regeneration separately from saved values.

The explicit level100 prepared-QA initialization fixes a test precondition only.
It does not close this gameplay defect, fresh-campaign pacing, or 1.1 acceptance.
