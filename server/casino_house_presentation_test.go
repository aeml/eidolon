package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestHouseBaccaratDealNeverExposesFutureCardsOrWinner(t *testing.T) {
	start := time.Now()
	s := &houseTableState{Game: "baccarat", Phase: "revealing", RevealAt: start.Add(houseRevealTime), Baccarat: &game.BaccaratResult{
		Player: []int{0, 3, 1}, Banker: []int{12, 2, 4}, PlayerTotal: 7, BankerTotal: 8, Winner: "banker",
	}}
	for second := -1; second <= 7; second++ {
		v := houseDealtCards(s, start.Add(time.Duration(second)*time.Second))
		n := max(0, min(second, 6))
		if len(v.Player)+len(v.Banker) != n {
			t.Fatalf("second %d: %+v", second, v)
		}
		payload, _ := json.Marshal(v)
		var fields map[string]any
		_ = json.Unmarshal(payload, &fields)
		if _, ok := fields["winner"]; ok {
			t.Fatal("future winner leaked")
		}
		if second == 3 && (len(v.Player) != 2 || len(v.Banker) != 1 || v.PlayerTotal != 5 || v.BankerTotal != 0) {
			t.Fatal("wrong deal order / visible score", v)
		}
	}
	s.Phase = "betting"
	if houseDealtCards(s, start) != nil {
		t.Fatal("cards exposed while betting")
	}
}

func TestHouseHistoryBoundedAndDecodedAfterRoundRollover(t *testing.T) {
	now := time.Now()
	s, _ := newHouseLobby("roulette", now)
	for i := 0; i < houseHistoryLimit; i++ {
		n := i % 37
		s.History = append(s.History, houseRoundResult{fmt.Sprintf("%032x", i+1), now.Add(time.Duration(i-100) * time.Second), &n, nil})
	}
	s.Phase = "complete"
	s.FinishedAt = now
	zero := 0
	s.Number = &zero
	history := houseCompletedHistory(s)
	if len(history) != houseHistoryLimit || history[0].RoundID != fmt.Sprintf("%032x", 2) || history[len(history)-1].RoundID != s.RoundID {
		t.Fatal("history bounds/order", history)
	}
	lobby, _ := newHouseLobby("roulette", now.Add(casinoResultPause))
	lobby.History = history
	encoded, _ := json.Marshal(lobby)
	decoded, err := decodeHouseState(&database.BlackjackTableRecord{TableID: "public-roulette", State: encoded})
	if err != nil || len(decoded.History) != houseHistoryLimit {
		t.Fatal("saved history did not decode", err)
	}
	if len(s.History) != houseHistoryLimit || s.History[0].RoundID != fmt.Sprintf("%032x", 1) {
		t.Fatal("projection mutated saved state")
	}
	lobby.History[0].RoundID = lobby.RoundID
	encoded, _ = json.Marshal(lobby)
	if _, err := decodeHouseState(&database.BlackjackTableRecord{TableID: "public-roulette", State: encoded}); err == nil {
		t.Fatal("current/future round admitted as past history")
	}
}

func TestHousePresentationPushesOnlyChangedSeatedTable(t *testing.T) {
	oldWorld, oldSessions, oldCache, oldVersions := world, activeSessions, houseCache, housePresentationVersions
	t.Cleanup(func() {
		world, activeSessions, houseCache, housePresentationVersions = oldWorld, oldSessions, oldCache, oldVersions
	})
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	activeSessions = map[string]*Client{}
	for i, table := range []string{"public-baccarat", "public-roulette", ""} {
		id := fmt.Sprintf("player-presentation-%d", i)
		p := &game.Entity{ID: id, Type: game.TypePlayer, Health: 100, InstanceID: game.CasinoInstanceID}
		if table != "" {
			p.CasinoSeat = &game.CasinoSeatSession{TableID: table, Seat: 0, SessionID: "private-seat"}
		}
		world.Entities[id] = p
		activeSessions[id] = &Client{playerID: id, send: make(chan []byte, 16)}
	}
	now := time.Now()
	s, _ := newHouseLobby("baccarat", now.Add(-30*time.Second))
	s.Phase = "revealing"
	s.RevealAt = now.Add(houseRevealTime)
	s.Baccarat = &game.BaccaratResult{Player: []int{7, 12}, Banker: []int{8, 12}, PlayerTotal: 8, BankerTotal: 9, Winner: "banker"}
	s.Players = []houseParticipant{{PlayerID: "player-presentation-0", Name: "Hero", Seat: 0, SessionID: "private-seat", Wagers: []game.CasinoWager{{Spot: "player", Amount: 20}}}}
	encoded, _ := json.Marshal(s)
	houseCache = map[string]houseCacheEntry{"public-baccarat": {record: &database.BlackjackTableRecord{TableID: "public-baccarat", Version: 1, State: encoded}, available: true}}
	housePresentationVersions = map[string]string{}
	notifyHousePresentation(now)
	notifyHousePresentation(now.Add(500 * time.Millisecond))
	client := activeSessions["player-presentation-0"]
	if len(client.send) != 1 || len(activeSessions["player-presentation-1"].send) != 0 || len(activeSessions["player-presentation-2"].send) != 0 {
		t.Fatal("duplicate or unscoped presentation notification")
	}
	notifyHousePresentation(now.Add(time.Second))
	if len(client.send) != 2 {
		t.Fatal("newly dealt card did not push without a client poll")
	}
	delete(world.Entities, client.playerID)
	notifyHousePresentation(now.Add(2 * time.Second))
	if len(client.send) != 2 {
		t.Fatal("departed player received old table animation")
	}
}
