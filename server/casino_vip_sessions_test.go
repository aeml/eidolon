package main

import (
	"context"
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestVIPCasinoMongoPokerSlotsAndMembershipExpiry(t *testing.T) {
	clients, tokens := setupPokerMongo(t)
	now := time.Now()
	period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(-time.Hour).AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	oldLoader := loadVIPPeriods
	t.Cleanup(func() { loadVIPPeriods = oldLoader })
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
	publicBefore := pokerViewFor("spectator")
	for i, c := range clients {
		if err := world.ChangeCasinoSeat(c.playerID, tokens[i], "leave", false, now, ""); err != nil {
			t.Fatal(err)
		}
		if err := requireCasinoVIPLocked(c, now); err != nil {
			t.Fatal(err)
		}
		p := world.Entities[c.playerID]
		p.X, p.Y, p.Z = 0, 0, 153
		if err := world.ChangeCasinoFloor(p.ID, true, now); err != nil {
			t.Fatal(err)
		}
		table, _ := game.CasinoTableByID("vip-poker")
		p.X, p.Z = table.Seats[i].ExitX, table.Seats[i].ExitZ
		seat, err := world.TakeCasinoSeat(p.ID, table.ID, i, now)
		if err != nil {
			t.Fatal(err)
		}
		tokens[i] = seat.SessionID
	}
	id := pokerViewFor(clients[0].playerID).RoundID
	if id == publicBefore.RoundID {
		t.Fatal("public and VIP lobbies reused a round identity")
	}
	for i, c := range clients {
		if err := handlePokerBuyIn(c, tokens[i], id, 20, now); err != nil {
			t.Fatal(err)
		}
		if p := world.GetEntityCopy(c.playerID); p.EP != 80 || p.Gold != 300 {
			t.Fatal("wrong funding currency", p.EP, p.Gold)
		}
	}
	if publicAfter := pokerViewFor("spectator"); publicAfter.RoundID != publicBefore.RoundID || len(publicAfter.Players) != 0 {
		t.Fatal("VIP mixed into public poker")
	}
	v := pokerViewFor(clients[0].playerID)
	if v.Currency != "ep" || v.Balance != 80 || v.MaxBuyIn != 100 || v.BigBlind != 2 {
		t.Fatal("wrong VIP metadata", v)
	}
	if err := tickPoker(v.DealAt, "vip-poker"); err != nil {
		t.Fatal(err)
	}
	v = pokerViewFor(clients[0].playerID)
	if v.Phase != "playing" || v.Round == nil || v.Round.Players[1].Cards[0] != -1 {
		t.Fatal("VIP shared deal/privacy", v)
	}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, nil }
	for _, c := range clients {
		if requireCasinoFundingLocked(c, "ep", 1, now) == nil {
			t.Fatal("expired membership funded wager")
		}
	}
	for i, c := range clients {
		if c.playerID == v.Round.TurnPlayerID {
			if err := handlePokerPlay(c, tokens[i], id, "fold", 0, v.Round.Revision, v.Round.Deadline.Add(-time.Second)); err != nil {
				t.Fatal("expiry blocked funded action", err)
			}
		}
	}
	for step := 0; step < 3; step++ {
		if err := tickPoker(v.DealAt, "vip-poker"); err != nil {
			t.Fatal(err)
		}
	}
	total := 0
	for _, c := range clients {
		p := world.GetEntityCopy(c.playerID)
		total += p.EP
		if p.Gold != 300 {
			t.Fatal("EP pot paid Gold")
		}
	}
	if total != 200 {
		t.Fatal("EP pot not conserved", total)
	}
	c := clients[0]
	if err := handlePokerLeave(c, tokens[0], now); err != nil {
		t.Fatal(err)
	}
	if err := world.ChangeCasinoSeat(c.playerID, tokens[0], "leave", false, now, ""); err != nil {
		t.Fatal(err)
	}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
	if err := requireCasinoVIPLocked(c, now); err != nil {
		t.Fatal(err)
	}
	table, _ := game.CasinoTableByID("vip-slots-earth")
	p := world.Entities[c.playerID]
	p.X, p.Z = table.Seats[0].ExitX, table.Seats[0].ExitZ
	seat, err := world.TakeCasinoSeat(p.ID, table.ID, 0, now)
	if err != nil {
		t.Fatal(err)
	}
	r, s, err := loadSlotSessionLocked(p.ID, "earth", "ep")
	if err != nil {
		t.Fatal(err)
	}
	setupEPRecordCleanup(t, r.TableID)
	if err := handleSlotAction(c, seat.SessionID, s.Session.Revision, "spin", 10, 0); err != nil {
		t.Fatal(err)
	}
	view := slotViewFor(p.ID)
	if view.Currency != "ep" || view.MaxBet != 100 || view.MinBet != 10 || p.Gold != 300 {
		t.Fatal("VIP slot used Gold", view)
	}
	public, err := game.NewSlotSession("earth")
	if err != nil {
		t.Fatal(err)
	}
	if public.Bet != 20 {
		t.Fatal("legacy slot stake changed")
	}
}

func TestVIPCasinoMongoBlackjackSharedHandSettlesAfterExpiry(t *testing.T) {
	clients, tokens := setupPokerMongo(t)
	now := time.Now()
	period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(-time.Hour).AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	oldLoader, oldExtra, oldAvailable := loadVIPPeriods, extraBlackjack, extraBlackjackAvailable
	t.Cleanup(func() { loadVIPPeriods, extraBlackjack, extraBlackjackAvailable = oldLoader, oldExtra, oldAvailable })
	extraBlackjack = map[string]*database.BlackjackTableRecord{}
	extraBlackjackAvailable = map[string]bool{}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
	table, _ := game.CasinoTableByID("vip-blackjack")
	lobby, err := newBlackjackLobby()
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(lobby)
	if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
		t.Fatal(err)
	}
	setupEPRecordCleanup(t, table.ID)
	for i, c := range clients {
		if err := world.ChangeCasinoSeat(c.playerID, tokens[i], "leave", false, now, ""); err != nil {
			t.Fatal(err)
		}
		if err := requireCasinoVIPLocked(c, now); err != nil {
			t.Fatal(err)
		}
		p := world.Entities[c.playerID]
		p.X, p.Z = 0, 153
		if err := world.ChangeCasinoFloor(p.ID, true, now); err != nil {
			t.Fatal(err)
		}
		p.X, p.Z = table.Seats[i].ExitX, table.Seats[i].ExitZ
		seat, err := world.TakeCasinoSeat(p.ID, table.ID, i, now)
		if err != nil {
			t.Fatal(err)
		}
		tokens[i] = seat.SessionID
		if err := handleBlackjackBet(c, seat.SessionID, lobby.RoundID, 100, now); err != nil {
			t.Fatal(err)
		}
		if err := handleBlackjackBet(c, seat.SessionID, lobby.RoundID, 100, now); err != nil {
			t.Fatal("retry", err)
		}
		if p.EP != 0 || p.Gold != 300 {
			t.Fatal("blackjack funding not EP-only")
		}
	}
	v := blackjackViewFor(clients[0].playerID)
	if v.Currency != "ep" || v.Balance != 0 || v.MaxBet != 100 || len(v.Players) != 2 {
		t.Fatal("shared EP blackjack metadata", v)
	}
	if err := tickBlackjack(v.DealAt, table.ID); err != nil {
		t.Fatal(err)
	}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, nil }
	for _, c := range clients {
		if requireCasinoFundingLocked(c, "ep", 2, now) == nil {
			t.Fatal("expired extra funding admitted")
		}
	}
	for moves := 0; moves < 3; moves++ {
		v = blackjackViewFor(clients[0].playerID)
		if v.Phase != "playing" {
			break
		}
		for i, c := range clients {
			if c.playerID == v.Round.TurnPlayerID {
				if err := handleBlackjackPlay(c, tokens[i], v.RoundID, "stand", v.Round.Revision, v.Round.Deadline.Add(-time.Second)); err != nil {
					t.Fatal("expiry blocked stand", err)
				}
			}
		}
	}
	for i := 0; i < 3; i++ {
		if err := tickBlackjack(v.DealAt, table.ID); err != nil {
			t.Fatal(err)
		}
	}
	v = blackjackViewFor(clients[0].playerID)
	if v.Phase != "complete" {
		t.Fatal("VIP blackjack not settled", v.Phase)
	}
	for _, c := range clients {
		p := world.GetEntityCopy(c.playerID)
		want := 0
		for _, rp := range v.Round.Players {
			if rp.PlayerID == p.ID {
				for _, hand := range rp.Hands {
					want += hand.Payout
				}
			}
		}
		if p.EP != want || p.Gold != 300 || len(p.GoldCreditReceipts) != 0 {
			t.Fatal("VIP blackjack wrong wallet payout", p.EP, want)
		}
	}
}

// Only the explicit disposable loopback URI accepted by setupPokerMongo is used.
func setupEPRecordCleanup(t *testing.T, key string) {
	t.Helper()
	// Reuse the already-validated fixture URI without replacing its global world.
	uri := os.Getenv("EIDOLON_CASINO_TEST_MONGO_URI")
	connection, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		connection.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": key})
		connection.Disconnect(context.Background())
	})
}
