package game

import (
	"math"
	"testing"
)

func TestChronicleWitnessesAreNonCombatResidentsInOpenTown(t *testing.T) {
	w := &World{Entities: make(map[string]*Entity), Grid: NewSpatialMap(50)}
	w.spawnChronicleWitnesses()
	if len(w.Entities) != 4 {
		t.Fatalf("witness count = %d", len(w.Entities))
	}
	for _, npc := range w.Entities {
		if npc.Type != TypeNPC || npc.SubType != "ChronicleWitness" || npc.InstanceID != "" || npc.State != "IDLE" {
			t.Fatalf("invalid witness: %+v", npc)
		}
		if npc.Z != 235 || math.Hypot(npc.X, npc.Z-200) >= 50 {
			t.Fatalf("outside clear town area: %+v", npc)
		}
		if npc.Damage != 0 || len(npc.Quests) != 0 {
			t.Fatal("witness must not attack or offer quests")
		}
	}
}

func TestDarkRealmWitnessesHaveClearNonCombatReadingApproaches(t *testing.T) {
	w := &World{Entities: make(map[string]*Entity), Grid: NewSpatialMap(50)}
	w.spawnDarkRealmCamp()
	w.spawnDarkRealmEncounters()
	for _, witness := range darkRealmWitnesses {
		npc := w.Entities[witness.id]
		if npc == nil || npc.Type != TypeNPC || npc.SubType != "ChronicleWitness" || npc.InstanceID != DarkRealmInstanceID || npc.Damage != 0 || len(npc.Quests) != 0 {
			t.Fatal("invalid expedition witness", witness.id)
		}
		inside := false
		for _, rect := range DarkRealmLayout().WalkRects {
			inside = inside || pointInWalkRect(rect, npc.X, npc.Z)
		}
		if !inside {
			t.Fatal("witness outside expedition floor", witness.id)
		}
		if !adminShapesClear(adminLandingColliders.DarkRealm, npc.X, 0, npc.Z) {
			t.Fatal("witness inside scenery", witness.id)
		}
		for _, enemy := range w.Entities {
			if enemy.Type == TypeEnemy && math.Hypot(npc.X-enemy.SpawnX, npc.Z-enemy.SpawnZ) < 15 {
				t.Fatal("enemy spawns on witness approach", witness.id, enemy.ID)
			}
		}
	}
}
