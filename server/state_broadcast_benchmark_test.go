package main

import (
	"bytes"
	"fmt"
	"testing"

	"eidolon-server/internal/game"
)

// Profile the actual generated-world snapshot/delta/protobuf/queue path, not
// just one entity encoder. Declared static100 actors:60 casino/40 town. This
// deliberately excludes simulation, sockets, Mongo, combat and client decode;
// its idle cost is diagnostic, never native capacity/headroom acceptance.
func BenchmarkBroadcastStateCurrentPopulation100Idle(b *testing.B) {
	previousWorld, previousSessions := world, activeSessions
	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client, 100)
	b.Cleanup(func() {
		world.StopBackground()
		world, activeSessions = previousWorld, previousSessions
	})
	for index := 0; index < 100; index++ {
		id := fmt.Sprintf("broadcast-profile-%d", index)
		player := &game.Entity{ID: id, Type: game.TypePlayer,
			SubType: "Fighter", Level: 30, State: "IDLE", X: float64(index%4) * 2, Z: 200,
			Health: 100, MaxHealth: 100, Mana: 100, MaxMana: 100}
		if index < 60 {
			player.InstanceID, player.Z = game.CasinoInstanceID, 160
		}
		if world.SafeZoneAt(player.InstanceID, player.X, player.Z) == "" {
			b.Fatal("profile actor left its declared safe scene")
		}
		world.AddEntity(player)
		client := newAutoStatusClient(id)
		client.prioritySend = make(chan []byte, 32)
		activeSessions[id] = client
	}
	drain := func() uint64 {
		var total uint64
		for _, client := range activeSessions {
			if len(client.send) != 1 {
				b.Fatal("every recipient must get one real queued state frame")
			}
			data := <-client.send
			if len(data) < 5 || !bytes.Equal(data[:4], stateProtoMagic) || data[4] != stateProtoWireVersion {
				b.Fatal("missing actual state protobuf envelope")
			}
			total += uint64(len(data))
			for len(client.prioritySend) > 0 {
				<-client.prioritySend
			}
		}
		return total
	}
	broadcastState()
	drain() // Warm full sync; every measured iteration is an ordinary next frame.
	var wireBytes uint64
	b.ReportAllocs()
	for b.Loop() {
		broadcastState()
		wireBytes += drain()
	}
	b.ReportMetric(float64(wireBytes)/float64(b.N), "wire-B/frame")
}
