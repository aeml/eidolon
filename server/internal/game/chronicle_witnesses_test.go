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
