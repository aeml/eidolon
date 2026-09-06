package game

func isEquipmentSlot(slot string) bool {
	switch slot {
	case "head", "chest", "legs", "feet", "gloves", "shoulders", "belt", "neck", "mainHand", "offHand", "ring1", "ring2", "trinket1", "trinket2":
		return true
	}
	return false
}

func equipmentItemType(item Item) bool {
	switch item.Type {
	case "", ItemWeapon, ItemArmor, ItemAccessory, ItemNeck, ItemGloves:
		return true
	}
	return false
}

func itemFitsEquipmentSlot(item Item, slot string) bool {
	return isEquipmentSlot(slot) && equipmentItemType(item) && (item.Slot == slot ||
		item.Slot == "ring" && (slot == "ring1" || slot == "ring2") ||
		item.Slot == "trinket" && (slot == "trinket1" || slot == "trinket2"))
}

func activeEquipmentItem(slot string, item Item) bool {
	// Preserve older gear with omitted descriptors in an actual equipment slot.
	// Unsupported records stay saved for recovery but must not provide power.
	return isEquipmentSlot(slot) && equipmentItemType(item) && (item.Slot == "" || itemFitsEquipmentSlot(item, slot))
}

func activeEquipmentItems(equipment map[string]Item) map[string]Item {
	for slot, item := range equipment {
		if !activeEquipmentItem(slot, item) {
			active := make(map[string]Item, len(equipment))
			for key, value := range equipment {
				if activeEquipmentItem(key, value) {
					active[key] = value
				}
			}
			return active
		}
	}
	return equipment
}
