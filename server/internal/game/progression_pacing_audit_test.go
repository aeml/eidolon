package game

import (
	"fmt"
	"math/rand"
	"sort"
	"testing"
	"time"
)

// This audit reports production reward behavior; a passing audit is NOT a
// balance approval. Keep numeric pacing targets in the balance plan until
// earned gameplay validates them. Run with -v to retain a before/after record.
func TestProgressionPacingAuditBossRewards(t *testing.T) {
	for _, level := range []int{30, 40, 60, 70, 100} {
		for _, size := range []int{1, 2, 5} {
			t.Run(fmt.Sprintf("level=%d/players=%d", level, size), func(t *testing.T) {
				w := newTestWorld()
				instanceID := "pacing-audit"
				layout := DungeonLayout{Rooms: []DungeonRoom{{X: 0, Z: 0, Width: 40, Height: 40, Type: "boss"}}}
				w.InstanceLayouts[instanceID] = &DungeonInstance{
					ID: instanceID, Layout: layout, Difficulty: DifficultyNormal,
					DungeonType: "verdant_bastion_catacombs", RunLevel: level,
					RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{},
				}
				players := make([]*Entity, size)
				for i := range players {
					player := newTestPlayer(fmt.Sprintf("audit-%d", i), "Fighter")
					player.Level, player.MaxExperience = level, experienceRequiredForLevel(level)
					player.BaseStats = applyLevelGrowth(canonicalBaseStatsForClass(player.SubType), level)
					player.Inventory = make([]Item, MaxInventorySize)
					player.InstanceID = instanceID
					w.AddEntity(player)
					players[i] = player
				}
				if size > 1 {
					party := w.CreateParty(players[0].ID)
					if party == nil {
						t.Fatal("party creation failed")
					}
					for _, player := range players[1:] {
						if err := w.JoinParty(party.ID, player.ID); err != nil {
							t.Fatal(err)
						}
					}
				}
				rewards := make(chan RewardSummaryEvent, size)
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "reward_summary" {
						rewards <- value.(RewardSummaryEvent)
					}
				}
				boss := &Entity{ID: "audit-boss", Type: TypeEnemy, SubType: "RootboundWarden",
					Level: level, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
				w.AddEntity(boss)
				// Exercise the real death/reward/party/level-up pipeline. This is an
				// isolated reward probe, not evidence of winning a boss through play.
				w.handleDeath(boss, players[0], nil)
				seen := map[string]bool{}
				for range players {
					select {
					case reward := <-rewards:
						if seen[reward.PlayerID] {
							t.Fatal("duplicate recipient reward")
						}
						seen[reward.PlayerID] = true
						player := w.GetEntity(reward.PlayerID)
						if player == nil || reward.XP <= 0 {
							t.Fatal("missing recipient or reward")
						}
						// The candidate's Normal boss budget is personal per eligible
						// recipient; no flat bonus or ordinary-party pool can stack on it.
						wantXP := (100 + 25*(level-1)*(level-1)) * 35 / 100
						if reward.XP != wantXP {
							t.Fatalf("production boss XP=%d, want personal content budget %d", reward.XP, wantXP)
						}
						player.Mu.RLock()
						gotXP := player.Experience
						for earnedLevel := level; earnedLevel < player.Level; earnedLevel++ {
							gotXP += experienceRequiredForLevel(earnedLevel)
						}
						if level == MaxPlayerLevel {
							gotXP = player.ResonanceLevel*ResonanceXPPerLevel + player.ResonanceXP
						}
						endingLevel := player.Level
						player.Mu.RUnlock()
						if gotXP != reward.XP {
							t.Fatalf("receipt=%d actual credited=%d", reward.XP, gotXP)
						}
						t.Logf("BOSS recipient=%s start=%d end=%d players=%d xp=%d next_level_fraction=%.4f resonance=%t",
							reward.PlayerID, level, endingLevel, size, reward.XP,
							float64(reward.XP)/float64(experienceRequiredForLevel(level)), level == MaxPlayerLevel)
					case <-time.After(5 * time.Second):
						t.Fatal("production reward did not arrive")
					}
				}
			})
		}
	}
}

func TestProgressionPacingAuditQuestBudgets(t *testing.T) {
	w := newTestWorld()
	for _, quest := range append(chronicleQuestCatalog(), dailyQuestCatalog()...) {
		if quest.RewardXP < 0 || quest.RewardGold < 0 || quest.MaxCount <= 0 {
			t.Fatalf("invalid catalog budget: %+v", quest)
		}
		t.Logf("QUEST id=%s objective=%s count=%d xp=%d gold=%d", quest.ID, quest.Type, quest.MaxCount, quest.RewardXP, quest.RewardGold)
	}
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		player := newTestPlayer("audit-opening-"+class, class)
		player.Level, player.MaxExperience = 1, experienceRequiredForLevel(1)
		player.BaseStats = canonicalBaseStatsForClass(class)
		for _, definition := range chronicleQuestCatalog()[:2] {
			quest := definition
			before := player.Level
			// Catalog payouts only: deliberately omit kills/travel/collection.
			// This isolates payout jumps; it is not an earned campaign route.
			w.awardQuestRewardsLocked(player, &quest)
			t.Logf("OPENING_PAYOUT_ONLY class=%s quest=%s start=%d end=%d xp=%d gold=%d", class, quest.ID, before, player.Level, quest.GrantedXP, quest.GrantedGold)
		}
	}
	for _, level := range []int{1, 10, 30, 60, 70, 90, 99, 100} {
		t.Logf("LEVEL level=%d xp_required=%d", level, experienceRequiredForLevel(level))
	}
}

func TestProgressionPacingAuditCollectionDrops(t *testing.T) {
	for _, source := range []struct{ target, ordinary, guardian string }{
		{"Verdant Memory Seed", "Skeleton", "InfernoTitan"},
		{"Moon-Tide Pearl", "MountainTroll", "FrostGuardian"},
		{"Cinderheart Ore", "SandstormDjinn", "PhoenixSentinel"},
		{"Stormglass Pinion", "StormHarpy", "CycloneAvatar"},
	} {
		var definition Quest
		for _, quest := range chronicleQuestCatalog() {
			if quest.Target == source.target {
				definition = quest
			}
		}
		if definition.ID == "" {
			t.Fatalf("missing collection %s", source.target)
		}
		definition.Accepted = true
		player := newTestPlayer("audit-drops", "Wizard")
		player.Quests = []Quest{definition}
		for _, subtype := range []string{source.ordinary, source.guardian} {
			count, quantity := 0, 0
			const rolls = 10000
			for i := 0; i < rolls; i++ {
				player.Quests[0].DropMisses = 0 // Measure base chance separately from pity.
				item := ChronicleDropForKill(player, subtype, (float64(i)+.5)/rolls)
				if item != nil {
					count++
					quantity += item.Stack
				}
			}
			if count == 0 || quantity == 0 {
				t.Fatalf("required item has no eligible drops: %s/%s", source.target, subtype)
			}
			t.Logf("COLLECTION_BASE_WITHOUT_PITY item=%s source=%s required=%d drop_rate=%.4f mean_items_per_eligible_kill=%.4f expected_kills=%.2f",
				source.target, subtype, definition.MaxCount, float64(count)/rolls,
				float64(quantity)/rolls, float64(definition.MaxCount)*rolls/float64(quantity))
		}
		rolls := rand.New(rand.NewSource(20260907))
		trials := make([]int, 2000)
		total := 0
		for trial := range trials {
			player.Quests[0] = definition
			for player.Quests[0].Count < definition.MaxCount {
				trials[trial]++
				if trials[trial] > definition.MaxCount*100 {
					t.Fatal("unbounded collection simulation")
				}
				if ChronicleDropForKill(player, source.ordinary, rolls.Float64()) != nil {
					player.Quests[0].Count++
				}
			}
			total += trials[trial]
		}
		sort.Ints(trials)
		t.Logf("COLLECTION_WITH_PITY item=%s trials=%d mean_kills=%.2f p90_kills=%d max_observed=%d",
			source.target, len(trials), float64(total)/float64(len(trials)), trials[len(trials)*9/10], trials[len(trials)-1])
	}
}
