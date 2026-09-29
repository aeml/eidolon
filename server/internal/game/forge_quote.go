package game

import "maps"

// ForgeQuote identifies the equipment and upgrade state shown to the player.
// Check it under the same lock as spending; a replay cannot buy the next rank.
type ForgeQuote struct {
	ItemID    string        `json:"itemId"`
	Level     int           `json:"level"`
	Potency   int           `json:"potency"`
	Sockets   int           `json:"sockets"`
	Gems      []SocketedGem `json:"gems"`
	GemIDs    []string      `json:"gemIds,omitempty"`
	GemCounts []int         `json:"gemCounts,omitempty"`
}

func forgeQuoteMatches(item Item, expected []*ForgeQuote) bool {
	// Older clients omit the quote during rolling deployment.
	if len(expected) == 0 || (len(expected) == 1 && expected[0] == nil) {
		return true
	}
	if len(expected) != 1 {
		return false
	}
	quote := expected[0]
	if quote.ItemID == "" || quote.ItemID != item.ID || quote.Level != item.Level || quote.Potency != item.Potency || quote.Sockets != item.Sockets || len(quote.Gems) != len(item.Gems) {
		return false
	}
	for i, gem := range item.Gems {
		if quote.Gems[i].Type != gem.Type || quote.Gems[i].Quality != gem.Quality || !maps.Equal(quote.Gems[i].Stats, gem.Stats) {
			return false
		}
	}
	return true
}

func forgeGemQuoteMatches(inventory []Item, indices []int, expected []*ForgeQuote) bool {
	if len(expected) == 0 || (len(expected) == 1 && expected[0] == nil) {
		return true
	}
	if len(expected) != 1 || len(expected[0].GemIDs) != len(indices) || len(expected[0].GemCounts) != len(indices) {
		return false
	}
	for i, index := range indices {
		if index < 0 || index >= len(inventory) || expected[0].GemIDs[i] == "" || expected[0].GemIDs[i] != inventory[index].ID || expected[0].GemCounts[i] != forgeInventoryStackCount(inventory[index]) {
			return false
		}
	}
	return true
}
