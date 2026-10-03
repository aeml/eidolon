package game

import (
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestDungeonRoomRewardRuntimeRetainsFirstOutcomeUntilConfirmed(t *testing.T) {
	w, instance, players, _ := frozenRoomRewardFixture(t, "elite_ambush")
	var proposals []database.DungeonRoomRewardOperation
	w.OnDungeonRoomReward = func(op database.DungeonRoomRewardOperation) error {
		// Persistence may acquire account ownership, never scene locks here.
		if !w.Mu.TryLock() {
			t.Fatal("callback held world lock")
		}
		w.Mu.Unlock()
		if !instance.Mu.TryLock() {
			t.Fatal("callback held instance lock")
		}
		instance.Mu.Unlock()
		for _, player := range players {
			if !player.Mu.TryLock() {
				t.Fatal("callback held actor lock")
			}
			player.Mu.Unlock()
		}
		proposals = append(proposals, op)
		return errors.New("unknown prepare acknowledgement")
	}
	w.MarkDungeonRoomCleared(instance.ID, 1)
	if len(proposals) != 1 || instance.RoomState.Rooms[1].Cleared || instance.RoomState.Rooms[1].Rewarded || players[0].Gold != 99 {
		t.Fatal("unconfirmed shared plan advanced progress or currency")
	}
	players[0].Disconnected = true
	players[1].State, players[1].Health = "DEAD", 0
	players[2].InstanceID = ""
	w.MarkDungeonRoomCleared(instance.ID, 1)
	if len(proposals) != 2 || !reflect.DeepEqual(proposals[0], proposals[1]) {
		t.Fatal("retry rerolled items or recaptured cohort")
	}
	op := proposals[0]
	if err := w.ConfirmDungeonRoomRewardProgress(op); err != nil || !instance.RoomState.Rooms[1].Cleared || !instance.RoomState.Rooms[1].Rewarded {
		t.Fatal("confirmed plan failed to project progress", err)
	}
	if len(w.PendingDungeonRoomRewardPlans()) != 1 {
		t.Fatal("progress projection retired individual claims prematurely")
	}
	if err := w.RetireDungeonRoomRewardPlan(op); err != nil || len(w.PendingDungeonRoomRewardPlans()) != 0 {
		t.Fatal("completed cohort did not retire", err)
	}
	w.MarkDungeonRoomCleared(instance.ID, 1)
	if len(proposals) != 2 {
		t.Fatal("completed room captured a fresh outcome")
	}
}

func TestDungeonRoomRewardRuntimeConcurrentCaptureDoesNotAliasCache(t *testing.T) {
	w, instance, _, _ := frozenRoomRewardFixture(t, "elite_ambush")
	var group sync.WaitGroup
	results := make(chan database.DungeonRoomRewardOperation, 12)
	for range 12 {
		group.Add(1)
		go func() {
			defer group.Done()
			op, err := w.CaptureDungeonRoomReward(instance.ID, 1)
			if err != nil {
				t.Error(err)
				return
			}
			results <- op
		}()
	}
	group.Wait()
	close(results)
	var first database.DungeonRoomRewardOperation
	for op := range results {
		if first.ID == "" {
			first = op
		} else if !reflect.DeepEqual(first, op) {
			t.Fatal("same room captured multiple outcomes")
		}
	}
	first.Participants[0].Items[0] = "mutated external payload"
	first.Participants[0].Username = "mutated-owner"
	retained := w.PendingDungeonRoomRewardPlans()[0]
	if retained.Validate() != nil || retained.Participants[0].Username == "mutated-owner" {
		t.Fatal("caller mutated immutable cache")
	}
	retained.Participants[0].Items[0] = "mutated discovery payload"
	if w.PendingDungeonRoomRewardPlans()[0].Validate() != nil {
		t.Fatal("discovery aliased retained roll")
	}
}

func TestDungeonRoomRewardRuntimeShrineFeedbackReflectsActualRecovery(t *testing.T) {
	for _, late := range []bool{false, true} {
		t.Run(fmt.Sprint(late), func(t *testing.T) {
			w, _, players, op := frozenRoomRewardFixture(t, "shrine")
			if late {
				op.CreatedAt = op.CreatedAt.Add(-time.Minute)
				op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
			}
			_, found, changed, event, err := w.ApplyDurableDungeonRoomReward(op, players[0].Name)
			if err != nil || !found || !changed || event.HealthRestored != 30 || event.ManaRestored != 30 {
				t.Fatal("confirmed shrine feedback lost actual recovery", event, err)
			}
			if late && (event.BuffName != "" || event.BuffDurationSeconds != 0 || event.DamageReductionPct != 0) {
				t.Fatal("late grant advertised renewed protection")
			}
			if !late && (event.BuffName != "Sanctuary" || event.BuffDurationSeconds < 1 || event.BuffDurationSeconds > 8) {
				t.Fatal("active shrine did not advertise its actual protection")
			}
		})
	}
}
