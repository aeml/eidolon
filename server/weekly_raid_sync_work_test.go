package main

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func waitWeeklySyncStopped(t *testing.T, work *weeklyRaidSyncWork) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		work.mu.Lock()
		running := work.running
		work.mu.Unlock()
		if !running {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("weekly sync worker did not stop")
}

func TestWeeklySyncWorkCoalescesRequestsWithoutCombatLocks(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	barrier := &saveTestBarrier{done: make(chan struct{})}
	t.Cleanup(barrier.release)
	entered := make(chan struct{}, 1)
	var passes atomic.Int32
	work := &weeklyRaidSyncWork{recover: func() error {
		if passes.Add(1) == 1 {
			entered <- struct{}{}
			<-barrier.done
		}
		return nil
	}}
	work.request()
	<-entered
	// Combat callbacks can own these locks. Requests must not acquire them
	// or retain an event/player closure for each completion.
	previous := world
	world = &game.World{Entities: make(map[string]*game.Entity)}
	t.Cleanup(func() { world = previous })
	player := &game.Entity{}
	world.Mu.Lock()
	player.Mu.Lock()
	unlock := lockCharacterWork("weekly-hero")
	var producers sync.WaitGroup
	for range 8 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for range 64 {
				if !work.request() {
					t.Error("live request rejected")
				}
			}
		}()
	}
	producers.Wait()
	unlock()
	player.Mu.Unlock()
	world.Mu.Unlock()
	if passes.Load() != 1 {
		t.Fatal("requests started parallel recovery passes")
	}
	barrier.release()
	group.SealWhenIdle()
	if passes.Load() != 2 {
		t.Fatal("pending requests lost or created a pass per completion")
	}
}

func TestWeeklySyncWorkFailureRetainsRealCompletionJournal(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	group := arenaSyncWorkFixture(t)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	at := time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)
	s.entry.CompletedAt = at
	world.AddEntity(&game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 100, Gold: 99,
		Inventory: make([]game.Item, game.MaxInventorySize), WeeklyRaidCompletions: map[string]time.Time{s.entry.Week: at}})
	s.committer.fail = errors.New("disposable database unavailable")
	work := &weeklyRaidSyncWork{recover: recoverPendingWeeklyRaidRewards}
	work.request()
	waitWeeklySyncStopped(t, work)
	// Worker finishes its recover call before publishing running=false.
	// Inspect the actual disk journal, not merely the coordinator's flags.
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil || s.finished != 0 {
		t.Fatal("failed recovery consumed the entitlement or lost the character journal", err)
	}
	character, err := pending.Character()
	if err != nil || !character.WeeklyRaidCompletions[s.entry.Week].Equal(at) || character.Gold != 99 {
		t.Fatal("journal lost the original completion or granted before durable preparation", err)
	}
	s.committer.fail = nil
	if !work.request() {
		t.Fatal("later request rejected")
	}
	group.SealWhenIdle()
	if s.finished != 1 || s.committer.saved.Gold != 15099 ||
		!s.committer.saved.WeeklyRaidRewardReceipts[s.entry.Week] || len(s.committer.saved.WeeklyRaidCompletions) != 0 {
		t.Fatal("retry lost the recorded reward or failed to save the receipt")
	}
}

func TestWeeklySyncWorkSealedAdmissionLeavesLiveOutbox(t *testing.T) {
	s := setupWeeklyDeliveryTest(t)
	group := arenaSyncWorkFixture(t)
	group.CloseAndWait()
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	at := time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)
	week := database.CurrentRaidWeek(at)
	world.AddEntity(&game.Entity{ID: "player-hero", Type: game.TypePlayer, Level: 100,
		WeeklyRaidCompletions: map[string]time.Time{week: at}})
	work := &weeklyRaidSyncWork{recover: func() error { t.Error("sealed work ran"); return nil }}
	if work.request() {
		t.Fatal("sealed group admitted recovery")
	}
	work.mu.Lock()
	defer work.mu.Unlock()
	if work.running || !work.pending || s.finished != 0 || s.committer.saved != nil ||
		!world.GetEntityCopy("player-hero").WeeklyRaidCompletions[week].Equal(at) {
		t.Fatal("rejected request acknowledged or discarded completion")
	}
}
