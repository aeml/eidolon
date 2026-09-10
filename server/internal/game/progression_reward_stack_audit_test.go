package game

import (
	"fmt"
	"testing"
	"time"
)

// Reward accounting, not an earned dungeon clear: a prepared recipient receives
// the real four-boss death pipeline, then explicitly claims overlapping dailies.
// Excludes trash, room clears, story rewards and sales; do not label it the full
// run budget. This exposes stacking that a per-source XP multiplier can miss.
func TestProgressionPacingAuditOverlappingBossDailies(t *testing.T) {
	for _, difficulty := range []DungeonDifficulty{DifficultyNormal, DifficultyHeroic, DifficultyMythic} {
		t.Run(fmt.Sprint(difficulty), func(t *testing.T) {
			w := newTestWorld()
			const instanceID = "reward-stack-audit"
			level := MinLevelForDifficulty(difficulty, "verdant_bastion_catacombs")
			player := newTestPlayer("stack-recipient", "Wizard")
			player.Level, player.MaxExperience = level, experienceRequiredForLevel(level)
			player.Experience = 0
			player.BaseStats = applyLevelGrowth(InitialPlayerStats(), level)
			player.Inventory = make([]Item, MaxInventorySize)
			w.AddEntity(player)
			w.AddEntity(&Entity{ID: "quest-npc-1", Type: TypeNPC})
			w.GenerateDailyQuests(player.ID)
			ids := []string{"daily_dungeon_bosses", "daily_verdant_bastion_bosses"}
			if difficulty == DifficultyHeroic {
				ids = append(ids, "daily_dungeon_bosses_heroic")
			} else if difficulty == DifficultyMythic {
				ids = append(ids, "daily_dungeon_bosses_mythic")
			}
			for _, id := range ids {
				if _, ok := w.PerformAcceptQuest(player.ID, id); !ok {
					t.Fatalf("accept %s", id)
				}
			}
			player.InstanceID = instanceID
			layout := DungeonLayout{Rooms: []DungeonRoom{{Width: 40, Height: 40, Type: "boss"}}}
			w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID,
				Layout: layout, DungeonType: "verdant_bastion_catacombs", Difficulty: difficulty,
				RunLevel: level, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
			receipts := make(chan RewardSummaryEvent, 4)
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "reward_summary" {
					receipts <- value.(RewardSummaryEvent)
				}
			}
			startGold := player.Gold
			bossXP, bossGold := 0, 0
			for _, subtype := range []string{"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel"} {
				boss := &Entity{ID: "stack-" + subtype, Type: TypeEnemy, SubType: subtype,
					Level: level, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
				w.AddEntity(boss)
				boss.Mu.Lock()
				w.handleDeath(boss, player, nil)
				boss.Mu.Unlock()
				select {
				case reward := <-receipts:
					if reward.PlayerID != player.ID || reward.XP <= 0 {
						t.Fatalf("unexpected receipt: %+v", reward)
					}
					bossXP += reward.XP
					bossGold += reward.Gold
				case <-time.After(5 * time.Second):
					t.Fatal("missing boss receipt")
				}
			}
			player.Mu.Lock()
			levelAfterBosses := player.Level
			player.InstanceID = "" // Prepared return to the real turn-in proximity check.
			player.Mu.Unlock()
			questXP, questGold := 0, 0
			for _, id := range ids {
				quest := questByID(t, player, id)
				if quest.Count != quest.MaxCount || quest.Completed || quest.GrantedXP != 0 || quest.GrantedGold != 0 {
					t.Fatalf("four boss kills must ready, but not pay, %s: %+v", id, quest)
				}
				if _, ok := w.PerformCompleteQuest(player.ID, id); !ok {
					t.Fatalf("manual turn-in %s", id)
				}
				questXP += quest.GrantedXP + quest.GrantedResonanceXP
				questGold += quest.GrantedGold
				if _, ok := w.PerformCompleteQuest(player.ID, id); ok {
					t.Fatalf("duplicate turn-in %s", id)
				}
			}
			actualXP := player.Experience + player.ResonanceLevel*ResonanceXPPerLevel + player.ResonanceXP
			for earned := level; earned < player.Level; earned++ {
				actualXP += experienceRequiredForLevel(earned)
			}
			if player.Level == MaxPlayerLevel {
				actualXP -= player.MaxExperience // Capped sentinel is not earned XP.
			}
			if actualXP != bossXP+questXP || player.Gold-startGold != bossGold+questGold {
				t.Fatalf("stack mismatch: actual XP/gold %d/%d, receipts %d/%d", actualXP,
					player.Gold-startGold, bossXP+questXP, bossGold+questGold)
			}
			// All matching fresh generic/regional/difficulty contracts are
			// included above. Their combined XP is a bonus, not the run's main
			// reward; keep the bound against actual production boss receipts.
			if questXP*4 > bossXP {
				t.Fatalf("overlapping dailies exceed 25%% of boss XP: daily=%d boss=%d", questXP, bossXP)
			}
			wantQuestXP, wantQuestGold := 6760, 960
			if difficulty == DifficultyHeroic {
				wantQuestXP, wantQuestGold = 85200, 4160
			}
			if difficulty == DifficultyMythic {
				wantQuestXP, wantQuestGold = 163640, 7360
			}
			if questXP != wantQuestXP || questGold != wantQuestGold {
				t.Fatalf("wrong stacked budget: XP=%d gold=%d", questXP, questGold)
			}
			t.Logf("BOSS_DAILY_STACK difficulty=%v start=%d after_bosses=%d after_claims=%d boss_xp=%d daily_xp=%d total_xp=%d boss_gold=%d daily_gold=%d total_gold=%d contracts=%d",
				difficulty, level, levelAfterBosses, player.Level, bossXP, questXP, bossXP+questXP,
				bossGold, questGold, bossGold+questGold, len(ids))
		})
	}
}
