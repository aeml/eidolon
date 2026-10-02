package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestNetworkWalkingClipsWallCrossingButKeepsRealDoorways(t *testing.T) {
	for _, origin := range []float64{0, 30000} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("origin-%v/doorway-%v", origin, doorway), func(t *testing.T) {
				player := newTestPlayer("path-player", "Fighter")
				player.X, player.Z, player.Speed = origin, origin, 20
				player.InstanceID = "dungeon_network-path"
				player.MovementContext, player.RecoveryContextReady = "walk-path", true
				w := newPvPTestWorld(player)
				// Rooms connect through a route around the solid gap. Both
				// endpoints are valid floors, but that does not authorize tunnelling.
				rects := []DungeonWalkRect{
					{X: origin, Z: origin, Width: 20, Height: 20},
					{X: origin + 30, Z: origin, Width: 20, Height: 20},
					{X: origin, Z: origin + 15, Width: 6, Height: 36},
					{X: origin + 15, Z: origin + 30, Width: 36, Height: 6},
					{X: origin + 30, Z: origin + 15, Width: 6, Height: 36},
				}
				if doorway {
					rects = append(rects, DungeonWalkRect{X: origin + 15, Z: origin, Width: 12, Height: 6})
				}
				w.InstanceLayouts = map[string]*DungeonInstance{player.InstanceID: {Layout: DungeonLayout{WalkRects: rects}}}
				now := time.Unix(1000, 0)
				if !w.updatePlayerMovementAt(player.ID, origin+30, 0, origin, 0, "MOVING", 1, &player.MovementContext, now) {
					t.Fatal("canonical path correction rejected instead of acknowledged")
				}
				wantX := origin + 10
				if doorway {
					wantX = origin + 30
				}
				if math.Abs(player.X-wantX) > 1e-6 || player.Z != origin || player.LastMoveSequence != 1 {
					t.Fatalf("path admission lost wall/doorway/ack: x=%v z=%v ack=%d, want x=%v", player.X, player.Z, player.LastMoveSequence, wantX)
				}
			})
		}
	}
}
