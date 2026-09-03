package game

import (
	"math"
	"testing"
	"time"
)

func newHazardLifecycleWorld(t *testing.T) (*World, *Entity, *Hazard) {
	t.Helper()
	w := NewWorld(nil)
	hazard := &Hazard{
		ID:           "hazard-lifecycle",
		HazardType:   HazardSandstorm,
		X:            500,
		Z:            500,
		Radius:       6,
		DamagePct:    0.10,
		TickInterval: 1,
	}
	w.Hazards = map[string]*Hazard{hazard.ID: hazard}
	player := &Entity{
		ID:        "player-hazard-lifecycle",
		Type:      TypePlayer,
		SubType:   "Fighter",
		X:         hazard.X,
		Z:         hazard.Z,
		TargetX:   hazard.X,
		TargetZ:   hazard.Z,
		Health:    100,
		MaxHealth: 100,
		State:     "IDLE",
		Cooldowns: make(map[string]time.Time),
	}
	w.AddEntity(player)
	return w, player, hazard
}

func assertFreshHazardExposure(t *testing.T, w *World, player *Entity, hazard *Hazard) {
	t.Helper()
	player.X, player.Z = hazard.X, hazard.Z
	player.InstanceID = ""
	player.State = "IDLE"
	player.Disconnected = false
	player.Health = player.MaxHealth

	w.processHazardDamage(0.5, []*Entity{player})
	if player.Health != player.MaxHealth {
		t.Fatalf("fresh half tick caused early damage: %d/%d", player.Health, player.MaxHealth)
	}
	w.processHazardDamage(0.5, []*Entity{player})
	if player.Health != 90 {
		t.Fatalf("complete fresh tick caused wrong damage: got %d, want 90", player.Health)
	}
}

func TestHazardExposureResetsAcrossSafeLifecycleBoundaries(t *testing.T) {
	tests := []struct {
		name       string
		transition func(*World, *Entity)
	}{
		{
			name: "inclusive town safety",
			transition: func(w *World, player *Entity) {
				player.X, player.Z = -100, 100
				w.processHazardDamage(0.1, []*Entity{player})
			},
		},
		{
			name: "dungeon instance",
			transition: func(w *World, player *Entity) {
				player.InstanceID = "dungeon_hazard_lifecycle"
				w.processHazardDamage(0.1, []*Entity{player})
			},
		},
		{
			name: "death and respawn",
			transition: func(w *World, player *Entity) {
				player.State = "DEAD"
				player.Health = 0
				w.processHazardDamage(0.1, []*Entity{player})
			},
		},
		{
			name: "disconnected session",
			transition: func(w *World, player *Entity) {
				if !w.SetEntityDisconnected(player.ID, time.Now()) {
					t.Fatal("failed to mark lifecycle player disconnected")
				}
				w.processHazardDamage(0.1, []*Entity{player})
				if _, ok := w.ClearEntityDisconnected(player.ID); !ok {
					t.Fatal("failed to resume lifecycle player")
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			w, player, hazard := newHazardLifecycleWorld(t)
			w.processHazardDamage(0.6, []*Entity{player})
			if player.Health != player.MaxHealth {
				t.Fatal("partial exposure unexpectedly caused damage")
			}

			test.transition(w, player)
			if _, exists := w.PlayerHazardTicks[player.ID]; exists {
				t.Fatal("safe lifecycle boundary retained hazard tick state")
			}

			assertFreshHazardExposure(t, w, player, hazard)
		})
	}
}

func TestHazardTickStateClearsOnEveryExplicitWorldTransfer(t *testing.T) {
	t.Run("respawn", func(t *testing.T) {
		w, player, _ := newHazardLifecycleWorld(t)
		w.PlayerHazardTicks[player.ID] = map[string]float64{"hazard-lifecycle": 0.75}
		w.PerformRespawn(player.ID)
		if _, exists := w.PlayerHazardTicks[player.ID]; exists {
			t.Fatal("respawn retained hazard tick state")
		}
	})

	t.Run("recall", func(t *testing.T) {
		w, player, _ := newHazardLifecycleWorld(t)
		w.PlayerHazardTicks[player.ID] = map[string]float64{"hazard-lifecycle": 0.75}
		w.PerformRecall(player.ID)
		if _, exists := w.PlayerHazardTicks[player.ID]; exists {
			t.Fatal("recall retained hazard tick state")
		}
	})

	t.Run("instance transition", func(t *testing.T) {
		w, player, _ := newHazardLifecycleWorld(t)
		w.PlayerHazardTicks[player.ID] = map[string]float64{"hazard-lifecycle": 0.75}
		if err := w.EnterInstance(player.ID, "dungeon_hazard_lifecycle"); err != nil {
			t.Fatalf("EnterInstance failed: %v", err)
		}
		if _, exists := w.PlayerHazardTicks[player.ID]; exists {
			t.Fatal("instance transition retained hazard tick state")
		}
	})

	t.Run("entity removal", func(t *testing.T) {
		w, player, _ := newHazardLifecycleWorld(t)
		w.PlayerHazardTicks[player.ID] = map[string]float64{"hazard-lifecycle": 0.75}
		w.RemoveEntity(player.ID)
		if _, exists := w.PlayerHazardTicks[player.ID]; exists {
			t.Fatal("entity removal retained hazard tick state")
		}
	})
}

func TestTownSafetyIncludesFenceLineAndEndsImmediatelyOutside(t *testing.T) {
	tests := []struct {
		name     string
		x, z     float64
		outsideX float64
		outsideZ float64
	}{
		{name: "northwest", x: -100, z: 100, outsideX: -100.001, outsideZ: 100},
		{name: "northeast", x: 100, z: 100, outsideX: 100.001, outsideZ: 100},
		{name: "southwest", x: -100, z: 300, outsideX: -100, outsideZ: 300.001},
		{name: "southeast", x: 100, z: 300, outsideX: 100, outsideZ: 300.001},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			w, player, hazard := newHazardLifecycleWorld(t)
			hazard.X, hazard.Z, hazard.Radius = test.x, test.z, 1
			player.X, player.Z = test.x, test.z
			w.processHazardDamage(1, []*Entity{player})
			if player.Health != player.MaxHealth {
				t.Fatal("player took hazard damage on inclusive town fence line")
			}

			player.X, player.Z = test.outsideX, test.outsideZ
			w.processHazardDamage(1, []*Entity{player})
			if player.Health != 90 {
				t.Fatalf("player immediately outside town did not take hazard damage: %d", player.Health)
			}
		})
	}
}

func TestHazardRadiusIsInclusiveAndLeavingResetsPartialTick(t *testing.T) {
	w, player, hazard := newHazardLifecycleWorld(t)
	player.X = hazard.X + hazard.Radius
	w.processHazardDamage(1, []*Entity{player})
	if player.Health != 90 {
		t.Fatalf("exact hazard boundary did not apply damage: %d", player.Health)
	}

	player.Health = player.MaxHealth
	w.processHazardDamage(0.6, []*Entity{player})
	player.X = hazard.X + hazard.Radius + 0.001
	w.processHazardDamage(0.1, []*Entity{player})
	player.X = hazard.X + hazard.Radius
	w.processHazardDamage(0.5, []*Entity{player})
	if player.Health != player.MaxHealth {
		t.Fatal("leaving the exact hazard footprint retained a partial tick")
	}
}

func TestCanonicalHazardCatalogHasEveryRealmAnchorAndBroadcastEntity(t *testing.T) {
	w := NewWorld(nil)
	if len(w.Hazards) != 65 {
		t.Fatalf("canonical hazard count changed: got %d, want 65", len(w.Hazards))
	}

	typeCounts := make(map[HazardType]int)
	for id, hazard := range w.Hazards {
		typeCounts[hazard.HazardType]++
		if hazard.Radius < 5 || hazard.Radius > 10 || hazard.TickInterval != 1 || hazard.DamagePct <= 0 {
			t.Fatalf("invalid canonical hazard %s: %+v", id, hazard)
		}
		entity := w.Entities[id]
		if entity == nil || entity.Type != TypeHazard || entity.SubType != string(hazard.HazardType) ||
			math.Abs(entity.X-hazard.X) > 0.000001 || math.Abs(entity.Z-hazard.Z) > 0.000001 ||
			math.Abs(entity.Scale-hazard.Radius) > 0.000001 {
			t.Fatalf("hazard %s has mismatched broadcast entity: %+v", id, entity)
		}
	}

	wantCounts := map[HazardType]int{
		HazardLavaPool:  19,
		HazardSandstorm: 12,
		HazardLightning: 15,
		HazardWindGust:  19,
	}
	for hazardType, want := range wantCounts {
		if got := typeCounts[hazardType]; got != want {
			t.Fatalf("%s anchor count: got %d, want %d", hazardType, got, want)
		}
	}
}
