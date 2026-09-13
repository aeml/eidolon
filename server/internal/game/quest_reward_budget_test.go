package game

import "testing"

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
		{"Skeleton", 100, 4250, 200}, {"Imp", 100, 18250, 400}, {"AquaGolem", 100, 146000, 1100},
		{"VerdantBastionBoss", 4, 3380, 480}, {"AbyssalWellBoss", 5, 17425, 1200},
		{"MoltenCoreBoss", 5, 23825, 1400}, {"TempestSpireBoss", 5, 23825, 1400},
		{"DungeonBossHeroic", 4, 78440, 3200}, {"DungeonBossMythic", 4, 156880, 6400},
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
