package game

import (
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func completedGroundRecord(op database.GroundItemOperation, available time.Time) database.GroundItemRecord {
	return database.GroundItemRecord{GroundItemOperation: op, State: database.GroundItemComplete,
		AvailableAt: available, ExpiresAt: available.Add(time.Minute)}
}

func TestGroundItemRestoreLatestPartialAndNewerReservation(t *testing.T) {
	w, source, recipient, _ := groundItemFixture(t)
	item := Item{ID: "source-stack", Name: "Same fragments", Stack: 5, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
	source.Inventory = []Item{item}
	for index := range recipient.Inventory {
		recipient.Inventory[index] = Item{ID: fmt.Sprintf("occupied-%d", index), Stack: 1}
	}
	recipient.Inventory[0] = item
	recipient.Inventory[0].ID, recipient.Inventory[0].Stack = "existing-stack", 8
	drop, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, 5)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.ApplyDurableGroundItem(drop); err != nil {
		t.Fatal(err)
	}
	available := time.Now().UTC().Truncate(time.Millisecond)
	dropRecord := completedGroundRecord(drop, available)
	if err := w.RestoreGroundItemProjection(dropRecord, nil); err == nil || w.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("unconfirmed drop was restored")
	}
	if err := w.RestoreGroundItemProjection(dropRecord, groundSavedReceipt(source)); err != nil {
		t.Fatal(err)
	}
	pickup, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	pending := database.GroundItemRecord{GroundItemOperation: pickup, State: database.GroundItemPending,
		AvailableAt: available, ExpiresAt: dropRecord.ExpiresAt}
	if err := w.RestoreGroundItemProjection(pending, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := w.ApplyDurableGroundItem(pickup); err != nil {
		t.Fatal(err)
	}
	complete := pending
	complete.State = database.GroundItemComplete
	if err := w.RestoreGroundItemProjection(complete, groundSavedReceipt(recipient)); err != nil {
		t.Fatal(err)
	}
	loot := w.GetEntityCopy(drop.LootID)
	if loot == nil || loot.LootItem.Stack != 3 || loot.GroundItemGeneration != 1 || !loot.LootTime.Equal(available) {
		t.Fatal("partial restoration refilled quantity or renewed expiry", loot)
	}
	fresh := newTestWorld()
	t.Cleanup(fresh.StopBackground)
	if err := fresh.RestoreGroundItemProjection(complete, groundSavedReceipt(recipient)); err != nil {
		t.Fatal("cold restoration lost remaining custody", err)
	}
	restored := fresh.GetEntityCopy(drop.LootID)
	if restored == nil || restored.LootItem.Stack != 3 || restored.GroundItemGeneration != 1 || !restored.LootTime.Equal(available) {
		t.Fatal("cold restoration refilled original quantity or reset expiry")
	}
	if err := w.RestoreGroundItemProjection(dropRecord, groundSavedReceipt(source)); err == nil || w.GetEntityCopy(drop.LootID).LootItem.Stack != 3 {
		t.Fatal("older drop refilled a newer partial generation")
	}
	recipient.Inventory[1] = Item{}
	newer, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.RestoreGroundItemProjection(complete, groundSavedReceipt(recipient)); err == nil || w.GetEntityCopy(drop.LootID).GroundItemReservation != newer.ID {
		t.Fatal("old completion cleared a new live reservation")
	}
	if err := w.ReleaseRejectedGroundItemReservation(pickup); err == nil {
		t.Fatal("old prepare released another generation's claim")
	}
	if err := w.ReleaseRejectedGroundItemReservation(newer); err != nil || w.GetEntityCopy(drop.LootID).GroundItemReservation != "" {
		t.Fatal("definitively rejected exact claim could not be released", err)
	}
}

func TestGroundItemRestoreAcceptedExpiredPickupThenNeverResurrects(t *testing.T) {
	w, source, recipient, item := groundItemFixture(t)
	drop, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.ApplyDurableGroundItem(drop); err != nil {
		t.Fatal(err)
	}
	available := time.Now().UTC().Truncate(time.Millisecond)
	if err := w.RestoreGroundItemProjection(completedGroundRecord(drop, available), groundSavedReceipt(source)); err != nil {
		t.Fatal(err)
	}
	pickup, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	// Reopen an already accepted pending claim after its original minute.
	pickup.LootTime = available.Add(-2 * time.Minute)
	pickup.LootCreatedAt, pickup.CreatedAt = pickup.LootTime, pickup.LootTime.Add(time.Second)
	pickup.Fingerprint, _ = database.GroundItemFingerprint(pickup)
	record := database.GroundItemRecord{GroundItemOperation: pickup, State: database.GroundItemPending,
		AvailableAt: pickup.LootTime, ExpiresAt: pickup.LootTime.Add(time.Minute)}
	fresh := newTestWorld()
	t.Cleanup(fresh.StopBackground)
	fresh.AddEntity(recipient)
	if err := fresh.RestoreGroundItemProjection(record, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := fresh.PrepareDurableGroundPickup(source.ID, drop.LootID); err == nil {
		t.Fatal("expired accepted custody became a fresh claim")
	}
	if changed, err := fresh.ApplyDurableGroundItem(pickup); err != nil || !changed {
		t.Fatal("expired accepted claim could not finish its character effect", err)
	}
	record.State = database.GroundItemComplete
	if err := fresh.RestoreGroundItemProjection(record, groundSavedReceipt(recipient)); err != nil || fresh.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("consumed expired loot was left free", err)
	}
	if changed, err := recipient.ApplyGroundItemCharacterEffect(pickup); err != nil || changed {
		t.Fatal("offline receipt replay granted again", err)
	}
}

func TestGroundItemEffectStorageCollisionsAndCompatibleStackFragments(t *testing.T) {
	for _, storage := range []string{"stash", "buyback", "equipment"} {
		for _, stackable := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s-stackable-%t", storage, stackable), func(t *testing.T) {
				w, source, recipient, item := groundItemFixture(t)
				if stackable {
					item.Stack, item.MaxStack = 3, 10
					source.Inventory[0] = item
				}
				drop, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, item.Stack)
				if err != nil {
					t.Fatal(err)
				}
				if _, err := w.ApplyDurableGroundItem(drop); err != nil {
					t.Fatal(err)
				}
				if err := w.RestoreGroundItemProjection(completedGroundRecord(drop, time.Now().UTC().Truncate(time.Millisecond)), groundSavedReceipt(source)); err != nil {
					t.Fatal(err)
				}
				pickup, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
				if err != nil {
					t.Fatal(err)
				}
				switch storage {
				case "stash":
					recipient.Stash = []Item{cloneItem(item)}
				case "buyback":
					recipient.Buyback = []Item{cloneItem(item)}
				case "equipment":
					recipient.Equipment = map[string]Item{"mainHand": cloneItem(item)}
				}
				before := cloneItems(recipient.Inventory)
				changed, err := recipient.ApplyGroundItemCharacterEffect(pickup)
				if !stackable {
					if !errors.Is(err, ErrGroundItemIdentity) || changed || !reflect.DeepEqual(before, recipient.Inventory) || len(recipient.ItemDeliveryReceipts) != 0 {
						t.Fatal("unique gear was renamed/duplicated or a rejected effect partially applied", err)
					}
				} else if err != nil || !changed || recipient.Inventory[0].ID == item.ID || recipient.Inventory[0].Stack != item.Stack || recipient.Inventory[0].Stats["strength"] != item.Stats["strength"] {
					t.Fatal("compatible fragment lost metadata or reused an owned storage identity", err)
				}
			})
		}
	}
}

func TestGroundItemDropFreezesPhysicallyGroundedCoordinates(t *testing.T) {
	w, source, _, item := groundItemFixture(t)
	w.rockSolids = rockSolidsForTest(t)
	source.InstanceID = ""
	source.X, source.Z = -102, -321
	// A known point inside the fixture; a drop from a displacement/jump
	// must freeze the recovered physical position, not the actor's raw position.
	if !insideRockSolids(w.rockSolids, rockPoint{source.X, source.Z}, .5) {
		t.Fatal("fixture must begin inside a rock")
	}
	op, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, 1)
	if err != nil || insideRockSolids(w.rockSolids, rockPoint{op.X, op.Z}, .5) {
		t.Fatal("drop froze unrecoverable rock coordinates", err)
	}
	if _, err := w.ApplyDurableGroundItem(op); err != nil {
		t.Fatal(err)
	}
	if err := w.RestoreGroundItemProjection(completedGroundRecord(op, time.Now().UTC().Truncate(time.Millisecond)), groundSavedReceipt(source)); err != nil {
		t.Fatal(err)
	}
	loot := w.GetEntityCopy(op.LootID)
	if loot == nil || loot.X != op.X || loot.Z != op.Z {
		t.Fatal("publication changed frozen ledger coordinates", loot)
	}
}
