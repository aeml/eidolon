package game

import (
	"encoding/json"
	"math"
	"os"
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
		if npc.Z < 115 || npc.Z > 280 || math.Abs(npc.X) > 85 {
			t.Fatalf("outside clear town area: %+v", npc)
		}
		if npc.Damage != 0 || len(npc.Quests) != 0 {
			t.Fatal("witness must not attack or offer quests")
		}
	}
}

func TestTownResidentsWalkSmoothClearLoopsAndPauseForListeners(t *testing.T) {
	tracePath := os.Getenv("EIDOLON_TOWN_RESIDENT_TRACE")
	trace := make(map[string][]map[string]any)
	w := &World{Entities: make(map[string]*Entity), Grid: NewSpatialMap(50)}
	w.spawnChronicleWitnesses()
	for _, resident := range w.Entities {
		moved, idle := false, false
		for tick := 0; tick < 30*240; tick++ {
			oldX, oldZ, oldYaw := resident.X, resident.Z, resident.Rotation
			w.updateEntity(resident, 1.0/30, nil, &deferredActions{})
			if tracePath != "" && tick < 45*30 {
				trace[resident.ID] = append(trace[resident.ID], map[string]any{"time": float64(tick+1) / 30,
					"id": resident.ID, "type": "NPC", "subType": "ChronicleWitness", "name": resident.Name,
					"x": resident.X, "y": resident.Y, "z": resident.Z, "rotation": resident.Rotation, "state": resident.State})
			}
			distance := math.Hypot(resident.X-oldX, resident.Z-oldZ)
			if distance > 1.601/30 {
				t.Fatal("resident snapped", resident.ID, distance)
			}
			if math.Abs(resident.Rotation-oldYaw) > math.Pi*.201 {
				t.Fatal("resident spun abruptly", resident.ID)
			}
			moved = moved || distance > .001
			idle = idle || resident.State == "IDLE"
			if math.Abs(resident.X) > 100 || resident.Z < 100 || resident.Z > 300 || !adminShapesClear(adminLandingColliders.Overworld, resident.X, 0, resident.Z) {
				t.Fatal("resident crossed a town solid/boundary", resident.ID, resident.X, resident.Z)
			}
			found := false
			for _, entity := range w.Grid.Nearby(resident.X, resident.Z, 2, "") {
				found = found || entity.ID == resident.ID
			}
			if !found {
				t.Fatal("resident missing from live spatial grid")
			}
		}
		if !moved || !idle {
			t.Fatal("resident must walk and rest", resident.ID)
		}
		player := &Entity{Type: TypePlayer, X: resident.X + 4, Z: resident.Z, State: "IDLE"}
		x, z, clock := resident.X, resident.Z, resident.townResidentClock
		for tick := 0; tick < 300; tick++ {
			w.updateTownResident(resident, 1.0/30, []*Entity{player})
		}
		if resident.X != x || resident.Z != z || resident.townResidentClock != clock || resident.State != "IDLE" {
			t.Fatal("resident walked away from conversation")
		}
		player.InstanceID = "other"
		w.updateTownResident(resident, 1.0/30, []*Entity{player})
		if resident.townResidentClock == clock {
			t.Fatal("resident did not resume")
		}
	}
	service := &Entity{ID: "quest-npc-1", Type: TypeNPC, SubType: "QuestNPC", X: -20, Z: 200}
	if w.updateTownResident(service, .1, nil) || service.X != -20 || service.Z != 200 {
		t.Fatal("service moved")
	}
	if tracePath != "" {
		data, err := json.Marshal(trace)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(tracePath, data, 0644); err != nil {
			t.Fatal(err)
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
