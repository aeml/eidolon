# 1.10 final integration — evidence and remaining work

## September19 checkpoint — administration delivered, Rootheart accepted

Alpha1.9.17 is publicly verified at `b5feba27`, with all ten CI35464162303 jobs
passing, matching domains/database readiness and a protected schema12→14 backup.
See [administration delivery](2026-09-19-release1-9-17-administration.md).
The subsequent [five-player Rootheart raid](2026-09-19-rootheart-party-acceptance.md)
passed in29.5minutes: full original guardian, all three defended repair waves,
five personal manual claims and saved re-logins, no deaths or retries. Native69714
is terminal and cleaned up. Do not repeat it because the historical failures below
remain in this audit. Remaining three elemental raids, earned full campaign,
regional/cross-feature/phone checks and final1.10 delivery remain open.

## Alpha 1.9.14 — friendly repair artificer targeting

Raid49954 is terminal exit1 after15.0m on631030ab. Five-member town recovery
and re-entry passed; clients observed ritual start and wave1. The driver then
selected CrystalKeeper, whose1,000,000HP did not change for60seconds. Full repair,
personal rewards and full raid acceptance remain unproven. Log:
`/tmp/eidolon-earth-raid-r5-20260914-vwNevs/run.log`. Sanitized0; owned API/Mongo
containers absent after cleanup. Private checkpoint:
`/tmp/eidolon-party-checkpoint-earthraid0914e-FNrE47/save.archive.gz`, SHA256
`62030983f3e74c8e51de5f7086301e3453fe24ad1090187750aa77aa95c08beb`.
Not a verified playable resume. Do not poll/restart49954.

This exposed a production targeting omission, not just a driver mistake:
`GameEngine.isHostileActorTarget` treated non-interactive Maelin as an enemy.
Server creates her as TypeNPC; the client creates CrystalKeeper but its generic
Actor fallback returned hostile. Exclude CrystalKeeper without adding a service
interaction or changing server ritual rules. Two regressions failed on the old
predicate, then passed for IDLE and CHANNELING. Normal enemies remain targetable;
hovered and buffered Maelin cannot become an effective combat target.
295 tests across five focused targeting/presentation suites passed2.015s;
ESLint, Bash syntax and diff checks passed. Login, runtime defaults and cumulative
patch notes advance to1.9.14. Deployment and full raid retry are pending, not
accepted by these unit checks. Avoid overlapping the retry with CI browser QA.

Physical-phone feedback remains Brave/Chrome with positive general UI feedback;
user has not tried dungeon or party play. Those checks remain open.

Release3fb8d580 pushed to master; CI34856694692 started (watch57501). Do not
supersede this deployment with QA-only commits. Before retrying, the failed log
also proves two driver assumptions need correction: Graven Colossus was logged
as HollowSentinel (its reused rendering class), and the second Cleric provided
1228 effective ally healing while the first had zero. Resolve known boss identity
from its server-generated ID prefix so boss-room bounds, screenshots and clear
assertions use the actual guardian; do not rename or weaken expected bosses.
Check aggregate effective Cleric healing rather than require the first Cleric
to heal an already-full ally. Death, damage and reward assertions stay intact;
four-player behavior still requires its single healer.18 focused encounter and
timing tests passed0.560s, lint/diff passed. These are local QA-only corrections
for the next run, not yet connected raid acceptance.

## Earlier evidence

Raid36074 terminalexit1: first assault room/recovery-size validation passed,
then a moving DemonOrc remained at1719HP for60seconds in the next encounter.
All five survived with218Gold; both Clerics healed (3627/1337). Repeated fallback
ground inputs were unavailable while the target moved from5.38 to17.88units away.
Inspection found the QA fallback still approached its initial target coordinates.
It now rereads the live enemy position per approach, retains the12-unit movement
bound and60-second damage-stall watchdog, and records latest approach diagnostics
if the stall recurs. This is a specific QA correction, not yet proof that the
encounter stall is resolved.12focused approach/timing tests pass0.659s
(10821exit0); lint/diff pass. No production change or forced combat result.
Log `/tmp/eidolon-earth-raid-r4-20260914-LKHD3v/run.log`; sanitized0/owned cleanup
passed; private `/tmp/eidolon-party-checkpoint-earthraid0914d-HJBXQU/save.archive.gz`,
SHA256`2d95e3cc00dca95464fc6044770d96a9d016b03852478c91e895f778699aaf94`.

Raid8535 is terminalexit1 after2.4m: five-member UI formation/readiness/entry and
first assault-room combat passed, each player alive with165Gold, but the shared
QA rest validator required exactly four observations. Correction declares the
expected group size (default4, explicit raid5–10), checks every observed member,
and retains80%first/50%later rest thresholds and death/stale-pool rejection.
21focused rest tests pass0.498s (6334exit0); lint/diff pass. Searched shared party
helpers for remaining four-member count/index assumptions; the other matches
were unrelated numeric limits. No production or encounter changes.
Log `/tmp/eidolon-earth-raid-r3-20260914-2iB769/run.log`; sanitized0/owned cleanup
passed. Private checkpoint `/tmp/eidolon-party-checkpoint-earthraid0914c-FIykh8/save.archive.gz`,
SHA256`b18abbc59c046b7dddee9c8ba3c99187a7d0a264ded1bdc09c8992f838702ca5`.
Not a raid clear; no repair credit was claimed.

First five-player raid invocation29311 stopped before formation: the new helper
expected raw `currentInstanceType === 'overworld'`, but initial town state is
null. All five legal builds loaded/replicated; no raid entered or combat credit.
Use existing `readPlayerState` normalization, as the dungeon route does. Native
exit1, sanitized0, owned containers removed. Log
`/tmp/eidolon-earth-raid-20260914-tRhG1L/run.log`; private checkpoint
`/tmp/eidolon-party-checkpoint-earthraid0914a-T1yGnX/save.archive.gz`, SHA256
`5dae8157b36b3af5b6683fdf83642eb0eb7769e6e8d979c066fbd5f651be2d54`.
This is a QA assumption failure, not a demonstrated gameplay defect or raid clear.
Retry5471 also exited1 before raid entry: all five builds and accepted party
invitations passed, but the helper had not selected the guide's **Raids** tab.
The card existed in the hidden panel, so its attribute assertion passed while
accessible button lookup correctly timed out. Add the ordinary tab click and
visible-card assertion. Log `/tmp/eidolon-earth-raid-r2-20260914-2CemVT/run.log`;
sanitized0/owned cleanup passed. Private checkpoint
`/tmp/eidolon-party-checkpoint-earthraid0914b-Z8od1W/save.archive.gz`, SHA256
`eeeaa127059ca1cfd3281698a67d8623af661981e6105b78e495f783d81c254c`.

Normal70 Molten now **accepted**: native49494 terminalexit0/54.1m, all five bosses,
four geared roles, zero deaths, four town recoveries, each manual Fire handoff
and re-login saved rewards. Exact f2fdea9b; cleanup/checkpoint verified. See
[Molten acceptance](2026-09-14-molten-party-acceptance.md). Do not repeat it for
the local raid-driver extraction. Five-player full-raid driver is prepared, not
yet accepted; remaining family/earned-campaign/raid/phone scope remains open.

Alpha1.9.12 is publicly delivered on both domains at38847b2f, database ready;
login/notes and eight served HTML/JS/CSS files exactly match the release source.
CI34840066682 is **terminal success, all ten jobs passed**, including live
saved-character play and town healing/Well Rested. Watch42418 exited0; do not
repeat this accepted release. Alpha1.9.13 poker recovery is pushed asf2fdea9b,
CI34843057369 **terminal success, all ten jobs passed**; watch51003 exited0.
Live saved-character gameplay and town recovery/Well Rested passed. Do not
repeat those completed gates. Exact public delivery passed at12:46:27UTC:
both domains matchf2fdea9b/Alpha1.9.13, DBready, and eight served HTML/JS/CSS files
match transformed committed source. This accepts1.9.13 delivery, not the remaining
full1.10 campaign/raid/integrated-visual scope. The connected casino route
passed and exposed table clipping, now repaired and verified at four screen
sizes plus the actual two-player flow. See
[connected casino and layout evidence](2026-09-14-connected-casino-acceptance.md).
This does not close earned campaign, remaining dungeons, actual group raids,
busy-floor or physical-phone acceptance. Connected EP blackjack and paid slots
now pass their bounded routes; [saved bonus/free-spin interactions](2026-09-14-connected-slots-acceptance.md)
also pass for both Gold and EP. These are prepared socket fixtures, not rendered
venue or earned-currency evidence. Connected
EP poker separately passed and exposed the packaged1.9.13 walk-back correction;
see [EP hand and restart evidence](2026-09-14-vip-poker-connected-recovery.md).

Latest checkpoint:1.9.11 public delivery is verified at
`bd56689384f737c18c78a84607bc4683e7fb11bd`: frontend manifest, backend health
(database ready), login label/patch notes, actual runtime script/versioned
imports and tracker JS/CSS match. **CI34829019013 is terminal success, all ten
jobs passed**, including final live character and town recovery QA. See
[party tracker correction and acceptance](2026-09-14-party-quest-tracker.md).
Do not poll or restart that completed run. Earlier1.9.10/4bab14fa CI34822657032
also passed all ten jobs; the superseded1.9.11attempt34827963234 failed a stale
test assertion before deployment and is terminal. Earlier
1.9.9 CI34804655770 is terminal success, not pending work.
The corrected strict earned Earth route
now passes all eight phases on clean89c2ad5d, native10782 terminal success;
[accepted result and earned checkpoint](2026-09-14-earned-earth-acceptance.md).
The old31615 attempt failed travel; do not treat it as active or rerun the
subsequently accepted route.1.9.8 previously passed
all CI gates with actual
schema-upgrade backup confirmed. Snapshot sharing now passes the original
50/100-client bounded criteria; see [accepted rerun evidence](2026-09-14-broadcast-snapshot-sharing.md).
The earlier100-client failure below is retained baseline evidence, not the
current optimization outcome.1.9.9 packages that accepted change for publication;
full earned campaign/raid/phone acceptance remains open. The controlled High/Low
rendering workload now passes its predeclared frame-time and resource budgets;
see [timings and inspected screenshots](2026-09-14-final-render-workload.md).
This is not an actual group raid or a physical-phone result. Do not repeat
the completed concurrency or EP backup checks for documentation changes.

September 14, 2026. This is an **open acceptance audit**, not a declaration of
1.10 completion. Preserve the full [1.1–1.10 roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md),
[progression requirements](2026-09-07-progression-balance-and-investigations.md),
and [casino scope](2026-09-09-town-casino-roadmap.md). The September 12 feature-first
policy changes verification timing, not the required final experience.

The dated release plans contain historical “not implemented/not published”
paragraphs. Do not recreate shipped features or repeat a long passing route
because an older checklist remains unchecked. Match evidence to its source and
scope; do not count prepared characters as earned progression.

## Current release boundary

Live Alpha 1.9.10 integration patch: locked elemental-raid and
portal cards now name the required Chronicle quests and explicitly tell players
to turn them in to Archmage Ilyra. The old chapter3/5/7/9/13/14 labels predated
the expanded story and sent players to the wrong journal chapters. Entry gates,
levels, rewards and saved progress are unchanged. Focused menu checks compare
these names with the actual server quest catalog. Cumulative login patch notes
and package/server/CI version labels match. The Abyssal run ended on its
original traversal deadline before publication, with artifacts retained; this
guide correction does not claim a completed Abyssal clear.

Prepared-release checks: version presentation, Pages runtime versioning, asset
versioning, dungeon progression menu and dungeon preparation **282 tests across
five suites passed in 10.087 seconds**. Focused ESLint and `git diff --check`
passed. No browser run or previously accepted load/backup suite was repeated
for this text-only game change. The full 1.10 acceptance scope remains open.

- Verified public delivery: Alpha1.9.10, `4bab14fad67db14c26c93d9bacb0410f57187626`.
  Exact CI **34822657032** passed all ten jobs, including live character QA.
  Retained terminal metadata: `/tmp/eidolon-1-9-10-ci-final-20260914.json`.
- Earlier Alpha1.9.9, `3481f89ae4c6e3f050ac6a3cb0494b27ea4245a4`, passed all
  ten CI34804655770 jobs; do not poll/restart it. Earlier1.9.8 CI34802207933 and1.9.7
  CI34800160671 are also terminal successes, not pending work.
- 1.9.7 implements actual VIP-floor access and EP games, not payments. Keep
  Gold→EP at 1,000,000:1, monthly entitlement at 100 EP, no EP→Gold conversion,
  and EP rewards cosmetic-only outside EP wagering. Paid membership provisioning
  is trusted administration; checkout and billing remain excluded.

## Evidence recovered — retain instead of repeating

**Bounded concurrency now measured:** [current trial results and allocation profile](2026-09-14-concurrency-trials.md).
10-client baseline and50-client120s stage passed admission/replication checks;
50-client sampled memory also passed.100clients were all admitted but exceeded
the fixed heap budget, so that stage was stopped early and is NOT accepted.
No transport/decode errors; heap returned near baseline after clients left.
Existing benchmark identifies repeated Entity snapshots as92.27% of allocation
bytes. Address that measured cost before rerunning affected load, not a new soak.
All owned services/listeners are stopped/removed; logs retained locally.

**EP rollback defect repaired locally:** schema11 did not fence pre-EP writers.
[Schema12 and current recovery evidence](2026-09-14-ep-schema-recovery.md) now
proves actual old-binary startup/preflight refusal with saved BSON unchanged,
and authenticated backup/restore of EP, membership, cosmetics, receipts and a
pending wager. These focused checks passed; corrective publication follows the
running1.9.7 release. Do not repeat this backup matrix for documentation-only
changes, or confuse the writer stand-in with actual post-restore gameplay.

**Four-player Verdant already passed.** The authoritative result is in
[role-appropriate dungeon equipment](2026-09-12-party-progressed-gear.md), not the
earlier failed Common-gear attempts. Native 15051 on `9b6745d7` passed in 58.8
minutes, zero retries, seed `-1286139677518117694`, Normal level 30. All rooms and
four original-health bosses cleared without deaths, global stat scaling or
mid-run grants. Fighter Strong, Rogue Agile, Wizard Brilliant, Cleric Wise;
five Rare and nine Uncommon pieces each. Actual individual credit, manual Ilyra
claims, Water offers, five town recoveries, completed-run re-entry and saved
handoffs passed. Archive: `/tmp/eidolon-geared-party-pass-KVzr6y`.

Do not describe that as a missing first-dungeon clear or rerun the same hour-long
case by default. It is one prepared-party seed, before the 1.6 encounter changes;
it does not prove earned leveling, the other dungeon families or crystal raids.
Its 43.20 minutes of traversal includes 36.04 minutes of browser formation
overhead: it is not a human clear-time benchmark.

**Current EP shared-table check:** on the 1.9.7 candidate plus documentation,
`EIDOLON_CASINO_TEST_MONGO_URI=... go test . -run '^TestVIPCasinoMongo' -count=1`
passed in 1.520s using an owned loopback Mongo 7.0.16 container. This includes the
last poker initialization correction: public/VIP lobbies have different round
identities, two funded participants remain isolated from public play, private
cards stay private, and funded poker/blackjack settlement survives VIP expiry
without touching Gold. The exact owned container was stopped and removed.
Reuse the previous [VIP game evidence](2026-09-14-vip-casino-games.md) for other
unchanged paths. This is not a production wager or a populated-floor benchmark.

**Current progression source audit:** production catalog/drop audit passed;
log `/tmp/eidolon-final-progression-budget-20260914.log`. There are 31 Chronicle
chapters, including eight investigations. Earth has 40/60/50-kill authored hunts
and eight collected seeds. Seed collection averaged 20.08 eligible kills with
saved pity in 2,000 simulations (p90 26, maximum observed 34); all four collection
definitions use the same measured distribution. The opening pays 100 XP/100 Gold;
Earth dungeon chapter pays 10,562 XP/300 Gold. These are actual current budgets,
not the obsolete million-XP catalog and not proof of satisfying campaign pacing.

## Remaining acceptance, grouped to avoid repeated matrices

### Actual-phone feedback — September 14 clarification

The user uses **Brave or Chrome** on their phone and has **not tried a party or
dungeon session**. Preserve their earlier positive general mobile-UI feedback;
it does not establish mobile dungeon or multiplayer acceptance. Phone model/OS
were not supplied. The browser question is answered; do not ask it again.
Actual-phone party/dungeon play remains unverified, separate from automated
responsive-layout and desktop hardware-rendering results.

| Area | Existing implementation/evidence to retain | Still required |
| --- | --- | --- |
| 1.1 first hour and dungeon foundations | Current manual Ilyra chain, town recovery/Well Rested, skill fixes, party credit, passing prepared Verdant route; earned current-curve Earth readiness passes without daily/grant substitutions | Relevant current encounter delta and remaining dungeon families/seeds |
| 1.2 character/equipment/mobile | Published class/equipment work, inspected galleries, real phone user reports “everything looks good,” responsive menu checks | Integrated High/Low visual review and sustained phone combat/party scope; do not erase the user's positive UI feedback |
| 1.3 combat feel | Existing cast/impact, movement, aiming, telegraph and sound work with focused native receipts | Inspect/hear these together during the actual group/campaign routes, including other instances and representative runes |
| 1.4 Chronicle | 31 chapters, eight playable sites, four witness dialogues/restoration consequences; named-NPC click fix is live | Complete earned campaign through all four dungeon handoffs, four full raids and repair defenses, portal and four-Eidolon Dark King finale |
| 1.5 progression/economy | Current reduced budgets, promised-reward migration, Forge refresh, builds, appearance collection, Gold/EP separation | Record earned XP/Gold/drops/upgrades and sources/sinks across the campaign; no mandatory daily wall, no max-level lost rewards |
| 1.6 encounters | Distinct boss footprints, four different repair jobs, party preparation/recovery and lockout copy | Actual group raid completion, all repair waves/objectives, wipe/re-entry/reconnect and individual saved receipts; targeted recheck of changed 1.6 mechanics |
| 1.7 arena | Team elimination, practice/ranked, rating windows, build policy, durable results/season rewards and anti-farming; [four connected clients pass ranked2v2 rounds, saved results, and actual disconnect/resume/restart penalty ownership](2026-09-14-connected-arena-acceptance.md) | Rendered team-round/result review in final cross-feature scope; retain prior financial/idempotency tests rather than recreating a season |
| 1.8 social | Group finder, roles, guild calendar, invitations/readiness/moderation, shared seating; [connected recruitment/consent/readiness/token-resume roster](2026-09-14-connected-group-finder-acceptance.md) and [connected guild invites/calendar permissions/reschedule consent/actual restart persistence](2026-09-14-connected-guild-calendar-acceptance.md) pass | Integrated rendered group/raid/casino experience; retain accepted connected social evidence |
| 1.9 world/casino | Rotating disturbances; public and VIP venue/games; connected public blackjack and EP poker/restart; [VIP blackjack](2026-09-14-connected-vip-blackjack-acceptance.md), [EP cosmetic purchase/apply/replay/restart](2026-09-14-connected-cosmetic-vendor-acceptance.md), and [Gold/EP Earth-slot paid spins, prepared bonus/free spins, resume/restart](2026-09-14-connected-slots-acceptance.md) pass; prior membership/recovery evidence | Earned full public event, integrated rendered venue experience and busy-floor rendering |
| 1.10 integration/delivery | Post-Malachar “A Letter Without a Throne” and Help cadence shipped in 1.9.1; bounded 50/100-client concurrency, controlled High/Low rendering and schema12 recovery accepted | Final cross-feature acceptance, cumulative notes and exact live 1.10 identities; retain the accepted performance/recovery evidence and its limits |

September19 crowded-floor visual review now has a bounded High/Low result:
40 equipped models across the canonical public/VIP venue, actual seated poses
and controller cutaway, with four inspected screenshots. It caught a missing
upstairs-patron cutaway, fixed locally for the next release batch. Retain this
[crowd review and its limits](2026-09-19-casino-crowd-review.md); do not rerun it
as a new40-client networking, wagering or performance test. The existing
connected game/settlement evidence remains distinct from this render evidence.

This table organizes work; it does not check off the parent roadmap's detailed
requirements. In particular, preserve all five dungeon families (Verdant,
Abyssal, Molten, Tempest, Umbral), failing seeds plus the specified seed coverage,
all four classes, actual attacks/abilities rather than forced deaths, floor
ownership/High–Low comparisons, exit/party/death/reconnect states and live smoke.
Retain the casino's full public/VIP interaction and currency checklist, not just
the newest EP tests. The population-dependent second PvP queue remains
conditional; a fifth class/new continent and payment integration remain excluded.

## Execution order

Raid preparation now reuses the legal progressed-gear catalog through
`tests/raidPartyFixture.js`: five distinct level70 characters, Fighter tank,
two Wise Clerics, Brilliant Wizard and Agile Rogue; each has five Rare and nine
Uncommon pieces. The server's test-only catalog exports actual raid definitions.
Native36884 passed preparation against all four definitions and their current
Chronicle order. Three focused fixture tests pass (0.469s); lint/diff checks pass.
Only prerequisite chapters are prepared: the selected Vigil remains accepted,
zero-count and incomplete, with no later chapter or cleared-instance receipt.
This is **setup, not a raid clear or earned campaign**. Next work must connect the
five players, form/ready/enter through normal controls, complete assault rooms and
guardian, defend all repair waves/objectives and manually claim each saved reward.
Do not run an entry-only GPU test just to repeat entry during the full clear.
`tests/e2e/raid-party-entry.js` now provides that five-player invitation, explicit
acceptance, guide conversion, individual ready-check and shared-instance UI flow.
It uses normal controls and read-only observations; conversion is confirmed by
the server's chat receipt (party updates do not transmit MaxSize). Syntax/lint
checks pass. **Not run against five browsers yet**; wire it into the complete
combat/repair route before using GPU time. No live runtime change.
`tests/raidVigilControls.js` and `tests/e2e/raid-vigil-input.js` now provide the
ritual movement step for that route. They consume the live personal
`currentDungeonRoomState.crystal` snapshot: Earth ward holding, Water's carried
memory hint, ordered Fire channel points and alternating Wizard/Rogue Air runners.
The tank and both Clerics retain combat/support ownership; the runner's sole
input worker must invoke this after telegraph avoidance, before attack/follow.
Only ground clicks are issued; no quest/wave/clock mutations. Nine planner tests
pass0.469s; lint/diff pass (native29605 exited0). **Still not an actual defended
raid or browser acceptance**; complete the shared combat/ritual driver next.

The complete driver is now wired as `tests/e2e/five-player-raid.spec.js` using
`geared-party-route.js` (the four-player spec remains a wrapper for its existing
route). It combines five legal prepared roles, UI formation/readiness/entry,
assault traversal and actual boss combat, live ritual movement during attacks,
all three defended wave receipts on every client, restored scene screenshot,
town recall/re-entry, individual manual Ilyra turn-ins and saved reward re-login.
No runtime change, stat/HP adjustment, wave or quest mutation. The original
120-minute expedition ceiling remains; the remaining ritual loop also has a
15-minute bound and current-update/death checks. `party-raid` isolated route uses
zero retries and retains a private checkpoint during owned cleanup.
64 focused tests in five suites pass1.035s (native41198 exit0); Bash/lint/diff
pass. Native51235 lists both browser specs successfully without launching GPU.
**Not yet run as a full connected raid**. Run after Molten49494 releases the GPU;
do not repeat accepted dungeon/slot routes for this QA-only extraction.

### Bounded concurrency trial contract (before execution)

Run on Ryzen7 5700G (8 cores/16 threads), 31,456MiB RAM, Linux, while no owned
native Chrome gate is active. This is a shared development/production host;
record that limitation rather than claiming dedicated-host or Internet capacity.
Use an isolated loopback API/Mongo, exact release `08f020bc`, no production
credentials, pre-created characters or privileged gameplay grants.

Use the existing mixed combat/town/social loadtester: **10 clients/30 seconds**
as a measured starting baseline, then **50/120 seconds**, and **100/120 seconds**
only if the preceding stage passes. Each stage must admit every requested player,
have zero unexpected read/write/decode errors, keep database-ready health, and
deliver at least five aggregate state frames per client-second of the configured
steady duration. This aggregate rate is not per-client latency or frame-time proof.
API heap must remain below512MiB and below four times its pre-load healthy heap;
allow normal garbage-collection fluctuations, not an inferred memory leak from
one sample. Retain measured values. Do not weaken targets after seeing results.

No long soak: stop at the first failure, distinguish test-driver/auth/protocol
errors from server capacity, and fix only the demonstrated issue before deciding
what to repeat. These trials do not replace raid gameplay, browser performance,
long-duration retention, packet-loss or public Cloudflare/TLS checks.

Concurrency preparation found an evidence bug in the existing load tester: it
incremented `joined` after sending a request, without server admission. The tool
now counts each own authoritative Player snapshot once, reports decoder errors,
and exits unsuccessfully for missing admissions or transport/decode errors.
Generated usernames are no longer printed as successful join receipts. Focused
loadtest checks pass0.013s and the executable builds. This is not a measured
concurrency run; run the existing tool against disposable services with explicit
targets before claiming capacity. No second load-testing framework was added.

1. Abyssal party20006 is terminal: four bosses cleared, then the original
   120-minute traversal/recovery deadline. Artifacts and a verified private
   four-boss saved-progress copy are retained; full clear/claims remain open.
   See [regional result](2026-09-14-regional-party-dungeons.md). Do not poll or
   restart that handle.1.9.10 is now deployed with exact public identities;
   all ten CI34822657032 jobs passed. Retain that release evidence, then continue
   the missing encounter and cross-feature checks without overlapping GPU jobs.
2. Retain the accepted earned Earth route10782 and prepared Verdant route15051;
   neither proves the other realms or full earned campaign. Continue remaining
   dungeon families using the existing prepared-party options, with Low graphics
   for the next multi-browser functional run to reduce shared GPU contention.
   Keep legal class gear, difficulty, actual inputs and completion gates intact.
3. Continue earned realm/raid progression and cross-feature sessions; fix
   demonstrated game defects, distinguish controller failures, and rerun only
   affected paths. No debug kills, fabricated repair receipts or in-run gear grants.
4. Retain the accepted bounded concurrency and controlled High/Low rendering
   reports linked above. Do not rerun them for copy or documentation changes;
   they do not replace actual group raids, campaign or physical-phone evidence.
5. Retain the accepted schema12 backup/restore, old-writer refusal and actual
   production upgrade-backup evidence. Revisit only for relevant storage changes.
   Never run destructive recovery on production or restore an incompatible writer.
6. Publish 1.10 only after the parent requirements have matching evidence, with
   accurate cumulative patch notes and verified frontend/backend commit identity.

The overall goal remains active. No broad soak or replacement deployment was
started for this audit.
