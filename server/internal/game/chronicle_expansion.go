package game

// The two new investigations share the old collection budget. This prevents
// expanding the narrative from also inflating its total XP/gold. Coordinated
// curve and source tuning remains a separate balance pass.
func expandChronicleInvestigations(classic []Quest) []Quest {
	investigations := ChronicleInvestigationCatalog()
	before := make(map[string]ChronicleInvestigation, len(investigations))
	for _, chapter := range investigations {
		before[chapter.BeforeQuestID] = chapter
	}
	xpBudget, goldBudget := map[string]int{}, map[string]int{}
	for _, quest := range classic {
		if quest.Type != "COLLECT" {
			continue
		}
		realm := before[quest.ID].Realm
		xpBudget[realm], goldBudget[realm] = quest.RewardXP, quest.RewardGold
	}
	expanded := make([]Quest, 0, len(classic)+len(investigations))
	for _, quest := range classic {
		if chapter, exists := before[quest.ID]; exists {
			expanded = append(expanded, Quest{ID: chapter.ID, Type: "INVESTIGATE", Target: chapter.Realm,
				MaxCount: len(chapter.Sites), Category: QuestCategoryChronicle, Title: chapter.Title,
				ObjectiveText: chapter.Directions, Description: chapter.Acceptance, Lore: chapter.Summary,
				RewardXP: xpBudget[chapter.Realm] / 8, RewardGold: goldBudget[chapter.Realm] / 4})
			if quest.Type == "COLLECT" {
				quest.RewardXP -= 2 * (xpBudget[chapter.Realm] / 8)
				quest.RewardGold -= 2 * (goldBudget[chapter.Realm] / 4)
			}
		}
		expanded = append(expanded, quest)
	}
	for index := range expanded {
		expanded[index].Chapter = index + 1
	}
	return expanded
}

func hasSatisfiedChroniclePrerequisite(player *Entity, questID string) bool {
	for _, quest := range player.Quests {
		if quest.ID == questID {
			return quest.Completed || (isOptionalChronicleAddition(quest) && quest.LegacyOptional)
		}
	}
	return false
}

func nextChapterNumber(player *Entity, questID string) int {
	for _, quest := range player.Quests {
		if quest.ID == questID {
			return quest.Chapter
		}
	}
	return 0
}
