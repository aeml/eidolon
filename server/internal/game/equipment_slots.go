package game

import "strings"

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
		item.Type == ItemWeapon && item.Slot == "mainHand" && slot == "offHand" ||
		item.Slot == "ring" && (slot == "ring1" || slot == "ring2") ||
		item.Slot == "trinket" && (slot == "trinket1" || slot == "trinket2"))
}

func activeEquipmentItem(slot string, item Item) bool {
	// Preserve older gear with omitted descriptors in an actual equipment slot.
	// Unsupported records stay saved for recovery but must not provide power.
	return isEquipmentSlot(slot) && equipmentItemType(item) && (item.Slot == "" || itemFitsEquipmentSlot(item, slot))
}

func activeEquipmentItems(equipment map[string]Item, classes ...string) map[string]Item {
	class := ""
	if len(classes) > 0 {
		class = classes[0]
	}
	for slot, item := range equipment {
		if !activeEquipmentItem(slot, item) || !classAllowsEquipment(class, item, slot) {
			active := make(map[string]Item, len(equipment))
			for key, value := range equipment {
				if activeEquipmentItem(key, value) && classAllowsEquipment(class, value, key) {
					active[key] = value
				}
			}
			return active
		}
	}
	return equipment
}

func classAllowsEquipment(class string, item Item, slot string) bool {
	if class == "Rogue" {
		if slot == "offHand" && item.Type != ItemWeapon || strings.Contains(item.Name, "Wooden Staff") {
			return false
		}
	}
	if class != "Wizard" && class != "Rogue" {
		return true
	}
	switch slot {
	case "head", "chest", "legs", "feet", "gloves", "shoulders", "belt":
		for _, base := range []string{"Iron Helm", "Plate Mail", "Plate Greaves", "Iron Boots", "Iron Gauntlets", "Steel Pauldrons", "Plated Girdle"} {
			if strings.Contains(item.Name, base) {
				return false
			}
		}
		if class == "Wizard" {
			for _, base := range []string{"Leather Cap", "Leather Tunic", "Leather Pants", "Leather Boots", "Leather Gloves", "Reinforced Spaulders", "Studded Belt"} {
				if strings.Contains(item.Name, base) {
					return false
				}
			}
		}
	}
	return true
}

func dualWieldingRogue(class string, equipment map[string]Item) bool {
	if class != "Rogue" {
		return false
	}
	for _, slot := range []string{"mainHand", "offHand"} {
		item := equipment[slot]
		if item.Type != ItemWeapon || !activeEquipmentItem(slot, item) || !classAllowsEquipment(class, item, slot) {
			return false
		}
	}
	return true
}
