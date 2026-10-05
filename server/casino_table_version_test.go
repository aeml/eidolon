package main

import (
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestCasinoTableViewsExposeExactPersistentVersionAcrossHands(t *testing.T) {
	c, _, _ := epWalletFixture(t)
	oldBlackjack, oldBA := blackjackCached, blackjackAvailable
	oldPoker, oldPA := pokerCached, pokerAvailable
	oldHouse := houseCache
	defer func() {
		blackjackCached, blackjackAvailable = oldBlackjack, oldBA
		pokerCached, pokerAvailable = oldPoker, oldPA
		houseCache = oldHouse
	}()
	const version int64 = 9007199254740993
	for _, kind := range []string{"blackjack", "poker", "roulette", "baccarat"} {
		t.Run(kind, func(t *testing.T) {
			tableID := "public-" + kind
			player := world.Entities[c.playerID]
			player.CasinoSeat = &game.CasinoSeatSession{TableID: tableID, Seat: 0, SessionID: "synthetic-private-secret"}
			var state interface{}
			var err error
			switch kind {
			case "blackjack":
				state, err = newBlackjackLobby()
			case "poker":
				state, err = newPokerLobby(-1)
			default:
				state, err = newHouseLobby(kind, time.Now())
			}
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(state)
			if err != nil {
				t.Fatal(err)
			}
			record := &database.BlackjackTableRecord{TableID: tableID, Version: version, State: encoded}
			view := func() interface{} {
				switch kind {
				case "blackjack":
					blackjackCached, blackjackAvailable = record, true
					return blackjackViewFor(c.playerID)
				case "poker":
					pokerCached, pokerAvailable = record, true
					return pokerViewFor(c.playerID)
				default:
					houseCache = map[string]houseCacheEntry{tableID: {record: record, available: true}}
					return houseViewFor(c.playerID)
				}
			}
			for _, n := range []int64{version, version + 1} {
				record.Version = n
				if n > version {
					// A subsequent hand has a new round identity, not a reset
					// of the native persistent table counter.
					switch kind {
					case "blackjack":
						state, err = newBlackjackLobby()
					case "poker":
						state, err = newPokerLobby(-1)
					default:
						state, err = newHouseLobby(kind, time.Now())
					}
					if err != nil {
						t.Fatal(err)
					}
					record.State, err = json.Marshal(state)
					if err != nil {
						t.Fatal(err)
					}
				}
				payload, err := json.Marshal(view())
				if err != nil {
					t.Fatal(err)
				}
				var projected struct {
					TableID, TableVersion string
					Available             bool
				}
				if json.Unmarshal(payload, &projected) != nil || !projected.Available || projected.TableID != tableID || projected.TableVersion != strconv.FormatInt(n, 10) {
					t.Fatal("table identity/exact decimal version missing")
				}
				var fields map[string]json.RawMessage
				if json.Unmarshal(payload, &fields) != nil || len(fields["tableVersion"]) == 0 || fields["tableVersion"][0] != '"' {
					t.Fatal("version encoded as a lossy number")
				}
			}
		})
	}
}
