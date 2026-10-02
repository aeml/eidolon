package main

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

func pvpStateWorkFixture(t *testing.T) (*Client, *game.Entity, *lifecycle.Group) {
	t.Helper()
	group := arenaSyncWorkFixture(t)
	oldWorld, oldSessions := world, activeSessions
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50), PvP: game.NewPvPSystem()}
	client := newAutoStatusClient("snapshot-owner")
	player := newAutoStatusPlayer(client.playerID, client.username, "available")
	world.AddEntity(player)
	activeSessions = map[string]*Client{client.username: client}
	t.Cleanup(func() { group.SealWhenIdle(); world, activeSessions = oldWorld, oldSessions })
	return client, player, group
}

func TestPvPStateWorkCoalescesCallbacksUnderCombatLocksAndSendsFreshState(t *testing.T) {
	client, player, group := pvpStateWorkFixture(t)
	other := newAutoStatusClient("snapshot-other")
	activeSessions[other.username] = other
	unlock := lockCharacterWork(client.username)
	world.Mu.Lock()
	player.Mu.Lock()
	client.stateMu.Lock()
	var released sync.Once
	releaseLocks := func() {
		released.Do(func() { client.stateMu.Unlock(); player.Mu.Unlock(); world.Mu.Unlock(); unlock() })
	}
	t.Cleanup(releaseLocks)
	staleMatch := &game.PvPMatch{ID: "old-match", TeamA: []string{client.playerID, client.playerID}, TeamB: []string{"missing", ""}}
	done := make(chan struct{})
	go func() {
		for range 512 {
			queuePvPMatchState(staleMatch)
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		releaseLocks()
		<-done
		t.Fatal("snapshot callback re-entered a combat, account or snapshot lock")
	}
	// The callback argument is obsolete. Only the fresh canonical profile and
	// cleared match may be presented once the owning account lock is acquired.
	world.SetPvPProfile(game.PvPProfile{PlayerID: client.playerID, Rating: 1234, Revision: 2, LastMatchID: "latest-result"})
	releaseLocks()
	group.SealWhenIdle()
	messages := drainSentMessages(client.send)
	if len(messages) < 1 || len(messages) > 2 || len(other.send) != 0 {
		t.Fatal("burst created per-event snapshots, lost the update or leaked it")
	}
	for _, message := range messages {
		var state struct {
			Profile game.PvPProfile `json:"profile"`
			Match   *game.PvPMatch  `json:"match"`
		}
		if message.Type != MsgPvPUpdate || json.Unmarshal(message.Payload, &state) != nil ||
			state.Match != nil || state.Profile.Rating != 1234 || state.Profile.LastMatchID != "latest-result" {
			t.Fatal("snapshot reused callback match state or an old profile")
		}
	}
}

func TestPvPStateWorkRechecksReplacementOwnerBeforeSnapshot(t *testing.T) {
	older, _, group := pvpStateWorkFixture(t)
	unlock := lockCharacterWork(older.username)
	var released sync.Once
	t.Cleanup(func() { released.Do(unlock) })
	if !older.queuePvPState() {
		t.Fatal("initial snapshot was rejected")
	}
	newer := newAutoStatusClient(older.playerID)
	sessionsMu.Lock()
	activeSessions[older.username] = newer
	sessionsMu.Unlock()
	older.retired.Store(true)
	if !newer.queuePvPState() {
		t.Fatal("replacement snapshot was rejected")
	}
	released.Do(unlock)
	group.SealWhenIdle()
	if len(older.send) != 0 || len(newer.send) != 1 {
		t.Fatal("snapshot reached a retired owner or missed its replacement")
	}
}

func TestPvPStateWorkRejectsClosedRecipientsAndSealedAdmission(t *testing.T) {
	client, _, group := pvpStateWorkFixture(t)
	closed := newAutoStatusClient("snapshot-closed")
	closed.markTransportClosed()
	unbound := &Client{username: "snapshot-unbound"}
	if closed.queuePvPState() || unbound.queuePvPState() || (*Client)(nil).queuePvPState() {
		t.Fatal("closed/unbound/absent recipient queued snapshot work")
	}
	group.CloseAndWait()
	if client.queuePvPState() {
		t.Fatal("sealed admission queued a snapshot worker")
	}
	client.pvpStateMu.Lock()
	defer client.pvpStateMu.Unlock()
	if client.pvpStateRunning || !client.pvpStatePending || len(client.send) != 0 {
		t.Fatal("rejected snapshot pretended to run or deliver")
	}
}
