package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestChronicleQuestProtocolCarriesNarrativeFields(t *testing.T) {
	quests := questsToProto([]game.Quest{{
		ID: "chronicle", Type: "COLLECT", Target: "Stormglass Pinion", Count: 2, MaxCount: 4,
		RewardXP: 50, Accepted: true, Title: "The Sky Answers", Description: "Story body",
		Lore: "Recovered lore", Category: game.QuestCategoryChronicle, Chapter: 8, ObjectiveText: "Recover four pinions.",
	}})
	if len(quests) != 1 {
		t.Fatalf("expected one protobuf quest, got %d", len(quests))
	}
	quest := quests[0]
	if quest.GetTitle() != "The Sky Answers" || quest.GetDescription() != "Story body" || quest.GetLore() != "Recovered lore" ||
		quest.GetCategory() != game.QuestCategoryChronicle || quest.GetChapter() != 8 || quest.GetObjectiveText() != "Recover four pinions." {
		t.Fatalf("protobuf lost Chronicle narrative fields: %+v", quest)
	}
}
