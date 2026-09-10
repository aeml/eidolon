package main

import (
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestNewPlayerCharacterPreservesLiveDefaultsForEveryClass(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			p := newPlayerCharacter("new-player", class)
			want := database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10}
			if p.Stats != want || p.Name != "new-player" || p.Class != class || p.Level != 1 || p.XP != 0 ||
				p.ProgressionVersion != game.CurrentProgressionVersion || p.X != -1.25 || p.Y != 0 || p.Z != 200 {
				t.Fatalf("new-character defaults changed: %+v", p)
			}
			if p.Gold != 0 || len(p.Inventory) != 0 || len(p.Equipment) != 0 || len(p.Stash) != 0 {
				t.Fatal("new-character constructor granted resources")
			}
			p.Stats.Intelligence = 999
			if newPlayerCharacter("next-player", class).Stats != want {
				t.Fatal("starting stats shared mutable state")
			}
		})
	}
}
