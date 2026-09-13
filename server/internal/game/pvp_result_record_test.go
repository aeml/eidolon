package game

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestArenaResultMustBeDurableBeforeProfilesOrReturnAndRetryIsFrozen(t *testing.T) {
	w, now := arenaQueueFixture("a", "b")
	match := startTestPvPMatch(w, PvPModeArena1v1, []string{"a"}, []string{"b"})
	attempts := 0
	var first PvPMatchResult
	w.OnPvPResultRecord = func(result PvPMatchResult) error {
		attempts++
		if attempts == 1 {
			first = result
			return errors.New("disk unavailable")
		}
		if !reflect.DeepEqual(first, result) {
			t.Fatal("retry changed its decided result")
		}
		return nil
	}
	w.ForfeitPvP("a")
	if !w.HasPvPMatch("a") || w.Entities["a"].InstanceID != match.ID || len(w.PvP.Profiles) != 0 {
		t.Fatal("unrecorded outcome escaped reservation")
	}
	if state := w.PvPStatus("a")["match"].(*PvPMatch); !state.SettlementPending {
		t.Fatal("missing save-pending state")
	}
	*now = now.Add(5 * time.Second)
	w.UpdatePvP(*now)
	if w.HasPvPMatch("a") || w.Entities["a"].InstanceID != "" || w.PvP.Profiles["a"].Revision != 1 || attempts != 2 {
		t.Fatal("recorded outcome did not release participants exactly once")
	}
	w.completePvPMatch(match.ID, true)
	if attempts != 2 || w.PvP.Profiles["a"].Revision != 1 {
		t.Fatal("duplicate completion reapplied result")
	}
}

func TestArenaHydrationCannotReplaceNewerResultRevision(t *testing.T) {
	w, _ := arenaQueueFixture("a")
	w.SetPvPProfile(PvPProfile{PlayerID: "a", Rating: 1032, Revision: 2, LastMatchID: "new"})
	w.SetPvPProfile(PvPProfile{PlayerID: "a", Rating: 1000, Revision: 1, LastMatchID: "old", UpdatedAt: time.Now().Add(time.Hour)})
	if profile := w.PvPStatus("a")["profile"].(PvPProfile); profile.Rating != 1032 || profile.Revision != 2 {
		t.Fatal("late hydration erased a newer result")
	}
}
