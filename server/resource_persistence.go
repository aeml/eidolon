package main

import (
	"fmt"
	"math"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const characterResourcesVersion = 1

func wellRestedSnapshot(entity *game.Entity) *database.CharacterWellRested {
	if entity.WellRestedSeconds == 0 {
		return nil
	}
	return &database.CharacterWellRested{Version: 1, RemainingSeconds: entity.WellRestedSeconds}
}

// Restore before derived maxima are calculated. No wall-clock adjustment: the
// rest bank neither earns nor expires while the character is logged out.
func restoreCharacterWellRested(entity *game.Entity, saved *database.CharacterWellRested) error {
	if saved == nil {
		entity.WellRestedSeconds = 0
		return nil
	}
	if saved.Version != 1 || saved.RemainingSeconds < 0 || saved.RemainingSeconds > game.MaxWellRestedSeconds ||
		math.IsNaN(saved.RemainingSeconds) || math.IsInf(saved.RemainingSeconds, 0) {
		return fmt.Errorf("unsupported or invalid Well Rested snapshot")
	}
	entity.WellRestedSeconds = saved.RemainingSeconds
	return nil
}

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
