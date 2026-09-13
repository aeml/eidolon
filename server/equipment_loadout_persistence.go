package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func databaseLoadouts(profiles []game.EquipmentLoadout) []database.EquipmentLoadout {
	if profiles == nil {
		return nil
	}
	result := make([]database.EquipmentLoadout, 0, len(profiles))
	for _, profile := range game.CloneEquipmentLoadouts(profiles) {
		result = append(result, database.EquipmentLoadout{Name: profile.Name, Class: profile.Class, Equipment: profile.Equipment, Hotbar: profile.Hotbar})
	}
	return result
}

func gameLoadouts(profiles []database.EquipmentLoadout) []game.EquipmentLoadout {
	if profiles == nil {
		return nil
	}
	result := make([]game.EquipmentLoadout, 0, min(len(profiles), game.MaxEquipmentLoadouts))
	for _, profile := range profiles[:min(len(profiles), game.MaxEquipmentLoadouts)] {
		result = append(result, game.EquipmentLoadout{Name: profile.Name, Class: profile.Class, Equipment: profile.Equipment, Hotbar: profile.Hotbar})
	}
	return game.CloneEquipmentLoadouts(result)
}
