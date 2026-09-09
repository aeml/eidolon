# Safe-zone recovery and Well Rested

Requested September 8, 2026. Status: implementation in progress, NOT live.
Part of the active full-roadmap goal: implement as a coordinated 1.0.x feature
after urgent blockers, and include it in 1.1 recovery and progression acceptance.

September9 03:33 checkpoint: new move-only0a3e1c0 uninterrupted route FAILED4.8m
at Watch2/40, zero deaths,115/150HP and0/130MP after repeated retreats; no
issued movement failure. Evidence retained, not pacing approval. Separate
8564500 comparison uses real town recovery only between credited encounters,
without changing deadlines, counts, rewards or default CI. Policy41tests/lint
pass; actual53523 is ACTIVE. Feature/campaign remains unversioned and NOT live.
52 passed all initial test groups and is in predeploy gameplay QA; queue unchanged.

September9 03:24 checkpoint: the uninterrupted17a4dba route FAILED5.2m at
Watch3/40 with zero deaths: an issued retreat displaced2.46 of the required6
units near New Growth. Marker interception is a lead, not established cause.
New integrated0a3e1c0 adds player-facing Shift-click move-only input, preserving
ordinary walking/collisions and normal interaction. Full client257suites/3655tests,
lint and native marker-pointer fixture pass. Fresh actual uninterrupted24785 is
ACTIVE on that clean source, with unchanged quest counts, timeouts and recovery
rules. Evidence and limitations are in the candidate integration document.
Feature is still NOT live;52 CI remains active and53 must wait for its full gate.

September9 03:08 checkpoint: integrated production1816738 passes full server
race and256 client suites/3645tests. Additional combined save regression passes
all four classes living/dead through3 BSON/journal/catalog reloads each, keeping
legacy promises, exact rest and zero mana/death through curve migration. Current
candidate17a4dba is running the ordinary uninterrupted opening/diary/40-kill Watch;
opening and diary passed without deaths or reconnects, hunt still in progress.
Not a pacing approval or live release. Production51 is fully verified;52 is now
in CI, preserving the ordered queue before this feature can be published.

September9 02:31 checkpoint, developmentbadd0cf: corrected enemy acquisition,
chase and roam to use the scene-scoped sanctuary registry, plus delayed boss
slams rechecking safety at impact. Regressions first reproduced the failures;
final focused race passes8.000s (including12 new cases). This changes production
AI, so older d650c72 session proofs are not relabeled as new-runtime acceptance.
Integrated with31-chapter story/coordinated rewards in isolated1816738, where
corrected full client/server checks are currently running. Neither branch is
versioned/live, and canonical deployment order remains unchanged.

September9 02:14 checkpoint, development1c7537f: native real-time expiry and
reentry now pass in an ordinary registered browser session; stats/maxima,
icon and aura expire together and return only on earned rest. Screenshots
inspected with no enclosing cube. An explicit earned-town-recovery collection
route also passes8/8 fragments with3 real rest stops and no player deaths.
The default no-rest combat failure remains open; its CI route is unchanged.
The8000XP collection payout still causes level6→17 and is not balanced yet.
Full client243 suites/3449tests and lint pass. Exact logs, owned cleanup and
limitations are recorded in the development contract and execution ledger.
Remaining release gates include earned-play balance and ordered versioning/
deployment; this is not a live-feature announcement.

Development branch `work/well-rested-20260908` in
`/tmp/eidolon-well-rested-ZL0PZY` now implements the server registry, recovery,
persisted fractional bank, final stat modifier, enemy-kill-only XP multiplier,
protobuf replication, desktop/phone timer and High/Low golden-elemental aura.
Initial foundation af7ed63 passed full Go race/Jest, but its first real-process
test found fixed simulation ticks slowed recovery under load. Corrected d650c72
uses per-player elapsed monotonic server time, retaining fixed combat/movement
steps and resetting the clock on disconnect/resume. The corrected actual
four-class recovery/cap/death/expiry/restart test passed31.984s on owned local
Mongo; no production data was involved. Hardware Chrome gallery and phone
rendered checks pass; screenshot inspection also corrected timer label wrapping.
Detailed contract/evidence live in that branch's
`docs/plans/2026-09-08-well-rested-implementation.md`.

Additional23:52 checkpoint, development commit97977a9: the existing144-session
matrix passes with exact requested town recovery across three fresh processes;
new actual token-resume/live-handoff and north-gate movement/expiry/return tests
pass. No disabled town healing or fake movement/warp commands. All tests used
owned loopback Mongo and the exact d650c72 race binary; projects removed after
clean normal drains. Other older resource workflow assumptions and integrated
browser/earned-play gates are still open.

September9 00:05 checkpoint, development e9c5de5: adapted and passed the existing
four-class token replay/Recall/Respawn and eight-live-socket shutdown/restart
checks with exact timed town healing, retaining a real Wizard cast. Added a
four-class PvP expiry/forfeit/return regression; full server-package race check
passed. No production changes this turn. Remaining resource adaptation now
centers on dungeon/PvP integrations and journal/auction/schema-upgrade flows;
browser-integrated and earned balance gates remain open.

September9 00:23 checkpoint, development cebd17f: actual four-class dungeon
restart/recovery matrix passes52.653s, all8 living/dead cases and16 processes.
Retains exact dungeon resources after real rest expiry, real Fireball cost,
room/layout progress and recovery without grants. All logs clean with normal
drains; owned Mongo/volumes removed and checked absent. Client authority checks
pass2 suites/15 tests: render time cannot grant healing or earn/spend rest.
There is no playable offline progression entry; current client explicitly uses
server authority, so no independent client rest clock is needed.

September9 00:30 checkpoint, development10eb246:8 real PvP cases now pass across
four classes, duels,1v1/2v2 parties/queues, forfeit and shutdown. Both real expiry
and retained-bank exits use current maxima, with exact match rewards unchanged.
Rejected-save and already-committed journal replay retain exact resources/rest
and later gold. Combined actual workflows pass91.871s; all19 child logs clean,
owned disposable Mongo removed. Full root race suite passes11.467s.

September9 00:36 checkpoint, development3121fa4: seller-payout normal collection
and all6 crash boundaries pass55.267s with exact durable rest/resources and
unchanged payment/receipt/claim/item checks. Final normal resource-probe follow-up
passes8.357s; full root race suite13.757s. All22 child logs clean;6 intentional
kills documented, other processes drained normally. Owned Mongo/volumes removed.

September9 00:40 checkpoint: development8e21d49 now includes the verified local
50 movement fix through the ordered51–57 ancestry. Version/state/movement/input
checks pass4 suites/315 tests. No backend code changed in this merge; existing
d650c72 backend acceptance is unchanged. Feature remains unpublished.

September9 00:50 checkpoint: developmentf2a6ad8 closes listing and item-delivery
recovery acceptance. Listing9 normal/rejection cases,7 crash boundaries and
delayed publication pass92.422s. Item5 capacity/collection cases and6 crash
boundaries pass69.162s; stricter original-gold/equipment startup guard follow-up
passes40.684s. All88 child logs clean, intentional kills documented, other
processes drained; owned Mongo/volumes removed. Full root race11.365s.
Merged client/lint sweep66914 still running; no feature deployment.

September9 00:58 checkpoint: developmentfdf023b closes bid/competing-request and
buyout recovery checks. Bid crash6 cases54.506s; combined same-bidder raises,
competing bids, buyout capacity/rejections,6 crash cases and competing purchases
105.677s. Exact one-winner/item, charges/refunds, offline resources/rest and
original equipment/progression retained. All54 child logs clean with12 intentional
kills documented; other processes drained. Owned Mongo/volumes removed. Root
race12.077s; merged client242 suites/3,425 tests93.429s and lint pass.

This is not a versioned/staged release. It follows staged57, requires schema9,
and must not publish inherited57 metadata. Remaining gates include integrated
expiry and rested/unrested earned balance, plus release-specific verification.

September9 01:16 checkpoint, developmentb409d83: standalone refund/refund-lifecycle acceptance passes
43.100s, retaining exact offline bank/resources and online recovery through
recipient save/acknowledgement failures, bounded backlog and deliberate malformed
auction startup refusal. Original live-session handoff/cooldown passes8.066s:
real Fireball, repeated joins, overlapping login and late transport cleanup.
Its exact recovery checks now respect the existing disconnect boundary that
clears transient fractional healing, with each session independently validated
against the fresh handoff save. No production code changed. All owned test
containers/volumes removed; normal child logs drained cleanly. This closes those
two persistence gates, not schema upgrade or integrated earned-play/aura gates.

September9 01:30 checkpoint, development4b407b3: actual schema7→8→9 upgrade
passes12.916s, including real old-server zero-mana casts, failed auction escrow
save/crash, old-writer refusals before writes and two new-process recoveries.
Full root race13.222s/lint pass. Fresh-character hardware Chrome travel/combat/
Recall/relogin route passes1/32.3s with earned bank, countdown, local damage
receipt and transparent19-mesh aura; screenshots inspected. All owned local
processes ended and disposable data removed. This does not close earned balance,
phone/group/expiry or older browser assumptions that must reflect town healing.
Detailed evidence remains in the implementation branch contract.

September9 01:56 checkpoint, development1d68888: phone talent costs/cooldown and
death/Recall/login recovery pass actual browser checks using fresh authoritative
rest time. Full client242 suites/3,440 tests and lint pass. Two real party members
pass native joystick plus local/remote aura checks across High/Low and three
phone layouts; screenshots inspected. Visible particle parts reduce19→10 at Low.
These are Chrome-emulated phones/two players, not physical-device/full-raid proof.
The full collection playthrough failed its unchanged120-second encounter bound
at3/8 fragments after low-mana retreat/reacquisition; opening passed normally.
Keep that earned-play failure open and investigate ordinary resource management
and defensive input. Feature remains unpublished. All owned local tests ended,
disposable data removed; ordered release50 is now live and51 is in CI.

## Requested behavior

- Town, and every future designated safe zone, restores **10% of maximum health
  and 10% of maximum mana per second** to living characters, capped at maximum.
- Each second spent in a safe zone earns **one second of Well Rested duration**.
  Presence is sufficient: no sitting emote or separate rest action is required.
- Stored duration caps at **7,200 seconds (two hours)**. It does not count down
  inside a safe zone; it counts down only while outside one.
- While active, Well Rested increases **all stats by 10%** and **XP from enemy
  kills by 25%**. Quest turn-ins and unrelated XP sources do not receive the kill
  bonus. Max-level XP conversion must retain the established cap rules.
- Active characters have an attractive surrounding particle aura, inspired by
  the player's Conquer Online Lucky Time reference. Create Eidolon's own effect:
  subtle orbiting gold/elemental motes and a soft halo, not a solid box or a large
  opaque effect. Keep enemies, telegraphs, equipment and the hero readable.
- Outside safe zones, the requested **.01 per-stat passive regeneration remains
  unchanged**. Safe-zone healing is a distinct rule, not a global regen increase.

## Implementation requirements

- Use one authoritative safe-zone definition for protection, rest accumulation,
  recovery and replicated UI state. Avoid a town-only coordinate check duplicated
  across systems; future safe zones must opt into the same contract.
- Recovery requires a living character; it never revives a corpse or bypasses
  explicit Respawn. Define safe-zone recovery as the total 10%-per-second passive
  recovery there, rather than accidentally stacking another percentage refill.
- Use elapsed simulation time with retained fractions, not rounded frame counts;
  server authority prevents client clocks, reloads or repeated boundary crossings
  from granting duplicate duration/healing. Partial seconds and the cap are stable.
- Persist remaining duration with the character's full save/recovery contract.
  Proposed baseline: offline characters neither earn nor spend rest time. Make
  this explicit in patch notes; confirm any different offline policy before build.
- Define an explicit stat map before implementation. Preserve the user's “all
  stats” request: do not silently implement only one attribute or just damage.
  Cover primary attributes, derived combat/resource stats and bounded percentage
  stats without applying the same 10% twice through both base and derived paths.
  Document rounding, caps, movement/cooldown interpretation and maximum-resource
  changes on expiry. Never refill current HP/MP merely by toggling the buff.
- Apply kill XP once in the common authoritative enemy-reward path, including
  ordinary/elite/boss and eligible shared-party kill rewards. Define ordering with
  other multipliers; do not multiply quest, exploration or room-clear payouts.
- Replicate active status and remaining duration to local/remote players. Show a
  readable buff icon, percentage description, countdown and safe-zone paused/
  accumulating state on desktop and phone. The aura follows the correct actor,
  appears after reconnect, and cleans up on expiry, removal and scene changes.
- Honor reduced effects and graphics settings; avoid one light per particle,
  shared-material recoloring, particle leaks and party-sized visual clutter.

## Required acceptance

- [ ] Safe-zone registry, boundaries, living-only healing, fractional ticks, caps,
  full resources and future non-town zone tests.
- [ ] Accumulate inside, pause consumption inside, consume outside, cap at7200,
  expiry, rapid crossing and reconnect/crash-save tests with exact duration.
- [ ] Stat-map tests across all classes, equipment, percentages and expiry; no
  double multiplication, compounding recalculation or HP/MP refill exploit.
- [ ] Exactly25% eligible kill-XP bonus; party/boss, existing multipliers and
  max-level coverage; quest and other unrelated XP demonstrably unchanged.
- [ ] Real-input town→combat→town and reconnect verification, not only prepared
  component scenes. Recheck first-hour/campaign pacing rested and unrested.
- [ ] Inspect aura and duration UI on desktop, portrait/landscape phone, both
  graphics qualities and reduced-effects settings, including groups and expiry.
- [ ] Publish versioned notes/login metadata and pass the ordered CI/live gate.

Do not claim that this feature is delivered because it has been added to the
roadmap. Current no-rest balance results are not final evidence for rested play.
