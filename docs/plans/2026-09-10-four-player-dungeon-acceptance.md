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

## Latest result — guide re-entry, September10 21:29

Charge-reserve run46761 on clean02d30584 ended after7.1minutes at the second
town return, before the Warden. All four remained alive with477Gold each.
Fighter3872damage/847taken, Cleric1175effective ally healing/0taken,
Wizard3167damage/452taken, Rogue3004damage/240taken; no rejected casts and no
Charge casts in this early segment. The first room and complete four-person
recovery/resume succeeded; the later guide projection failed for a member at
dungeon-guide.js:48, called from the per-member resume loop. There is no boss
strategy or full-clear result. Archive
`/tmp/eidolon-four-role-charge-reserve-proof-yQ6cln`; scan passed and owned
services cleared. Final full town resources must not be treated as combat data.

24ef041d corrects an independently demonstrated approach sequencing limitation:
the generic ground helper witnesses movement, not waypoint arrival. The guide
controller now finishes each waypoint and camera follow before another step,
uses ordinary Shift-click walking, retains four steps and actual hover/click
checks, and records early projection/loaded-NPC/DOM coverage failures. Per-member
re-entry logs identify class and phase without account identifiers.32 focused
tests/3suites1.365s and lint passed (35443); route lint/shell/discovery87783 passed.
This did not prove the previous failure's root cause; its old log lacked those
early visibility diagnostics. No combat, gear, resources or global deadlines changed.

The separate focused route59146 on clean24ef041d passed2.6minutes: four ordinary
registrations with explicit QA level30 entry eligibility, real invitations,
initial group dungeon entry, then three full-party recalls and twelve individual
guide resumes to the same instance. Both navigation and browser-failure checks
passed; no combat or earned progression is claimed. Archive
`/tmp/eidolon-party-guide-reentry-proof-bglqIQ`, log
`/tmp/eidolon-party-guide-reentry-native.log`; scan passed and owned ports cleared.
The focused result supports returning to the unchanged full-clear acceptance
requirements; all bosses, rewards, individual manual turn-ins and relogin remain.

## Latest full-party result — September10 22:08 checkpoint

42295 on cleanfad742f1 ended TERMINAL1 after16.4minutes. Two rooms and both
four-person town recovery/individual guide resume cycles passed with exact
instance/seed/rooms/Gold/inventory/quests retained. Seed1981447043613537575,
generator2, no fallback. The Warden started15000HP and was last reported3247HP
before Rogue and Wizard deaths. Fighter and Cleric survived; no full clear,
post-clear boss-credit, manual turn-in or persistence claim.

Totals: Fighter9336damage/4929taken, Cleric7504effective ally healing/3128taken,
Wizard6931damage/3120taken, Rogue7545damage/2808taken. All597Gold; no rejected
casts. Fighter used3Charges,4Iron Fortress,17Whirlwind,13Shield Slam. Cleric
used16Healing Light and7Guardian Embrace and retained106mana. Wizard used38
Fireballs and Rogue63Piercing Throws. Death observations remain latched; cleanup
resource values must not be treated as combat survival evidence.

Warning moves/eventual escapes were12/11,9/9,6/6,6/6 respectively. The current
counter does not prove escape occurred before impact. Inspect timing/position
evidence and the unused legal DPS defensive/support skills before drawing a
balance conclusion. Source inspection also found the boss slam directly
subtracts HP rather than using ordinary Arcane Shield absorption; this needs
focused reproduction, and cannot explain this run through shield bypass because
the Wizard never cast that shield. The telegraph center is captured at warning
creation and does not follow the boss.

Archive`/tmp/eidolon-four-role-guide-clear-proof-mb3bxE` retains report/results/log;
artifact scan passed, copied-log QA-prefix count0, owned listeners cleared.
Screenshots are not pixel-redacted. No encounter, gear, regen or deadline changes
were made in response to this result.

## Follow-up: real defense fix and better role evidence

[The slam defense regression](2026-09-10-boss-slam-defenses.md) reproduced an
actual game defect and now passes focused race checks; full server68058 remains
active at this checkpoint. It does not retroactively explain42295 through a
shield the controller never cast.

The party controller now selects the equipped Wizard Arcane Shield when injured
and Rogue Poison Coating while fighting, checking the actual loadout, mana cost,
cooldown, active buff and recent accepted cast. It uses ordinary self-positioned
hotbar keys only after warning policy allows casting; escape remains first.
No fixture, stats, damage, deadlines or progress assertions changed.

The read-only warning observer records first safe position before the advertised
impact, latest position safety (including re-entry), and the last twelve damage
events with observed position/distance/time relative to recent warnings. Existing
eventual-escape counts are retained, but are no longer the only timing evidence.
These are client observations, not server-authoritative proof of dodging.
Focused26401 passed67tests/3suites1.469s plus lint; discovery37006 found the one
intended four-player route. Logs`/tmp/eidolon-party-defense-controls-{client,lint,discovery}.log`.
Native use and full-clear acceptance of these changes remain pending.

## First surviving Warden — terminal navigation failure, September10 22:46

62131 on cleana5320d74 ended TERMINAL1 after23.4minutes. Two opening rooms and
the Rootbound Warden were cleared with all four alive. Three complete all-four
town recovery/individual guide-resume cycles retained the same seed/rooms/Gold/
inventory/quests. Seed-2339742150727221791, generator2, Normal30, no fallback.
The Warden's last pre-kill report was361HP with the tank158/855HP and20mana;
the subsequent defeat and boss receipt were recorded. Boss-only totals:
Fighter4603damage/3833taken, Cleric6600effective ally healing/3864taken,
Wizard3943damage/736taken, Rogue6461damage/3680taken. This is real four-browser
combat evidence, not a prepared kill grant or a full dungeon-clear receipt.

The later failure was `Party failed to gather before the next pull` during
travel after the third recovery. No deaths or rejected casts were observed.
Run totals: Fighter7846damage/4348taken; Cleric7221effective ally healing/3864
taken; Wizard6448damage/1022taken; Rogue10833damage/3920taken. All740Gold.
Wizard used4Arcane Shields/34Fireballs; Rogue8Poison Coatings/51Piercing Throws.
Fighter used7Charges/4Iron Fortress/15Whirlwind/12Shield Slam; Cleric17Healing
Light/8Guardian Embrace. Final full resources reflect town recovery/cleanup,
not the resources remaining immediately after the boss.

Warning moves/eventual escapes/observed early escapes, by the same role order:
23/17/6,18/18/5,8/8/2,20/18/5. Recent damage records frequently show the player
inside the circle near its advertised impact time, without an observed early
escape. These client-timed positions are not server-authoritative dodge proof.
The old eventual-escape counts substantially overstate observed timely escapes.

Archive`/tmp/eidolon-four-role-defenses-proof-Mcelgz` retains report/results/log;
artifact scan passed and copied-log remaining QA-prefix count0. Owned API/Mongo
containers and18580/18581/41980listeners were absent after terminal cleanup.
No later bosses, full quest claim or fresh-login acceptance was reached.

The formation controller's direct chord can cross an L-shaped hallway corner
even when the leader used the canonical route. A focused geometric regression
demonstrates that weakness, but the old failure did not retain positions to
prove it was the exact cause of62131. The revised planner checks the full real
collision path; if the direct segment is blocked, it approaches the leader's
previous settled position first. Formation inputs cannot substitute an unchecked
side vector or jump. Recovery resets this navigation anchor at the actual resumed
entrance, not progress/instance state. Failures now record each role's position,
movement target, blocked-stop count and previous anchor, then rethrow the failure.
The fifteen-second gathering and all combat/expedition limits remain unchanged.

Focused95228 passed55tests/3suites1.434s plus lint. A subsequent arrival-race check
ensures a follower that arrives between shared and per-browser reads is checked
again rather than falsely failed or declared gathered. Final95167 passed56tests/
3suites0.852s plus lint and single-route discovery. Logs
`/tmp/eidolon-party-corner-final-{focused,lint,discovery}.log`.
Native corner-following and full-clear/manual/relogin acceptance remain pending.

The subsequent geometry check replays62131's exact production seed with the
existing `TestReportedDungeonSeed` command (89356 passed; log
`/tmp/eidolon-party-formation-seed-replay.log`). The saved layout contains12rooms,
11corridors and29walk rectangles. A Go companion prevents the saved fixture
drifting from the production generator:42904 race passed1.360s, log
`/tmp/eidolon-party-formation-fixture.log`.

Client33064 passed29tests/2suites5.976s plus lint. The new case builds the actual
Verdant world/collision shapes, then verifies three full-size followers through
every canonical join of this seed with the revised planner. Log
`/tmp/eidolon-party-formation-geometry.log` and corresponding`...-lint.log`.
This is a deterministic geometry check with idealized arrival, not a recreation
of the unknown failure position, network/camera timing or complete native party
movement. It must not be used to claim62131's exact cause or a full-clear pass.

## Short-arrival failure —1157, September10 23:10

1157 on cleanedc7503a terminated1 before combat after all four setup/roster/
same-instance checks passed. Seed6747352009075544054, generator2, Normal30,
no fallback. All remained alive, no casts/rejections, Gold0. Unlike62131, this
failure retained the requested input, actual position, camera/mesh offsets and
all party positions.

Cleric started(19999.86762066857,19957.67491337919), requested a1.805-unit step,
and stopped at(20000.02804926322,19956.801398267533), a0.888125-unit displacement.
The Fighter was(19999.835235237577,19951.8698252471): the Cleric was already
within the existing five-unit gathering boundary, but the generic movement
helper required more than one unit. Camera/mesh offsets were0, targets cleared,
Cleric blocked-stop count3. Its requested destination overlapped the nearby
Rogue's standard collision body. This is not a boss, camera or terrain result;
it demonstrates the mismatch between the helper's displacement assertion and
the formation's actual arrival condition.

Archive`/tmp/eidolon-four-role-corners-proof-83inuh` retains reports/results/log;
wrapper scanned2files, copied log sanitized and remaining QA-prefix count0.
Owned18580/18581/41980listeners were cleared. No dungeon clear/quest claim.

The optional movement arrival region now lets this formation input complete
after a real click when the living player is observed inside that explicit
region in the same scene. Ordinary callers still require their original minimum
displacement. No covered-pointer/no-input or unachieved arrival is accepted as
movement success. The formation still rereads all actual positions and enforces
its existing radius and15-second deadline. Exact1157 coordinates, unchanged
ordinary short-movement failures, unachieved arrival, invalid regions, death,
wrong scene and real Shift input are covered.28066 passed57tests/4suites1.068s
plus lint and single-route discovery. Logs
`/tmp/eidolon-party-arrival-{focused,lint,discovery}.log`.
This changes test inputs/evidence only; native full-party acceptance remains open.

## Actor-aware formation follow-up —69808

69808 on clean04b68c5a ended TERMINAL1 after1.1minutes, before combat, with
seed-5640445871472287783/generator2/Normal30/no fallback. Setup, visible party
and same-instance entry passed. Its arrival predicate correctly did not accept
the failed Wizard step: requested12units, observed0.712units, remaining about
17.77units from the tank. Camera/mesh offsets0, no pending movement target,
Wizard blockedStops4. Two preceding no-clear-input observations were retained.
This was not the already-within-formation1157 case, and is not a combat verdict.

Archive`/tmp/eidolon-four-role-arrival-proof-t2IlWC` retains reports/results/log;
wrapper scanned2files, copied log sanitized with0QA prefixes remaining, owned
18580/18581/41980listeners cleared. Its failure captured each player's own
position, not all collision actors as seen by the Wizard. Do not claim a proven
specific blocker or camera cause from that missing observation.

Static walking checks omit actor capsules. The planner now also checks the
client's active living actor bodies, permits separation from an existing overlap
without walking deeper into it, and tries checked gathering-circle alternatives
before a short checked lateral detour. No unchecked vector/jump is allowed.
Coincident spawn positions can separate. Failure diagnostics now include nearby
actor positions/radii as seen by each affected client, without account IDs.
The exact instance ID now accompanies arrival regions; the group also rejects
cross-instance positions even if their coordinates match. This supersedes the
earlier helper's scene-type-only guard without changing ordinary displacement
checks, fifteen-second gathering, combat/expedition limits or gameplay collision.

Initial69300 passed55tests/4suites5.097s plus lint. Final87372 passed64tests/
5suites5.104s plus lint and single-route discovery, including occupied gathering
points, a checked side step around a nearby body, coincident/overlapping actors,
the recorded production floor geometry, exact-instance arrival and ordinary
movement failures. Logs`/tmp/eidolon-party-body-final2-{focused,lint,discovery}.log`.
Full client regression on952b835e subsequently passed315suites/4359tests in
140.563s; no Jest/eslint process remained at recovery. Log
`/tmp/eidolon-party-body-full-client.log`. Lint produced no errors; an explicit
confirmation72582 also terminated0, log
`/tmp/eidolon-party-body-full-lint-confirm.log`. Native formation/full-clear
acceptance remains pending; unit success is not native party movement proof.

## Concurrent destinations —7703, September10 23:33

7703 on cleana1138def ended TERMINAL1 before combat. Seed-7673813163550020757,
generator2/Normal30/no fallback; all four setup/party/same-instance entry checks
passed. All alive, Gold0, no casts. Rogue requested a three-unit lateral move,
observed0.649744units and failed the unchanged displacement/arrival conditions.
The captured Cleric and Wizard both ended at exactly the same logical location
(19996.855299818162,19990.019934266693); Rogue's requested position was also
that side of their shared starting point. Every follower had planned against
the same earlier body snapshot, then all moved concurrently. A path clear of
stationary actors is not a reservation against another concurrently chosen path.

Archive`/tmp/eidolon-four-role-bodies-proof-5eE8As` retains reports/results/log;
wrapper scanned2files, copied-log QA-prefix count0, owned containers and
18580/18581/41980listeners absent. No combat/fullclear/manual/relogin acceptance.

Two focused tests first failed as expected (13430): concurrent planning launched
three moves together instead of one, and the recorded0.000712-unit replicated
spawn offset forbade departure in a direction the actual collision system treats
as coincident. Formation now plans/awaits one follower move at a time and rereads
positions before the next plan. The native move waits for the issued destination
to settle; observed formation position, not issued input, remains completion.
The body's coincident threshold now matches CollisionManager's existing0.001;
larger overlaps retain the away/tangent-only check. No game collision, resources,
gear,15-second gathering deadline or combat/expedition limit changed.

14476 passed66tests/5suites5.148s, lint and single-route discovery. Logs
`/tmp/eidolon-party-sequential-{focused,lint,discovery}.log`. Native success remains
required; a controller regression pass does not establish dungeon playability.

## Leave a lane for the last follower —84516

84516 on clean9c7beca3 terminated1 after1.4minutes, before combat, with
seed-2687562139384423444/generator2/Normal30/no fallback. Setup/party/exact entry
passed, all alive,0Gold/damage/casts/healing. Sequential moves avoided7703's
identical concurrent destinations, but a later gathering hit the original15s
deadline. Tank(19999.89858,19935.90542), Cleric(19998.32794,19939.57916),
Wizard(20001.21175,19939.63453), Rogue(19996.86634,19949.90267). The first two
followers occupied the rear approach; the Rogue was still outside formation.
All targets cleared/blockedStops0/camera and mesh offsets0. Do not call this a
combat verdict or infer a terrain defect from these observations.

Archive`/tmp/eidolon-four-role-sequential-proof-t4HuMT` retains reports/results/
log, wrapper scanned2files/copied-log QA-prefix count0/owned containers and
18580/18581/41980listeners absent. No fullclear/turn-in/relogin acceptance.

The earlier geometry regression ignored other follower bodies. Adding those
bodies to all canonical joins of the recorded62131 layout exposed a reproducible
gathering failure (82071 RED); this is not a recreation of84516's network timing
or a claim that its different seed was replayed. Distinct path-oriented side/rear
slots now leave a lane for the last arrival. Initial slots at radius4 still
failed one later join (78193/23106); placements now aim at4.5, half a unit inside
the unchanged existing<5 arrival bound, and check finer alternatives inside it.
All segments still require real floor and actor clearance. Same sequential
observed moves,15s deadline, combat/expedition limits, resources and gameplay
collision; no assertion weakened or actor moved by state assignment in native QA.

71222 passed37tests/2suites8.688s including the new body-aware complete fixture.
Final40104 passed68tests/5suites9.020s plus lint and single-route discovery, also
covering distinct separated slots and unchanged ordinary movement assertions.
Logs`/tmp/eidolon-party-slots-final-{focused,lint,discovery}.log`. The geometry
test still assumes ideal arrival; native party clear and earned campaign gates
remain mandatory and open.

## Warden survives; post-fight gathering still fails —99535

99535 on clean229cbdd8 terminated1 after15.7minutes. Seed6347868825596501926,
generator2/Normal30/no fallback. All four entered, cleared the two opening rooms,
completed two full-party town recovery/individual guide-resume cycles with exact
progress retained, and defeated the15000HP Rootbound Warden. All four had655Gold,
no observed death and no rejected casts. Manual final chapter claims were not
reached. The later formation failure is not a combat death or full-clear result.

Boss-only damage/taken: Fighter5057/1458, Wizard3691/920, Rogue6261/736;
Cleric3041effective ally healing/1288taken. Full-run damage/taken: Fighter9152/2367,
Wizard6275/920, Rogue11138/1096; Cleric4244effective ally healing. Accepted casts:
Fighter4Fortress/14Whirlwind/14ShieldSlam/4Charge; Cleric9Embrace/7Light;
Wizard33Fireball/2Shield; Rogue6Coating/50PiercingThrow. Final tank940HP/123MP
includes normal cleanup/town recovery and must not be described as boss reserves.
The last pre-defeat tank report was855HP/14MP with260bossHP remaining.

The run then hit the unchanged15s formation deadline while walking after the
boss, before a third town-rest receipt. At failure the Cleric and Wizard were
inside the formation radius; Rogue was near the previous anchor about14units
behind the tank. All targets cleared, camera/mesh offsets0; ClericblockedStops6,
others0. Per-move timings were not recorded, so the exact time spent planning,
retrying or moving each follower cannot be reconstructed from this run alone.
Archive`/tmp/eidolon-four-role-slots-proof-8rI0vh` retains reports/results/log;
wrapper scanned2files, copied-log QA-prefix count0, owned containers and
18580/18581/41980listeners absent.

Focused62919 RED demonstrates a controller scheduling limitation: three disjoint
six-second moves exceed the existing15s deadline serially even though they can
finish together. The controller now batches only routes whose entire swept
actor circles are disjoint. Shared spawn origins, intersecting/overlapping
routes, insufficient body clearance and invalid segments cannot run together.
Reservations use each browser's actual planning origin, not an older group
snapshot. Existing real terrain/body checks and distinct gathering slots remain.
After all issued moves settle, actual positions are reread before any next batch
or completion; one input error still fails after other issued inputs finish.

Bounded failure diagnostics now retain planned origins/deltas, batch membership,
elapsed times and promise outcomes. A fulfilled input hook is not an arrival
receipt: actual living same-instance positions remain the only completion test.
No gameplay, resource, equipment, formation radius,15s deadline, combat or total
expedition limit changed. This scheduling test is not proof that concurrency
alone explains every second of99535's failure.

Final39738 passed82tests/5suites8.782s, lint and single-route discovery, including
full recorded terrain with follower bodies, crossing/collinear/near-end/shared-
origin reservations, fresh planning origins and error propagation. Logs
`/tmp/eidolon-party-batch-final2-{focused,lint,discovery}.log`. Native full-clear,
manual turn-in/relogin and earned campaign acceptance remain open.
