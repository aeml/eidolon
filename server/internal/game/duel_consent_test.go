package game

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestDuelResponsesRequireExactCurrentChallenge(t *testing.T) {
	for _, accepted := range []bool{false, true} {
		a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
		w := newPvPTestWorld(a, b)
		first, err := w.RequestDuel(a.ID, b.ID)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.RespondDuel(b.ID, a.ID, first.ID, false); err != nil {
			t.Fatal(err)
		}
		current, err := w.RequestDuel(a.ID, b.ID)
		if err != nil {
			t.Fatal(err)
		}
		if first.ID == "" || current.ID == first.ID {
			t.Fatal("challenge identity not replaced")
		}
		for _, stale := range []string{"", "made-up", first.ID} {
			if _, err := w.RespondDuel(b.ID, a.ID, stale, accepted); err == nil {
				t.Fatal("stale response admitted", stale)
			}
			if w.PvP.Challenges[b.ID].ID != current.ID || w.HasPvPMatch(a.ID) {
				t.Fatal("stale response consumed replacement or admitted match")
			}
		}
		match, err := w.RespondDuel(b.ID, a.ID, current.ID, accepted)
		if err != nil || (match != nil) != accepted {
			t.Fatal("current consent failed", match, err)
		}
		if _, err := w.RespondDuel(b.ID, a.ID, current.ID, accepted); err == nil {
			t.Fatal("replayed response accepted")
		}
	}
}

func TestPendingDuelRetriesDoNotReplaceOrExtendAndOtherPlayersCannotOverwrite(t *testing.T) {
	a, b, c := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}, &Entity{ID: "c", Type: TypePlayer}
	w := newPvPTestWorld(a, b, c)
	now := time.Now()
	w.PvP.now = func() time.Time { return now }
	first, err := w.RequestDuel(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Second)
	retry, err := w.RequestDuel(a.ID, b.ID)
	if err != nil || retry.ID != first.ID || !retry.ExpiresAt.Equal(first.ExpiresAt) {
		t.Fatal("retry replaced or extended consent")
	}
	if _, err := w.RequestDuel(c.ID, b.ID); err == nil {
		t.Fatal("different challenger overwrote recipient consent")
	}
	if w.PvP.Challenges[b.ID].ID != first.ID {
		t.Fatal("competing request consumed original consent")
	}
	if _, err := w.RespondDuel(b.ID, a.ID, first.ID, false); err != nil {
		t.Fatal(err)
	}
	if _, err := w.RequestDuel(c.ID, b.ID); err != nil {
		t.Fatal("declined prompt did not free recipient")
	}
}

func TestDuelExpiryIsExclusiveAndNotAdvertised(t *testing.T) {
	a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
	w := newPvPTestWorld(a, b)
	now := time.Date(2026, 9, 30, 21, 0, 0, 0, time.UTC)
	w.PvP.now = func() time.Time { return now }
	challenge, err := w.RequestDuel(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	now = challenge.ExpiresAt
	if w.PvPStatus(b.ID)["challenge"] != nil {
		t.Fatal("expired prompt advertised")
	}
	if _, err := w.RespondDuel(b.ID, a.ID, challenge.ID, true); err == nil {
		t.Fatal("accepted at expiry boundary")
	}
	w.UpdatePvP(now)
	if len(w.PvP.Challenges) != 0 {
		t.Fatal("expired prompt retained by tick")
	}
}

func TestDuelCannotBindRecreatedActorAndDoesNotExposePointers(t *testing.T) {
	a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
	w := newPvPTestWorld(a, b)
	challenge, err := w.RequestDuel(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(challenge)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "Health") || strings.Contains(string(encoded), "requester\"") {
		t.Fatal("actor snapshot leaked", string(encoded))
	}
	w.Entities[a.ID] = &Entity{ID: a.ID, Type: TypePlayer, MaxHealth: 100, Health: 100}
	if _, err := w.RespondDuel(b.ID, a.ID, challenge.ID, true); err == nil {
		t.Fatal("recreated actor inherited old consent")
	}
	if w.HasPvPMatch(a.ID) || w.HasPvPMatch(b.ID) {
		t.Fatal("failed actor check reserved match")
	}
}

func TestMatchedPlayersCannotDamageOutsideAdmittedScene(t *testing.T) {
	a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
	w := newPvPTestWorld(a, b)
	match := startTestPvPMatch(w, PvPModeDuel, []string{a.ID}, []string{b.ID})
	if !w.CanDamage(a, b) {
		t.Fatal("admitted opponents cannot fight")
	}
	a.InstanceID, b.InstanceID = "", ""
	if w.CanDamage(a, b) || w.canDamageAtImpact(a.ID, b.ID) {
		t.Fatal("match record authorized damage in overworld")
	}
	a.InstanceID, b.InstanceID = "other-instance", "other-instance"
	if w.CanDamage(a, b) {
		t.Fatal("match record authorized different scene")
	}
	a.InstanceID, b.InstanceID = match.ID, match.ID
	if !w.CanDamage(a, b) {
		t.Fatal("scene fence blocked real opponents")
	}
}

func TestOpenWorldFlagRejectsZeroHealthAndSafeZoneBlocksDelayedImpact(t *testing.T) {
	a := &Entity{ID: "a", Type: TypePlayer, X: 0, Z: 0}
	b := &Entity{ID: "b", Type: TypePlayer, X: 2, Z: 0}
	w := newPvPTestWorld(a, b)
	a.Health = 0
	if err := w.SetOpenWorldPvP(a.ID, true); err == nil {
		t.Fatal("zero health player opted in")
	}
	a.Health = 100
	if err := w.SetOpenWorldPvP(a.ID, true); err != nil {
		t.Fatal(err)
	}
	if err := w.SetOpenWorldPvP(b.ID, true); err != nil {
		t.Fatal(err)
	}
	if !w.canDamageAtImpact(a.ID, b.ID) {
		t.Fatal("mutual opt-in unavailable")
	}
	b.X, b.Z = 0, 240
	if w.CanDamage(a, b) || w.canDamageAtImpact(a.ID, b.ID) {
		t.Fatal("safe zone allowed delayed player damage")
	}
	if err := w.SetOpenWorldPvP(b.ID, false); err != nil {
		t.Fatal(err)
	}
}
