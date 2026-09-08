package main

import (
	"context"
	"os"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

// Prepared listing/43-gold escrow; purchases and recovery use ordinary sessions.
func auctionBuyoutFixture(t *testing.T, repo *database.DB, mode string) (*database.Character, string, *database.Character, *database.Auction) {
	t.Helper()
	storage := ""
	if mode == "stash" || mode == "full" {
		storage = mode
	}
	p, password, a := auctionItemFixture(t, repo, "SOLD", storage)
	a.Status, a.BuyerID = "ACTIVE", ""
	old, _ := resourceJournalFixture(t, repo)
	old.Gold = 1191
	if err := repo.SaveCharacter(old.Name, old); err != nil {
		t.Fatal(err)
	}
	a.BidderID, a.BidderName = "player-"+old.Name, old.Name
	if mode == "same_bidder" {
		p.Gold = 1191
		a.BidderID, a.BidderName = "player-"+p.Name, p.Name
	}
	if mode == "insufficient" {
		p.Gold = 499
	}
	if mode == "disabled" {
		a.Buyout = 0
	}
	if err := repo.SaveCharacter(p.Name, p); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpdateAuction(a); err != nil {
		t.Fatal(err)
	}
	return p, password, old, a
}

func verifyAuctionPurchaseCharacter(t *testing.T, saved, baseline *database.Character, item database.Item, opID string, bought bool, gold int, sameBidder bool) {
	t.Helper()
	expected := *baseline
	expected.Gold = gold
	copies := 0
	if bought {
		copies = 1
		expected.GoldCreditReceipts = map[string]int{"buyout:" + opID: -500}
		if sameBidder {
			refundCount := 0
			for id, amount := range saved.GoldCreditReceipts {
				if id != "buyout:"+opID {
					if amount != 43 {
						t.Fatal("wrong same-bidder refund")
					}
					expected.GoldCreditReceipts[id] = 43
					refundCount++
				}
			}
			if refundCount != 1 {
				t.Fatal("same-bidder escrow not refunded exactly once")
			}
		}
		if saved.ItemDeliveryReceipts[opID] == "" {
			t.Fatal("item receipt does not match final purchase")
		}
	}
	verifyAuctionItemCharacter(t, saved, &expected, item, copies)
}

func TestAuctionBuyoutActualNormalAndCapacity(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, mode := range []string{"ordinary", "same_bidder", "stash", "full", "insufficient", "disabled"} {
		t.Run(mode, func(t *testing.T) {
			p, password, old, a := auctionBuyoutFixture(t, repo, mode)
			dir := t.TempDir()
			bought := mode != "full" && mode != "insufficient" && mode != "disabled"
			var baseline, firstSave *database.Character
			opID := ""
			for phase := 140; phase < 142; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				connection := resourceOpenCharacter(t, address, p.Name, password)
				if phase == 140 {
					resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
					var cast game.AbilityResult
					resourceReadMessage(t, connection, MsgAbilityResult, &cast)
					if !cast.Accepted || cast.Mana != 70 {
						t.Fatal("ordinary cast failed")
					}
					baseline = resourceCloseAndWait(t, repo, connection, p.Name)
					connection = resourceOpenCharacter(t, address, p.Name, password)
				}
				resourceSend(t, connection, MsgTradingBuyout, TradingBuyoutPayload{AuctionID: a.ID})
				var reply string
				resourceReadMessage(t, connection, MsgError, &reply)
				want := "Auction bought!"
				if phase == 141 {
					want = "auction is not active"
				}
				if mode == "full" {
					want = game.ErrAuctionStorageFull.Error()
				}
				if mode == "insufficient" {
					want = database.ErrInsufficientGold.Error()
				}
				if mode == "disabled" {
					want = "auction has no buyout price"
				}
				if reply != want {
					t.Fatalf("buyout reply=%q want%q", reply, want)
				}
				current := resourceWaitRefundAuction(t, repo, a.ID, func(value *database.Auction) bool {
					return len(value.PendingRefunds) == 0 && (!bought || value.Status == "SOLD")
				})
				if bought {
					opID = current.LastBidOperationID
				}
				if current.ItemClaimed != bought || current.SellerClaimed || pendingAuctionBid(t, repo, a.ID) != nil || !reflect.DeepEqual(current.Item, a.Item) {
					t.Fatal("buyout claim/item state changed incorrectly")
				}
				if bought && (current.BuyerID != "player-"+p.Name || current.SalePrice != 500 || opID == "") {
					t.Fatal("wrong winning purchase")
				}
				saved, err := repo.GetCharacter(p.Name, p.Name)
				if err != nil {
					t.Fatal(err)
				}
				wantedGold := baseline.Gold
				if bought {
					wantedGold -= 500
					if mode == "same_bidder" {
						wantedGold += 43
					}
				}
				verifyAuctionPurchaseCharacter(t, saved, baseline, a.Item, opID, bought, wantedGold, mode == "same_bidder")
				if mode == "stash" && (len(saved.Stash) != 1 || saved.Stash[0].ID != a.Item.ID) {
					t.Fatal("purchase not delivered into available stash")
				}
				if !bought && (!reflect.DeepEqual(saved.Inventory, baseline.Inventory) || !reflect.DeepEqual(saved.Stash, baseline.Stash)) {
					t.Fatal("rejected purchase changed storage")
				}
				oldSaved, err := repo.GetCharacter(old.Name, old.Name)
				if err != nil {
					t.Fatal(err)
				}
				oldGold := 1191
				oldReceipts := 0
				if bought && mode != "same_bidder" {
					oldGold = 1234
					oldReceipts = 1
				}
				if oldSaved.Gold != oldGold || len(oldSaved.GoldCreditReceipts) != oldReceipts || !reflect.DeepEqual(oldSaved.Resources, old.Resources) {
					t.Fatal("buyout lost or duplicated previous escrow refund")
				}
				if bought {
					resourceSend(t, connection, MsgTradingCollect, TradingCollectPayload{AuctionID: a.ID})
					resourceReadMessage(t, connection, MsgError, &reply)
					if reply != "nothing to collect" {
						t.Fatal("buyout item collected again")
					}
				}
				saved = resourceCloseAndWait(t, repo, connection, p.Name)
				if phase == 140 {
					firstSave = saved
				} else if !reflect.DeepEqual(saved.ItemDeliveryReceipts, firstSave.ItemDeliveryReceipts) || !reflect.DeepEqual(saved.GoldCreditReceipts, firstSave.GoldCreditReceipts) {
					t.Fatal("restart/repeat request changed receipts")
				}
				stop()
			}
		})
	}
}

func TestAuctionBuyoutActualCrashBoundaries(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	if os.Getenv("EIDOLON_RESOURCE_FAILPOINTS") != "1" {
		t.Skip("requires disposable Mongo failpoints")
	}
	admin := resourceRefundAdmin(t, uri)
	for _, boundary := range []string{"decision_rejected", "decision_reply_lost", "before_purchase", "purchase_journal", "before_finalize", "final_reply_lost"} {
		t.Run(boundary, func(t *testing.T) {
			p, password, old, a := auctionBuyoutFixture(t, repo, "ordinary")
			dir := t.TempDir()
			address, crash := compatStartServerWithCrash(t, binary, uri, 144, true, "-save-journal-dir", dir)
			connection := resourceOpenCharacter(t, address, p.Name, password)
			resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
			var cast game.AbilityResult
			resourceReadMessage(t, connection, MsgAbilityResult, &cast)
			if !cast.Accepted || cast.Mana != 70 {
				t.Fatal("ordinary cast failed")
			}
			baseline := resourceCloseAndWait(t, repo, connection, p.Name)
			connection = resourceOpenCharacter(t, address, p.Name, password)
			collection, validator := "", bson.M{}
			command, namespace := "", ""
			switch boundary {
			case "decision_rejected":
				collection, validator = "auction_bid_operations", bson.M{"deliberate_rejection": true}
			case "decision_reply_lost":
				command, namespace = "insert", "eidolon.auction_bid_operations"
			case "before_purchase":
				collection, validator = "users", bson.M{"username": bson.M{"$ne": p.Name}}
			case "purchase_journal":
				collection, validator = "users", bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": p.Name}}, bson.M{"characters": bson.M{"$elemMatch": bson.M{"name": p.Name, "gold": 1234}}}}}
			case "before_finalize":
				collection, validator = "auctions", bson.M{"$or": bson.A{bson.M{"id": bson.M{"$ne": a.ID}}, bson.M{"status": bson.M{"$ne": "SOLD"}}}}
			case "final_reply_lost":
				command, namespace = "update", "eidolon.auctions"
			}
			configure := func(enabled bool) {
				t.Helper()
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if command != "" {
					mode := "off"
					if enabled {
						mode = "alwaysOn"
					}
					if err := admin.Database("admin").RunCommand(ctx, bson.D{{Key: "configureFailPoint", Value: "failCommand"}, {Key: "mode", Value: mode}, {Key: "data", Value: bson.M{"failCommands": []string{command}, "namespace": namespace, "writeConcernError": bson.M{"code": 64, "errmsg": "prepared purchase acknowledgement failure"}}}}).Err(); err != nil {
						t.Fatal(err)
					}
				} else {
					value := bson.M{}
					if enabled {
						value = validator
					}
					if err := admin.Database("eidolon").RunCommand(ctx, bson.D{{Key: "collMod", Value: collection}, {Key: "validator", Value: value}, {Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"}}).Err(); err != nil {
						t.Fatal(err)
					}
				}
			}
			t.Cleanup(func() { configure(false) })
			configure(true)
			resourceSend(t, connection, MsgTradingBuyout, TradingBuyoutPayload{AuctionID: a.ID})
			var reply string
			resourceReadMessage(t, connection, MsgError, &reply)
			if reply != "Your auction purchase is awaiting recovery. Please try again shortly." {
				t.Fatal("fault missed purchase", reply)
			}
			op := pendingAuctionBid(t, repo, a.ID)
			opID := ""
			if boundary == "decision_rejected" {
				if op != nil {
					t.Fatal("rejected decision committed")
				}
			} else {
				if op == nil || op.Kind != database.AuctionOperationBuyout || op.Amount != 500 || !op.Valid() {
					t.Fatal("purchase decision missing")
				}
				opID = op.ID
			}
			before, err := repo.GetCharacter(p.Name, p.Name)
			if err != nil {
				t.Fatal(err)
			}
			purchased := boundary == "before_finalize" || boundary == "final_reply_lost"
			gold := 1234
			if purchased {
				gold = 734
			}
			verifyAuctionPurchaseCharacter(t, before, baseline, a.Item, opID, purchased, gold, false)
			current, err := repo.GetAuction(a.ID)
			if err != nil || current.ItemClaimed != (boundary == "final_reply_lost") {
				t.Fatal("fault missed final sale boundary")
			}
			if boundary == "purchase_journal" {
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				pending, err := journal.Read(p.Name)
				if err != nil || pending == nil {
					t.Fatal("purchase journal missing")
				}
				saved, err := pending.Character()
				if err != nil {
					t.Fatal(err)
				}
				verifyAuctionPurchaseCharacter(t, saved, baseline, a.Item, opID, true, 734, false)
			}
			crash()
			configure(false)
			for phase := 145; phase < 147; phase++ {
				address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
				if pendingAuctionBid(t, repo, a.ID) != nil {
					t.Fatal("startup admitted before purchase recovery")
				}
				bought := boundary != "decision_rejected"
				current = resourceWaitRefundAuction(t, repo, a.ID, func(value *database.Auction) bool {
					return len(value.PendingRefunds) == 0 && (!bought || value.Status == "SOLD")
				})
				connection := resourceOpenCharacter(t, address, p.Name, password)
				if bought {
					resourceSend(t, connection, MsgTradingBuyout, TradingBuyoutPayload{AuctionID: a.ID})
					resourceReadMessage(t, connection, MsgError, &reply)
					if reply != "auction is not active" {
						t.Fatal("recovered purchase accepted twice", reply)
					}
				}
				saved := resourceCloseAndWait(t, repo, connection, p.Name)
				gold := 1234
				if bought {
					gold = 734
				}
				verifyAuctionPurchaseCharacter(t, saved, baseline, a.Item, opID, bought, gold, false)
				oldSaved, err := repo.GetCharacter(old.Name, old.Name)
				if err != nil {
					t.Fatal(err)
				}
				oldGold := 1191
				if bought {
					oldGold = 1234
				}
				if oldSaved.Gold != oldGold || !reflect.DeepEqual(oldSaved.Resources, old.Resources) {
					t.Fatal("previous bidder refund changed through recovery")
				}
				if bought && (oldSaved.GoldCreditReceipts[op.RefundID] != 43 || len(oldSaved.GoldCreditReceipts) != 1) {
					t.Fatal("previous escrow refund receipt missing/duplicated")
				}
				if current.ItemClaimed != bought || current.SellerClaimed || !reflect.DeepEqual(current.Item, a.Item) || bought && (current.BuyerID != "player-"+p.Name || current.SalePrice != 500) {
					t.Fatal("recovery changed wrong auction fields")
				}
				stop()
			}
		})
	}
}

func TestAuctionBuyoutActualCompetingRequests(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	first, firstPassword, old, a := auctionBuyoutFixture(t, repo, "ordinary")
	second, secondPassword := resourceJournalFixture(t, repo)
	players := []*database.Character{first, second}
	dir := t.TempDir()
	winner := -1
	for phase := 148; phase < 150; phase++ {
		address, stop := compatStartServer(t, binary, uri, phase, "-save-journal-dir", dir)
		connections := []*websocket.Conn{
			resourceOpenCharacter(t, address, first.Name, firstPassword), resourceOpenCharacter(t, address, second.Name, secondPassword),
		}
		start, sent := make(chan struct{}), make(chan error, 2)
		for _, connection := range connections {
			go func(c *websocket.Conn) {
				<-start
				sent <- c.WriteJSON(map[string]any{"type": MsgTradingBuyout, "payload": TradingBuyoutPayload{AuctionID: a.ID}})
			}(connection)
		}
		close(start)
		for range connections {
			if err := <-sent; err != nil {
				t.Fatal(err)
			}
		}
		accepted := 0
		for i, connection := range connections {
			var reply string
			resourceReadMessage(t, connection, MsgError, &reply)
			if reply == "Auction bought!" {
				accepted++
				winner = i
			} else if reply != "auction is not active" && reply != game.ErrAuctionBidPending.Error() {
				t.Fatal("unexpected competing buyout response", reply)
			}
		}
		if phase == 148 && accepted != 1 || phase == 149 && accepted != 0 {
			t.Fatalf("competing/repeated buyout accepted %d winners", accepted)
		}
		settled := resourceWaitRefundAuction(t, repo, a.ID, func(value *database.Auction) bool { return value.Status == "SOLD" && len(value.PendingRefunds) == 0 })
		if winner < 0 || settled.BuyerID != "player-"+players[winner].Name || !settled.ItemClaimed || settled.SalePrice != 500 || pendingAuctionBid(t, repo, a.ID) != nil {
			t.Fatal("wrong competing buyout winner")
		}
		for i, connection := range connections {
			saved := resourceCloseAndWait(t, repo, connection, players[i].Name)
			gold := 1234
			if i == winner {
				gold = 734
			}
			verifyAuctionPurchaseCharacter(t, saved, players[i], a.Item, settled.LastBidOperationID, i == winner, gold, false)
		}
		oldSaved, err := repo.GetCharacter(old.Name, old.Name)
		if err != nil || oldSaved.Gold != 1234 || len(oldSaved.GoldCreditReceipts) != 1 {
			t.Fatal("competing buyouts duplicated/lost escrow refund")
		}
		stop()
	}
}
