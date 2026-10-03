package main

import (
	"errors"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestGroundItemReceiptAndCompleteDebitSurviveRealJournalReopen(t *testing.T) {
	c, committer, dir := vendorPersistenceFixture(t)
	p := world.GetEntityCopy(c.playerID)
	op, err := world.PrepareDurableInventoryDrop(c.playerID, 0, p.Inventory[0].ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if changed, err := world.ApplyDurableGroundItem(op); err != nil || !changed {
		t.Fatal(err)
	}
	committer.fail = errors.New("modeled database outage")
	unlock := lockCharacterWork(c.username)
	err = persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, world.GetEntityCopy(c.playerID)))
	unlock()
	if err == nil || world.Entities[op.LootID] != nil {
		t.Fatal("unconfirmed intent published its world item")
	}
	if err := world.CompleteGroundItemProjection(op, committer.saved, time.Now()); err == nil {
		t.Fatal("missing saved-character proof authorized publication")
	}
	// Only the character post-image is proven recoverable here. The frozen op
	// is test-owned; a real shared store/startup coordinator is still required.
	world = nil
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	committer.fail = nil
	failedCharacterSaves.users = map[string]bool{}
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if len(committer.saved.Inventory) != 0 || !database.GroundItemCharacterReceiptMatches(committer.saved, op) || committer.saved.Gold != p.Gold {
		t.Fatal("journal replay lost the exact item debit/receipt or changed Gold")
	}
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	if err := world.CompleteGroundItemProjection(op, committer.saved, time.Now().UTC().Truncate(time.Millisecond)); err != nil {
		t.Fatal(err)
	}
	loot := world.GetEntityCopy(op.LootID)
	if loot == nil || loot.LootItem.ID != "earned" || loot.LootItem.Potency != 4 || loot.LootItem.Stats["strength"] != 9 {
		t.Fatal("confirmed recovered projection lost earned metadata")
	}
}
