# Alpha 1.9.0 — a world that stays interesting

Candidate branched from packaged1.8 release595c07ff and includes its corrections.
Deployed asAlpha1.9.0 at e86e29a0f808e7547678c77485b8441c06ee067c. Exact
CI34749377284 terminalSUCCESS; public client/server identities match and database
is ready. Live Water recall passed only on retry; preserve this unresolved caveat
and the focused diagnostic follow-up in the1.10 handoff, not a claim of a fix.
Parent scope: [full roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md) and
[two-floor casino](2026-09-09-town-casino-roadmap.md). Both remain required.

Implement rotating elemental disturbances, cooperative public events and shared
encounters with readable world signals/objectives. Reuse current region, combat,
party-credit, spawn and reward systems. Events must not become mandatory daily
chores or undo the Gold/drop/XP balance pass. Inspect actual code before choosing
event sites/mechanics; do not add a second combat or reward framework.

Then complete the physical casino venue and games: intentional Trading House →
stash → casino spacing; two navigable floors, prestigious upstairs, lore-themed
slots with distinct mechanics/bonuses/free spins/jackpots/animations/audio; real-
player poker with private cards, turns, pots/side pots and sufficient real players.
Retain and refine the existing solo/multiplayer-house blackjack. Use current seat,
camera, round and durable currency receipt infrastructure, not menu-only games.

VIP currency is unresolved: user was asked asynchronously for its name and how
players obtain it. Do not invent its name, grants, exchange rate or monetization,
and never substitute Gold/Resonance. Continue public content while awaiting input.
The functioning VIP experience is required by1.10, not an optional placeholder.

Objective-based PvP battleground is conditional on demonstrated population for a
second queue; do not split a small population by default. Full1.10 integration,
concurrency/recovery/mobile/performance, cadence and post-Malachar hook remain.

Use focused changed-path checks and essential save/currency/ownership safeguards,
builds and deployment smoke. Reuse passing unchanged evidence; consolidate broad
campaign/device/endurance checks in final stabilization. No subagents or new soak.

## Packaging and combined release checks — September13

Public event/casino feature batch implemented. No additional PvP queue was added:
the conditional population prerequisite has not been demonstrated. Functional VIP
still awaits the user-approved separate currency and remains required for1.10.

Slot paytables are now explicitly tuned per theme, keeping bonuses/free spins/
jackpots intact. Full-cycle samples, limits and uncertainty are recorded in the
slot handoff: tuned sampled returns Earth96.16%, Fire96.85%, Water91.77%, Air96.89%.
This is initial economy tuning, not a theoretical RTP guarantee. Final changed-
Water sample plus all slot rules PASS0.803s; unchanged themes' results reused.

Combined production-scenery check builds the actual world generator's town,
foliage and dungeon landmarks plus current stash/Trading House/furniture positions.
PASS5.6s:323 sampled town approaches, ward/rune and wave-spawn positions,542 scenery
colliders,9 foliage groups, zero blocked samples. Screenshot
/tmp/eidolon-world19-town-20260913.png inspected. This is actual placement/spatial
evidence, not a connected character traversal or final production lighting audit.

Actual two-player poker sockets PASS40.210s: ordinary authenticated seats/buy-ins,
solo waiting, real15-second deal, private cards, full server stop/start DURING the
hand, new seat tokens/original cards, rejected stale action, check/call through
river/showdown, exactly-once cash-outs and saved totalGold1000. Initial fixture
polled too quickly and hit the existing rate limit; corrected to normal three-
second polling without weakening production limits. No game fix was needed.
Server evidence /tmp/eidolon-compat-session-1196209317 and1493643058.

Actual shared event sockets PASS1.409s during the real active window: both clients
saw disturbance-2982151 in Air, participants2/wave1/remaining8, identical schedule,
no joining Gold grant. Evidence /tmp/eidolon-compat-session-2606226907. Prepared
approach characters and presence/activation only; NOT an earned wave/boss clear.
The opt-in check skips outside a usable event window rather than altering time.

Per the user's feature-first policy, remaining combined connected floor/camera,
earned full-event play and broad multiplayer/device/performance checks carry into
the consolidated1.10 integration phase alongside VIP. Their scope remains intact;
they are not marked passed by these narrower release checks. Existing1.8 seated
camera/blackjack and1.9 navigation/slot/poker focused evidence is reused.

Synchronized login, package/lock, release manifest, server/container/compose/deploy/
CI and isolated-QA defaults toAlpha1.9.0. Added cumulative1.9 notes covering the
actual features and explicit unfinished VIP boundary; preserved all earlier
versions. VersionPresentation248testsPASS2.765s, changedJS lint, Go build-all and
diffPASS. No broad local matrix/soak. Disposable Mongo and QA servers stopped.

## Implemented candidate — elemental public events

Server-owned ten-minute rotation through four road-side disturbances, announced
one minute before activation; three defended waves then a Fracturekeeper. Earth
holds the center, Water follows alternating runes, Fire holds the outer annulus,
Air requires movement within the ward. Enemies contest charging. Nearby alive
connected overworld players activate the encounter; all levels can contribute.
Normal combat/loot/party XP are reused. Completion calms nearby hazards for five
minutes, without a repeatable completion purse or reward-claim entitlement.
Owned enemies expire cleanly and never use ordinary overworld respawn. Champion
extra health survives stat recalculation without refilling damage.

Bound to shutdown-aware one-second server loop, login/resume snapshot and
noncritical broadcasts. Client has exact-radius world rings, map indication and
optional collapsible nearby objective/lore; hidden in instances and away from the
site. Existing hazards receive CALMED/recovery snapshots without rebuilding,
suppress threatening particles during calm and restore normal footprints afterward.

Focused evidence: TestPublicEvent PASS0.013s, Go build-all PASS; four changed-path
JS suites26tests PASS3.647s; changedJS lint/client preparation/diff PASS. Single
390px rendered event fixture PASS6.1s including expansion/no horizontal overflow/
instance hiding. Screenshot /tmp/eidolon-public-event-phone-20260913.png inspected.
This is a prepared scene, NOT an earned combat clear or actual-site clearance
proof. Next event checks: actual region geometry/approach and one connected shared
encounter before release. No broad campaign/device/soak repeated.

## Implemented candidate — physical two-floor venue

Stash moved from(0,185) to(-8,185), between the rotated Trading House and casino
approach. Server entity, offline spawn/recovery, map/minimap and current footprint
tests agree. Expanded casino width to26 units to preserve gaming-floor circulation
and a separate east stairwell. Existing public table coordinates remain unchanged.
Actual upper floor atY6, velvet carpet/gold inlay, lounge seating, side tables,
candles and stairwell balustrade replace the solid upper-storey placeholder.
Three separately batched groups allow outside silhouette / ground-floor cutaway /
visible VIP interior without hiding the staircase. No VIP currency or wagers added.

Venue-specific swept navigation derives stair height from movement on both server
and client. Ground-side stair entry, upper rail crossings and balcony exits are
bounded; jumps cannot bypass the enclosed venue. Ground-plane picking follows the
walker's height. Different-floor actors no longer push each other horizontally,
and opposite-direction walkers can pass on the narrow stair flight. Public seat
claims reject upstairs players, and upstairs clicking cannot select hidden public
chairs. Nearby physical landing button (44px minimum) and illuminated stair markers
start a normal walk up/down the steps, restoring ordinary control afterward.

Evidence: focused TestCasino PASS0.014s and Go build-all PASS. Initial navigation/
controller/map27tests PASS1.561s; updated stash/town/controller/map31tests PASS1.985s.
Final collision-push/passing/Trading House clearance checks use only the two changed
suites. Single390px rendered fixture uses real Fighter/Actor walking and full-size
collisions, climbs and descends via the actual landing button: PASS14.8s. Screenshot
/tmp/eidolon-casino-vip-stairs-20260913.png inspected. This is a prepared local venue,
not connected multiplayer/reconnect evidence or a completed VIP casino. Full actual
town placement, connected floor transitions and games remain release work.

Public slots and real-player poker now use the existing seated/wager lifecycle
in this local candidate; functioning VIP games await approved currency.
Retain events' actual-world/connected check and final1.10 integration scope.

## Slot rules candidate

Four differentiated elemental rule engines now implemented; see
[slot rules and next integration](2026-09-13-elemental-slots.md). Ten paylines,
secure weighted outcomes, fixed jackpot, Earth sticky wilds, Fire free-spin
multiplier, Water cascades, Air expanding reel and sealed narrative bonus choice.
Revisioned saveable free-spin/bonus state validates payouts and redacts offers.
Focused rules tests PASS0.006s/build-allPASS. Now Gold-wired with durable owner-bound
sessions, four physical cabinets and seated reel/bonus/free-spin UI, procedural
symbols, animations/audio and explicit paid-spin confirmation. Focused Mongo
recovery, authenticated socket spin/resume/restart and phone component checks pass;
see [slot handoff](2026-09-13-elemental-slots.md) for reusable evidence. Economic
sign-off and the connected full-town presentation check remain before release.

## Poker candidate

Two-to-six-real-player no-limit Hold’em with5/10Gold blinds, explicit per-hand
100–500Gold buy-in, private cards, complete streets/actions, side pots/uncalled
returns/ties, timers, folds, seat recovery and durable cash-outs. Connected
handlers and phone-sized seated UI implemented. See
[poker rules and evidence](2026-09-13-fourfold-poker.md) for passing focused checks.
Actual multiplayer network/full-town camera checks remain in the shared1.9
release review; do not repeat unchanged broad suites.

## Release dependency

1.8 CI34744510043 failed legacy dispatcher assertion;254d07ae updates that check
to validate the actual registry too, already merged into this WT as5dc982e0.
Replacement CI34744672300 failed one GuildPersistenceLifecycle Mongo connection
timeout in race pass; regular coverage passed and Mongo continued accepting
connections, no DATA RACE or server crash reported. Exact transient cause unknown.
Failed jobs retried ONCE on the same run; server/client/all browser shards passed,
but predeploy then failed on actual mixed indexed/non-indexed casino geometry:
table cylinders/boxes and slot octahedron gems could not share a material batch.
6acb6c4e normalizes batch inputs to non-indexed triangles and adds a real mixed
catalog regression (CasinoController4testsPASS1.365s/lint/diffPASS). Pushed from
frozen1.8, including an accurate1.8 patch-note bullet; merged here. New exact
CI34746925219 for6acb6c4e4260565233bf6999bd102be36b830838 has passed server/client,
all browser shards, predeploy, both deploy jobs and final live QA. Run is SUCCESS.
Both public release.json and healthz independently report this exact Alpha1.8.0
commit, with database ready. No further polling/rerun of these terminal jobs.
No1.9 publication/version bump until its complete feature batch is ready.
