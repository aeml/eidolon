package game

import (
	"math"
	"testing"
	"time"
)

func TestStarterSpacingAwarenessAndRetaliation(t *testing.T) {
	for level := 1; level <= 10; level++ {
		e := &Entity{Type: TypeEnemy, SubType: "Skeleton", Level: level}
		want := EnemySightRange
		if level < 10 {
			want = float64(12 + 3*level)
		}
		if unprovokedEnemySightRange(e) != want {
			t.Fatal("wrong authored awareness")
		}
		e.InstanceID = "dungeon_verdant"
		if unprovokedEnemySightRange(e) != EnemySightRange {
			t.Fatal("dungeon awareness changed")
		}
		e.InstanceID, e.SubType = "", "DemonOrc"
		if unprovokedEnemySightRange(e) != EnemySightRange {
			t.Fatal("advanced awareness changed")
		}
	}
	for _, provoked := range []bool{false, true} {
		w := newTestWorld()
		p := newTestPlayer("road-traveler", "Wizard")
		p.X, p.Z = 145, 200
		e := &Entity{ID: "road-warden", Type: TypeEnemy, SubType: "Skeleton", Level: 3,
			State: "IDLE", Health: 50, MaxHealth: 50, X: 185, Z: 200, SpawnX: 185, SpawnZ: 200,
			TargetX: 185, TargetZ: 210, Speed: 5.4, AttackCooldown: time.Second}
		if provoked {
			e.Threat = map[string]float64{p.ID: 10}
		}
		w.AddEntity(p)
		w.AddEntity(e)
		w.updateEntity(e, .1, []*Entity{p}, &deferredActions{})
		if provoked && e.X >= 185 {
			t.Fatal("provoked enemy failed to retaliate")
		}
		if !provoked && e.X != 185 {
			t.Fatal("unprovoked starter acquired distant player")
		}
	}
}

func TestStarterSpacingAdvancedSectorsRemainOutsideRoads(t *testing.T) {
	for _, family := range []string{"Imp", "DemonOrc"} {
		for _, sign := range []float64{-1, 1} {
			if lanternholdAdvancedSpawnAllowed(family, sign*200, 300) {
				t.Fatal("advanced spawn admitted beside road")
			}
			if !lanternholdAdvancedSpawnAllowed(family, sign*260, 200) ||
				!lanternholdAdvancedSpawnAllowed(family, sign*200, 600) {
				t.Fatal("distant sector removed")
			}
		}
	}
	for _, family := range []string{"Skeleton", "Construct", "InfernoTitan", "MountainTroll"} {
		if !lanternholdAdvancedSpawnAllowed(family, 200, 300) {
			t.Fatal("unrelated family changed")
		}
	}
	for x := 200.0; x <= 300; x += 2 {
		for z := 250.0; z <= 400; z += 2 {
			if lanternholdAdvancedSpawnAllowed("DemonOrc", x, z) &&
				math.Hypot(x-188.11058391445485, z-322.9937488143687)-10 <= EnemySightRange {
				t.Fatalf("spawn %v,%v can acquire level-three road after idle roaming", x, z)
			}
		}
	}
}

func TestStarterSpacingProductionPopulation(t *testing.T) {
	w := NewWorld(nil)
	counts := map[string]int{}
	for _, e := range w.Entities {
		if e.Type != TypeEnemy || e.InstanceID != "" {
			continue
		}
		counts[e.SubType]++
		if !lanternholdAdvancedSpawnAllowed(e.SubType, e.SpawnX, e.SpawnZ) {
			t.Fatalf("production %s spawn inside road buffer: %v,%v", e.SubType, e.SpawnX, e.SpawnZ)
		}
	}
	for _, family := range []string{"Skeleton", "Imp", "DemonOrc", "Construct", "InfernoTitan"} {
		if counts[family] == 0 {
			t.Fatalf("removed %s sector", family)
		}
	}
}
