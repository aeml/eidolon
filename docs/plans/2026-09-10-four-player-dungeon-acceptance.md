# Four-player dungeon acceptance

The user requested party-based dungeon verification: Fighter tank, Cleric healer,
Wizard and Rogue DPS. A solo clear is no longer the primary viability gate.
The preceding solo story attempt was intentionally interrupted, not failed in
combat; its archive is `/tmp/eidolon-solo-party-pivot-GVgwK4`.

The explicit isolated `party-dungeon` route uses four independent browser
processes, ordinary account registration and guarded empty-account fixtures.
All are level30, with production-generated Common level30 equipment, canonical
unallocated base stats, a legal specialization and five ranks of primary mastery.
The Earth dungeon quest is prepared from the recorded story-gate fixture. No
claim is made that these characters earned their preparation. No invulnerability,
in-run grants, health overrides, boss kills or inside waypoints are permitted.
Natural town recovery/Well Rested before entry remains enabled.

The party forms through visible invitations. The Fighter leads normal ground
traversal and attacks; the healer targets injured allies with Healing Light;
both damage classes use actual target clicks and primary abilities. The existing
eight-minute encounter, sixty-second damage-stall and forty-minute expedition
limits remain. Check all four bosses, all rooms, each member's quest/rewards,
effective ally healing, damage receipts, and ordinary Recall/re-entry continuity.
First-pass failures must distinguish fixture/controller defects from game bugs
and actual party balance. Common-only gear is a conservative baseline, not a
claim that this is the optimal or required player build.

Pending: successful controller validation/full-clear result, individual
manual turn-in/relogin proof and an earned four-player campaign. This adds no
production gameplay change and is not a release/deployment receipt.

## First native run — informative failure, not a clear

Session20718 TERMINAL1 on080a363b, about5.6minutes. All four level30 clients
formed a party and entered the same generated run (seed-7981223469871274837).
The opening normal/elite rooms cleared and the Warden was attackable, reduced
from15000 to10932HP before the Fighter died. Recorded totals: Fighter5544damage
and2498damage taken; Cleric1634effective ally healing/13Healing Light casts;
Wizard3344damage/21Fireballs; Rogue5116damage/43Piercing Throws. All received471
Gold. No rejected casts. The helper's subsequent ordinary respawn means final
Fighter940HP/610MP are town values, not survival evidence.

Archive `/tmp/eidolon-four-role-first-proof-ve8uzL` contains report/results/log;
wrapper credential scan0 and copied-log remaining QA prefixes0. Owned services
and18580/18581/41980listeners were absent afterward. No later boss/quest claim.

The first controller omitted party town recovery and only used direct Healing
Light. At Warden entry the Fighter had168/555mana, subsequently falling to6.
The next controller uses ordinary whole-party Recall/rest/re-entry after a
cleared room when anyone is below80%HP/MP, checks each member's unchanged
instance/seed/rooms/inventory/Gold/quests, and rewalks the entrance route. It also
uses legal Guardian Embrace healing aura within its range, preserving critical
direct-heal priority, and latches deaths before automatic cleanup can hide them.
These are player-input strategy corrections; no balance or fixture buffs.

Second native18143 TERMINAL1 onf6fcddef: opening room cleared, no deaths,
Cleric666effective ally healing from Healing Light and Guardian Embrace, no
rejected casts. Town recovery worked, but the driver incorrectly expected a
resume request to transfer all four players. Production `dungeon_entry.go`
explicitly resumes only the requester; initial creation moves the group. Fix
the driver to use the guide for every remaining member, preserving the strict
same-run/content checks. Archive `/tmp/eidolon-four-role-rest-proof-HtoFTA`;
wrapper sanitized2files, copied-log scanner sanitized1file, zero remaining
QA prefixes; owned services/listeners removed. This is not a game entry defect.

Third native41896 TERMINAL1 on311b1a61: two complete four-person town recovery
cycles preserved each member's same run/content, and the Fighter reached the
Warden at855/855HP and555/555MP. No deaths/rejected casts. The healer's following
helper then aimed a full step toward the tank, ignoring its desired seven-unit
spacing; the ordinary ground-pointer helper refused the covered destination.
Fix the input plan to stop short, omit sub-unit requests, and use the leader's
existing typed covered-pointer handling without resetting any progress timer or
suppressing actual failed movement commands. This is not proof of broken game
collision or a boss balance result. Archive
`/tmp/eidolon-four-role-follow-proof-Y5tJpG`; wrapper scan and copied-log
sanitization completed, owned services/listeners absent. Focused server race
checks for concurrent/requester-only resume passed2.423s (87676).

Fourth native49218 TERMINAL1 on7d8fb5bb: all four players entered and two
whole-party town-rest/re-entry cycles preserved run/content. The Fighter again
started the Warden at855/855HP and555/555MP. The last reported boss health was
11344/15000 before the tank died. End combat totals were Fighter5902damage and
2021taken; Cleric1190effective ally healing, with only two Healing Light and two
Guardian Embrace casts (all before the boss); Wizard4357damage/30Fireballs;
Rogue3832damage/36Piercing Throws. The Cleric retained555mana. Repeated covered
ground-input skips coincided with the absence of boss healing. This supports
fixing the healer's approach/target controller, not declaring the party balanced
or nerfing the Warden to accommodate an inactive healer. Do not rerun unchanged.
Archive `/tmp/eidolon-four-role-spacing-proof-OCCodb` preserves report/results
and the copied log; both credential checks left zero QA prefixes and owned
services/listeners were absent after cleanup. No full-clear or final quest claim.

The subsequent [party-credit requirement](2026-09-10-party-kill-credit.md) removes
the dungeon proximity restriction: all connected party members still in the run
at the kill count, including downed players. Its prepared reward/ability tests
are separate from this still-open four-browser clear and earned campaign gate.

## Current post-clear contract

The four-role route now continues after the full clear with each character's
ordinary Ilyra Complete Quest and Continue conversation buttons. Every turn-in
must grant Gold and offer the first Water expedition without auto-accepting it;
remaining party members must still have unclaimed Earth completion. After all
four individual claims, each reconnects in a fresh document. The exact chapter
receipt and Gold balance must persist without duplicate rewards, and the Water
offer must remain unchanged. Combat metrics are saved before those page reloads.
The existing shared manual-turn-in helper is exported, not duplicated or bypassed.

Lint and Playwright discovery67718 passed for this extension; these are not
native turn-in/relogin evidence. Later native attempts and the corrected desktop
healing/warning-response controller are recorded in
[desktop party healing](2026-09-10-desktop-party-healing.md). The latest completed
attempt87906 proved real healing but wiped at the first boss; no post-clear
assertion has yet been reached by the browser party.

Native62541 onf8d9bf2d ended TERMINAL1 after1.8minutes, before the first room
cleared. Four hotbars, party UI, roster select/clear and same-instance entry
passed. The tank pulled three Skeletons while the healer was40.024 units away;
successive approach decisions were28.016 and15.160 units, with tank HP707,
374 and40. Cleric had610mana, no casts/healing/rejections. Tank took1018 damage
and died; all Gold remained0. No boss warnings occurred, so this does not test
the quake response or disprove the previously observed roster healing.
Archive`/tmp/eidolon-four-role-quake-proof-aahV7A` contains report/results/log;
wrapper and copied-log scans left0 QA prefixes; owned services/listeners gone.

The traversal callback issued one follower step after the leader's movement
helper witnessed just one unit, although leader steps could be14 units and
followers capped at12. Arrival was never synchronized, allowing a gap to grow
before the opening Charge. The corrected test waits for the leader's actual
waypoint arrival, then repeatedly reads all positions and uses ordinary inputs
until every follower is within the four-unit formation margin. Gathering has a
15-second bound and fails on death or a stalled follower; original expedition
and combat deadlines remain. Focused26340 passed69 tests/3suites1.041s plus lint,
including witnessed catch-up, blocked timeout and death rejection. Native
formation/quake/full-clear/turn-in verification remains pending.

Native96142 on4c962541 ended TERMINAL1 at the Warden, last reported2676/15000HP.
The party cleared two rooms and completed two all-four town recovery/resume
cycles with unchanged run/content. Fighter recorded7855damage/3765taken,
Cleric4541effective ally healing, Wizard6281damage and Rogue6610damage; all487Gold.
There were no rejected casts. Warning moves/full-radius escapes were12/7 for
Fighter,8/6 Cleric,2/2 Wizard and3/3 Rogue. These demonstrate actual escape inputs,
not universal dodging or a full clear. The tank's final town940HP/610MP are cleanup
respawn values; its observed-death latch is true. Archive
`/tmp/eidolon-four-role-gather-proof-jONZ3R`; wrapper/copy0 QA prefixes, owned
containers/listeners absent after terminal. Screenshots are not pixel-redacted.

The warning controller paused all four roles whenever any warning was active,
including safe ranged players. The next policy permits healing and in-range
primary casts from a witnessed safe position, while forbidding follow/chase/basic
approach inputs until warnings expire. Unsafe actors still prioritize escape and
the tank still holds melee. Three policy cases plus prior navigation/control
coverage passed72 tests/3suites1.046s and lint (31312). No combat numbers, gear,
regeneration, reward formulas or deadlines change. Native verification remains
pending; this policy is not by itself evidence of encounter balance.

Native60485 once2040fd ended TERMINAL1 after15.7minutes. Two rooms and two
all-four recovery/resume cycles passed. Warden's last reported health2665/15000,
tank171HP/10MP; Fighter and Rogue later had observed deaths. Final receipts:
Fighter7771damage/4701taken, Cleric7764effective ally healing/3976taken,
Wizard7595damage/2632taken, Rogue8549damage/3352taken; all692Gold, no rejected
casts. Moves/full-radius warning escapes:18/9 Fighter,14/11 Cleric,8/8 Wizard,
11/11 Rogue. Cleric ended8mana and its final decisions lacked enough mana to
heal. Fighter's final town940HP/610MP are cleanup respawn values, not survival.
Archive`/tmp/eidolon-four-role-safe-casts-proof-rwErPR`; wrapper/copy0 QA prefixes,
owned services/listeners absent. Full clear and manual turn-ins remain unproven.

Fighter recorded15 Charges at20mana each across the run, including repeated
returns after warning escapes. The next ordinary-input strategy reserves Charge
for gaps above18 units (its actual base range is28), retaining normal movement
for shorter returns from the12.5-unit quake. The shared primary-input selector
keeps existing default hunt behavior and ranged casts unchanged; only this party
route opts into the reserve. Five additional policy cases plus existing combat,
formation and ranged controls passed87 tests/3suites0.94s and lint (73196).
This does not grant resources, alter combat values or relax deadlines. Its
native outcome remains pending while the separate release backport runs Go QA.

Next controller correction uses existing Shift-click move-only walking while
following: foreground actor models no longer redirect the movement input into
combat. Physical collision and witnessed displacement remain enforced, with no
jump fallback. Direct healing now uses its actual cast range with a safety
margin; the ten-unit aura still requires close proximity. Before an ally heal,
the driver samples up to six points on the real hitbox and verifies the actual
hovered entity, instead of mistaking a canvas-visible but boss-covered point
for the ally. It never assigns hover state or sends ability commands directly.
Focused84936 passed29 tests across3 suites0.957s plus lint. These changes need
the next native run; no new clear or improved boss-healing claim yet.
