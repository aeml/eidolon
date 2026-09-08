package game

import "testing"

func TestChronicleOpeningRewardBudget(t *testing.T) {
	q := chronicleQuestCatalog()[0]
	if q.ID != "chronicle_01_bell_below" || q.MaxCount != 3 || q.RewardXP != 100 || q.RewardGold != 100 {
		t.Fatalf("opening should promise one initial level of XP and unchanged starter gold: %+v", q)
	}
}

func TestChronicleOpeningRewardPreservesAcceptedQuotes(t *testing.T) {
	for _, state := range []struct {
		name                string
		accepted, completed bool
		count               int
	}{
		{"offered", false, false, 0}, {"accepted", true, false, 1},
		{"ready", true, false, 3}, {"completed", true, true, 3},
	} {
		t.Run(state.name, func(t *testing.T) {
			old := chronicleQuestCatalog()[0]
			old.RewardXP, old.RewardGold = 500, 100
			old.Accepted, old.Completed, old.Count = state.accepted, state.completed, state.count
			if state.completed {
				old.GrantedGold, old.GrantedXP = 100, 500
			}
			p := &Entity{Quests: []Quest{old}}
			ensureChronicleLocked(p)
			q := *questByID(t, p, old.ID)
			wantXP := 100
			if state.accepted || state.completed {
				wantXP = 500
			}
			if q.RewardXP != wantXP || q.RewardGold != 100 || q.Count != old.Count ||
				q.Accepted != old.Accepted || q.Completed != old.Completed ||
				q.GrantedGold != old.GrantedGold || q.GrantedXP != old.GrantedXP {
				t.Fatalf("changed contract or receipt: old=%+v refreshed=%+v", old, q)
			}
			ensureChronicleLocked(p)
			if *questByID(t, p, old.ID) != q {
				t.Fatal("repeated refresh changed contract")
			}
		})
	}
	zero := chronicleQuestCatalog()[0]
	zero.Accepted, zero.RewardXP, zero.RewardGold = true, 0, 0
	if got := copyQuestDefinition(zero, chronicleQuestCatalog()[0]); got.RewardXP != 0 || got.RewardGold != 0 {
		t.Fatal("refresh invented a reward for an accepted zero quote")
	}
}

// An isolated payout probe, not earned combat or first-hour timing evidence.
// Keep other XP sources out of this test so the turn-in's level jump is explicit.
func TestChronicleOpeningManualRewardAcrossClasses(t *testing.T) {
	w := newTestWorld()
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			p := newTestPlayer("opening-"+class, class)
			p.Level, p.Experience, p.MaxExperience = 1, 0, experienceRequiredForLevel(1)
			p.BaseStats = canonicalBaseStatsForClass(class)
			p.X, p.Z, p.Gold = 20, 215, 37
			w.AddEntity(p)
			w.GenerateDailyQuests(p.ID)
			id := "chronicle_01_bell_below"
			if _, ok := w.PerformAcceptQuest(p.ID, id); !ok {
				t.Fatal("accept failed")
			}
			for i := 0; i < 3; i++ {
				w.UpdateQuestProgress(p, "Skeleton")
			}
			if p.Level != 1 || p.Experience != 0 || p.Gold != 37 || questByID(t, p, id).Completed {
				t.Fatal("objective progress paid or auto-completed")
			}
			if _, ok := w.PerformCompleteQuest(p.ID, id); !ok {
				t.Fatal("manual turn-in failed")
			}
			q := *questByID(t, p, id)
			if p.Level != 2 || p.Experience != 0 || p.Gold != 137 || !q.Completed ||
				q.GrantedXP != 100 || q.GrantedGold != 100 || q.GrantedResonanceXP != 0 {
				t.Fatalf("wrong opening payout: level=%d xp=%d gold=%d receipt=%+v", p.Level, p.Experience, p.Gold, q)
			}
			if _, ok := w.PerformCompleteQuest(p.ID, id); ok || p.Level != 2 || p.Experience != 0 || p.Gold != 137 {
				t.Fatal("duplicate turn-in rewarded again")
			}
		})
	}
}

func TestChronicleOpeningLegacyManualReward(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("opening-legacy", "Fighter")
	p.Level, p.Experience, p.MaxExperience = 1, 0, experienceRequiredForLevel(1)
	p.X, p.Z, p.Gold = 20, 215, 37
	old := chronicleQuestCatalog()[0]
	old.Accepted, old.RewardXP, old.RewardGold = true, 500, 100
	p.Quests = []Quest{old}
	w.AddEntity(p)
	w.GenerateDailyQuests(p.ID)
	for i := 0; i < 3; i++ {
		w.UpdateQuestProgress(p, "Skeleton")
	}
	w.GenerateDailyQuests(p.ID)
	if _, ok := w.PerformCompleteQuest(p.ID, old.ID); !ok {
		t.Fatal("legacy turn-in failed")
	}
	q := questByID(t, p, old.ID)
	// The promised 500 XP is unchanged; curve 2 spends 100 + 125 + 200
	// reaching level four, leaving exactly 75 rather than the legacy 136.
	if p.Level != 4 || p.Experience != 75 || p.Gold != 137 || q.GrantedXP != 500 || q.GrantedGold != 100 {
		t.Fatalf("legacy promise was reduced: level=%d xp=%d gold=%d receipt=%+v", p.Level, p.Experience, p.Gold, q)
	}
	if _, ok := w.PerformCompleteQuest(p.ID, old.ID); ok || p.Gold != 137 || p.Experience != 75 {
		t.Fatal("legacy turn-in replay paid twice")
	}
}
