package main

import (
	"fmt"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const characterResourcesVersion = 1

// The caller supplies the same detached entity copy used for the rest of the
// character save. Do not read HP and mana independently from a live actor.
func resourceSnapshot(entity *game.Entity) *database.CharacterResources {
	return &database.CharacterResources{Version: characterResourcesVersion,
		Health: max(0, entity.Health), Mana: max(0, entity.Mana),
		Dead: entity.State == "DEAD" || entity.Health <= 0}
}

// Call after loading the complete build and recalculating maxima, before the
// entity is published to the world. Never replay casts or regenerate offline.
func restoreCharacterResources(entity *game.Entity, saved *database.CharacterResources) error {
	if saved == nil {
		// Legacy saves contain no previous resource values. Preserve the old
		// login baseline once, rather than silently filling bonus capacity.
		entity.Health = min(max(1, entity.Health), max(1, entity.MaxHealth))
		entity.Mana = min(max(0, entity.Mana), max(0, entity.MaxMana))
		return nil
	}
	if saved.Version != characterResourcesVersion || saved.Health < 0 || saved.Mana < 0 {
		return fmt.Errorf("unsupported or invalid resource snapshot version %d", saved.Version)
	}
	entity.Health = min(saved.Health, max(0, entity.MaxHealth))
	entity.Mana = min(saved.Mana, max(0, entity.MaxMana))
	if saved.Dead || entity.Health == 0 {
		entity.Health = 0
		entity.State = "DEAD"
	} else {
		entity.State = "IDLE"
	}
	return nil
}
