package main

import (
	"errors"
	"os"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestAuctionRefundOrdersPendingSaveAndPersistsReceiptWithResources(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-refund", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		Health: 0, Mana: 0, State: "DEAD", Gold: 100}
	world.AddEntity(entity)
	world.SetEntityDisconnected(entity.ID, time.Now().Add(-10*time.Minute))
	refund := database.AuctionRefund{ID: "refund-once", PlayerID: entity.ID, CharacterName: "refund", Amount: 43}
	committer.fail = errors.New("Mongo unavailable")
	if err := deliverAuctionRefund(refund); err == nil || entity.Gold != 100 {
		t.Fatal("credit bypassed earlier pending save failure")
	}
	committer.fail = nil
	for i := 0; i < 3; i++ {
		if err := deliverAuctionRefund(refund); err != nil {
			t.Fatal(err)
		}
	}
	if committer.saved.Gold != 143 || committer.saved.GoldCreditReceipts[refund.ID] != 43 ||
		committer.saved.Resources.Health != 0 || committer.saved.Resources.Mana != 0 || !committer.saved.Resources.Dead {
		t.Fatal("refund duplicated or overwrote dead depleted resources")
	}
	if len(world.CollectExpiredDisconnectedPlayers(time.Minute)) != 1 {
		t.Fatal("durably saved refund left player pinned")
	}
}

type refundFaultCommitter struct {
	delegate   *testCharacterCommitter
	afterFirst func()
}

func (committer *refundFaultCommitter) CommitCharacterSave(user string, character *database.Character, id string) error {
	err := committer.delegate.CommitCharacterSave(user, character, id)
	if committer.afterFirst != nil {
		after := committer.afterFirst
		committer.afterFirst = nil
		after()
	}
	return err
}

func TestAuctionRefundFilesystemFailurePinsCreditedEntityUntilRetry(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-refund", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		Health: 17, Mana: 0, State: "IDLE", Gold: 100}
	world.AddEntity(entity)
	world.SetEntityDisconnected(entity.ID, time.Now().Add(-10*time.Minute))
	characterSaveCommitter = &refundFaultCommitter{delegate: committer, afterFirst: func() {
		if err := os.Rename(dir, dir+"-held"); err != nil {
			t.Fatal(err)
		}
	}}
	refund := database.AuctionRefund{ID: "refund-disk", PlayerID: entity.ID, CharacterName: "refund", Amount: 43}
	if err := deliverAuctionRefund(refund); err == nil {
		t.Fatal("lost journal path was accepted")
	}
	if entity.Gold != 143 || committer.saved.Gold != 100 || len(world.CollectExpiredDisconnectedPlayers(time.Minute)) != 0 {
		t.Fatal("failed local journal lost or expired the only credited snapshot")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	if err := deliverAuctionRefund(refund); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Gold != 143 || committer.saved.GoldCreditReceipts[refund.ID] != 43 || committer.saved.Resources.Mana != 0 {
		t.Fatal("retry duplicated refund or lost resources")
	}
	if len(world.CollectExpiredDisconnectedPlayers(time.Minute)) != 1 {
		t.Fatal("successful retry did not unpin expiry")
	}
}
