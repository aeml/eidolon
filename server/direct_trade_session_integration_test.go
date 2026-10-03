package main

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type directTradeSocketView struct {
	Trade           *game.DirectTrade `json:"trade"`
	State           string            `json:"state"`
	DeliveryPending bool              `json:"deliveryPending"`
}

// Reuses the existing explicit disposable-loopback/built-binary guard and
// production login/process helpers. Never runs against a default/live Mongo.
// No server testing message, invented settlement plan or production grant.
func TestDirectTradeActualSocketsCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	var fixtures [2]*database.Character
	var passwords [2]string
	for index := range fixtures {
		fixtures[index], passwords[index] = resourceJournalFixture(t, repo)
		fixtures[index].EP = 17 + index
		fixtures[index].Inventory = []database.Item{{ID: "trade-item-" + fixtures[index].Name, Name: "Earned trade blade", Type: "WEAPON",
			Level: 30, Stack: 1, MaxStack: 1, Rarity: string(game.RarityRare), Potency: 4, StatScaleVersion: game.ItemStatScaleVersion,
			Stats: map[string]int{"damage": 23}, Gems: []database.SocketedGem{{Stats: map[string]int{"wisdom": 7}}}}}
		if err := repo.SaveCharacter(fixtures[index].Name, fixtures[index]); err != nil {
			t.Fatal(err)
		}
	}
	var connections [2]*websocket.Conn
	open := func(address string) {
		t.Helper()
		for index := range connections {
			connections[index] = resourceOpenCharacter(t, address, fixtures[index].Name, passwords[index])
		}
	}
	t.Cleanup(func() {
		for _, conn := range connections {
			if conn != nil {
				_ = conn.Close()
			}
		}
	})
	startOffer := func(ids [2]string, gold [2]int) *game.DirectTrade {
		t.Helper()
		resourceSend(t, connections[0], MsgTradeRequest, TradeRequestPayload{TargetName: strings.ToUpper(fixtures[1].Name)})
		var view directTradeSocketView
		for _, conn := range connections {
			resourceReadMessage(t, conn, MsgTradeUpdate, &view)
		}
		if view.Trade == nil || view.State != "open" {
			t.Fatal("ordinary trade did not open")
		}
		tradeID := view.Trade.ID
		for index, conn := range connections {
			if ids[index] == "" {
				continue
			}
			resourceSend(t, conn, MsgTradeOffer, TradeOfferPayload{TradeID: tradeID, ItemIDs: []string{ids[index]}, Gold: gold[index]})
			for _, peer := range connections {
				resourceReadMessage(t, peer, MsgTradeUpdate, &view)
			}
			if view.State != "offer" || view.Trade.ID != tradeID {
				t.Fatal("offer was acknowledged before its durable save")
			}
			saved, err := repo.GetDirectTradeCharacter(fixtures[index].Name, fixtures[index].Name)
			if err != nil {
				t.Fatal(err)
			}
			state, err := database.DecodeDirectTradeState(saved.DirectTradeState)
			if err != nil || state.Escrow == nil || state.Escrow.TradeID != tradeID {
				t.Fatal("socket offer has no saved escrow", err)
			}
		}
		return view.Trade
	}
	firstConfirm := func(trade *game.DirectTrade) {
		t.Helper()
		resourceSend(t, connections[0], MsgTradeConfirm, TradeActionPayload{TradeID: trade.ID})
		for _, conn := range connections {
			var view directTradeSocketView
			resourceReadMessage(t, conn, MsgTradeUpdate, &view)
			if view.State != "confirm" || !view.Trade.ConfirmedA {
				t.Fatal("first confirmation froze/settled prematurely")
			}
		}
		op, err := repo.GetDirectTradeOperation(database.DirectTradeOperationID(trade.ID))
		if err != nil || op != nil {
			t.Fatal("first confirmation created an unauthorized joint decision", err)
		}
	}
	check := func(gold [2]int, ids [2]string, earned [2]game.Item) {
		t.Helper()
		for index, fixture := range fixtures {
			saved, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
			if err != nil || saved == nil {
				t.Fatal("missing actual saved character", err)
			}
			state, err := database.DecodeDirectTradeState(saved.DirectTradeState)
			if err != nil || state.Escrow != nil || state.Delivery != nil || saved.Gold != gold[index] || saved.EP != fixture.EP {
				t.Fatal("actual recovery lost/duplicated Gold, EP or private custody", err)
			}
			found := 0
			for _, item := range saved.Inventory {
				if item.ID == ids[index] {
					found++
					if item.Potency != earned[index].Potency || !reflect.DeepEqual(item.Stats, earned[index].Stats) ||
						!reflect.DeepEqual(gameItemFromDatabaseExact(item).Gems, earned[index].Gems) {
						t.Fatal("actual delivery changed earned affixes or gems")
					}
				}
			}
			if found != 1 {
				t.Fatal("actual item custody was lost or duplicated", found)
			}
		}
	}

	dir := t.TempDir()
	address, crash := compatStartServerWithCrash(t, binary, uri, 730, true, "-save-journal-dir", dir)
	open(address)
	ids := [2]string{fixtures[0].Inventory[0].ID, fixtures[1].Inventory[0].ID}
	trade := startOffer(ids, [2]int{17, 29})
	earned := [2]game.Item{trade.OfferA.Items[0], trade.OfferB.Items[0]}
	firstConfirm(trade)
	resourceSend(t, connections[1], MsgTradeConfirm, TradeActionPayload{TradeID: trade.ID})
	for _, conn := range connections {
		var view directTradeSocketView
		resourceReadMessage(t, conn, MsgTradeComplete, &view)
		if view.DeliveryPending {
			t.Fatal("ordinary completed delivery stayed pending")
		}
	}
	gold := [2]int{1246, 1222}
	ids = [2]string{ids[1], ids[0]}
	earned = [2]game.Item{earned[1], earned[0]}
	check(gold, ids, earned)

	// A disconnect cancels an unconfirmed gift with an untouched empty peer.
	startOffer([2]string{ids[0], ""}, [2]int{5, 0})
	resourceCloseAndWait(t, repo, connections[0], fixtures[0].Name)
	var cancelled directTradeSocketView
	resourceReadMessage(t, connections[1], MsgTradeCancel, &cancelled)
	if cancelled.DeliveryPending {
		t.Fatal("disconnect refund was not saved")
	}
	connections[0] = resourceOpenCharacter(t, address, fixtures[0].Name, passwords[0])
	check(gold, ids, earned)

	// Kill without closing sockets: only durably saved escrow remains, with no
	// shared decision. A fresh production login must discover both orphan peers.
	orphan := startOffer(ids, [2]int{17, 29})
	crash()
	for _, conn := range connections {
		_ = conn.Close()
	}
	address, secondCrash := compatStartServerWithCrash(t, binary, uri, 731, true, "-save-journal-dir", dir)
	open(address)
	check(gold, ids, earned)
	orphanOp, err := repo.GetDirectTradeOperation(database.DirectTradeOperationID(orphan.ID))
	if err != nil || orphanOp == nil || orphanOp.Decision != database.DirectTradeCancel || orphanOp.State != database.DirectTradeComplete {
		t.Fatal("fresh login did not recover the actual orphan cancellation", err)
	}

	// Reject only the second participant's new private receipt, leaving the
	// first receipt and one immutable settlement durable. This validator exists
	// only in the explicitly disposable test database and is always restored.
	partial := startOffer(ids, [2]int{17, 29})
	firstConfirm(partial)
	admin, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Disconnect(context.Background()) })
	setValidator := func(validator bson.M) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: "users"}, {Key: "validator", Value: validator},
			{Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { setValidator(bson.M{}) })
	partialID := database.DirectTradeOperationID(partial.ID)
	// The coordinator sorts actual account names; fixtures are created in
	// increasing timestamp order, so index 1 is its second saved participant.
	if fixtures[0].Name >= fixtures[1].Name {
		t.Fatal("fixture does not match sorted save order")
	}
	setValidator(bson.M{"$expr": bson.M{"$or": bson.A{bson.M{"$ne": bson.A{"$username", fixtures[1].Name}},
		bson.M{"$not": bson.A{bson.M{"$in": bson.A{partialID, "$characters.direct_trade_state.last_operation_id"}}}}}}})
	resourceSend(t, connections[1], MsgTradeConfirm, TradeActionPayload{TradeID: partial.ID})
	var pendingMessage string
	resourceReadMessage(t, connections[1], MsgError, &pendingMessage)
	if !strings.Contains(pendingMessage, "pending") {
		t.Fatal("unconfirmed partial save was announced as complete", pendingMessage)
	}
	first, err := repo.GetDirectTradeCharacter(fixtures[0].Name, fixtures[0].Name)
	if err != nil {
		t.Fatal(err)
	}
	firstState, err := database.DecodeDirectTradeState(first.DirectTradeState)
	if err != nil || firstState.LastOperationID != partialID || firstState.Delivery == nil {
		t.Fatal("first actual participant receipt is missing", err)
	}
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	lastSave, err := journal.Read(fixtures[1].Name)
	if err != nil || lastSave == nil {
		t.Fatal("second actual receipt has no crash recovery journal", err)
	}
	secondCrash()
	for _, conn := range connections {
		_ = conn.Close()
	}
	setValidator(bson.M{})
	address, stop := compatStartServer(t, binary, uri, 732, "-save-journal-dir", dir)
	defer stop()
	// Startup must replay journals and complete the shared decision before ready.
	partialOp, err := repo.GetDirectTradeOperation(partialID)
	if err != nil || partialOp == nil || partialOp.State != database.DirectTradeComplete || partialOp.Decision != database.DirectTradeSettle {
		t.Fatal("fresh server became ready before actual partial settlement recovery", err)
	}
	gold = [2]int{gold[0] + 12, gold[1] - 12}
	ids, earned = [2]string{ids[1], ids[0]}, [2]game.Item{earned[1], earned[0]}
	check(gold, ids, earned)
	open(address)
	for index, conn := range connections {
		resourceCloseAndWait(t, repo, conn, fixtures[index].Name)
	}
	stop()
	check(gold, ids, earned)
}
