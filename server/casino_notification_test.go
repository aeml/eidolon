package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

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
