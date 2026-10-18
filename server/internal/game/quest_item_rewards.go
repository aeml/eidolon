package game

import "math/rand"

// Six different equipment bases; no materials, common items or client rolls.
// Boosted quest odds: 55% green, 35% blue, 10% orange (ordinary orange is 1%).
func generateQuestRewardChoices(level int) []Item {
	pool := make([]BaseItem, 0, len(BaseItems))
	for _, base := range BaseItems {
		if base.Type == ItemWeapon || base.Type == ItemArmor || base.Type == ItemAccessory {
			pool = append(pool, base)
		}
	}
	rand.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	choices := make([]Item, 0, 6)
	for _, base := range pool[:min(6, len(pool))] {
		rarity, multiplier, stats := questItemRarity(rand.Float64())
		choices = append(choices, *createItem(base, rarity, multiplier, stats, max(1, min(MaxPlayerLevel, level))))
	}
	return choices
}

func questItemRarity(roll float64) (ItemRarity, float64, int) {
	if roll < 0.10 {
		return RarityLegendary, 20, 5
	}
	if roll < 0.45 {
		return RarityRare, 5, 2
	}
	return RarityUncommon, 2, 1
}

// Claims can be made from the Journal anywhere. Turn-in already proved the
// nearby giver/objectives and persisted these exact offers. Never regenerate.
func (w *World) PerformClaimQuestItem(playerID, questID, itemID string) bool {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || itemID == "" {
		return false
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	for i := range player.Quests {
		quest := &player.Quests[i]
		if quest.ID != questID || !quest.Completed || quest.ClaimedRewardID != "" {
			continue
		}
		for _, item := range quest.RewardChoices {
			if item.ID != itemID {
				continue
			}
			if player.AddItemToInventory(cloneItem(item)) != 0 {
				return false
			}
			quest.ClaimedRewardID = itemID
			quest.RewardChoices = nil
			return true
		}
		return false
	}
	return false
}
