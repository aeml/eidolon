package game

import (
	"fmt"
	"testing"
	"time"
)

func TestWeeklyDeathRecordsCompletionBeforeAsynchronousHandoff(t *testing.T) {
	for _, size := range []int{1, 4} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			players := make([]*Entity, size)
			for i := range players {
				p := newTestPlayer(fmt.Sprintf("weekly-%d", i), "Fighter")
				p.Level, p.InstanceID = 100, "weekly-instance"
				w.AddEntity(p)
				players[i] = p
			}
			if size > 1 {
				party := w.CreateParty(players[0].ID)
				for _, p := range players[1:] {
					if err := w.JoinParty(party.ID, p.ID); err != nil {
						t.Fatal(err)
					}
				}
			}
			completed := make(chan WeeklyRaidCompletionEvent, size)
			w.OnEvent = func(kind string, payload interface{}) {
				if kind == "weekly_raid_complete" {
					completed <- payload.(WeeklyRaidCompletionEvent)
				}
			}
			boss := &Entity{ID: "weekly-boss", Type: TypeEnemy, SubType: "UmbraPrime", Level: 100,
				Health: 1, MaxHealth: 1, InstanceID: "weekly-instance", State: "IDLE"}
			w.AddEntity(boss)
			boss.Mu.Lock()
			w.handleDeath(boss, players[0], nil)
			boss.Mu.Unlock()
			for range players {
				select {
				case event := <-completed:
					copy := w.GetEntityCopy(event.PlayerID)
					year, week := event.CompletedAt.ISOWeek()
					key := fmt.Sprintf("%d-W%02d", year, week)
					if event.CompletedAt.IsZero() || copy == nil || !copy.WeeklyRaidCompletions[key].Equal(event.CompletedAt) {
						t.Fatal("death event reached handoff without its saved-character outbox")
					}
					delete(copy.WeeklyRaidCompletions, key)
					if len(w.GetEntityCopy(event.PlayerID).WeeklyRaidCompletions) != 1 {
						t.Fatal("completion snapshot aliases live map")
					}
				case <-time.After(time.Second):
					t.Fatal("weekly completion not emitted")
				}
			}
		})
	}
}

func TestWeeklyCompletionKeepsOriginalWeekAndSkipsRedeemedWeeks(t *testing.T) {
	p := newTestPlayer("weekly-week-boundary", "Fighter")
	p.Level = 100
	sunday := time.Date(2026, 9, 27, 23, 59, 59, 0, time.UTC)
	p.queueWeeklyRaidCompletionLocked(sunday)
	p.queueWeeklyRaidCompletionLocked(sunday.Add(time.Millisecond))
	p.queueWeeklyRaidCompletionLocked(sunday.Add(2 * time.Second))
	if len(p.WeeklyRaidCompletions) != 2 || !p.WeeklyRaidCompletions["2026-W39"].Equal(sunday) {
		t.Fatal("completion moved weeks or replaced first kill time")
	}
	p.WeeklyRaidRewardReceipts = map[string]bool{"2026-W40": true}
	delete(p.WeeklyRaidCompletions, "2026-W40")
	p.queueWeeklyRaidCompletionLocked(sunday.Add(time.Hour))
	if len(p.WeeklyRaidCompletions) != 1 {
		t.Fatal("redeemed week queued again")
	}
}
