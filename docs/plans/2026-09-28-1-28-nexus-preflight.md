# Alpha 1.28 — the Nexus is not the expedition portal

Local versioned implementation, not published. Keep these changes out of the
1.26 repair and1.27 publication: AtlasQuestMarkers, QuestUI, DungeonPreparation,
UIManagerDungeon, NexusJourney tests, DungeonProgressionMenu tests, raid-menu
Nexus cases/direct-description selectors and this record.

## Demonstrated gaps and changes

Active Fifth Note/Dark King quest markers previously pointed to the Fourfold
Portal in town, while actual private Nexus/court admission uses the Dungeon
Guide. Those active contracts produced no return/admission guidance from inside
the shared expedition. Markers now select the actual town Guide. Inside the
Dark Realm they select camp and explicitly instruct Recall/Return to Lanternhold;
the camp marker is NOT a fictional dungeon door. Ready quests still select local
Ilyra for manual claims, and no private-run coordinates leak onto another map.

The existing selected-dungeon preparation disclosure now contains Nexus-only
details: Dissonant Herald → Null Architect → Eidolon Devourer, intervening rooms,
MEMORY FRACTURE and leaving its marked circle, personal story/level eligibility,
same-run checkpoint recovery and manual Fifth Note completion before the court.
Selecting another dungeon hides this text; no action is sent by reading it.

For a character with an accepted, unclaimed Fifth Note, a completed Nexus route
now says Return to Ilyra in town, including compact tracking. Boss loot does not
open the court; each character must click Complete Quest. Veterans whose quest
is already claimed retain the normal loot/exit guidance, not another claim.
Incomplete bosses and town recovery/re-entry remain incomplete route states.

Sources: dungeon_instance.go/dungeon_runtime.go for guardian order;
dungeon_telegraphs.go for the warning and actual impact pattern; quests.go and
the Guide for personal court eligibility. Server encounter, movement, checkpoint,
five-minute empty-instance/fifteen-minute logout and reward logic are unchanged.
Prior earned geared-party Nexus acceptance retains its scope; no full clear replay.

## Evidence and remaining checks

46 focused Nexus/menu/preparation/atlas/Vigil checks passed3.215s, scoped lint
and whitespace passed. Three Nexus disclosure layouts passed13.6s at desktop,
portrait and short landscape. Portrait/landscape screenshots inspected at
`/tmp/eidolon-128-nexus-briefing/`: readable scrolling with entry and Close retained.
These are UI/snapshot checks, not new earned progression or real-phone evidence.

The earlier1.26 CI exposed broad disclosure selectors in an existing keyboard
test. Its isolated1.26 repair is separate. This future Nexus change adds nested
paragraphs, so its Bastion tests now explicitly select the direct description
paragraph rather than every hidden Nexus paragraph. All three affected Bastion
layouts passed18.2s at`/tmp/eidolon-128-bastion-regression/` without changing runtime
behavior or weakening the existing visibility/keyboard/entry assertions.

After merging the isolated1.26 keyboard correction, the full affected
raid-menu browser file passed all17 cases in1.6m at
`/tmp/eidolon-128-menu-integration/`. This checks the new Nexus disclosure
alongside prior raid preparation, family levels, party actions, desktop/phone
layouts and the complete keyboard focus/action loop. No new dungeon clear.

Final version/login/runtime/cumulative notes and focused packaging are complete:
347 checks4.48s, full lint and whitespace passed.1.29 remains in a separate
recovery stash, with only1.28 content restored in shared files.
Remaining: predecessor acceptance, publication and exact CI/live verification. No admission,
reward, save or campaign pacing change; human playtest and final art gates remain.
