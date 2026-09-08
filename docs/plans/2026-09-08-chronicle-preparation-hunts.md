# Chronicle preparation expeditions — unreleased candidate

The balancing request now has a 31-chapter implementation: the 15 original
milestones, eight investigation chapters and eight additional Ilyra expeditions.
This candidate builds on the coordinated XP/reward work, not the live server.
Counts and rewards below remain provisional until earned playtests establish
reasonable travel, combat and dungeon-entry pacing.

## Added chapters

| Chapter | Placement | Objective |
|---|---|---|
| Those Who Kept the Watch | After Mara's diary | 40 Earth Skeletons, level8+ |
| Ink That Walks | After the Memory Seeds | 60 Earth Imps, level20+ |
| The Borrowed Oath | After the returning scar | 50 Earth Demon Orcs, level30+ |
| The Ferry That Never Came | After the Bastion | 60 Earth Constructs, level40+ |
| Debts Beneath the Snow | After Dain's shelter | 60 Water Mountain Trolls, level50+ |
| A Current Without a Master | After the false reflection | 70 Water Aqua Golems, level55+ |
| Fuel for an Unending War | After the cold kiln | 35 Fire Magma Golems, level75+ |
| The Hours We Refuse to Lose | After the weatherkeeper's record | 30 Air Thunder Rocs, level80+ |

Each quest has authored acceptance, completion, history and retrospective
catch-up dialogue. The narrative follows Malachar's corruption of protection
into obedience: a watch forbidden to end, commands carried through living roots,
aid stranded behind erased permissions, kindness recast as debt, an endless war
and hours stolen from ordinary lives. The ferry starts in Earth deliberately:
the sealed supply route explains why aid never reached Water's flood shelter.

Clearing each original dungeon still unlocks its raid-road, not a repaired
crystal. All four complete raids and defended repair Vigils remain mandatory
before the Nexus and Dark King finale. Stable milestone IDs are unchanged.

## Authority, compatibility and reward limits

Only actual death-pipeline recipients gain hunt credit. Matching enemy type,
minimum level, overworld instance and authored regional spawn coordinates are
required. Dragging an enemy across a border cannot change its expedition.
Starter Skeletons cannot satisfy the harder watch. Party credit uses the existing
alive/range/instance checks and still requires each recipient's accepted quest.
Duplicate deaths do not duplicate credit; reaching the count does not turn in
the quest or grant its reward. Return to Ilyra and click Complete Quest.

New missing chapters behind an existing accepted/completed milestone become
optional catch-up content. Migration preserves existing progress, accepted
contracts, rewards and access; it does not mark added chapters complete or
silently turn existing required chapters optional. The journal and conversation
distinguish optional expeditions from investigation lore.

Canonical content is `server/internal/game/content/chronicle-hunts.json`, with
validated generated client text. Each hunt pays75% of its content level's next-
level XP threshold and10gold per content level. The full31-chapter authored
story totals1,774,073XP/20,300gold, excluding combat, dailies and other sources.
This arithmetic is not proof that every leveling band is playable.

## Verification and remaining work

Three race repeats of Chronicle/quest/collection/accepted-contract/daily checks
pass **10372 / root14.726s / database1.056s / game48.126s**. Initial failures
exposed stale23-chapter indices and old manual handoff fixtures; tests now check
stable dungeon/raid IDs and all31 manual advances. Extra actual-death party
scenarios pass **17722 / three race repeats /8.233s**, including nearby,
unaccepted, completed, far, dead and another-instance recipients.

Focused client four-suite baseline passes **50924 /23 tests /5.771s**. Dialogue
checks initially exposed old next-chapter assertions; corrected coverage plus
the optional-expedition UI check pass **43508 /44 tests**. Full lint49281
passed before the final test-only edits. Full client/server regression remains
required on the final integrated candidate.

The separately earned23-chapter reward route ends at level7 before a level30
dungeon. Do not call the preparation gap fixed from these unit tests. Next:
integrate the tested nearby-inspection key, adapt earned browser handoffs to
the31-chapter catalog, and play the new hunts without grants. Measure all-class
survivability, actual quest times, gear/inventory pressure, gold sinks and the
70–100 endgame approach. A rollback-compatible progression bridge and staged
release/patch notes remain prerequisites to activation. Nothing here is live.
