package game

import (
	"testing"
	"time"
)

func arenaQueueFixture(ids ...string) (*World, *time.Time) {
	players := make([]*Entity, 0, len(ids))
	for _, id := range ids {
		players = append(players, &Entity{ID: id, Type: TypePlayer, State: "IDLE"})
	}
	w := newPvPTestWorld(players...)
	now := time.Date(2026, 9, 13, 0, 0, 0, 0, time.UTC)
	w.PvP.now = func() time.Time { return now }
	return w, &now
}

func TestArenaRatingSearchWidensOnTickWithoutAnotherJoin(t *testing.T) {
	w, now := arenaQueueFixture("a", "b")
	w.SetPvPProfile(PvPProfile{PlayerID: "a", Rating: 1000})
	w.SetPvPProfile(PvPProfile{PlayerID: "b", Rating: 1250})
	for _, id := range []string{"a", "b"} {
		if match, err := w.JoinArenaQueue(id, 1); err != nil || match != nil {
			t.Fatalf("premature match: %+v %v", match, err)
		}
	}
	var started *PvPMatch
	w.OnPvPMatchStart = func(match *PvPMatch) { started = match }
	*now = now.Add(89 * time.Second)
	w.UpdatePvP(*now)
	if started != nil {
		t.Fatal("rating search widened too early")
	}
	status := w.PvPStatus("a")
	if status["ratingWindow"] != 200 || status["teamRating"] != 1000 || status["queuedSeconds"] != 89 {
		t.Fatalf("queue snapshot is misleading: %+v", status)
	}
	*now = now.Add(time.Second)
	w.UpdatePvP(*now)
	if started == nil || started.Practice || w.Entities["a"].InstanceID != started.ID || w.Entities["b"].InstanceID != started.ID {
		t.Fatal("expanded search did not admit and publish actual scene")
	}
	if arenaRatingWindow(now.Add(-time.Hour), *now) != 500 {
		t.Fatal("search widened past published cap")
	}
}

func TestArenaSearchSkipsIncompatibleHeadAndKeepsPracticeSeparate(t *testing.T) {
	w, _ := arenaQueueFixture("high", "low", "practice", "near")
	w.SetPvPProfile(PvPProfile{PlayerID: "high", Rating: 2000})
	for _, id := range []string{"high", "low"} {
		w.JoinArenaQueue(id, 1)
	}
	if match, err := w.JoinArenaQueueWithMode("practice", 1, true); err != nil || match != nil {
		t.Fatal("practice matched a ranked player")
	}
	match, err := w.JoinArenaQueue("near", 1)
	if err != nil || match == nil || !containsPlayer(match.TeamA, "low") || !containsPlayer(match.TeamB, "near") {
		t.Fatalf("incompatible head blocked compatible teams: %+v %v", match, err)
	}
	if w.PvPStatus("high")["queued"] != 1 || w.PvPStatus("practice")["queuePractice"] != true {
		t.Fatal("unmatched queues were lost")
	}
}

func TestArenaPracticeTwoPlayerTeamsNeverEarnRankedRewardsOrPenalty(t *testing.T) {
	w, _ := arenaQueueFixture("a", "b", "c", "d")
	first := w.CreateParty("a")
	w.JoinParty(first.ID, "b")
	second := w.CreateParty("c")
	w.JoinParty(second.ID, "d")
	w.JoinArenaQueueWithMode("a", 2, true)
	match, err := w.JoinArenaQueueWithMode("c", 2, true)
	if err != nil || match == nil || !match.Practice || match.FirstTo != 2 {
		t.Fatalf("missing practice2v2: %+v %v", match, err)
	}
	if w.CombatRelationship(w.Entities["a"], w.Entities["b"]) != RelationshipAlly || w.CombatRelationship(w.Entities["a"], w.Entities["c"]) != RelationshipHostile {
		t.Fatal("practice teams lost combat relationship")
	}
	var result PvPMatchResult
	w.OnPvPMatchComplete = func(value PvPMatchResult) { result = value }
	w.ForfeitPvP("a")
	if !result.Practice || len(result.Profiles) != 0 || len(w.PvP.Profiles) != 0 || !w.PvP.DeserterUntil["a"].IsZero() {
		t.Fatal("practice contaminated ranked state")
	}
	for _, id := range []string{"a", "b", "c", "d"} {
		if w.Entities[id].InstanceID != "" {
			t.Fatal("practice did not restore the whole party")
		}
	}
}

func TestArenaRechecksDeadOrChangedPartiesAndWholeTeamCancellation(t *testing.T) {
	for _, change := range []string{"dead", "offline", "instance", "membership", "cancel"} {
		t.Run(change, func(t *testing.T) {
			w, now := arenaQueueFixture("a", "b", "c", "d", "e")
			party := w.CreateParty("a")
			w.JoinParty(party.ID, "b")
			w.JoinArenaQueueWithMode("a", 2, true)
			switch change {
			case "dead":
				w.Entities["b"].Health = 0
			case "offline":
				w.Entities["b"].Disconnected = true
			case "instance":
				w.Entities["b"].InstanceID = "dungeon"
			case "membership":
				w.JoinParty(party.ID, "e")
			case "cancel":
				w.ForfeitPvP("b")
			}
			*now = now.Add(time.Second)
			w.UpdatePvP(*now)
			if w.PvPStatus("a")["queued"] != 0 || w.PvPStatus("b")["queued"] != 0 {
				t.Fatal("invalid/cancelled team remained queued")
			}
		})
	}
}

func TestArenaCannotMatchPartyAlliesOrAwardTiedTimeout(t *testing.T) {
	w, now := arenaQueueFixture("a", "b")
	party := w.CreateParty("a")
	w.JoinParty(party.ID, "b")
	w.JoinArenaQueue("a", 1)
	if match, err := w.JoinArenaQueue("b", 1); err != nil || match != nil {
		t.Fatal("matched allies who cannot damage each other")
	}
	w.ForfeitPvP("a")
	w.ForfeitPvP("b")
	match := startTestPvPMatch(w, PvPModeArena1v1, []string{"a"}, []string{"b"})
	*now = match.EndsAt.Add(time.Second)
	w.UpdatePvP(*now)
	if len(w.PvP.Profiles) != 0 || w.HasPvPMatch("a") {
		t.Fatal("a tied timeout created a ranked winner")
	}
}
