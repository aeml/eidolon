package game

import (
	"fmt"
	"testing"
	"time"
)

func TestQuestRewardsGoldXPAndCapOverflow(t *testing.T) {
	for _, story := range []bool{false, true} {
		for _, level := range []int{1, 99, 100} {
			t.Run(fmt.Sprintf("story=%t/level=%d", story, level), func(t *testing.T) {
				w := NewWorld(nil)
				player := newTestPlayer("quest-rewards", "Wizard")
				player.Level = level
				player.Experience = 0
				player.MaxExperience = experienceRequiredForLevel(level)
				if level == 99 {
					player.Experience = player.MaxExperience - 50
				}
				if level == 100 {
					player.Experience = player.MaxExperience
				}
				player.Gold = 123
				player.X, player.Z = -20, 200
				id := "daily_skeleton"
				if story {
					player.X, player.Z, id = 20, 215, "chronicle_01_bell_below"
				}
				w.AddEntity(player)
				w.GenerateDailyQuests(player.ID)
				if _, ok := w.PerformAcceptQuest(player.ID, id); !ok {
					t.Fatal("accept failed")
				}
				quest := questByID(t, player, id)
				for i := 0; i < quest.MaxCount; i++ {
					w.UpdateQuestProgress(player, "Skeleton")
				}
				if player.Gold != 123 || quest.Completed {
					t.Fatal("objective progress paid a reward")
				}
				rewardXP, rewardGold := quest.RewardXP, quest.RewardGold
				if _, ok := w.PerformCompleteQuest(player.ID, id); !ok {
					t.Fatal("turn-in failed")
				}
				quest = questByID(t, player, id)
				wantXP, wantResonance := rewardXP, 0
				if level == 99 {
					wantXP, wantResonance = 50, rewardXP-50
				}
				if level == 100 {
					wantXP, wantResonance = 0, rewardXP
				}
				if player.Gold != 123+rewardGold || quest.GrantedGold != rewardGold || quest.GrantedXP != wantXP || quest.GrantedResonanceXP != wantResonance {
					t.Fatalf("incorrect reward split: player gold=%d quest=%+v", player.Gold, quest)
				}
				if got := player.ResonanceLevel*ResonanceXPPerLevel + player.ResonanceXP; got != wantResonance {
					t.Fatalf("resonance=%d want %d", got, wantResonance)
				}
				if level >= 99 && (player.Level != 100 || player.Experience != player.MaxExperience) {
					t.Fatal("cap was not preserved")
				}
				gold, xp, resonance := player.Gold, player.Experience, player.ResonanceXP
				if _, ok := w.PerformCompleteQuest(player.ID, id); ok {
					t.Fatal("duplicate turn-in accepted")
				}
				if player.Gold != gold || player.Experience != xp || player.ResonanceXP != resonance {
					t.Fatal("duplicate reward")
				}
				if got := w.Economy.Drain(time.Now()).Sources["quest_rewards"]; got != rewardGold {
					t.Fatalf("gold source=%d want %d", got, rewardGold)
				}
			})
		}
	}
}

func TestQuestCatalogGoldMigrationPreservesProgressAndReceipts(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("saved-quest-gold", "Wizard")
	player.LastDailyQuest = time.Now()
	player.Quests = []Quest{
		{ID: "daily_skeleton", Accepted: true, Count: 100},
		{ID: "chronicle_01_bell_below", Accepted: true, Completed: true, Count: 3, GrantedGold: 90, GrantedXP: 400, GrantedResonanceXP: 100},
	}
	w.AddEntity(player)
	beforeGold := player.Gold
	w.GenerateDailyQuests(player.ID)
	for _, quest := range append(dailyQuestCatalog(), chronicleQuestCatalog()...) {
		if quest.RewardGold < 100 || quest.RewardGold > 50_000 {
			t.Fatalf("invalid gold tier: %+v", quest)
		}
	}
	daily := questByID(t, player, "daily_skeleton")
	if !daily.Accepted || daily.Count != 100 || daily.Completed || daily.RewardGold <= 0 {
		t.Fatalf("saved daily lost: %+v", daily)
	}
	story := questByID(t, player, "chronicle_01_bell_below")
	if !story.Completed || story.GrantedGold != 90 || story.GrantedXP != 400 || story.GrantedResonanceXP != 100 {
		t.Fatalf("receipt changed: %+v", story)
	}
	if player.Gold != beforeGold {
		t.Fatal("migration paid retroactive gold")
	}
}

func TestQuestRewardReceiptAcrossResonanceRanks(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("rank-reward", "Wizard")
	player.Level = MaxPlayerLevel
	player.ResonanceLevel = 3
	player.ResonanceXP = ResonanceXPPerLevel - 100
	quest := Quest{RewardGold: 50000, RewardXP: 2*ResonanceXPPerLevel + 250}
	w.awardQuestRewardsLocked(player, &quest)
	if quest.GrantedXP != 0 || quest.GrantedResonanceXP != quest.RewardXP || player.ResonanceLevel != 6 || player.ResonanceXP != 150 || player.ResonancePoints != 3 {
		t.Fatalf("incorrect rank-crossing reward: receipt=%+v level=%d xp=%d points=%d", quest, player.ResonanceLevel, player.ResonanceXP, player.ResonancePoints)
	}
}
