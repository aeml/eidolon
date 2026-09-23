package game

import (
	"testing"
	"time"
)

func TestCoordinatedQuestBudgetsCoverEntireCatalog(t *testing.T) {
	storyXP, storyGold := 0, 0
	for _, q := range chronicleQuestCatalog() {
		if q.RewardXP <= 0 || q.RewardXP > 500_000 || q.RewardGold <= 0 || q.RewardGold > 5000 {
			t.Fatalf("missing or excessive candidate story budget: %+v", q)
		}
		storyXP += q.RewardXP
		storyGold += q.RewardGold
	}
	for _, q := range dailyQuestCatalog() {
		if q.RewardXP <= 0 || q.RewardXP > 500_000 || q.RewardGold <= 0 || q.RewardGold > 6400 {
			t.Fatalf("missing or excessive candidate daily budget: %+v", q)
		}
		if _, ordinary := dailyHuntContentLevels[q.Target]; ordinary && q.MaxCount != 100 {
			t.Fatal("ordinary daily requirements unexpectedly changed")
		}
	}
	t.Logf("CANDIDATE_STORY_TOTAL chapters=%d xp=%d gold=%d; requires earned route validation", len(chronicleQuestCatalog()), storyXP, storyGold)
}

func TestCoordinatedQuestBudgetsUseContentLevelAndIndependentGold(t *testing.T) {
	for _, tc := range []struct {
		target          string
		count, xp, gold int
	}{
		{"Skeleton", 100, 520, 200}, {"Imp", 100, 900, 400}, {"AquaGolem", 100, 3040, 1100},
		{"VerdantBastionBoss", 4, 208, 480}, {"AbyssalWellBoss", 5, 680, 1200},
		{"MoltenCoreBoss", 5, 840, 1400}, {"TempestSpireBoss", 5, 840, 1400},
		{"DungeonBossHeroic", 4, 2432, 3200}, {"DungeonBossMythic", 4, 4864, 6400},
	} {
		if actual := dailyRewardBudget(tc.target, tc.count); actual.XP != tc.xp || actual.Gold != tc.gold {
			t.Fatalf("%s: %+v expected XP=%d gold=%d", tc.target, actual, tc.xp, tc.gold)
		}
	}
	if q := chronicleRewardBudget("chronicle_02_seeds_first_grove"); q.XP != 1600 || q.Gold != 100 {
		t.Fatal("Earth realm budget not independent of XP")
	}
	if q := chronicleRewardBudget(ChronicleDarkKingID); q.XP != 490250 || q.Gold != 5000 {
		t.Fatal("final story award is not bounded separately from weekly cache")
	}
	if q := dailyRewardBudget("unknown", 100); q != (questRewardBudget{}) {
		t.Fatal("unknown target has invented rewards")
	}
	if q := dailyRewardBudget("Skeleton", 0); q != (questRewardBudget{}) {
		t.Fatal("zero-objective contract paid")
	}
}

func TestCampaignBalanceHonorsAcceptedDailyQuotes(t *testing.T) {
	p := newTestPlayer("quoted-daily", "Wizard")
	p.Level, p.Experience, p.MaxExperience, p.Gold = 30, 1234, experienceRequiredForLevel(30), 5678
	var daily Quest
	for _, q := range dailyQuestCatalog() {
		if q.Target == "Skeleton" {
			daily = q
			break
		}
	}
	if daily.ID == "" {
		t.Fatal("missing ordinary daily")
	}
	quoted := daily
	quoted.Accepted, quoted.Count, quoted.RewardXP, quoted.RewardGold = true, 37, 4250, 200
	quoted.RewardXPQuoted, quoted.RewardGoldQuoted = true, true
	p.Quests, p.LastDailyQuest = []Quest{quoted}, time.Now()
	w := newTestWorld()
	w.AddEntity(p)
	w.GenerateDailyQuests(p.ID)
	refreshed := questByID(t, p, daily.ID)
	if refreshed.RewardXP != 4250 || refreshed.RewardGold != 200 || refreshed.Count != 37 || !refreshed.Accepted || refreshed.Completed {
		t.Fatal("balance rewrote accepted daily", refreshed)
	}
	if daily.RewardXP != 520 || daily.RewardGold != 200 {
		t.Fatal("fresh daily does not use new independent XP/Gold budgets")
	}
	if p.Level != 30 || p.Experience != 1234 || p.MaxExperience != 21125 || p.Gold != 5678 {
		t.Fatal("budget lookup touched character progression")
	}
}

func TestPreparationBudgetsPreserveEveryAcceptedStoryQuote(t *testing.T) {
	seen := 0
	for _, definition := range chronicleQuestCatalog() {
		budget, changed := chroniclePreparationXP[definition.ID]
		if !changed {
			continue
		}
		seen++
		if definition.RewardXP != budget {
			t.Fatalf("new offer %s has %d, want %d", definition.ID, definition.RewardXP, budget)
		}
		for _, completed := range []bool{false, true} {
			for _, quote := range []int{0, 1234} {
				progress := definition
				progress.Accepted, progress.Completed = true, completed
				progress.RewardXP, progress.RewardGold = quote, 71
				progress.RewardXPQuoted, progress.RewardGoldQuoted = true, true
				progress.Count = 1
				if definition.Type == "INVESTIGATE" {
					progress.InvestigationMask = 1
				}
				refreshed := copyQuestDefinition(progress, definition)
				if refreshed.RewardXP != quote || refreshed.RewardGold != 71 || refreshed.Count != 1 ||
					!refreshed.Accepted || refreshed.Completed != completed {
					t.Fatalf("rewrote saved contract %s: %+v", definition.ID, refreshed)
				}
			}
		}
	}
	if seen != len(chroniclePreparationXP) {
		t.Fatal("preparation budget references missing story chapters")
	}
}
