package main

import (
	"errors"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestAuctionBuyoutSaveFailureKeepsDebitAndItemInOneJournal(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-buyer", Name: "buyer", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 1000, Health: 17, Mana: 0, State: "IDLE"}
	world.AddEntity(p)
	world.Trading.Auctions["purchase"] = &game.Auction{ID: "purchase", SellerID: "seller", Status: game.AuctionActive, Buyout: 500, Bid: 43, BidderID: "player-old", BidderName: "old", EndTime: time.Now().Add(time.Hour), Item: game.Item{ID: "purchased-item", Name: "Item", Stack: 1, MaxStack: 1}}
	op, err := world.Trading.PrepareAuctionBuyout("purchase", p)
	if err != nil || op == nil {
		t.Fatal("prepare failed", err)
	}
	characterSaveCommitter = &refundFaultCommitter{delegate: committer, afterFirst: func() { committer.fail = errors.New("purchase save rejected") }}
	if err := completePendingAuctionBidLocked(*op); err == nil {
		t.Fatal("uncommitted purchase finalized")
	}
	if p.Gold != 500 || committer.saved.Gold != 1000 || world.Trading.Auctions["purchase"].Status != game.AuctionActive || len(world.Trading.PendingBidOperations(p.ID)) != 1 {
		t.Fatal("failed purchase lost pending state")
	}
	pending, err := characterSaveJournal.Read(p.Name)
	if err != nil || pending == nil {
		t.Fatal("purchase not journaled")
	}
	saved, err := pending.Character()
	if err != nil || saved.Gold != 500 || saved.Inventory[0].ID != "purchased-item" || saved.GoldCreditReceipts["buyout:"+op.ID] != -500 || len(saved.ItemDeliveryReceipts) != 1 || saved.Resources.Mana != 0 {
		t.Fatal("journal separated debit/item/receipt/resources")
	}
	committer.fail = nil
	if err := completePendingAuctionBidLocked(*op); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Gold != 500 || len(committer.saved.Inventory) != 1 || world.Trading.Auctions["purchase"].Status != game.AuctionSold || len(world.Trading.PendingBidOperations(p.ID)) != 0 {
		t.Fatal("retry duplicated purchase or failed finalization")
	}
}
