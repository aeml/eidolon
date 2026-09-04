package game

import "fmt"

// DebitPlayerGold moves player-owned gold into a server-side operation. The
// caller must credit it back if the durable write fails.
func (w *World) DebitPlayerGold(playerID string, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer || player.Disconnected {
		return fmt.Errorf("player is unavailable")
	}
	if player.Gold < amount {
		return fmt.Errorf("insufficient gold")
	}
	player.Gold -= amount
	return nil
}

func (w *World) CreditPlayerGold(playerID string, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return fmt.Errorf("player is unavailable")
	}
	player.Gold += amount
	return nil
}

// DebitPlayerItem removes one complete inventory slot for durable guild-bank
// storage. Stacks intentionally move as a unit in the alpha protocol.
func (w *World) DebitPlayerItem(playerID, itemID string) (Item, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer || player.Disconnected {
		return Item{}, fmt.Errorf("player is unavailable")
	}
	for index := range player.Inventory {
		if player.Inventory[index].ID == itemID {
			item := cloneItem(player.Inventory[index])
			player.Inventory[index] = Item{}
			return item, nil
		}
	}
	return Item{}, fmt.Errorf("inventory item not found")
}

func (w *World) CreditPlayerItem(playerID string, item Item) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return fmt.Errorf("player is unavailable")
	}
	if remaining := player.AddItemToInventory(item); remaining > 0 {
		return fmt.Errorf("inventory is full")
	}
	return nil
}
