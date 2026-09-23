package main

import (
	"encoding/json"
	"reflect"
	"sync"
	"testing"

	"eidolon-server/internal/game"
)

func TestBroadcastSynchronizesResonanceWithoutMenuOrRelog(t *testing.T) {
	originalWorld, originalSessions := world, activeSessions
	world = game.NewWorld(nil)
	defer func() {
		world.StopBackground()
		world, activeSessions = originalWorld, originalSessions
	}()
	player := newSocialBroadcastPlayer("resonance-live", "Wizard", "Wizard", "available")
	player.Level = game.MaxPlayerLevel
	player.ResonanceXP = 3696249
	world.AddEntity(player)
	client := newSocialBroadcastClient(player.ID)
	client.prioritySend = make(chan []byte, 16)
	activeSessions = map[string]*Client{player.ID: client}

	readProgress := func() game.EndgameProgress {
		t.Helper()
		select {
		case raw := <-client.prioritySend:
			var message Message
			if err := json.Unmarshal(raw, &message); err != nil || message.Type != MsgEndgameUpdate {
				t.Fatalf("expected Resonance update, got %s (%v)", raw, err)
			}
			var progress game.EndgameProgress
			if err := json.Unmarshal(message.Payload, &progress); err != nil {
				t.Fatal(err)
			}
			return progress
		default:
			t.Fatal("live Resonance update missing; player must reopen menu or relog")
			return game.EndgameProgress{}
		}
	}
	assertCurrent := func() {
		t.Helper()
		got := readProgress()
		want, _ := world.EndgameProgressForPlayer(player.ID)
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("live progress %+v differs from login progress %+v", got, want)
		}
	}

	sendEndgameState(client)
	assertCurrent()
	// Simulate the authoritative change made by kill/room awards: no menu,
	// combo, boss or quest notification accompanies these ordinary rewards.
	player.Mu.Lock()
	player.ResonanceXP += 4857
	player.Mu.Unlock()
	broadcastState()
	assertCurrent()
	broadcastState()
	if len(client.prioritySend) != 0 {
		t.Fatal("unchanged progress was resent on every world tick")
	}

	player.Mu.Lock()
	player.ResonanceXP, player.ResonanceLevel, player.ResonancePoints = 12, 1, 1
	player.ResonanceRanks = map[string]int{"power": 1}
	player.Mu.Unlock()
	broadcastState()
	assertCurrent()
	// Explicit menu requests still get a reply even if nothing changed.
	sendEndgameState(client)
	assertCurrent()
	client.resetSnapshotHistory()
	broadcastState()
	assertCurrent()

	// A failed enqueue must not mark the update as delivered.
	client.prioritySend = make(chan []byte, 1)
	client.prioritySend <- []byte("occupied")
	player.Mu.Lock()
	player.ResonanceXP++
	player.Mu.Unlock()
	broadcastState()
	<-client.prioritySend
	broadcastState()
	assertCurrent()

	// Explicit reward/menu notifications and broadcasts run concurrently in
	// production. Their queued snapshots must never move XP backwards.
	client.prioritySend = make(chan []byte, 256)
	var workers sync.WaitGroup
	workers.Add(2)
	go func() {
		defer workers.Done()
		for i := 0; i < 50; i++ {
			player.Mu.Lock()
			player.ResonanceXP++
			player.Mu.Unlock()
			broadcastState()
		}
	}()
	go func() {
		defer workers.Done()
		for i := 0; i < 50; i++ {
			sendEndgameState(client)
		}
	}()
	workers.Wait()
	previousXP := 0
	for len(client.prioritySend) > 0 {
		progress := readProgress()
		if progress.XP < previousXP {
			t.Fatal("older Resonance update overtook a newer snapshot")
		}
		previousXP = progress.XP
	}
	want, _ := world.EndgameProgressForPlayer(player.ID)
	if previousXP != want.XP {
		t.Fatal("last live update differs from authoritative progress")
	}
}
