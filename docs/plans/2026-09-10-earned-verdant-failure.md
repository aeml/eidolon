# Earned Verdant attempts — first boss failures

Status: failed native attempt; dungeon completion remains unaccepted.

Session96530 exited1 on frozen626385d7674d00fb9fb5bc3f0f841ce5972c8a58.
Run `fresh-story-dungeon-0910` used a fresh isolated Wizard, ordinary town
recovery, zero retries, no daily leveling and no prepared grants/waypoints.
All eight Earth readiness phases passed; earned level31 entered normal level30
Verdant. The dungeon phase failed after243,140ms on the survival assertion.
The wrapper's actual credential scan passed, sanitizing zero files. Neither
owned API nor Mongo container remained in a subsequent `docker ps` check.

Log: `/tmp/eidolon-fresh-story-dungeon-replay.log`.
Preserved report, test results and log:
`/tmp/eidolon-fresh-story-dungeon-failure-6JR0iz`.
Replay seed6046050058853350476, generator2, attempt0, no fallback.

## Evidence and limits

Three initial Skeletons were defeated through actual attacks. Rootbound Warden
spawned and took damage: observed health15000→14513 before the character died.
This boss was attackable in this run; its defeat, subsequent room/boss spawning,
full clear, manual dungeon reward and Water handoff remain unproven.

Mana was nearly exhausted before the boss. Well Rested expired naturally,
reducing maxHP979→890; observed basic damage was11. The death diagnostic records
five183-damage physical hits from the Warden, not a timeout or server stall.
The later failure receipt was gathered after the game's town transition; its
restored resources are not the character's health/mana at the moment of death.

## Original diagnostic findings

`earned-equipment.js` and `earned-gear-and-stats.js` intentionally fill only
empty slots and never upgrade occupied ones. Bag management uses the same
empty-slot behavior before selling/storing spare equipment. This route therefore
does not exercise normal equipment upgrades during campaign progression. That
is a verified harness limitation, not proof that a particular spare item was
better or that upgrades alone would make this encounter beatable.

The character unlocked Teleport, Arcane Shield and Gravity Well. Dungeon Wizard
defense leaves crowd control disabled by default. The failure diagnostic lacks
defense counters and complete equipped-item stats. Capture these and exercise
appropriate earned equipment/ability use through ordinary UI before concluding
balance changes are necessary. Retain item identities, replacement/persistence
checks, original failure evidence and all encounter/death limits. Do not grant
gear, raise regeneration or weaken bosses merely to pass the harness.

The stale Water assertion was never reached and did not cause this failure.
Corrected runs must earn their own native acceptance; all classes/groups,
realms, raids, balance and phone gates remain required.

## Second native attempt — September 10, 11:35 UTC

Session44188 TERMINAL1 on clean/frozen4b3991ffea239bb3152ea93263fbc0bbe95c05a3.
RunID `earned-upgrade-story-0910`; archive
`/tmp/eidolon-earned-upgrade-failure-sQmC8N` retains test-results, report and
`run.log` copied from `/tmp/eidolon-earned-upgrade-story-replay.log`.
Actual wrapper credential scan passed with0sanitized files; owned containers
and API18590/Mongo18591/web41990 listeners were absent after completion.
No boss-fight screenshot was captured; retained PNGs cover earlier story stages.

All8readiness phases passed in3298052ms (~55minutes), without deaths or daily/
fixture progression. Real earned replacement receipts include mainhand, chest,
shoulders, legs, offhand and trinkets. Entered normal30 at earned31 with1254HP
and737mana; ordinary WellRested expiry reduced those boosted maxima. Seed
**-1263584004433865125**, generator2, attempt0, no fallback. This is a different
ordinary layout, not a forced reproduction of the original seed.

Three Skeletons and a4130HP DemonOrc were defeated. Warden15000→at most9505
observed HP before death. Last boss maximumHP1165, basicdamage22. Character
remained at full health for several minutes while retreating and dealing slow
low-mana damage, then died to **seven177-damage physical hits in23.533seconds**.
Death position(20035.233783749074,19771.176993562265), mana12. Dungeon phase
failed after649337ms on survival, not an eight-minute timeout or world stall.
Defense counters:187retreats,39acceptedFireballs,0rejectedFireballs,0shields,
0rejectedShields,0GravityWells,0crowdJumps. Teleport/ArcaneShield/GravityWell were
unlocked and in the hotbar. Nearly empty mana before the boss is observed; a
specific terrain trap or optimal-build conclusion is not yet established.

This proves the upgrade helper was used and improved this attempt's observed
damage/survival, but not that gear alone solves the encounter. The different
seed also prevents attributing the entire improvement to gear. Both failed
attempts remain authoritative. No first-boss defeat, later boss spawning, full
clear, manual dungeon reward/raidaccess/save or Water handoff is accepted.

### Next diagnostic work, before another long fresh run

1. Reproduce recovery and appropriate earned ability use in short explicitly
   prepared diagnostics. Existing town Recall/dungeon resume are normal game
   affordances; investigate between-encounter recovery without resetting a run,
   granting resources or erasing cleared-room/loot/quest state. Do not silently
   switch the failed run to another strategy or claim it passed.
2. Inspect retreat reachability and hostile body spacing. The old death receipt
   lacks final target positions, room/walk geometry and damage-event positions.
   A new read-only diagnostic now captures those facts on future failures, with
   detached geometry and no player names/IDs in the spatial snapshot. Focused
   tests14053 passed13/2suites0.757s plus lintNode24; full/native verification of
   that instrumentation remains pending. Logs
   `/tmp/eidolon-dungeon-spatial-{unit,lint}.log`. It does not change combat input,
   damage, resources, survival or timeout bounds and is not a gameplay fix.
3. Evaluate resource use, kit/build, observed damage rate and encounter tuning
   together, including other classes and parties. Do not raise .01 passive
   regeneration, fabricate gear, weaken a single boss or extend timeouts merely
   to produce green QA. Town-rest gameplay must retain the user's intended role.
4. Preserve original full-clear/manual-reward/save/Water requirements. Only run
   another ordinary fresh campaign after short diagnostics justify the change.

## Historical follow-up preceding the second attempt

Primarybf8d36d6 includes the class-input/required Water-hunt corrections and the
earned equipment-upgrade helper with fuller equipment/ability/defense receipts.
The helper now selects strictly improving eligible bag gear through normal
dragging before bag disposal/training checkpoints and dungeon entry. This is QA
play behavior, not automatic player equipping. See
[earned upgrade policy](2026-09-10-earned-equipment-upgrades.md) and
[native equipment evidence](2026-09-10-native-equipment-upgrade-verification.md).

The integrated visual-release candidate subsequently exposed another intermittent
native ring drop failure (86642:2pass/1fail); slot artwork was a separate pointer
target even after parent-node stability was fixed. A native hit-target assertion
failed all3baseline cases. Pointer-transparent decorative equipment artwork then
passed all3drag/refresh/login cases and Forge on release runtimec3305ae7, with
actual credential scan and retained artifacts at
`/tmp/eidolon-visual-equipment-hit-proof-sqU6uz`. The3fileCSS/test correction is
now ported here in25495d95. Its main-branch full regression is required before
another long earned replay; release-branch acceptance does not replace that gate.
At that checkpoint no new replay had started and the original failure remained
unrepaired; the subsequent44188 result is recorded above.

After that regression, rerun the earned route with upgraded equipment and
complete diagnostics. Preserve the original failed seed receipt and all original
deadlines/death bounds; record the new ordinary run's generated seed, rather than
claiming the route forces the original seed. Appropriate
earned Wizard ability/resource use and actual full dungeon clear/manual reward/
Water handoff still require native evidence. No balance conclusion is established
by the prepared inventory fixture or the partial first-boss damage above.
