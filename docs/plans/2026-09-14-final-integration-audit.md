# 1.10 final integration — evidence and remaining work

Latest checkpoint:1.9.9 is verified live at3481f89a with CI34804655770 terminal
success and exact public identities. The corrected strict earned Earth route
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

Pending integration patch note (not yet published): locked elemental-raid and
portal cards now name the required Chronicle quests and explicitly tell players
to turn them in to Archmage Ilyra. The old chapter3/5/7/9/13/14 labels predated
the expanded story and sent players to the wrong journal chapters. Entry gates,
levels, rewards and saved progress are unchanged. Focused menu checks compare
these names with the actual server quest catalog. Work is isolated from the
running Abyssal party source; include it in the next appropriate release notes.

- Candidate: Alpha1.9.8, `08f020bcba55a187f83bc8ddf5a20980fde88b15`.
  Exact CI **34802207933** is running; client passed, server in progress.
  Continue that run without superseding it for documentation.
- Verified live: Alpha1.9.7, `3460ccfb824359bbb48df1acfe7cb61587444663`,
  matching public frontend/backend, database ready. CI **34800160671** passed
  all ten jobs; do not poll/restart the completed run.
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
| 1.7 arena | Team elimination, practice/ranked, rating windows, build policy, durable results/season rewards and anti-farming | Combined real-player queue/round/result/reconnect flow; retain prior financial/idempotency tests rather than recreating a season |
| 1.8 social | Group finder, roles, guild calendar, invitations/readiness/moderation, shared seating | Exercise connected group formation and recovery as part of the same party/raid/casino sessions |
| 1.9 world/casino | Rotating disturbances; public and VIP venue/games; EP vendor/membership; earlier public poker restart proof | Earned full public event, complete connected enter/seat/play/leave/stairs flow, busy-floor rendering; exact 1.9.7 live delivery |
| 1.10 integration/delivery | Post-Malachar “A Letter Without a Throne” and Help cadence already shipped in 1.9.1 | Measured concurrency, current-state backup/restore and compatible rollback, final cross-feature acceptance, cumulative notes and exact live 1.10 identities |

This table organizes work; it does not check off the parent roadmap's detailed
requirements. In particular, preserve all five dungeon families (Verdant,
Abyssal, Molten, Tempest, Umbral), failing seeds plus the specified seed coverage,
all four classes, actual attacks/abilities rather than forced deaths, floor
ownership/High–Low comparisons, exit/party/death/reconnect states and live smoke.
Retain the casino's full public/VIP interaction and currency checklist, not just
the newest EP tests. The population-dependent second PvP queue remains
conditional; a fifth class/new continent and payment integration remain excluded.

## Execution order

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

1. Finish exact 1.9.8 CI/live verification. Do not rerun or supersede a live job
   because observation takes time. Avoid competing native Chrome on the shared
   GPU while the predeploy/live character gate owns it.
2. Use the existing fresh-story-ready route for the missing earned Earth gate,
   recording its actual class/seed/items/rewards/deaths and saved handoff. It only
   covers Earth; the driver explicitly rejects other realms. Do not call it a
   complete campaign or restart the already-passing prepared Verdant route.
3. Continue earned realm/raid progression and cross-feature sessions; fix
   demonstrated game defects, distinguish controller failures, and rerun only
   affected paths. No debug kills, fabricated repair receipts or in-run gear grants.
4. Before the single performance/concurrency acceptance pass, document the exact
   host/GPU/build, workload, retained comparable baseline and numeric targets.
   Existing loadtest/scene-performance/backup scripts are starting points, not
   evidence that the new run happened. Do not build a second QA framework.
5. Inspect current snapshot/EP receipts and rollback writer compatibility before
   disposable backup/recovery testing. Never point destructive recovery tests at
   production or roll back to a writer that drops EP/allowance/cosmetic fields.
6. Publish 1.10 only after the parent requirements have matching evidence, with
   accurate cumulative patch notes and verified frontend/backend commit identity.

The overall goal remains active. No broad soak or replacement deployment was
started for this audit.
