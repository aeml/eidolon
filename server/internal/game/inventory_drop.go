package game

import (
	"fmt"
	"time"
)

// PerformInventoryDrop moves exactly the requested current bag item to the
// player's feet. The item ID guards against a slot changing during a drag.
func (w *World) PerformInventoryDrop(playerID string, slot int, itemID string) ([]Item, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return nil, fmt.Errorf("character unavailable")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.State == "DEAD" || player.Health <= 0 || player.Disconnected {
		return nil, fmt.Errorf("you must be alive and connected to drop items")
	}
	if w.TradeByPlayer[playerID] != "" {
		return nil, fmt.Errorf("finish or cancel your trade before dropping items")
	}
	if slot < 0 || slot >= len(player.Inventory) || itemID == "" || player.Inventory[slot].ID != itemID {
		return nil, fmt.Errorf("that bag slot changed; drag the item again")
	}
	item := cloneItem(player.Inventory[slot])
	if IsChronicleQuestItem(item) {
		return nil, fmt.Errorf("quest items cannot be dropped")
	}
	if item.Stack <= 0 {
		item.Stack = 1
	}
	now := time.Now()
	baseID := fmt.Sprintf("loot-drop-%s-%d", playerID, now.UnixNano())
	lootID := baseID
	for suffix := 1; w.Entities[lootID] != nil; suffix++ {
		lootID = fmt.Sprintf("%s-%d", baseID, suffix)
	}
	loot := &Entity{ID: lootID, Type: TypeLoot, X: player.X, Y: 0.5, Z: player.Z,
		InstanceID: player.InstanceID, LootItem: &item, LootTime: now, CreatedAt: now}
	player.Inventory[slot] = Item{}
	w.Entities[loot.ID] = loot
	w.Grid.Add(loot)
	return cloneItems(player.Inventory), nil
}
