package main

import (
	"errors"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

type saveTestBarrier struct {
	done chan struct{}
	once sync.Once
}

func (barrier *saveTestBarrier) release() { barrier.once.Do(func() { close(barrier.done) }) }

type coalescedSaveRecord struct {
	username  string
	character *database.Character
	id        string
}

type coalescedSaveCommitter struct {
	mu       sync.Mutex
	records  []coalescedSaveRecord
	entered  chan coalescedSaveRecord
	barriers map[int]*saveTestBarrier
	fail     error
}

func (committer *coalescedSaveCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	committer.mu.Lock()
	record := coalescedSaveRecord{username, character, id}
	committer.records = append(committer.records, record)
	barrier, failure := committer.barriers[len(committer.records)], committer.fail
	committer.mu.Unlock()
	committer.entered <- record
	if barrier != nil {
		<-barrier.done
	}
	return failure
}

func coalescedSaveFixture(t *testing.T, blocked ...int) (*Client, *game.Entity, *coalescedSaveCommitter) {
	t.Helper()
	setupCharacterJournalTest(t)
	oldDB, oldSessions, oldGroup := db, activeSessions, backgroundCharacterWork
	db = &database.DB{} // Guard only; all writes use the actual journal and injected committer.
	backgroundCharacterWork = &lifecycle.Group{}
	world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
	player := &game.Entity{ID: "player-save-owner", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		Gold: 100, Health: 180, MaxHealth: 200, Mana: 70, MaxMana: 100, State: "IDLE"}
	world.AddEntity(player)
	client := &Client{username: "save-owner", playerID: player.ID}
	activeSessions = map[string]*Client{client.username: client}
	committer := &coalescedSaveCommitter{entered: make(chan coalescedSaveRecord, 32), barriers: make(map[int]*saveTestBarrier)}
	for _, number := range blocked {
		committer.barriers[number] = &saveTestBarrier{done: make(chan struct{})}
	}
	characterSaveCommitter = committer
	t.Cleanup(func() {
		for _, barrier := range committer.barriers {
			barrier.release()
		}
		backgroundCharacterWork.SealWhenIdle()
		db, activeSessions, backgroundCharacterWork = oldDB, oldSessions, oldGroup
	})
	return client, player, committer
}

func nextCoalescedSave(t *testing.T, committer *coalescedSaveCommitter) coalescedSaveRecord {
	t.Helper()
	select {
	case record := <-committer.entered:
		return record
	case <-time.After(time.Second):
		t.Fatal("expected canonical save did not reach the committer")
		return coalescedSaveRecord{}
	}
}

func TestCoalescedSaveBurstCapturesLatestStateWithoutQueuedSnapshots(t *testing.T) {
	client, player, committer := coalescedSaveFixture(t, 1, 2)
	savePlayer(client)
	first := nextCoalescedSave(t, committer)
	if first.character.Gold != 100 {
		t.Fatal("first snapshot did not capture the initial state")
	}
	var producers sync.WaitGroup
	for range 8 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for range 64 {
				savePlayer(client)
			}
		}()
	}
	producers.Wait()
	player.Mu.Lock()
	player.Gold, player.Experience, player.Health, player.Mana = 250, 4321, 21, 7
	player.Equipment = map[string]game.Item{"chest": {ID: "latest-chest", Type: game.ItemArmor, Stats: map[string]int{"vitality": 25}}}
	player.Mu.Unlock()
	client.saveMu.Lock()
	if !client.saveRunning || !client.savePending {
		t.Error("burst was not retained as one pending capture")
	}
	client.saveMu.Unlock()
	committer.barriers[1].release()
	second := nextCoalescedSave(t, committer)
	if second.character.Gold != 250 || second.character.XP != 4321 || second.character.Resources.Health != 21 ||
		second.character.Resources.Mana != 7 || second.character.Equipment["chest"].ID != "latest-chest" {
		t.Fatal("second save reused a queued stale snapshot")
	}
	// A request arriving during the second commit also gets a fresh final capture.
	player.Mu.Lock()
	player.Gold = 999
	player.Mu.Unlock()
	savePlayer(client)
	committer.barriers[2].release()
	backgroundCharacterWork.SealWhenIdle()
	if len(committer.records) != 3 || committer.records[2].character.Gold != 999 ||
		first.id == second.id || second.id == committer.records[2].id {
		t.Fatal("burst created one save per request, lost a late mutation or reused a receipt")
	}
	client.saveMu.Lock()
	defer client.saveMu.Unlock()
	if client.savePending || client.saveRunning {
		t.Fatal("drained save worker retained pending/running state")
	}
}

func TestCoalescedSaveOtherAccountDoesNotWaitForBlockedCommit(t *testing.T) {
	first, _, committer := coalescedSaveFixture(t, 1)
	savePlayer(first)
	nextCoalescedSave(t, committer)
	second := &Client{username: "save-other", playerID: "player-save-other"}
	world.AddEntity(&game.Entity{ID: second.playerID, Type: game.TypePlayer, SubType: "Fighter", Level: 30, Gold: 77})
	sessionsMu.Lock()
	activeSessions[second.username] = second
	sessionsMu.Unlock()
	savePlayer(second)
	if next := nextCoalescedSave(t, committer); next.username != second.username || next.character.Gold != 77 {
		t.Fatal("unrelated account was blocked or got the wrong snapshot")
	}
	committer.barriers[1].release()
	backgroundCharacterWork.SealWhenIdle()
}

func TestCoalescedSaveRechecksReplacementOwner(t *testing.T) {
	older, player, committer := coalescedSaveFixture(t)
	unlock := lockCharacterWork(older.username)
	savePlayer(older)
	newer := &Client{username: older.username, playerID: older.playerID}
	sessionsMu.Lock()
	activeSessions[older.username] = newer
	sessionsMu.Unlock()
	older.retired.Store(true)
	player.Mu.Lock()
	player.Gold = 777
	player.Mu.Unlock()
	savePlayer(newer)
	unlock()
	backgroundCharacterWork.SealWhenIdle()
	if len(committer.records) != 1 || committer.records[0].character.Gold != 777 {
		t.Fatal("stale owner saved over the replacement or replacement save was lost")
	}
}

func TestCoalescedSaveCommitFailureRetainsLatestDurableJournal(t *testing.T) {
	client, player, committer := coalescedSaveFixture(t, 1)
	committer.fail = errors.New("disposable commit unavailable")
	savePlayer(client)
	nextCoalescedSave(t, committer)
	player.Mu.Lock()
	player.Gold = 888
	player.Mu.Unlock()
	for range 64 {
		savePlayer(client)
	}
	committer.barriers[1].release()
	backgroundCharacterWork.SealWhenIdle()
	pending, err := characterSaveJournal.Read(client.username)
	if err != nil || pending == nil || len(committer.records) != 2 {
		t.Fatal("failed coalesced commit lost its latest durable state")
	}
	character, err := pending.Character()
	if err != nil || character.Gold != 888 {
		t.Fatal("failed coalesced commit journal did not retain the latest snapshot")
	}
	committer.mu.Lock()
	committer.fail = nil
	committer.mu.Unlock()
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if got := committer.records[len(committer.records)-1].character.Gold; got != 888 {
		t.Fatal("recovery restored an older snapshot")
	}
}

func TestCoalescedSaveSealedAdmissionLeavesFinalSaveVisible(t *testing.T) {
	client, player, committer := coalescedSaveFixture(t)
	backgroundCharacterWork.CloseAndWait()
	player.Mu.Lock()
	player.Gold = 321
	player.Mu.Unlock()
	savePlayer(client)
	client.saveMu.Lock()
	if client.saveRunning || !client.savePending {
		t.Error("rejected admission claimed a running worker or lost the pending capture")
	}
	client.saveMu.Unlock()
	failedCharacterSaves.Lock()
	failed := failedCharacterSaves.users[client.username]
	failedCharacterSaves.Unlock()
	if !failed || len(committer.records) != 0 {
		t.Fatal("sealed admission claimed a successful save")
	}
	if err := saveFinalCharacters(); err != nil {
		t.Fatal(err)
	}
	if len(committer.records) != 1 || committer.records[0].character.Gold != 321 {
		t.Fatal("shutdown did not preserve the newest rejected-save state")
	}
}
