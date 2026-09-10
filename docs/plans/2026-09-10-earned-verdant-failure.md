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

## Current follow-up — September 10

Primarybf8d36d6 includes the class-input/required Water-hunt corrections and the
earned equipment-upgrade helper with fuller equipment/ability/defense receipts.
The helper now selects strictly improving eligible bag gear through normal
dragging before bag disposal/training checkpoints and dungeon entry. This is QA
play behavior, not automatic player equipping. See
[earned upgrade policy](2026-09-10-earned-equipment-upgrades.md) and
[native equipment evidence](2026-09-10-native-equipment-upgrade-verification.md).

The integrated visual-release candidate subsequently exposed another intermittent
native ring drop failure (86642:2pass/1fail); slot artwork is a separate pointer
target even after parent-node stability was fixed. Its correction/verification
is proceeding on the release-integration branch and must be reconciled here
before another long earned replay. Earlier passing equipment fixtures do not
prove this interaction is fully reliable. Do not count a new replay as already
started or the original dungeon failure as repaired.

After that correction, rerun the earned route with the upgraded equipment and
complete diagnostics, retaining original seed/deadlines/death bounds. Appropriate
earned Wizard ability/resource use and actual full dungeon clear/manual reward/
Water handoff still require native evidence. No balance conclusion is established
by the prepared inventory fixture or the partial first-boss damage above.
