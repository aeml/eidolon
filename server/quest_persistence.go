package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Shared with the login path so saved collection contracts and bad-luck state
// are exercised by a real database round-trip test, not a second test mapper.
func questFromDatabase(q database.Quest) game.Quest {
	var choices []game.Item
	if len(q.RewardChoices) > 0 {
		choices = make([]game.Item, len(q.RewardChoices))
	}
	for i, item := range q.RewardChoices {
		choices[i] = gameItemFromDatabaseExact(item)
	}
	return game.Quest{
		RewardChoiceLevel: q.RewardChoiceLevel, RewardChoices: choices, ClaimedRewardID: q.ClaimedRewardID,
		ID: q.ID, Type: q.Type, Target: q.Target, Count: q.Count, MaxCount: q.MaxCount,
		CollectionVersion: q.CollectionVersion, DropMisses: q.DropMisses,
		InvestigationMask: q.InvestigationMask,
		LegacyOptional:    q.LegacyOptional,
		RewardXPQuoted:    q.RewardXPQuoted, RewardGoldQuoted: q.RewardGoldQuoted,
		RewardXP: q.RewardXP, RewardGold: q.RewardGold, GrantedGold: q.GrantedGold,
		GrantedXP: q.GrantedXP, GrantedResonanceXP: q.GrantedResonanceXP,
		Completed: q.Completed, Accepted: q.Accepted, Title: q.Title,
		Description: q.Description, Lore: q.Lore, Category: q.Category,
		Chapter: q.Chapter, ObjectiveText: q.ObjectiveText,
	}
}
