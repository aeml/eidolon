package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestAuctionItemSaveFailureRetainsReceiptBeforeFinalClaim(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-buyer", Name: "buyer", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 1234, Health: 17, Mana: 0, State: "IDLE"}
	world.AddEntity(p)
	world.Trading.Auctions["claim"] = &game.Auction{ID: "claim", SellerID: "seller", BuyerID: p.ID, Status: game.AuctionSold, EndTime: time.Now(), Item: game.Item{ID: "claimed-item", Name: "Item", Stack: 1, MaxStack: 1}}
	op, err := world.Trading.PrepareAuctionItemClaim("claim", p)
	if err != nil || op == nil {
		t.Fatal("could not prepare claim", err)
	}
	characterSaveCommitter = &refundFaultCommitter{delegate: committer, afterFirst: func() { committer.fail = errors.New("item save rejected") }}
	if err := completePendingAuctionBidLocked(*op); err == nil {
		t.Fatal("failed item save finalized claim")
	}
	if world.Trading.Auctions["claim"].ItemClaimed || len(world.Trading.PendingBidOperations(p.ID)) != 1 || p.Inventory[0].ID != "claimed-item" {
		t.Fatal("unconfirmed delivery lost reservation or finalized claim")
	}
	pending, err := characterSaveJournal.Read(p.Name)
	if err != nil || pending == nil {
		t.Fatal("item and receipt not journaled")
	}
	saved, err := pending.Character()
	if err != nil || saved.Inventory[0].ID != "claimed-item" || len(saved.ItemDeliveryReceipts) != 1 || saved.Resources.Mana != 0 || saved.Gold != 1234 {
		t.Fatal("journal lost item/receipt/resources")
	}
	committer.fail = nil
	if err := completePendingAuctionBidLocked(*op); err != nil {
		t.Fatal(err)
	}
	if !world.Trading.Auctions["claim"].ItemClaimed || len(world.Trading.PendingBidOperations(p.ID)) != 0 || len(committer.saved.ItemDeliveryReceipts) != 1 {
		t.Fatal("retry failed to complete once")
	}
	copies := 0
	for _, item := range committer.saved.Inventory {
		if item.ID == "claimed-item" {
			copies++
		}
	}
	if copies != 1 {
		t.Fatal("recovery duplicated item")
	}
	value, err := json.Marshal(world.GetEntityCopy(p.ID))
	if err != nil || bytes.Contains(value, []byte(op.ID)) {
		t.Fatal("private delivery receipt leaked into network snapshot")
	}
}

func TestAuctionItemCapacityChangeAbortsOnlyUnappliedDelivery(t *testing.T) {
	setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-buyer", Name: "buyer", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 1234, Health: 17, Mana: 0, State: "IDLE"}
	world.AddEntity(p)
	world.Trading.Auctions["claim"] = &game.Auction{ID: "claim", SellerID: "seller", BuyerID: p.ID, Status: game.AuctionSold, EndTime: time.Now(), Item: game.Item{ID: "claimed-item", Stack: 1, MaxStack: 1}}
	op, err := world.Trading.PrepareAuctionItemClaim("claim", p)
	if err != nil || op == nil {
		t.Fatal("could not prepare claim", err)
	}
	p.Inventory, p.Stash = make([]game.Item, game.MaxInventorySize), make([]game.Item, game.MaxStashSize)
	for _, items := range [][]game.Item{p.Inventory, p.Stash} {
		for i := range items {
			items[i] = game.Item{ID: "occupied", Stack: 1, MaxStack: 1}
		}
	}
	if err := completePendingAuctionBidLocked(*op); !errors.Is(err, game.ErrAuctionStorageFull) {
		t.Fatal("full storage did not reject unapplied delivery", err)
	}
	if len(p.ItemDeliveryReceipts) != 0 || len(world.Trading.PendingBidOperations(p.ID)) != 0 || world.Trading.Auctions["claim"].ItemClaimed || p.Gold != 1234 {
		t.Fatal("capacity failure lost claim or changed character")
	}
	p.Inventory[0] = game.Item{}
	op, err = world.Trading.PrepareAuctionItemClaim("claim", p)
	if err != nil || op == nil {
		t.Fatal("released claim cannot be retried after freeing space")
	}
	if err := completePendingAuctionBidLocked(*op); err != nil {
		t.Fatal(err)
	}
	if p.Inventory[0].ID != "claimed-item" || len(p.ItemDeliveryReceipts) != 1 {
		t.Fatal("retry did not deliver exactly once")
	}
}

func TestOfflineAuctionItemConversionDoesNotRescaleExistingGear(t *testing.T) {
	item := database.Item{ID: "legacy-earned", Name: "Legacy", Stack: 1, MaxStack: 1, Stats: map[string]int{"intelligence": 100}, StatScaleVersion: 0}
	if got := databaseItem(gameItemFromDatabaseExact(item)); !reflect.DeepEqual(got, item) {
		t.Fatal("offline delivery rewrote unrelated legacy gear")
	}
}
