package game

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func refundAuction() *Auction {
	return &Auction{ID: "refund-auction", SellerID: "seller", Status: AuctionActive,
		Bid: 43, BidderID: "player-old", BidderName: "old", Buyout: 200,
		EndTime: time.Now().Add(time.Hour), Item: Item{ID: "item", Stack: 1, MaxStack: 1}}
}

func TestTradingRefundOutboxRetainsFailedDeliveryAndSurvivesRoundTrip(t *testing.T) {
	ts := NewTradingSystem(nil)
	a := refundAuction()
	ts.Auctions[a.ID] = a
	bidder := &Entity{ID: "player-new", Name: "new", Gold: 100}
	if err := ts.BidAuction(a.ID, bidder, 50); err != nil {
		t.Fatal(err)
	}
	a = ts.Auctions[a.ID]
	if len(a.PendingRefunds) != 1 || a.PendingRefunds[0].Amount != 43 || a.BidderID != bidder.ID || bidder.Gold != 50 {
		t.Fatal("bid failed to preserve prior escrow intent")
	}
	if restored := ts.fromDBAuction(ts.toDBAuction(a)); !reflect.DeepEqual(restored.PendingRefunds, a.PendingRefunds) {
		t.Fatal("outbox lost in persistence")
	}
	gold := 0
	var receipts map[string]int
	lostAcknowledgement := true
	ts.SetRefundDelivery(func(refund database.AuctionRefund) error {
		if err := database.ApplyGoldCredit(&gold, &receipts, refund.ID, refund.Amount); err != nil {
			return err
		}
		if lostAcknowledgement {
			return errors.New("delivery reply lost")
		}
		return nil
	})
	if err := ts.RetryPendingRefunds(); err == nil || len(a.PendingRefunds) != 1 || gold != 43 {
		t.Fatal("failed delivery lost its durable intent")
	}
	lostAcknowledgement = false
	if err := ts.RetryPendingRefunds(); err != nil || len(a.PendingRefunds) != 0 || gold != 43 {
		t.Fatal("retry duplicated or lost refund")
	}
}

func TestTradingRefundOutboxSurvivesBuyoutCancellationAndFinalClaim(t *testing.T) {
	for _, route := range []string{"buyout", "cancel", "claim"} {
		t.Run(route, func(t *testing.T) {
			ts := NewTradingSystem(nil)
			a := refundAuction()
			ts.Auctions[a.ID] = a
			seller := &Entity{ID: "seller", Inventory: make([]Item, 2)}
			switch route {
			case "buyout":
				buyer := &Entity{ID: "player-buyer", Gold: 500, Inventory: make([]Item, 2)}
				if _, err := ts.BuyoutAuction(a.ID, buyer, nil); err != nil {
					t.Fatal(err)
				}
				if _, err := ts.CollectAuction(a.ID, seller); err != nil {
					t.Fatal(err)
				}
			case "cancel":
				if err := ts.CancelAuction(a.ID, seller, nil); err != nil {
					t.Fatal(err)
				}
				if _, err := ts.CollectAuction(a.ID, seller); err == nil {
					t.Fatal("cancelled item collected twice")
				}
			case "claim":
				ts.appendBidRefundLocked(a)
				a.Status = AuctionExpired
				if _, err := ts.CollectAuction(a.ID, seller); err != nil {
					t.Fatal(err)
				}
			}
			if ts.Auctions[a.ID] == nil || len(a.PendingRefunds) != 1 {
				t.Fatal("collection deleted unpaid refund")
			}
			ts.RemoveAuction(a.ID)
			if ts.Auctions[a.ID] == nil {
				t.Fatal("removal lost refund")
			}
			ts.SetRefundDelivery(func(refund database.AuctionRefund) error {
				if refund.PlayerID != "player-old" || refund.Amount != 43 {
					t.Fatal("wrong prior bidder refund")
				}
				return nil
			})
			if err := ts.RetryPendingRefunds(); err != nil || ts.Auctions[a.ID] != nil {
				t.Fatal("fully delivered auction not finalized")
			}
		})
	}
}

func TestDurablePlayerCreditPinsAgainstExpiryAndDetachesReceipts(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-credit", Type: TypePlayer, Gold: 100}
	w.AddEntity(player)
	w.SetEntityDisconnected(player.ID, time.Now().Add(-10*time.Minute))
	if found, err := w.ApplyDurablePlayerGoldCredit(player.ID, "refund", 43); !found || err != nil {
		t.Fatal("live refund failed")
	}
	if len(w.CollectExpiredDisconnectedPlayers(time.Minute)) != 0 {
		t.Fatal("unjournaled refund expired")
	}
	snapshot := w.GetEntityCopy(player.ID)
	if snapshot.Gold != 143 || snapshot.GoldCreditReceipts["refund"] != 43 {
		t.Fatal("snapshot lost receipt or gold")
	}
	snapshot.GoldCreditReceipts["refund"] = 99
	if player.GoldCreditReceipts["refund"] != 43 {
		t.Fatal("snapshot aliases live receipt map")
	}
	w.SetEntityUnjournaledSave(player.ID, false)
	if len(w.CollectExpiredDisconnectedPlayers(time.Minute)) != 1 {
		t.Fatal("durable player cannot expire")
	}
	if found, err := w.ApplyDurablePlayerGoldCredit(player.ID, "other", 43); found || err != nil {
		t.Fatal("mutated expired detached player")
	}
}
