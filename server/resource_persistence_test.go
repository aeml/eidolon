package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestResourceSnapshotRoundTrip(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, level := range []int{1, 30, 100} {
			for _, resources := range [][2]int{{1, 0}, {50, 25}, {100, 100}, {0, 0}} {
				e := &game.Entity{Type: game.TypePlayer, SubType: class, Level: level,
					State: "IDLE", Health: resources[0], Mana: resources[1],
					BaseStats: game.Stats{Vitality: 100, Intelligence: 100},
					Equipment: map[string]game.Item{"chest": {Stats: map[string]int{"vitality": 20, "intelligence": 30}}}}
				e.RecalculateStats()
				expected := resourceSnapshot(e)
				for cycle := 0; cycle < 5; cycle++ {
					saved := characterSnapshot("resource-fixture", e, time.Now())
					raw, err := bson.Marshal(saved)
					if err != nil {
						t.Fatal(err)
					}
					var loaded database.Character
					if err := bson.Unmarshal(raw, &loaded); err != nil {
						t.Fatal(err)
					}
					e.Health, e.Mana = 999, 999
					if err := restoreCharacterResources(e, loaded.Resources); err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(resourceSnapshot(e), expected) {
						t.Fatalf("%s level%d cycle%d: got%+v want%+v", class, level, cycle, resourceSnapshot(e), expected)
					}
					if (e.State == "DEAD") != (resources[0] == 0) {
						t.Fatal("death state lost")
					}
				}
			}
		}
	}
}

func TestResourceRestoreLegacyZeroAndValidation(t *testing.T) {
	e := &game.Entity{Health: 2080, MaxHealth: 2575, Mana: 1190, MaxMana: 1685, State: "IDLE"}
	if err := restoreCharacterResources(e, nil); err != nil {
		t.Fatal(err)
	}
	if e.Health != 2080 || e.Mana != 1190 {
		t.Fatal("legacy baseline was refilled")
	}
	for _, bad := range []*database.CharacterResources{
		{Version: 2, Health: 1}, {Version: 1, Health: -1}, {Version: 1, Health: 1, Mana: -1},
	} {
		if restoreCharacterResources(e, bad) == nil {
			t.Fatal("invalid snapshot accepted")
		}
		if e.Health != 2080 || e.Mana != 1190 {
			t.Fatal("validation mutated resources")
		}
	}
	if err := restoreCharacterResources(e, &database.CharacterResources{Version: 1, Health: 10, Mana: 0}); err != nil {
		t.Fatal(err)
	}
	if e.Health != 10 || e.Mana != 0 || e.State != "IDLE" {
		t.Fatal("zero mana was refilled")
	}
	if err := restoreCharacterResources(e, &database.CharacterResources{Version: 1, Health: 10, Mana: 0, Dead: true}); err != nil {
		t.Fatal(err)
	}
	if e.Health != 0 || e.State != "DEAD" {
		t.Fatal("saved death was revived")
	}
}

func TestResourceRestorePreservesFullBonusBarsAndClampsReducedMaxima(t *testing.T) {
	e := &game.Entity{Health: 2080, MaxHealth: 2575, Mana: 1190, MaxMana: 1685}
	saved := &database.CharacterResources{Version: 1, Health: 2575, Mana: 1685}
	if err := restoreCharacterResources(e, saved); err != nil {
		t.Fatal(err)
	}
	if e.Health != 2575 || e.Mana != 1685 {
		t.Fatal("login lost level bonus capacity")
	}
	e.MaxHealth, e.MaxMana = 100, 80
	if err := restoreCharacterResources(e, saved); err != nil {
		t.Fatal(err)
	}
	if e.Health != 100 || e.Mana != 80 {
		t.Fatal("resource exceeds current maximum")
	}
	if saved.Health != 2575 || saved.Mana != 1685 {
		t.Fatal("restore mutated persisted snapshot")
	}
}
