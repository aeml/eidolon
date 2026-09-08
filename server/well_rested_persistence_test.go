package main

import (
	"math"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestWellRestedSavedFractionSurvivesBSONAndPrivateJournal(t *testing.T) {
	e := &game.Entity{Type: game.TypePlayer, WellRestedSeconds: 123.456789, State: "DEAD"}
	character := &database.Character{Name: "rest-owner", WellRested: wellRestedSnapshot(e), Resources: resourceSnapshot(e), Gold: 1184}
	journal, err := database.OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	pending, err := journal.Write("rest-owner", character)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := pending.Character()
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := bson.Marshal(loaded)
	if err != nil {
		t.Fatal(err)
	}
	var fromDB database.Character
	if err := bson.Unmarshal(encoded, &fromDB); err != nil {
		t.Fatal(err)
	}
	restored := &game.Entity{Type: game.TypePlayer, SubType: "Wizard", Level: 1, BaseStats: game.Stats{Intelligence: 10, Vitality: 10}}
	if err := restoreCharacterWellRested(restored, fromDB.WellRested); err != nil {
		t.Fatal(err)
	}
	restored.RecalculateStats()
	if err := restoreCharacterResources(restored, fromDB.Resources); err != nil {
		t.Fatal(err)
	}
	if restored.WellRestedSeconds != e.WellRestedSeconds || restored.MaxMana != 110 || restored.Health != 0 || restored.Mana != 0 || restored.State != "DEAD" {
		t.Fatal("rest recovery changed duration/resources/death", restored.WellRestedSeconds)
	}
	if err := restoreCharacterWellRested(restored, nil); err != nil || restored.WellRestedSeconds != 0 {
		t.Fatal("legacy save granted rest")
	}
}

func TestWellRestedRejectsInvalidSavedState(t *testing.T) {
	e := &game.Entity{WellRestedSeconds: 3}
	for _, saved := range []*database.CharacterWellRested{
		{Version: 2, RemainingSeconds: 1}, {Version: 1, RemainingSeconds: -1}, {Version: 1, RemainingSeconds: 7200.1},
		{Version: 1, RemainingSeconds: math.NaN()}, {Version: 1, RemainingSeconds: math.Inf(1)},
	} {
		if err := restoreCharacterWellRested(e, saved); err == nil || e.WellRestedSeconds != 3 {
			t.Fatal("invalid state accepted or existing state mutated")
		}
	}
}
