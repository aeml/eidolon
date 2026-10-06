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

// Full current generated population, not a reduced AI-only fixture. The
// declared100 idle actors stay in the existing safe scenes (60 casino/40 town)
// so death cannot silently reduce the target-scan workload during profiling.
// No socket/DB/combat/headroom or real-player responsiveness claim.
func BenchmarkWorldUpdateCurrentPopulation100Idle(b *testing.B) {
	w := NewWorld(nil)
	b.Cleanup(w.StopBackground)
	for index := 0; index < 100; index++ {
		player := &Entity{ID: fmt.Sprintf("player-frame-benchmark-%d", index), Type: TypePlayer,
			SubType: "Fighter", Level: 30, State: "IDLE", X: float64(index%4) * 2, Z: 200,
			Health: 100, MaxHealth: 100, Mana: 100, MaxMana: 100}
		if index < 60 {
			player.InstanceID, player.Z = CasinoInstanceID, 160
		}
		if w.SafeZoneAt(player.InstanceID, player.X, player.Z) == "" {
			b.Fatal("benchmark actor must remain in its declared safe scene")
		}
		w.AddEntity(player)
	}
	b.ReportAllocs()
	for b.Loop() {
		w.Update(0.033)
	}
}
