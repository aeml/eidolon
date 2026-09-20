package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/mongo"
)

type houseSocketPresence struct {
	game.CasinoPresence
	House *houseTableView `json:"house"`
}

func readHouseSocket(t *testing.T, conn *websocket.Conn, match func(houseSocketPresence) bool) houseSocketPresence {
	t.Helper()
	until, nextPoll := time.Now().Add(45*time.Second), time.Time{}
	conn.SetReadDeadline(until)
	for time.Now().Before(until) {
		if !time.Now().Before(nextPoll) {
			resourceSend(t, conn, MsgCasino, map[string]any{"action": "get"})
			nextPoll = time.Now().Add(3 * time.Second)
		}
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if json.Unmarshal(data, &message) != nil {
			t.Fatal("bad socket response")
		}
		if message.Type == MsgError {
			t.Fatalf("house session rejected: %s", message.Payload)
		}
		if message.Type != "casino_update" {
			continue
		}
		var fields map[string]json.RawMessage
		json.Unmarshal(message.Payload, &fields)
		if strings.Contains(string(fields["house"]), "sessionId") || strings.Contains(string(fields["house"]), "\"deck\"") {
			t.Fatal("private house state leaked")
		}
		var v houseSocketPresence
		if err := json.Unmarshal(message.Payload, &v); err != nil {
			t.Fatal(err)
		}
		if match(v) {
			return v
		}
	}
	t.Fatal("house socket did not reach expected state")
	return houseSocketPresence{}
}

// Two real guests take the guard and walk the central aisle together. This is
// ordinary authorized movement, not a client-height teleport or floor bypass.
func approachHouseVIPSeats(t *testing.T, conns []*websocket.Conn, table game.CasinoTable) {
	t.Helper()
	contexts := make([]string, len(conns))
	for i, conn := range conns {
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "vip"})
		var floor struct {
			Upstairs bool `json:"upstairs"`
		}
		resourceReadMessage(t, conn, "casino_floor", &floor)
		if !floor.Upstairs {
			t.Fatal("VIP guard denied valid membership")
		}
		var movement struct {
			ID string `json:"movementContext"`
		}
		resourceReadMessage(t, conn, MsgMovementContext, &movement)
		contexts[i] = movement.ID
		if contexts[i] == "" {
			t.Fatal("stairs omitted movement context")
		}
	}
	positions := make([][2]float64, len(conns))
	for i := range positions {
		positions[i] = [2]float64{0, 104}
	}
	sequence := uint64(0)
	for leg := 0; leg < 2; leg++ {
		targets := make([][2]float64, len(conns))
		steps := 0
		for i := range conns {
			point := table.Seats[i]
			targets[i] = [2]float64{0, point.ExitZ}
			if leg == 1 {
				targets[i][0] = point.ExitX
			}
			steps = max(steps, int(math.Ceil(math.Hypot(targets[i][0]-positions[i][0], targets[i][1]-positions[i][1])/.8)))
		}
		for step := 1; step <= steps; step++ {
			time.Sleep(350 * time.Millisecond)
			sequence++
			fraction := float64(step) / float64(steps)
			for i, conn := range conns {
				resourceSend(t, conn, MsgMove, MovePayload{MovementContext: contexts[i], Sequence: sequence, State: "RUNNING", Y: 8,
					X: positions[i][0] + (targets[i][0]-positions[i][0])*fraction, Z: positions[i][1] + (targets[i][1]-positions[i][1])*fraction})
			}
		}
		positions = targets
	}
}

func TestHouseActualSocketsSharedRoundAndReconnect(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable Mongo and built server required")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	// One real socket case per game/floor; the focused Mongo suite covers all
	// four game/currency combinations and interrupted money acknowledgements.
	for _, tc := range []struct{ kind, currency string }{{"roulette", "gold"}, {"baccarat", "ep"}} {
		t.Run(tc.kind+"-"+tc.currency, func(t *testing.T) {
			prefix := "public"
			if tc.currency == "ep" {
				prefix = "vip"
			}
			id := prefix + "-" + tc.kind
			table, _ := game.CasinoTableByID(id)
			// An earlier subcase may have initialized an unused lobby, never an
			// existing funded round. This database must be explicitly disposable.
			if r, err := repo.GetBlackjackTable(id); err == nil {
				s, err := decodeHouseState(r)
				if err != nil || r.Pending != nil || s.Phase != "betting" || len(s.Players) != 0 {
					t.Fatal("refusing funded house table", id, err)
				}
			} else if !errors.Is(err, mongo.ErrNoDocuments) {
				t.Fatal(err)
			}
			names := []string{fmt.Sprintf("house-a-%d", time.Now().UnixNano()), fmt.Sprintf("house-b-%d", time.Now().UnixNano())}
			for i, name := range names {
				if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
					t.Fatal(err)
				}
				point := table.Seats[i]
				fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
					InstanceID: game.CasinoInstanceID, X: point.ExitX, Z: point.ExitZ, Gold: 500, LastDailyQuest: time.Now(),
					Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
				if tc.currency == "ep" {
					fixture.X, fixture.Z = 0, 104
					if i == 0 {
						if _, err := repo.GrantAdminRole(name, name, "disposable_casino_fixture"); err != nil {
							t.Fatal(err)
						}
					} else {
						start := time.Now().Add(-time.Hour)
						period, err := database.NewVIPPeriod(start, start.AddDate(0, 1, 0))
						if err != nil {
							t.Fatal(err)
						}
						if _, err := repo.ProvisionVIPPeriod(name, period); err != nil {
							t.Fatal(err)
						}
					}
				}
				if err := repo.SetFirstCharacter(name, fixture); err != nil {
					t.Fatal(err)
				}
			}
			journal := t.TempDir()
			address, stop := compatStartServer(t, binary, uri, 701, "-save-journal-dir", journal)
			defer stop()
			conns := make([]*websocket.Conn, 2)
			tokens := make([]string, 2)
			for i, name := range names {
				conns[i], _ = resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
			}
			if tc.currency == "ep" {
				approachHouseVIPSeats(t, conns, table)
			}
			for i, conn := range conns {
				resourceSend(t, conn, MsgCasino, map[string]any{"action": "sit", "tableId": id, "seat": i})
				v := readHouseSocket(t, conn, func(v houseSocketPresence) bool { return v.YourSeat != nil && v.House != nil && v.House.Available })
				if v.House.Currency != tc.currency || tc.currency == "ep" && v.House.Balance != 100 {
					t.Fatal("wrong currency or repeated/missing allowance", v.House.Currency, v.House.Balance)
				}
				tokens[i] = v.YourSeat.SessionID
			}
			v := readHouseSocket(t, conns[0], func(v houseSocketPresence) bool {
				return v.House != nil && v.House.Phase == "betting" && time.Until(v.House.DealAt) > 8*time.Second
			})
			for i, conn := range conns {
				spot := []string{"red", "black"}[i]
				if tc.kind == "baccarat" {
					spot = []string{"banker", "player"}[i]
				}
				request := map[string]any{"action": "house_bet", "sessionId": tokens[i], "roundId": v.House.RoundID, "wagers": []game.CasinoWager{{Spot: spot, Amount: 20}}}
				resourceSend(t, conn, MsgCasino, request)
				readHouseSocket(t, conn, func(v houseSocketPresence) bool {
					return v.House != nil && len(v.House.Players) == i+1 && !v.House.Processing
				})
				resourceSend(t, conn, MsgCasino, request) // Exact duplicate must not debit again.
			}
			shared := readHouseSocket(t, conns[1], func(v houseSocketPresence) bool { return v.House != nil && len(v.House.Players) == 2 })
			if shared.House.RoundID != v.House.RoundID {
				t.Fatal("different shared rounds")
			}
			// Close before the outcome; the remaining guest observes the same hand.
			resourceCloseAndWait(t, repo, conns[0], names[0])
			complete := readHouseSocket(t, conns[1], func(v houseSocketPresence) bool {
				return v.House != nil && v.House.RoundID == shared.House.RoundID && v.House.Phase == "complete" && !v.House.Processing
			})
			outcomes := complete.House.Players
			resourceCloseAndWait(t, repo, conns[1], names[1])
			stop()
			// A fresh process must load the same completed round/receipts. The admin
			// rejoins through real membership refresh and cannot gain another 100 EP.
			address, stopAgain := compatStartServer(t, binary, uri, 702, "-save-journal-dir", journal)
			defer stopAgain()
			for _, name := range names {
				conn, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
				saved := resourceCloseAndWait(t, repo, conn, name)
				var own houseParticipantView
				for _, p := range outcomes {
					if p.PlayerID == "player-"+name {
						own = p
					}
				}
				if !own.Paid {
					t.Fatal("missing saved payout")
				}
				wantReceipts := 1
				if own.Payout > 0 {
					wantReceipts++
				}
				if tc.currency == "gold" && (saved.Gold != 480+own.Payout || saved.EP != 0 || len(saved.GoldCreditReceipts) != wantReceipts) {
					t.Fatal("Gold replay/settlement mismatch", saved.Gold, own.Payout)
				}
				if tc.currency == "ep" && (saved.Gold != 500 || saved.EP != 80+own.Payout || len(saved.EPCasinoReceipts) != wantReceipts || len(saved.VIPAllowanceReceipts) != 1) {
					t.Fatal("EP/allowance mismatch", saved.EP, own.Payout, len(saved.VIPAllowanceReceipts))
				}
			}
			r, err := repo.GetBlackjackTable(id)
			if err != nil {
				t.Fatal(err)
			}
			s, err := decodeHouseState(r)
			if err != nil {
				t.Fatal(err)
			}
			if s.RoundID == complete.House.RoundID && (!reflect.DeepEqual(s.Number, complete.House.Number) || !reflect.DeepEqual(s.Baccarat, complete.House.Baccarat)) {
				t.Fatal("restart altered saved result")
			}
			t.Logf("%s/%s: two real sockets, one round, duplicate wagers, departed-player settlement and fresh-process wallet recovery passed", tc.kind, tc.currency)
		})
	}
}
