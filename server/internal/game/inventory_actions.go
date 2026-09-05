package game

import (
	"fmt"
	"math/rand"
	"sort"
)

func (w *World) PerformPickup(playerID, lootID string) (*Entity, bool, string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false, "player_not_found"
	}
	loot, ok := w.Entities[lootID]
	if !ok || loot.Type != TypeLoot {
		return nil, false, "loot_not_found"
	}
	if player.Type != TypePlayer || player.State == "DEAD" || player.Health <= 0 {
		return nil, false, "player_unavailable"
	}
	if player.InstanceID != loot.InstanceID {
		return nil, false, "different_instance"
	}
	if loot.LootOwnerID != "" && loot.LootOwnerID != playerID {
		return nil, false, "not_your_loot"
	}
	if loot.LootPartyID != "" {
		if party := w.Parties[loot.LootPartyID]; party != nil {
			party.Mu.RLock()
			masterRestricted := party.LootRule == "master" && party.MasterLooterID != playerID
			party.Mu.RUnlock()
			if masterRestricted {
				return nil, false, "master_looter_only"
			}
		}
	}

	dx := player.X - loot.X
	dz := player.Z - loot.Z
	dist := dx*dx + dz*dz
	if dist < 36.0 {
		if loot.LootItem != nil {
			originalStack := loot.LootItem.Stack
			itemName := loot.LootItem.Name
			remaining := player.AddItemToInventory(*loot.LootItem)
			accepted := originalStack - remaining
			if accepted > 0 {
				w.UpdateCollectionQuestProgress(player, itemName, accepted)
			}

			if remaining == 0 {
				w.Grid.Remove(loot)
				delete(w.Entities, lootID)
				return player, true, ""
			} else if remaining < originalStack {
				loot.LootItem.Stack = remaining
				return player, true, ""
			} else {
				// Inventory was full (or otherwise unable to accept any of this stack).
				// Do not delete the loot; leave it in the world.
				return player, false, "inventory_full"
			}
		}
	}
	return nil, false, "out_of_range"
}

func (w *World) PerformSplitStack(playerID string, slot int, amount int) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if slot < 0 || slot >= len(player.Inventory) {
		return nil, false
	}

	// Use pointer to modify directly
	item := &player.Inventory[slot]

	// Validation
	if item.ID == "" || item.Stack <= 1 || amount >= item.Stack || amount < 1 {
		return nil, false
	}

	// Find empty slot
	emptySlot := -1
	for i, invItem := range player.Inventory {
		if invItem.ID == "" {
			emptySlot = i
			break
		}
	}

	if emptySlot == -1 {
		return nil, false // Inventory full
	}

	// Create new item stack
	newItem := *item
	newItem.Stack = amount
	// Generate new ID to ensure uniqueness
	newItem.ID = fmt.Sprintf("%s-%d", item.ID, rand.Intn(1000000))

	// Update original stack
	item.Stack -= amount

	// Place new item
	player.Inventory[emptySlot] = newItem

	return player, true
}

func (w *World) PerformEquip(playerID, itemID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Find item
	invIndex := -1
	var itemToEquip *Item
	for i := range player.Inventory {
		if player.Inventory[i].ID == itemID {
			itemToEquip = &player.Inventory[i]
			invIndex = i
			break
		}
	}

	if itemToEquip == nil {
		return nil, false
	}

	if player.Level < itemToEquip.Level {
		return nil, false
	}

	// Prevent equipping non-equippable items
	if itemToEquip.Type == ItemMaterial || itemToEquip.Type == ItemRelic {
		return nil, false
	}

	// Validate Slot
	validSlot := false
	if itemToEquip.Slot == slot {
		validSlot = true
	} else if itemToEquip.Slot == "ring" && (slot == "ring1" || slot == "ring2") {
		validSlot = true
	} else if itemToEquip.Slot == "trinket" && (slot == "trinket1" || slot == "trinket2") {
		validSlot = true
	}

	if !validSlot {
		return nil, false
	}

	// Capture the item value BEFORE any inventory modifications to prevent pointer invalidation
	newItem := *itemToEquip

	// Remove from inventory (Clear slot)
	player.Inventory[invIndex] = Item{}

	// Unequip current
	if current, ok := player.Equipment[slot]; ok {
		remaining := player.AddItemToInventory(current)
		if remaining > 0 {
			// If we can't fit the old item, we have a problem.
			// Since we just cleared one slot, we should have at least one slot.
			// Restore the item to inventory if swap fails (unlikely)
			player.Inventory[invIndex] = newItem
			return nil, false
		}
	}

	if player.Equipment == nil {
		player.Equipment = make(map[string]Item)
	}
	player.Equipment[slot] = newItem
	player.EquipmentRevision++

	player.RecalculateStats()
	return player, true
}

func (w *World) PerformInventoryMove(playerID string, from, to int) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	if from < 0 || from >= MaxInventorySize || to < 0 || to >= MaxInventorySize {
		return nil, false
	}

	// Swap
	player.Inventory[from], player.Inventory[to] = player.Inventory[to], player.Inventory[from]

	return player, true
}

func inventorySortCategory(item Item) int {
	if isForgeHeartItem(item) {
		return 0
	}
	if isForgeShardItem(item) {
		return 1
	}
	if item.Type == ItemGem {
		return 2
	}
	return 3
}

func inventoryTypeRank(item Item) int {
	switch item.Type {
	case ItemWeapon:
		return 0
	case ItemArmor:
		return 1
	case ItemAccessory:
		return 2
	case ItemNeck:
		return 3
	case ItemGloves:
		return 4
	case ItemMaterial:
		return 5
	case ItemRelic:
		return 6
	case ItemGem:
		return 7
	default:
		return 99
	}
}

func inventoryGemQualityRank(item Item) int {
	switch item.GemQuality {
	case GemChipped:
		return 0
	case GemFlawed:
		return 1
	case GemNormal:
		return 2
	case GemFlawless:
		return 3
	case GemPerfect:
		return 4
	case GemRadiant:
		return 5
	default:
		return 99
	}
}

func (w *World) PerformInventorySort(playerID string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	items := make([]Item, 0, len(player.Inventory))
	for _, item := range player.Inventory {
		if item.ID != "" {
			items = append(items, item)
		}
	}

	sort.SliceStable(items, func(i, j int) bool {
		a := items[i]
		b := items[j]

		if diff := inventorySortCategory(a) - inventorySortCategory(b); diff != 0 {
			return diff < 0
		}

		if inventorySortCategory(a) == 2 {
			if a.GemType != b.GemType {
				return a.GemType < b.GemType
			}
			if diff := inventoryGemQualityRank(a) - inventoryGemQualityRank(b); diff != 0 {
				return diff < 0
			}
		}

		if diff := inventoryTypeRank(a) - inventoryTypeRank(b); diff != 0 {
			return diff < 0
		}
		if a.Rarity != b.Rarity {
			return a.Rarity < b.Rarity
		}
		if a.Level != b.Level {
			return a.Level < b.Level
		}
		return a.Name < b.Name
	})

	sortedInventory := make([]Item, len(player.Inventory))
	copy(sortedInventory, items)
	player.Inventory = sortedInventory

	return player, true
}

func (w *World) PerformUnequip(playerID, slot string) (*Entity, bool) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return nil, false
	}

	// Check if slot has item
	item, ok := player.Equipment[slot]
	if !ok {
		return nil, false
	}

	// Try to add to inventory
	remaining := player.AddItemToInventory(item)
	if remaining > 0 {
		// Inventory full
		return nil, false
	}

	// Remove from equipment
	delete(player.Equipment, slot)
	player.EquipmentRevision++

	player.RecalculateStats()
	return player, true
}
