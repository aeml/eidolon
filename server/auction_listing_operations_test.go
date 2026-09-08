package main

import (
	"errors"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type listingFaultCommitter struct {
	delegate *testCharacterCommitter
	calls    int
}

func (c *listingFaultCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	err := c.delegate.CommitCharacterSave(username, character, id)
	c.calls++
	if c.calls == 2 {
		c.delegate.fail = errors.New("listing escrow save rejected")
	}
	return err
}

func TestAuctionListingSaveFailureRetainsEscrowAndUnpublishedDecision(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-seller", Name: "seller", Type: game.TypePlayer, SubType: "Wizard", Level: 30, Gold: 1234, Health: 17, Mana: 0, State: "IDLE", Inventory: make([]game.Item, game.MaxInventorySize)}
	p.Inventory[8] = game.Item{ID: "earned-item", Name: "Earned", Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion}
	world.AddEntity(p)
	op, err := world.Trading.PrepareAuctionListing(p, 8, 100, 500, 24)
	if err != nil || op == nil {
		t.Fatal("prepare failed", err)
	}
	characterSaveCommitter = &listingFaultCommitter{delegate: committer}
	if err := completePendingAuctionBidLocked(*op); err == nil {
		t.Fatal("uncommitted escrow published listing")
	}
	if p.Gold != 1209 || p.Inventory[8].ID != "" || committer.saved.Gold != 1234 || committer.saved.Inventory[0].ID != "earned-item" || len(world.Trading.Auctions) != 0 || len(world.Trading.PendingBidOperations(p.ID)) != 1 {
		t.Fatal("failed escrow lost owner/listing state")
	}
	pending, err := characterSaveJournal.Read(p.Name)
	if err != nil || pending == nil {
		t.Fatal("escrow journal missing")
	}
	saved, err := pending.Character()
	if err != nil || saved.Gold != 1209 || len(saved.Inventory) != 0 || saved.GoldCreditReceipts["listing:"+op.ID] != -25 || len(saved.ItemDeliveryReceipts) != 1 || saved.Resources.Mana != 0 {
		t.Fatal("journal separated deposit/item/resources")
	}
	committer.fail = nil
	if err := completePendingAuctionBidLocked(*op); err != nil {
		t.Fatal(err)
	}
	if len(world.Trading.Auctions) != 1 || committer.saved.Gold != 1209 || len(committer.saved.Inventory) != 0 || len(world.Trading.PendingBidOperations(p.ID)) != 0 {
		t.Fatal("retry duplicated escrow or lost listing")
	}
}
