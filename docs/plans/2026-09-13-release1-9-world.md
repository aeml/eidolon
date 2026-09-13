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

At creation:1.8 CI34744510043 IN_PROGRESS for595c07ff4c543c4bae48907627ff3a72ae25d33f.
Monitor that exact run;1.7e84f6219 is last verified live and fully green. Any1.8
release correction belongs in its frozen worktree and should then merge here.
