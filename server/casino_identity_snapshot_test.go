package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// One ordinary join and one notification, not a load test. The independent
// delayed binding leaves no synchronization edge from the notifier's unlocked
// identity read to the writer. A ready-only snapshot must establish that edge
// under sessionsMu, or exclude the pending connection entirely.
func TestHousePresentationConcurrentIdentityBinding(t *testing.T) {
	oldWorld, oldSessions, oldCache, oldVersions := world, activeSessions, houseCache, housePresentationVersions
	t.Cleanup(func() {
		world, activeSessions, houseCache, housePresentationVersions = oldWorld, oldSessions, oldCache, oldVersions
	})
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	client := &Client{username: "pending_house_reader", send: make(chan []byte, 4)}
	activeSessions = map[string]*Client{client.username: client}
	now := time.Now()
	lobby, err := newHouseLobby("roulette", now)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(lobby)
	if err != nil {
		t.Fatal(err)
	}
	houseCache = map[string]houseCacheEntry{"public-roulette": {
		record: &database.BlackjackTableRecord{TableID: "public-roulette", Version: 1, State: encoded}, available: true,
	}}
	housePresentationVersions = map[string]string{}
	bound := make(chan struct{})
	go func() {
		defer close(bound)
		time.Sleep(20 * time.Millisecond)
		client.bindPlayerID("player-pending_house_reader")
	}()
	notifyHousePresentation(now)
	<-bound
	if len(client.send) != 0 {
		t.Fatal("connection without a seated character received casino presentation")
	}
}

func TestPublicNameTargetRequiresBoundIdentity(t *testing.T) {
	old := activeSessions
	t.Cleanup(func() { activeSessions = old })
	client := &Client{username: "pending_public_name"}
	other := &Client{username: "other_player", playerID: "player-other_player"}
	alias := client.username
	other.publicName.Store(&alias)
	activeSessions = map[string]*Client{client.username: client, other.username: other}
	for _, input := range []string{client.username, strings.ToUpper(client.username)} {
		if activeClientByPublicName(input) != nil {
			t.Fatal("pre-join account target was exposed or redirected to another public alias")
		}
	}
	client.bindPlayerID("player-pending_public_name")
	if activeClientByPublicName(client.username) != client {
		t.Fatal("bound character cannot be resolved by account name")
	}
}
