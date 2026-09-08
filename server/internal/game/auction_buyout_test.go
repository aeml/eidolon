package game

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestAuctionPurchaseIsAtomicAndReplaysBeforeBalanceAndCapacity(t *testing.T) {
	item := Item{ID: "purchase", Name: "Purchased", Stack: 1, MaxStack: 1, Potency: 4, Stats: map[string]int{"wisdom": 9}}
	payload := auctionDeliveryPayload(t, item)
	p := &Entity{Gold: 499}
	if err := p.ApplyAuctionPurchase("op", payload, 500); !errors.Is(err, database.ErrInsufficientGold) {
		t.Fatal("insufficient balance accepted", err)
	}
	if p.Gold != 499 || len(p.Inventory) != 0 || len(p.ItemDeliveryReceipts) != 0 || len(p.GoldCreditReceipts) != 0 {
		t.Fatal("unfunded purchase changed character")
	}
	p.Gold, p.Inventory, p.Stash = 1000, filledAuctionStorage(MaxInventorySize), filledAuctionStorage(MaxStashSize)
	if err := p.ApplyAuctionPurchase("op", payload, 500); !errors.Is(err, ErrAuctionStorageFull) {
		t.Fatal("full storage accepted", err)
	}
	if p.Gold != 1000 || len(p.ItemDeliveryReceipts) != 0 || len(p.GoldCreditReceipts) != 0 {
		t.Fatal("capacity failure charged buyer")
	}
	p.Stash = nil
	if err := p.ApplyAuctionPurchase("op", payload, 500); err != nil {
		t.Fatal(err)
	}
	if p.Gold != 500 || len(p.Stash) != 1 || !reflect.DeepEqual(p.Stash[0], item) || p.GoldCreditReceipts["buyout:op"] != -500 || len(p.ItemDeliveryReceipts) != 1 {
		t.Fatal("purchase lost debit, exact item or receipt pair")
	}
	p.Gold, p.Stash = 0, filledAuctionStorage(MaxStashSize)
	if err := p.ApplyAuctionPurchase("op", payload, 500); err != nil {
		t.Fatal("replay checked current capacity/balance", err)
	}
	if p.Gold != 0 || p.Stash[0].ID != "occupied" {
		t.Fatal("replay charged or delivered twice")
	}
	if err := p.ApplyAuctionPurchase("op", payload, 499); err == nil {
		t.Fatal("reused operation changed price")
	}
	item.Potency++
	if err := p.ApplyAuctionPurchase("op", auctionDeliveryPayload(t, item), 500); err == nil {
		t.Fatal("reused operation changed item")
	}
	delete(p.ItemDeliveryReceipts, "op")
	if err := p.ApplyAuctionPurchase("op", payload, 500); err == nil {
		t.Fatal("partial receipt pair accepted")
	}
}

func TestAuctionBuyoutReservationFinalizesSaleAndOnePreviousBidRefund(t *testing.T) {
	ts := NewTradingSystem(nil)
	p := &Entity{ID: "player-buyer", Name: "buyer", Gold: 1000}
	a := &Auction{ID: "buyout", SellerID: "player-seller", Status: AuctionActive, Buyout: 500, Bid: 43, BidderID: "player-old", BidderName: "old", EndTime: time.Now().Add(time.Hour), Item: Item{ID: "item", Name: "Item", Stack: 1, MaxStack: 1}}
	ts.Auctions[a.ID] = a
	op, err := ts.PrepareAuctionBuyout(a.ID, p)
	if err != nil || op == nil || !op.Valid() || p.Gold != 1000 || a.Status != AuctionActive || a.ItemClaimed || len(p.Inventory) != 0 {
		t.Fatal("preparation changed character/sale", err)
	}
	if _, err := ts.PrepareAuctionBuyout(a.ID, &Entity{ID: "player-other", Name: "other", Gold: 1000}); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("competitor bypassed reservation")
	}
	if _, err := ts.BuyoutAuction(a.ID, p, nil); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("legacy buyout bypassed reservation")
	}
	if err := p.ApplyAuctionPurchase(op.ID, op.ItemPayload, op.Amount); err != nil {
		t.Fatal(err)
	}
	if err := ts.CompleteAuctionBid(*op); err != nil {
		t.Fatal(err)
	}
	settled := ts.Auctions[a.ID]
	if settled.Status != AuctionSold || settled.BuyerID != p.ID || settled.SalePrice != 500 || !settled.ItemClaimed || settled.SellerClaimed || len(settled.PendingRefunds) != 1 || settled.PendingRefunds[0].Amount != 43 || settled.PendingRefunds[0].ID != op.RefundID || p.Gold != 500 || p.Inventory[0].ID != "item" {
		t.Fatal("final sale/escrow/receipt mismatch")
	}
	if _, err := ts.PrepareAuctionBuyout(a.ID, p); err == nil {
		t.Fatal("sold auction bought twice")
	}
	if _, err := ts.CollectAuction(a.ID, p); err == nil {
		t.Fatal("buyout item collected twice")
	}
}

func TestAuctionBuyoutRejectsDisabledPriceAndOwnAuction(t *testing.T) {
	ts := NewTradingSystem(nil)
	p := &Entity{ID: "player-buyer", Name: "buyer", Gold: 1000}
	a := &Auction{ID: "disabled", SellerID: "seller", Status: AuctionActive, EndTime: time.Now().Add(time.Hour), Item: Item{ID: "item", Stack: 1, MaxStack: 1}}
	ts.Auctions[a.ID] = a
	if _, err := ts.PrepareAuctionBuyout(a.ID, p); err == nil {
		t.Fatal("disabled price became free buyout")
	}
	if _, err := ts.BuyoutAuction(a.ID, p, nil); err == nil {
		t.Fatal("legacy disabled price became free buyout")
	}
	a.Buyout, a.SellerID = 500, p.ID
	if _, err := ts.PrepareAuctionBuyout(a.ID, p); err == nil {
		t.Fatal("seller bought own item")
	}
	if len(ts.PendingBidOperations("")) != 0 || p.Gold != 1000 {
		t.Fatal("rejection retained reservation or charged buyer")
	}
}
