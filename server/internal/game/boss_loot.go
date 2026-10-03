package game

import (
	"encoding/json"
	"errors"
	"sort"

	"eidolon-server/internal/database"
)

var ErrBossLootUnsupported = errors.New("unsupported retained boss item; original payload kept")

// Caller owns the player mutex. Keep the whole original roll if it cannot fit;
// do not partially stack it and silently discard a remainder or reroll later.
func (player *Entity) AwardBossItemLocked(item Item) (bool, error) {
	item = normalizedGroundItem(item)
	payload, err := json.Marshal(item)
	if err != nil {
		return false, err
	}
	if !database.ValidAuctionItemPayload(string(payload)) {
		return false, errors.New("invalid boss item payload")
	}
	if bossItemAlreadyOwned(player, item.ID) {
		return false, ErrGroundItemIdentity
	}
	for _, retained := range player.PendingBossLoot {
		var identity struct{ ID string }
		if json.Unmarshal([]byte(retained), &identity) == nil && identity.ID == item.ID {
			return false, ErrGroundItemIdentity
		}
	}
	inventory, remaining, err := planInventoryItemPlacement(player, item, "boss-stack-"+item.ID)
	if err != nil {
		return false, err
	}
	if remaining == 0 {
		player.Inventory = inventory
	} else {
		player.PendingBossLoot = append(player.PendingBossLoot, string(payload))
	}
	player.UnjournaledSave = true
	return remaining == 0, nil
}

// Plan a bounded prefix on detached storage. Invalid/future metadata is kept
// verbatim and refuses this batch without partial effects. A full bag may still
// collect an earlier complete item; every later roll stays unchanged.
// Caller must save the COMPLETE character before acknowledging collected loot.
func (player *Entity) CollectPendingBossLootLocked(limit int) (int, error) {
	if limit < 1 || limit > 50 {
		return 0, errors.New("invalid boss item collection limit")
	}
	preview := &Entity{Inventory: cloneItems(player.Inventory), Stash: player.Stash, Buyback: player.Buyback, Equipment: player.Equipment}
	collected := 0
	for _, payload := range player.PendingBossLoot[:min(limit, len(player.PendingBossLoot))] {
		item, err := decodeGroundItem(payload)
		if err != nil || !database.ValidAuctionItemPayload(payload) {
			return 0, ErrBossLootUnsupported
		}
		if bossItemAlreadyOwned(preview, item.ID) {
			return 0, ErrGroundItemIdentity
		}
		inventory, remaining, err := planInventoryItemPlacement(preview, item, "boss-stack-"+item.ID)
		if err != nil {
			return 0, err
		}
		if remaining != 0 {
			break
		}
		preview.Inventory = inventory
		collected++
	}
	if collected != 0 {
		player.Inventory = preview.Inventory
		player.PendingBossLoot = append([]string(nil), player.PendingBossLoot[collected:]...)
		player.UnjournaledSave = true
	}
	return collected, nil
}

func bossItemAlreadyOwned(player *Entity, itemID string) bool {
	for _, slots := range [][]Item{player.Inventory, player.Stash, player.Buyback} {
		for _, item := range slots {
			if item.ID == itemID {
				return true
			}
		}
	}
	for _, item := range player.Equipment {
		if item.ID == itemID {
			return true
		}
	}
	return false
}

func (w *World) CollectPendingBossLoot(playerID string, limit int) (bool, int, error) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer {
		return false, 0, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	// Trading owns the offered bag; claiming cannot change it underneath consent.
	if w.TradeByPlayer[playerID] != "" {
		return true, 0, nil
	}
	count, err := player.CollectPendingBossLootLocked(limit)
	return true, count, err
}

// A lightweight retry index; do not copy full equipment/inventory images just
// to discover which accounts have retained rolls. IO happens after unlocking.
func (w *World) PlayersWithPendingBossLoot() []string {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	var players []string
	for id, player := range w.Entities {
		player.Mu.RLock()
		if player.Type == TypePlayer && len(player.PendingBossLoot) != 0 {
			players = append(players, id)
		}
		player.Mu.RUnlock()
	}
	sort.Strings(players)
	return players
}
