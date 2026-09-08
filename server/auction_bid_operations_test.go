package main

import (
	"errors"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestAuctionBidFailureRetainsDecisionAndJournaledDebitForRetry(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-bidder", Name: "bidder", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 100, Health: 17, Mana: 0, State: "IDLE"}
	world.AddEntity(player)
	world.Trading.Auctions["auction"] = &game.Auction{ID: "auction", SellerID: "seller", Status: game.AuctionActive, Bid: 43, BidderID: "player-old", BidderName: "old", EndTime: time.Now().Add(time.Hour)}
	op, err := world.Trading.PrepareAuctionBid("auction", player, 50)
	if err != nil {
		t.Fatal(err)
	}
	characterSaveCommitter = &refundFaultCommitter{delegate: committer, afterFirst: func() { committer.fail = errors.New("debit write rejected") }}
	if err := completePendingAuctionBidLocked(op); err == nil {
		t.Fatal("failed debit write finalized bid")
	}
	if player.Gold != 50 || committer.saved.Gold != 100 || world.Trading.Auctions["auction"].Bid != 43 || len(world.Trading.PendingBidOperations(player.ID)) != 1 {
		t.Fatal("failed debit discarded decision or changed auction")
	}
	pending, err := characterSaveJournal.Read("bidder")
	if err != nil || pending == nil {
		t.Fatal("failed debit lost durable journal")
	}
	saved, err := pending.Character()
	if err != nil || saved.Gold != 50 || saved.GoldCreditReceipts["bid:"+op.ID] != -50 || saved.Resources.Mana != 0 {
		t.Fatal("journal lost atomic debit/receipt/resources")
	}
	committer.fail = nil
	if err := completePendingAuctionBidLocked(op); err != nil {
		t.Fatal(err)
	}
	if player.Gold != 50 || committer.saved.Gold != 50 || world.Trading.Auctions["auction"].Bid != 50 || len(world.Trading.PendingBidOperations(player.ID)) != 0 {
		t.Fatal("recovery duplicated debit or failed to finalize")
	}
}

func TestAuctionSellerPayoutFailureRetainsDecisionAndJournaledCreditForRetry(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-seller", Name: "seller", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 100, Health: 17, Mana: 0, State: "IDLE"}
	world.AddEntity(player)
	world.Trading.Auctions["payout"] = &game.Auction{ID: "payout", SellerID: player.ID,
		Status: game.AuctionSold, SalePrice: 100, Bid: 43, Deposit: 5, EndTime: time.Now().Add(time.Hour)}
	op, err := world.Trading.PrepareAuctionSellerPayout("payout", player)
	if err != nil || op == nil {
		t.Fatal("seller payout preparation failed")
	}
	characterSaveCommitter = &refundFaultCommitter{delegate: committer, afterFirst: func() { committer.fail = errors.New("credit write rejected") }}
	if err := completePendingAuctionBidLocked(*op); err == nil {
		t.Fatal("failed credit write finalized seller claim")
	}
	if player.Gold != 200 || committer.saved.Gold != 100 || world.Trading.Auctions["payout"].SellerClaimed || len(world.Trading.PendingBidOperations(player.ID)) != 1 {
		t.Fatal("failed credit discarded decision or changed seller claim")
	}
	pending, err := characterSaveJournal.Read("seller")
	if err != nil || pending == nil {
		t.Fatal("failed payout lost durable journal")
	}
	saved, err := pending.Character()
	if err != nil || saved.Gold != 200 || saved.GoldCreditReceipts["seller-payout:"+op.ID] != 100 || saved.Resources.Mana != 0 {
		t.Fatal("journal lost atomic credit/receipt/resources")
	}
	committer.fail = nil
	if err := completePendingAuctionBidLocked(*op); err != nil {
		t.Fatal(err)
	}
	if player.Gold != 200 || committer.saved.Gold != 200 || !world.Trading.Auctions["payout"].SellerClaimed || len(world.Trading.PendingBidOperations(player.ID)) != 0 {
		t.Fatal("recovery duplicated payout or failed to finalize")
	}
}
