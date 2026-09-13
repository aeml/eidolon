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

## Release dependency

1.8 CI34744510043 failed legacy dispatcher assertion;254d07ae updates that check
to validate the actual registry too, already merged into this WT as5dc982e0.
Replacement CI34744672300 failed one GuildPersistenceLifecycle Mongo connection
timeout in race pass; regular coverage passed and Mongo continued accepting
connections, no DATA RACE or server crash reported. Exact transient cause unknown.
Failed jobs retried ONCE on the same run; currently server tests IN_PROGRESS,
client prior PASS reused. Monitor same run, do not blindly repeat.1.7e84f6219
remains last verified live. Release corrections belong in frozen1.8WT, then merge
here. No1.9 publication/version bump until1.8 passes and is verified live.
