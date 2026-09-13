package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func databaseAppearances(looks map[string]game.EquipmentAppearance) map[string]database.EquipmentAppearance {
	if looks == nil {
		return nil
	}
	result := make(map[string]database.EquipmentAppearance, len(looks))
	for key, look := range looks {
		result[key] = database.EquipmentAppearance{BaseName: look.BaseName, Rarity: string(look.Rarity), Slot: look.Slot}
	}
	return result
}

func gameAppearances(looks map[string]database.EquipmentAppearance) map[string]game.EquipmentAppearance {
	if looks == nil {
		return nil
	}
	result := make(map[string]game.EquipmentAppearance, len(looks))
	for key, look := range looks {
		result[key] = game.EquipmentAppearance{BaseName: look.BaseName, Rarity: game.ItemRarity(look.Rarity), Slot: look.Slot}
	}
	return result
}
