package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestProgressionCurveVersionAndMigratedFractionSurviveSnapshotBSON(t *testing.T) {
	// This document deliberately has no version: it models a real pre-versioned
	// save, not a new-curve character relabeled as legacy by the fixture.
	document := bson.M{"name": "curve-save", "class": "Wizard", "level": 30,
		"xp": 9890, "gold": 732, "stats": bson.M{"strength": 71, "intelligence": 52, "vitality": 68},
		"resonance_level": 3, "resonance_xp": 42, "resonance_points": 1,
		"resonance_ranks": bson.M{"ward": 2}}
	encoded, err := bson.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	var saved database.Character
	if err := bson.Unmarshal(encoded, &saved); err != nil {
		t.Fatal(err)
	}
	if saved.ProgressionVersion != 0 {
		t.Fatal("legacy fixture unexpectedly versioned")
	}
	progress, err := game.MigrateSavedProgression(saved.Level, saved.XP, saved.ProgressionVersion)
	if err != nil {
		t.Fatal(err)
	}
	player := &game.Entity{Type: game.TypePlayer, SubType: saved.Class, Level: saved.Level,
		Experience: saved.XP, Gold: saved.Gold, ResonanceLevel: saved.ResonanceLevel,
		ResonanceXP: saved.ResonanceXP, ResonancePoints: saved.ResonancePoints, ResonanceRanks: saved.ResonanceRanks,
		BaseStats: game.Stats{Strength: saved.Stats.Strength, Intelligence: saved.Stats.Intelligence, Vitality: saved.Stats.Vitality}}
	player.NormalizeResonanceProgress()
	player.ApplySavedProgression(progress)
	if player.Level != 30 || player.Experience != 9890 || player.Gold != 732 {
		t.Fatalf("incorrect saved fraction conversion: %+v", progress)
	}
	for iteration := 0; iteration < 3; iteration++ {
		snapshot := characterSnapshot("curve-save", player, time.Unix(1234, 0))
		encoded, err = bson.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		var raw bson.M
		if err := bson.Unmarshal(encoded, &raw); err != nil {
			t.Fatal(err)
		}
		if _, exists := raw["progression_version"]; !exists {
			t.Fatal("snapshot omitted curve version")
		}
		if err := bson.Unmarshal(encoded, &saved); err != nil {
			t.Fatal(err)
		}
		if saved.ProgressionVersion != game.CurrentProgressionVersion {
			t.Fatal("version not persisted")
		}
		again, err := game.MigrateSavedProgression(saved.Level, saved.XP, saved.ProgressionVersion)
		if err != nil || again != progress {
			t.Fatalf("saved progress migrated twice: %+v / %v", again, err)
		}
		if saved.Gold != 732 || saved.ResonanceLevel != 3 || saved.ResonanceXP != 42 || saved.ResonancePoints != 1 ||
			!reflect.DeepEqual(saved.ResonanceRanks, map[string]int{"ward": 2, "power": 0, "fortune": 0}) || saved.Stats.Strength != 71 {
			t.Fatal("unrelated earned state changed")
		}
		player.ApplySavedProgression(again)
	}
}
