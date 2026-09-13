package game

import (
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/arena"
)

func TestArenaEloReflectsTeamStrength(t *testing.T) {
	for _, tc := range []struct{ own, opposing, win, change int }{
		{1000, 1000, 1, 16}, {1000, 1000, 0, -16},
		{1000, 1400, 1, 29}, {1400, 1000, 1, 3},
		{1400, 1000, 0, -29}, {1000, 1400, 0, -3},
	} {
		if got := arenaRatingChange(tc.own, tc.opposing, tc.win == 1); got != tc.change {
			t.Fatalf("Elo %+v produced %d", tc, got)
		}
	}
}

func finishRewardFixture(w *World, forfeit bool) {
	match := startTestPvPMatch(w, PvPModeArena2v2, []string{"a", "b"}, []string{"c", "d"})
	if forfeit {
		w.ForfeitPvP("c")
		return
	}
	w.PvP.Matches[match.ID].WinnerIDs = []string{"a", "b"}
	w.PvP.Matches[match.ID].ScoreA = 2
	w.PvP.Matches[match.ID].ScoreB = 1
	w.PvP.Matches[match.ID].Status = PvPMatchComplete
	w.completePvPMatch(match.ID, false)
}

func TestArenaRepeatedOpponentRewardsSurviveHydrationAndResetAtUTCMidnight(t *testing.T) {
	w, now := arenaQueueFixture("a", "b", "c", "d")
	for i := 0; i < 3; i++ {
		finishRewardFixture(w, false)
	}
	before := w.PvP.Profiles["a"]
	if before.Honor != 150 || before.SeasonPoints != 9 || before.SeasonVictories != 3 || before.LastResult.TeamScore != 2 || before.LastResult.OpponentScore != 1 {
		t.Fatal("victory rewards or team scores missing", before)
	}
	fresh, _ := arenaQueueFixture("a", "b", "c", "d")
	fresh.PvP.now = func() time.Time { return *now }
	for _, profile := range w.PvP.Profiles {
		fresh.SetPvPProfile(profile)
	}
	finishRewardFixture(fresh, false)
	after := fresh.PvP.Profiles["a"]
	if after.Rating != before.Rating || after.Honor != before.Honor || after.SeasonPoints != before.SeasonPoints || after.SeasonVictories != 3 || !strings.Contains(after.LastResult.Reason, "Repeated opponent") {
		t.Fatal("rehydration reset reward cap", after)
	}
	if fresh.PvP.Profiles["c"].Honor != 0 || fresh.PvP.Profiles["c"].SeasonPoints != 0 {
		t.Fatal("intentional loss can farm currency or season points")
	}
	*now = now.Add(24 * time.Hour)
	finishRewardFixture(fresh, false)
	if got := fresh.PvP.Profiles["a"]; got.Honor != 200 || got.RewardState.Opponents["c"] != 1 {
		t.Fatal("new UTC day did not reopen rewards", got)
	}
}

func TestArenaForfeitNeverPaysEitherTeamAndOnlyLeaverPenaltySurvivesHydration(t *testing.T) {
	w, now := arenaQueueFixture("a", "b", "c", "d")
	finishRewardFixture(w, true)
	fresh, _ := arenaQueueFixture("a", "b", "c", "d")
	fresh.PvP.now = func() time.Time { return *now }
	for _, profile := range w.PvP.Profiles {
		if profile.Honor != 0 || profile.SeasonPoints != 0 || profile.SeasonVictories != 0 || !profile.LastResult.Forfeit {
			t.Fatal("forfeit paid rewards or lacked explanation", profile)
		}
		fresh.SetPvPProfile(profile)
	}
	if !fresh.PvP.DeserterUntil["c"].After(*now) || fresh.PvP.DeserterUntil["d"].After(*now) {
		t.Fatal("hydration lost leaver penalty or punished innocent teammate")
	}
	if _, err := fresh.JoinArenaQueue("c", 1); err == nil {
		t.Fatal("rehydrated deserter reentered ranked immediately")
	}
}

func TestArenaRewardSnapshotsAreDetachedAndDailyMapStaysBounded(t *testing.T) {
	w, now := arenaQueueFixture("a", "b", "c", "d")
	state := arena.RewardState{Day: now.UTC().Format("2006-01-02"), Opponents: map[string]int{"c": 3}}
	w.SetPvPProfile(PvPProfile{PlayerID: "a", Rating: 1000, RewardState: state})
	state.Opponents["c"] = 0
	snapshot := w.PvPStatus("a")["profile"].(PvPProfile)
	snapshot.RewardState.Opponents["c"] = 0
	if w.PvP.Profiles["a"].RewardState.Opponents["c"] != 3 {
		t.Fatal("caller mutated authoritative counters")
	}
	for i := 0; i < 256; i++ {
		state.Opponents[string(rune(i+1000))] = 1
	}
	delete(state.Opponents, "c")
	w.SetPvPProfile(PvPProfile{PlayerID: "a", Rating: 1000, RewardState: state})
	finishRewardFixture(w, false)
	if profile := w.PvP.Profiles["a"]; len(profile.RewardState.Opponents) != 256 || profile.Honor != 0 || profile.Rating != 1000 {
		t.Fatal("full history evicted counters or awarded gains", profile)
	}
}
