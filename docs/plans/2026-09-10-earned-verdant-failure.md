# Earned Verdant attempt — first boss failure

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

## Next diagnostic action

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

The separate class-input and required Water-hunt corrections still require
integration after regression. The stale Water assertion was never reached and
did not cause this failure. Corrected runs must earn their own native acceptance;
all classes/groups, realms, raids, balance and phone gates remain required.
