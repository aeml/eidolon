package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

func TestShutdownAdmissionRejectsCommandsAndWebSocketUpgrade(t *testing.T) {
	old := serverAdmission
	serverAdmission = &lifecycle.Group{}
	t.Cleanup(func() { serverAdmission = old })
	before, existed := messageHandlers[MsgRegister]
	t.Cleanup(func() {
		if existed {
			messageHandlers[MsgRegister] = before
		} else {
			delete(messageHandlers, MsgRegister)
		}
	})
	called := 0
	messageHandlers[MsgRegister] = func(*Client, Message) { called++ }
	client := &Client{}
	client.handleMessage(Message{Type: MsgRegister})
	if called != 1 {
		t.Fatal("open admission did not dispatch")
	}
	serverAdmission.CloseAndWait()
	client.handleMessage(Message{Type: MsgRegister})
	if called != 1 {
		t.Fatal("shutdown accepted another command")
	}
	response := httptest.NewRecorder()
	serveWs(response, httptest.NewRequest(http.MethodGet, "/ws", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatal("shutdown accepted WebSocket upgrade")
	}
}

func TestShutdownLoopsWaitForActiveTickAndNeverTickAfterStop(t *testing.T) {
	loops := newServerLoops()
	entered, release, stopped := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var count atomic.Int32
	loops.Every(time.Millisecond, func() {
		if count.Add(1) == 1 {
			close(entered)
			<-release
		}
	})
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("tick did not start")
	}
	go func() { loops.Stop(); close(stopped) }()
	<-loops.ctx.Done()
	select {
	case <-stopped:
		t.Fatal("stop returned during an active world tick")
	default:
	}
	close(release)
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("tick drain stuck")
	}
	if count.Load() != 1 {
		t.Fatal("cancelled ticker ran another mutation")
	}
}

func TestShutdownFinalSaveIncludesDisconnectedLateRewards(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		State: "DEAD", Health: 0, Mana: 0, Gold: 100}
	world.AddEntity(player)
	world.SetEntityDisconnected(player.ID, time.Now())
	old := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	t.Cleanup(func() { backgroundCharacterWork = old })
	scheduleCharacterWork(func() {
		scheduleCharacterWork(func() { player.Mu.Lock(); player.Gold += 43; player.Mu.Unlock() })
	})
	backgroundCharacterWork.SealWhenIdle()
	if err := saveFinalCharacters(); err != nil {
		t.Fatal(err)
	}
	if committer.saved == nil || committer.saved.Gold != 143 || !committer.saved.Resources.Dead || committer.saved.Resources.Mana != 0 {
		t.Fatal("final snapshot missed disconnected/nested reward state")
	}
}

func TestShutdownFinalSaveRequiresDurableCopy(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	world.AddEntity(&game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 1, Health: 17, Mana: 0})
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	if err := saveFinalCharacters(); err == nil {
		t.Fatal("shutdown accepted an unwritten latest snapshot")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	committer.fail = errors.New("database offline")
	if err := saveFinalCharacters(); err != nil {
		t.Fatal("durable journal should permit recoverable database outage shutdown")
	}
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil {
		t.Fatal("no durable shutdown snapshot")
	}
}

type shutdownJournalOrderCommitter struct {
	t     *testing.T
	calls int
}

func (committer *shutdownJournalOrderCommitter) CommitCharacterSave(string, *database.Character, string) error {
	committer.calls++
	users, err := characterSaveJournal.PendingUsers()
	if err != nil || len(users) != 8 {
		committer.t.Fatal("database IO began before every final snapshot was durable")
	}
	return errors.New("database unavailable")
}

func TestShutdownJournalsEveryCharacterBeforeFirstDatabaseAttempt(t *testing.T) {
	setupCharacterJournalTest(t)
	committer := &shutdownJournalOrderCommitter{t: t}
	characterSaveCommitter = committer
	world = game.NewWorld(nil)
	for _, user := range []string{"a", "b", "c", "d", "e", "f", "g", "h"} {
		world.AddEntity(&game.Entity{ID: "player-" + user, Type: game.TypePlayer, SubType: "Wizard", Level: 1, Health: 17, Mana: 0})
	}
	if err := saveFinalCharacters(); err != nil {
		t.Fatal(err)
	}
	if committer.calls != 1 {
		t.Fatal("shutdown repeated database outage timeout for remaining characters")
	}
}
