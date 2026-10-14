package main

import (
	"runtime"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestBroadcastDeliveryDuringPeriodicElitePublication(t *testing.T) {
	previousWorld, previousClients := world, clients
	defer func() { world, clients = previousWorld, previousClients }()
	w := &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50), EliteSpawnTimer: time.Now()}
	world = w
	client := newAutoStatusClient("elite-periodic-viewer")
	clients = map[*Client]bool{client: true}
	w.AddEntity(&game.Entity{ID: client.playerID, Type: game.TypePlayer, X: 60000, Z: 60000, Health: 100, MaxHealth: 100, State: "IDLE"})
	warning, err := telegraphBroadcast(game.TelegraphEvent{X: 60000, Z: 60000, Radius: 12})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 64; i++ {
			// Exercise the real periodic update path without waiting five
			// minutes between publications. Only this writer owns the timer.
			w.EliteSpawnTimer = time.Now().Add(-6 * time.Minute)
			w.Update(.001)
			runtime.Gosched()
		}
	}()
	for i := 0; i < 1000; i++ {
		deliverBroadcast(warning)
		if got := len(drainSentMessages(client.send)); got != 1 {
			t.Errorf("broadcast lost during elite publication: %d", got)
			break
		}
		runtime.Gosched()
	}
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("periodic elite publication deadlocked")
	}
	if len(w.Entities) < 2 {
		t.Fatal("periodic runtime path spawned no elites")
	}
	if client.transportClosed.Load() || client.retired.Load() {
		t.Fatal("healthy broadcast recipient retired")
	}
}
