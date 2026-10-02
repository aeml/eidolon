package game

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
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

func TestArenaActualJournalCapacityKeepsFrozenResultUntilSpaceIsRecovered(t *testing.T) {
	j, err := database.OpenPvPResultJournalWithLimit(t.TempDir(), 1)
	if err != nil {
		t.Fatal(err)
	}
	occupied := database.PvPResultReceipt{MatchID: "earlier-decided-result", Profiles: []database.PvPProfile{{
		PlayerID: "earlier", Revision: 1, LastMatchID: "earlier-decided-result", UpdatedAt: time.Now(), Honor: 50,
	}}}
	if err := j.Write(occupied); err != nil {
		t.Fatal(err)
	}
	w, now := arenaQueueFixture("a", "b")
	match := startTestPvPMatch(w, PvPModeArena1v1, []string{"a"}, []string{"b"})
	attempts := 0
	var frozen PvPMatchResult
	w.OnPvPResultRecord = func(result PvPMatchResult) error {
		attempts++
		if attempts == 1 {
			frozen = result
		} else if !reflect.DeepEqual(frozen, result) {
			t.Fatal("capacity retry changed the frozen outcome")
		}
		receipt := database.PvPResultReceipt{MatchID: result.MatchID}
		for _, profile := range result.Profiles {
			receipt.Profiles = append(receipt.Profiles, database.PvPProfile{PlayerID: profile.PlayerID,
				Revision: profile.Revision, LastMatchID: result.MatchID, UpdatedAt: profile.UpdatedAt,
				Rating: profile.Rating, Wins: profile.Wins, Losses: profile.Losses, Honor: profile.Honor})
		}
		return j.Write(receipt)
	}
	w.ForfeitPvP("a")
	if !w.HasPvPMatch("a") || w.Entities["a"].InstanceID != match.ID || len(w.PvP.Profiles) != 0 || attempts != 1 {
		t.Fatal("full journal released an unrecorded ranked result")
	}
	if status := w.PvPStatus("a")["match"].(*PvPMatch); !status.SettlementPending {
		t.Fatal("full journal did not expose pending settlement")
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 1 || entries[0].MatchID != occupied.MatchID {
		t.Fatal("capacity replaced an earlier earned result", err)
	}
	if err := j.Acknowledge(occupied.MatchID); err != nil {
		t.Fatal(err)
	}
	*now = now.Add(5 * time.Second)
	w.UpdatePvP(*now)
	if w.HasPvPMatch("a") || w.Entities["a"].InstanceID != "" || w.PvP.Profiles["a"].Revision != 1 || attempts != 2 {
		t.Fatal("recovered capacity failed to settle/release exactly once")
	}
	w.completePvPMatch(match.ID, true)
	if attempts != 2 || w.PvP.Profiles["a"].Revision != 1 {
		t.Fatal("duplicate completion applied another ranked result")
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 1 || entries[0].MatchID != match.ID {
		t.Fatal("released match lost its durable result", err)
	}
}
