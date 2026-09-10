package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Used only when the account has no saved character. Loading an existing
// character must keep its recorded stats, items and progression untouched.
func newPlayerCharacter(name, class string) *database.Character {
	stats := game.InitialPlayerStats()
	return &database.Character{
		Name: name, Class: class, Level: 1, XP: 0,
		ProgressionVersion: game.CurrentProgressionVersion,
		X:                  -1.25, Y: 0, Z: 200,
		Stats: database.Stats{
			Strength: stats.Strength, Dexterity: stats.Dexterity,
			Intelligence: stats.Intelligence, Wisdom: stats.Wisdom, Vitality: stats.Vitality,
		},
	}
}
