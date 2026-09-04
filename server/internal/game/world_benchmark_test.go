package game

import (
	"fmt"
	"testing"
)

func BenchmarkGetStateForPlayer(b *testing.B) {
	world := NewWorld(nil)
	player := &Entity{ID: "player-benchmark", Type: TypePlayer, X: 0, Z: 0, Health: 100, MaxHealth: 100}
	world.AddEntity(player)
	for index := 0; index < 250; index++ {
		world.AddEntity(&Entity{
			ID:        fmt.Sprintf("enemy-benchmark-%d", index),
			Type:      TypeEnemy,
			SubType:   "Skeleton",
			X:         float64(index%25) * 4,
			Z:         float64(index/25) * 4,
			Health:    100,
			MaxHealth: 100,
		})
	}

	b.ReportAllocs()
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		_ = world.GetStateForPlayer(player.ID, 200)
	}
}
