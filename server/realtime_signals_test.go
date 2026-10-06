package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestRealtimeSignalsSeparateActualSimulationAndBlockedBroadcast(t *testing.T) {
	resetOperationalMetricsForTest(t)
	previousWorld, previousSessions := world, activeSessions
	defer func() { world, activeSessions = previousWorld, previousSessions }()
	world = game.NewWorld(nil)
	world.Entities = make(map[string]*game.Entity)
	world.Grid = game.NewSpatialMap(50)
	player := &game.Entity{ID: "private-frame-player", Type: game.TypePlayer, Health: 100}
	world.AddEntity(player)
	client := newAutoStatusClient(player.ID)
	client.send = make(chan []byte, 16)
	client.prioritySend = make(chan []byte, 16)
	activeSessions = map[string]*Client{player.ID: client}
	client.stateMu.Lock()
	var release sync.Once
	done := make(chan struct{})
	defer func() {
		release.Do(client.stateMu.Unlock)
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Error("owned frame did not stop after releasing its snapshot lock")
		}
	}()
	go func() { runRealtimeFrame(time.Now()); close(done) }()
	deadline := time.Now().Add(2 * time.Second)
	for {
		snapshot := operationalMetricsSnapshot()
		if snapshot.StateBroadcast.InFlight == 1 {
			if snapshot.RealtimeUpdate.Completed != 1 || snapshot.RealtimeUpdate.InFlight != 0 || snapshot.StateBroadcast.Completed != 0 {
				t.Fatal("simulation and blocked snapshot delivery are not separately measured")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("actual frame did not reach snapshot delivery")
		}
		time.Sleep(time.Millisecond)
	}
	response := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	var health healthResponse
	if err := json.Unmarshal(response.Body.Bytes(), &health); err != nil || response.Code != http.StatusOK ||
		!health.Operational.StateBroadcast.InFlightKnown || health.Operational.StateBroadcast.InFlight != 1 || health.Operational.RealtimeUpdate.Completed != 1 {
		t.Fatal("health lost the independently observed frame phases", err)
	}
	if strings.Contains(response.Body.String(), "private-frame-player") {
		t.Fatal("frame measurements leaked player identity")
	}
	release.Do(client.stateMu.Unlock)
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("frame did not finish")
	}
	after := operationalMetricsSnapshot()
	if after.StateBroadcast.InFlight != 0 || after.StateBroadcast.Completed != 1 || after.StateBroadcast.TimedSamples != 1 ||
		after.RealtimeUpdate.TimedSamples != 1 || after.StateBroadcast.Failed != 0 || len(client.send) != 1 {
		t.Fatal("completed production frame lost timing, duplicated work or failed to send state")
	}
}
