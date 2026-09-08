package game

import "testing"

func TestAcceptedQuestQuoteSurvivesCatalogChange(t *testing.T) {
	for _, category := range []string{QuestCategoryDaily, QuestCategoryChronicle} {
		for _, completed := range []bool{false, true} {
			for _, xp := range []int{0, 12345} {
				old := Quest{ID: "quote-contract", Type: "KILL", Target: "Skeleton", Category: category,
					Accepted: !completed, Completed: completed, Count: 6, MaxCount: 8,
					RewardXP: xp, RewardGold: 0, RewardXPQuoted: true, RewardGoldQuoted: true,
					ObjectiveText: "Defeat eight of the courier's sentries.", GrantedGold: 19, GrantedXP: 20, GrantedResonanceXP: 21}
				definition := Quest{ID: old.ID, Type: old.Type, Target: old.Target, Category: category,
					MaxCount: 20, RewardXP: 42, RewardGold: 43, ObjectiveText: "Defeat twenty sentries."}
				updated := copyQuestDefinition(old, definition)
				if updated.RewardXP != xp || updated.RewardGold != 0 || updated.MaxCount != 8 || updated.Count != 6 || updated.ObjectiveText != old.ObjectiveText {
					t.Fatalf("accepted/completed quote rewritten: %+v", updated)
				}
				if updated.GrantedGold != 19 || updated.GrantedXP != 20 || updated.GrantedResonanceXP != 21 || updated.Accepted != old.Accepted || updated.Completed != completed {
					t.Fatalf("receipt/state rewritten: %+v", updated)
				}
				if twice := copyQuestDefinition(updated, definition); twice != updated {
					t.Fatal("refresh not idempotent")
				}
				old.Accepted, old.Completed = false, false
				offer := copyQuestDefinition(old, definition)
				if offer.RewardXP != 42 || offer.RewardGold != 43 || offer.MaxCount != 20 {
					t.Fatalf("unaccepted offer failed to update: %+v", offer)
				}
			}
		}
	}
}

func TestLegacyQuestQuoteBackfillsOnlyMissingAmounts(t *testing.T) {
	definition := Quest{ID: "daily_skeleton", Type: "KILL", Target: "Skeleton", MaxCount: 100, RewardXP: 500, RewardGold: 100}
	for _, xp := range []int{0, 700} {
		old := Quest{ID: definition.ID, Accepted: true, RewardXP: xp, RewardXPQuoted: true}
		updated := copyQuestDefinition(old, definition)
		if updated.RewardXP != xp || updated.RewardGold != 100 {
			t.Fatalf("partial legacy quote lost: %+v", updated)
		}
	}
	bare := copyQuestDefinition(Quest{ID: definition.ID, Accepted: true}, definition)
	if bare.RewardXP != 500 || bare.RewardGold != 100 {
		t.Fatalf("missing legacy rewards not backfilled: %+v", bare)
	}
}
