package main

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestCasinoOwnViewDoesNotWaitForUnrelatedGameLocks(t *testing.T) {
	for _, kind := range []string{"unseated", "slots", "blackjack", "poker", "roulette"} {
		t.Run(kind, func(t *testing.T) {
			previousWorld, previousSlots, previousPending := world, slotsCache, slotsPending
			t.Cleanup(func() { world, slotsCache, slotsPending = previousWorld, previousSlots, previousPending })
			world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
			slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
			id := "player-notification-view"
			player := &game.Entity{ID: id, Type: game.TypePlayer, Health: 100, InstanceID: game.CasinoInstanceID}
			world.Entities[id] = player
			world.Entities["player-other-table"] = &game.Entity{ID: "player-other-table", Type: game.TypePlayer, Health: 100, InstanceID: game.CasinoInstanceID,
				CasinoSeat: &game.CasinoSeatSession{TableID: "public-blackjack-earth", Seat: 1, SessionID: "other-private-session"}}
			if kind != "unseated" {
				tableID := "public-" + kind
				if kind == "slots" {
					tableID = "public-slots-earth"
					state := preparedWinningSlot(t, id)
					slotsCache[slotRecordKey(id, "earth")] = slotCacheEntry{State: state}
				}
				player.CasinoSeat = &game.CasinoSeatSession{TableID: tableID, Seat: 0, SessionID: "private-fixture-session"}
			}
			switch kind {
			case "blackjack":
				oldRecord, oldAvailable := blackjackCached, blackjackAvailable
				t.Cleanup(func() { blackjackCached, blackjackAvailable = oldRecord, oldAvailable })
				state, err := newBlackjackLobby()
				if err != nil {
					t.Fatal(err)
				}
				encoded, _ := json.Marshal(state)
				setBlackjackCache(publicBlackjackTable, &database.BlackjackTableRecord{TableID: publicBlackjackTable, Version: 1, State: encoded}, true)
			case "poker":
				oldRecord, oldAvailable, oldOwner := pokerCached, pokerAvailable, pokerPendingOwner
				t.Cleanup(func() { pokerCached, pokerAvailable, pokerPendingOwner = oldRecord, oldAvailable, oldOwner })
				state, err := newPokerLobby(-1)
				if err != nil {
					t.Fatal(err)
				}
				encoded, _ := json.Marshal(state)
				setPokerCache(publicPokerTable, &database.BlackjackTableRecord{TableID: publicPokerTable, Version: 1, State: encoded}, true, "")
			case "roulette":
				oldCache := houseCache
				t.Cleanup(func() { houseCache = oldCache })
				state, err := newHouseLobby("roulette", time.Now())
				if err != nil {
					t.Fatal(err)
				}
				encoded, _ := json.Marshal(state)
				houseCache = map[string]houseCacheEntry{"public-roulette": {record: &database.BlackjackTableRecord{TableID: "public-roulette", Version: 1, State: encoded}, available: true}}
			}
			var blocked []*sync.Mutex
			if kind != "blackjack" {
				blocked = append(blocked, &blackjackMu)
			}
			if kind != "poker" {
				blocked = append(blocked, &pokerMu)
			}
			if kind != "roulette" {
				blocked = append(blocked, &houseMu)
			}
			for _, lock := range blocked {
				lock.Lock()
			}
			client := &Client{playerID: id, send: make(chan []byte, 8)}
			done := make(chan struct{})
			go func() { sendCasinoState(client); close(done) }()
			blockedByOtherGame := false
			select {
			case <-done:
			case <-time.After(250 * time.Millisecond):
				blockedByOtherGame = true
			}
			for _, lock := range blocked {
				lock.Unlock()
			}
			select {
			case <-done:
			case <-time.After(2 * time.Second):
				t.Fatal("notification worker did not finish after releasing fixture locks")
			}
			if blockedByOtherGame {
				t.Error("own casino response waited on unrelated game's storage/timer mutex")
			}
			var message Message
			if len(client.send) != 1 || json.Unmarshal(<-client.send, &message) != nil || message.Type != "casino_update" {
				t.Fatal("own response missing or duplicated")
			}
			var payload struct {
				game.CasinoPresence
				Blackjack blackjackTableView `json:"blackjack"`
				Poker     pokerTableView     `json:"poker"`
				Slots     *slotMachineView   `json:"slots"`
				House     *houseTableView    `json:"house"`
			}
			if json.Unmarshal(message.Payload, &payload) != nil || len(payload.Tables) != len(game.CasinoTables()) || len(payload.Occupants) == 0 ||
				payload.Occupants[0].PlayerID == "" {
				t.Fatal("selective game view discarded shared floor presence")
			}
			if kind == "slots" && (payload.Slots == nil || !payload.Slots.Available || payload.Slots.Session.Revision != 2) ||
				kind == "blackjack" && (!payload.Blackjack.Available || payload.Blackjack.RoundID == "") ||
				kind == "poker" && (!payload.Poker.Available || payload.Poker.RoundID == "") ||
				kind == "roulette" && (payload.House == nil || !payload.House.Available || payload.House.RoundID == "") {
				t.Fatal("selective views discarded the seated game's state")
			}
			if kind != "blackjack" && payload.Blackjack.Available || kind != "poker" && payload.Poker.Available ||
				kind != "slots" && payload.Slots != nil || kind != "roulette" && payload.House != nil {
				t.Fatal("response included unrelated game state")
			}
		})
	}
}

func TestCasinoPhysicalActionAcknowledgesActorAndRefreshesCasinoPeers(t *testing.T) {
	for _, actorRegistered := range []bool{false, true} {
		t.Run(map[bool]string{false: "actor-outside-snapshot", true: "registered-actor"}[actorRegistered], func(t *testing.T) {
			previousWorld := world
			sessionsMu.Lock()
			previousSessions := activeSessions
			activeSessions = map[string]*Client{}
			sessionsMu.Unlock()
			t.Cleanup(func() {
				world = previousWorld
				sessionsMu.Lock()
				activeSessions = previousSessions
				sessionsMu.Unlock()
			})
			world = &game.World{Entities: map[string]*game.Entity{}}
			clients := map[string]*Client{}
			for _, id := range []string{"actor", "casino-peer", "town-player"} {
				clients[id] = &Client{playerID: id, send: make(chan []byte, 8)}
				instance := game.CasinoInstanceID
				if id == "town-player" {
					instance = ""
				}
				world.Entities[id] = &game.Entity{ID: id, Type: game.TypePlayer, Health: 100, State: "IDLE", InstanceID: instance}
				if id != "actor" || actorRegistered {
					activeSessions[id] = clients[id]
				}
			}
			actor := world.Entities["actor"]
			actor.CasinoVIPFloor, actor.Y, actor.Z = true, 8, 100
			handleMsgCasino(clients["actor"], Message{Payload: json.RawMessage(`{"action":"downstairs"}`)})
			if actor.CasinoVIPFloor || actor.Y != 0 {
				t.Fatal("physical floor action did not succeed")
			}
			for id, client := range clients {
				updates := 0
				for len(client.send) > 0 {
					var message Message
					if err := json.Unmarshal(<-client.send, &message); err != nil {
						t.Fatal(err)
					}
					if message.Type == "error" || message.Type == "casino_action_error" {
						t.Fatal("successful floor action was rejected")
					}
					if message.Type == "casino_update" {
						updates++
					}
				}
				want := 1
				if id == "town-player" {
					want = 0
				}
				if updates != want {
					t.Fatalf("%s received %d casino updates; want %d", id, updates, want)
				}
			}
		})
	}
}

func TestCasinoGameActionAudienceKeepsTablePeersAndPhysicalChanges(t *testing.T) {
	presence := game.CasinoPresence{
		YourSeat: &game.CasinoSeatSession{TableID: "public-blackjack"},
		Occupants: []game.CasinoOccupant{
			{PlayerID: "actor", TableID: "public-blackjack", Connected: true},
			{PlayerID: "peer", TableID: "public-blackjack", Connected: true},
			{PlayerID: "reserved", TableID: "public-blackjack", Connected: false},
			{PlayerID: "other-table", TableID: "public-poker", Connected: true},
			{PlayerID: "other-floor", TableID: "vip-blackjack", Connected: true},
		},
	}
	for _, action := range []string{"bet", "play", "slot_spin", "slot_bonus", "poker_buy_in", "poker_play", "house_bet"} {
		peers, scoped := casinoActionPeers(action, presence)
		if !scoped || len(peers) != 2 || !peers["actor"] || !peers["peer"] {
			t.Fatal("game action omitted a connected table peer or included unrelated/reserved seats", action)
		}
		peers, scoped = casinoActionPeers(action, game.CasinoPresence{})
		if !scoped || len(peers) != 0 {
			t.Fatal("missing actor seat broadened private game action audience")
		}
	}
	for _, action := range []string{"sit", "leave", "ready", "vip", "downstairs"} {
		peers, scoped := casinoActionPeers(action, presence)
		if scoped || peers != nil {
			t.Fatal("physical seating/floor/readiness change lost whole-casino audience", action)
		}
	}
}
