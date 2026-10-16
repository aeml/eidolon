package game

import (
	"fmt"
	"reflect"
	"testing"
	"time"
)

func TestQAWaypointRejectsDeadOrZeroHealthWithoutChangingLifecycle(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(&Entity{ID: "qa-waypoint-live-target", Type: TypeEnemy, State: "IDLE", Health: 100, MaxHealth: 100, X: 120, Z: 200})
	for _, waypoint := range []string{"combat", "encounter", "verdant"} {
		for _, state := range []struct {
			name, state string
			health      int
		}{{"dead", "DEAD", 0}, {"inconsistent-dead", "DEAD", 20}, {"zero-health", "IDLE", 0}} {
			t.Run(waypoint+"/"+state.name, func(t *testing.T) {
				stamp := time.Now().Add(time.Minute)
				player := &Entity{ID: fmt.Sprintf("qa-waypoint-%s-%s", waypoint, state.name), Type: TypePlayer,
					SubType: "Fighter", X: 20, Y: 3, Z: 40, TargetX: 25, TargetZ: 45, TargetID: "retained-target",
					Health: state.health, MaxHealth: 100, State: state.state, MoveLockUntil: stamp,
					QAWaypointProtectionEndTime: stamp, QAHazardInspectionEndTime: stamp, QAHealthRegenPausedUntil: stamp}
				w.AddEntity(player)
				// AddEntity applies the ordinary ground/entry normalization.
				// Rejection must preserve that actual live-world starting state.
				snapshot := func() []any {
					return []any{player.X, player.Y, player.Z, player.TargetX, player.TargetZ, player.TargetID,
						player.State, player.Health, player.MaxHealth, player.MoveLockUntil,
						player.QAWaypointProtectionEndTime, player.QAHazardInspectionEndTime, player.QAHealthRegenPausedUntil}
				}
				before := snapshot()
				if got, ok := w.MovePlayerToQAWaypoint(player.ID, waypoint); ok || got != nil {
					t.Fatal("an incapacitated player must use the ordinary resurrection flow")
				}
				if !reflect.DeepEqual(before, snapshot()) {
					t.Fatal("rejected waypoint changed lifecycle, position, target or protection")
				}
			})
		}
	}
}

func TestQAWaypointLivePlayerKeepsHealthAndValue(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "qa-waypoint-live-player", Type: TypePlayer, SubType: "Fighter", State: "IDLE",
		Health: 37, MaxHealth: 100, Level: 24, Gold: 1234, EP: 67}
	w.AddEntity(player)
	if got, ok := w.MovePlayerToQAWaypoint(player.ID, "combat"); !ok || got != player {
		t.Fatal("live QA waypoint should retain its ordinary preparation behavior")
	}
	if player.Health != 37 || player.MaxHealth != 100 || player.Level != 24 || player.Gold != 1234 || player.EP != 67 {
		t.Fatal("a QA waypoint must not heal, revive or grant progression/value")
	}
}
