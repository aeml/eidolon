package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func sessionActivityFixture(t *testing.T) (string, *fakeAdminActivityStore) {
	t.Helper()
	previousJournal, previousStore := adminActivityJournal, adminActivities
	previousPending := unjournaledActivity.events
	unjournaledActivity.events = make(map[primitive.ObjectID]database.AdminActivity)
	dir := filepath.Join(t.TempDir(), "activity")
	var err error
	adminActivityJournal, err = database.OpenAdminActivityJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	store := &fakeAdminActivityStore{}
	adminActivities = store
	t.Cleanup(func() {
		adminActivityJournal, adminActivities = previousJournal, previousStore
		unjournaledActivity.events = previousPending
	})
	return dir, store
}

func TestSessionActivityOutageAndReopenPreserveExactEvents(t *testing.T) {
	dir, store := sessionActivityFixture(t)
	if err := recordSessionActivity("hero", "login"); err != nil {
		t.Fatal(err)
	}
	if err := recordSessionDisconnect("hero"); err != nil {
		t.Fatal(err)
	}
	before, _ := adminActivityJournal.Pending(50)
	if len(before) != 2 {
		t.Fatal(before)
	}
	adminActivityJournal, _ = database.OpenAdminActivityJournal(dir)
	store.appendErr = errors.New("database offline")
	if retryPendingAdminActivity() == nil {
		t.Fatal("outage ignored")
	}
	if pending, _ := adminActivityJournal.Pending(50); len(pending) != 2 {
		t.Fatal("outage lost pending events")
	}
	store.appendErr = nil
	if err := retryPendingAdminActivity(); err != nil {
		t.Fatal(err)
	}
	if pending, _ := adminActivityJournal.Pending(50); len(pending) != 0 {
		t.Fatal("committed events not acknowledged")
	}
	if len(store.events) != 2 {
		t.Fatal(store.events)
	}
	for index, event := range store.events {
		if event.ID != before[index].ID || !event.At.Equal(before[index].At) || event.Actor != "hero" || event.RequestID != "session-"+event.ID.Hex() {
			t.Fatal(event)
		}
	}
}

func TestSessionActivityStartupDrainsMoreThanOneRuntimeBatch(t *testing.T) {
	_, store := sessionActivityFixture(t)
	for index := 0; index < 55; index++ {
		if err := recordSessionActivity("hero", "login"); err != nil {
			t.Fatal(err)
		}
	}
	if err := recoverAdminActivityOnStartup(); err != nil {
		t.Fatal(err)
	}
	if len(store.events) != 55 {
		t.Fatal("startup admitted before full activity replay", len(store.events))
	}
}

func TestSessionActivityConcurrentConnectionsAndReplay(t *testing.T) {
	_, store := sessionActivityFixture(t)
	var group sync.WaitGroup
	for index := 0; index < 20; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if err := recordSessionActivity("hero", "login"); err != nil {
				t.Error(err)
			}
		}()
	}
	for index := 0; index < 3; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			if err := retryPendingAdminActivity(); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	if err := recoverAdminActivityOnStartup(); err != nil {
		t.Fatal(err)
	}
	if len(store.events) != 20 {
		t.Fatal("lost or duplicated concurrent activity", len(store.events))
	}
}

func TestSessionActivityDiskFailureBlocksAuthenticationAndRetainsDisconnect(t *testing.T) {
	dir, store := sessionActivityFixture(t)
	if err := os.Rename(dir, dir+"-unavailable"); err != nil {
		t.Fatal(err)
	}
	if recordSessionActivity("hero", "login") == nil {
		t.Fatal("unaudited login admitted")
	}
	if recordSessionDisconnect("hero") == nil {
		t.Fatal("disk failure ignored")
	}
	if sessionActivityJournalHealthy() {
		t.Fatal("unpersisted disconnect reported healthy")
	}
	if persistUnjournaledActivity() == nil {
		t.Fatal("shutdown could discard unpersisted disconnect")
	}
	if err := os.Rename(dir+"-unavailable", dir); err != nil {
		t.Fatal(err)
	}
	if err := retryPendingAdminActivity(); err != nil {
		t.Fatal(err)
	}
	if !sessionActivityJournalHealthy() || len(store.events) != 1 || store.events[0].Action != "disconnect" {
		t.Fatal(store.events)
	}
}

func TestResumeActivityFailurePreservesOriginalDisconnectedTime(t *testing.T) {
	dir, _ := sessionActivityFixture(t)
	oldWorld, oldSessions := world, activeSessions
	t.Cleanup(func() { world, activeSessions = oldWorld, oldSessions })
	world, activeSessions = game.NewWorld(nil), map[string]*Client{}
	disconnectedAt := time.Now().Add(-10 * time.Minute)
	world.AddEntity(&game.Entity{ID: "player-audit-resume", Type: game.TypePlayer, Disconnected: true, DisconnectedAt: disconnectedAt})
	token, err := issueResumeToken("audit-resume")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(dir, dir+"-unavailable"); err != nil {
		t.Fatal(err)
	}
	c := &Client{send: make(chan []byte, 10)}
	payload, _ := json.Marshal(map[string]string{"token": token})
	c.dispatchMessage(Message{Type: MsgResumeSession, Payload: payload})
	e := world.GetEntity("player-audit-resume")
	if e == nil || !e.Disconnected || !e.DisconnectedAt.Equal(disconnectedAt) || c.playerID != "" || c.username != "" {
		t.Fatal("audit failure extended or admitted resume")
	}
	for _, msg := range drainSentMessages(c.send) {
		if msg.Type == MsgResumeSession {
			t.Fatal("false resume acknowledgement")
		}
	}
}
