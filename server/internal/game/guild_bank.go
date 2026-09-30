package game

import (
	"fmt"
	"math"
)

// DebitPlayerGold moves player-owned gold into a server-side operation. The
// caller must credit it back if the durable write fails.
func (w *World) DebitPlayerGold(playerID string, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return fmt.Errorf("player is unavailable")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Disconnected {
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
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Gold < 0 || player.Gold > math.MaxInt-amount {
		return fmt.Errorf("gold credit would overflow")
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
	if player == nil || player.Type != TypePlayer {
		return Item{}, fmt.Errorf("player is unavailable")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Disconnected {
		return Item{}, fmt.Errorf("player is unavailable")
	}
	for index := 0; index < min(len(player.Inventory), MaxInventorySize); index++ {
		if player.Inventory[index].ID == itemID {
			if IsChronicleQuestItem(player.Inventory[index]) {
				return Item{}, fmt.Errorf("story quest items cannot enter the guild bank")
			}
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
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if item.ID == "" || item.Stack < 0 {
		return fmt.Errorf("invalid guild bank item")
	}
	if item.Stack == 0 {
		item.Stack = 1
	} // Legacy non-stackable items.
	// A failed credit is rolled back in the guild bank. Plan on detached visible
	// storage so partial merges, metadata repair or hidden slots cannot grant an
	// item before returning that same complete stack to shared storage.
	inventory := cloneItems(player.Inventory)
	if len(inventory) < MaxInventorySize {
		inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
	}
	staged := &Entity{Inventory: inventory[:MaxInventorySize]}
	if remaining := staged.AddItemToInventory(item); remaining > 0 {
		return fmt.Errorf("inventory is full")
	}
	player.Inventory = inventory
	return nil
}
