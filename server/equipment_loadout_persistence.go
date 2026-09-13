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
		entry := database.EquipmentLoadout{Name: profile.Name, Class: profile.Class, Equipment: profile.Equipment, Hotbar: profile.Hotbar}
		if profile.Build != nil {
			entry.Build = &database.LoadoutBuild{Branch: profile.Build.Branch, TalentRanks: profile.Build.TalentRanks, SkillRunes: profile.Build.SkillRunes}
		}
		result = append(result, entry)
	}
	return result
}

func gameLoadouts(profiles []database.EquipmentLoadout) []game.EquipmentLoadout {
	if profiles == nil {
		return nil
	}
	result := make([]game.EquipmentLoadout, 0, min(len(profiles), game.MaxEquipmentLoadouts))
	for _, profile := range profiles[:min(len(profiles), game.MaxEquipmentLoadouts)] {
		entry := game.EquipmentLoadout{Name: profile.Name, Class: profile.Class, Equipment: profile.Equipment, Hotbar: profile.Hotbar}
		if profile.Build != nil {
			entry.Build = &game.LoadoutBuild{Branch: profile.Build.Branch, TalentRanks: profile.Build.TalentRanks, SkillRunes: profile.Build.SkillRunes}
		}
		result = append(result, entry)
	}
	return game.CloneEquipmentLoadouts(result)
}
