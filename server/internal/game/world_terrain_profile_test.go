package game

import (
	"math"
	"reflect"
	"testing"
)

func TestConfiguredTerrainRejectsUnknownBeforeCreatingWorld(t *testing.T) {
	for _, profile := range []string{"", "earth-elevation-v1", "future-profile"} {
		if w, err := NewWorldWithTerrainProfile(nil, profile); err == nil || w != nil {
			t.Fatalf("unsupported profile %q created a world", profile)
		}
	}
}

func TestConfiguredTerrainFlatPreservesOrdinaryWorld(t *testing.T) {
	w, err := NewWorldWithTerrainProfile(nil, FlatTerrainProfile)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if w.TerrainProfile() != FlatTerrainProfile || w.terrainElevation != nil || len(w.rockSolids) != 0 {
		t.Fatal("flat configuration enabled raised geometry/collisions")
	}
}

func TestConfiguredRaisedTerrainAdmitsAllClassesWithoutProgressionMutation(t *testing.T) {
	w, err := NewWorldWithTerrainProfile(nil, RaisedEarthTerrainProfile)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if w.TerrainProfile() != RaisedEarthTerrainProfile || len(w.rockSolids) != 18 {
		t.Fatal("public selection did not install the full negotiated surface")
	}
	for _, class := range []string{"Fighter", "Rogue", "Cleric", "Wizard"} {
		t.Run(class, func(t *testing.T) {
			p := newTestPlayer("terrain-returning-"+class, class)
			p.X, p.Y, p.Z = -102, 0, -321 // Old flat save inside a new formation.
			p.Health, p.Mana, p.Gold, p.EP = 37, 13, 4567, 9
			item := Item{ID: "retained-item", Name: "Retained item", Stack: 1, Stats: map[string]int{"vitality": 3}}
			p.Inventory = []Item{item}
			level, xp := p.Level, p.Experience
			w.AddEntity(p)
			if insideRockSolids(w.rockSolids, rockPoint{p.X, p.Z}, p.ReplicatedBodyRadius()) {
				t.Fatal("returning actor remained inside new formation")
			}
			assertActorOnElevation(t, w, p)
			if math.Hypot(p.X+102, p.Z+321) > 25 {
				t.Fatal("terrain correction unnecessarily teleported actor")
			}
			if p.Health != 37 || p.Mana != 13 || p.Gold != 4567 || p.EP != 9 ||
				p.Level != level || p.Experience != xp || !reflect.DeepEqual(p.Inventory, []Item{item}) {
				t.Fatal("terrain admission changed resources, currency, progression or inventory")
			}
			beforeX, beforeY, beforeZ := p.X, p.Y, p.Z
			w.AddEntity(p)
			if p.X != beforeX || p.Y != beforeY || p.Z != beforeZ {
				t.Fatal("repeated admission moved corrected actor again")
			}
		})
	}
	for _, instance := range []string{"dungeon_terrain-selection", CasinoInstanceID} {
		p := newTestPlayer("terrain-instance-"+instance, "Wizard")
		p.InstanceID, p.X, p.Y, p.Z = instance, -102, 8, -321
		w.AddEntity(p)
		if p.X != -102 || p.Y != 8 || p.Z != -321 {
			t.Fatal("overworld rollout rewrote instance-owned position")
		}
	}
}
