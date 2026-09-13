# Alpha 1.9.0 — a world that stays interesting

Active candidate branched from the packaged1.8 release595c07ff. Runtime stays1.8
until packaging; do not publish1.9 before1.8 CI/live verification completes.
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

Next content: differentiated lore-themed public slots and real-player poker using
the existing seated/wager lifecycle; functioning VIP games await approved currency.
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
all browser shards, predeploy and both deploy jobs; final live QA is IN_PROGRESS.
Both public release.json and healthz independently report this exact Alpha1.8.0
commit, with database ready. Monitor that run; don't rerun old failed34744672300.
No1.9 publication/version bump until its complete feature batch is ready.
