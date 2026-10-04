package game

import (
	"encoding/json"
	"maps"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
)

// Bounded custody primitive exercise, not simulated campaign or Mongo IO.
func TestGroundItemCheckpointHistoryStaysConstantAndConsumedReplayIsHarmless(t *testing.T) {
	w, a, b, item := groundItemFixture(t)
	legacy := map[string]string{"retained-legacy-domain": "retained-legacy-fingerprint"}
	a.ItemDeliveryReceipts, b.ItemDeliveryReceipts = maps.Clone(legacy), maps.Clone(legacy)
	var firstDrop, firstPickup database.GroundItemOperation
	var initialSize int
	for index := 0; index < 500; index++ {
		source, recipient := a, b
		if index%2 == 1 {
			source, recipient = b, a
		}
		drop, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, 1)
		if err != nil {
			t.Fatal(index, err)
		}
		if drop.Version != 2 || drop.AccountOrdinal != source.GroundAccountOrdinal+1 {
			t.Fatal("new plan did not extend checkpoint")
		}
		if changed, err := w.ApplyDurableGroundItem(drop); err != nil || !changed {
			t.Fatal(index, changed, err)
		}
		if err := w.CompleteGroundItemProjection(drop, groundSavedReceipt(source), time.Now().UTC().Truncate(time.Millisecond)); err != nil {
			t.Fatal(err)
		}
		pickup, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
		if err != nil {
			t.Fatal(index, err)
		}
		if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || !changed {
			t.Fatal(index, changed, err)
		}
		if err := w.CompleteGroundItemProjection(pickup, groundSavedReceipt(recipient), time.Now()); err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			firstDrop, firstPickup = drop, pickup
		}
		if !maps.Equal(a.ItemDeliveryReceipts, legacy) || !maps.Equal(b.ItemDeliveryReceipts, legacy) {
			t.Fatal("new transfer grew or removed historical receipts")
		}
		encoded, err := bson.Marshal(groundSavedReceipt(a))
		if err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			initialSize = len(encoded)
		}
		if len(encoded) != initialSize {
			t.Fatalf("private proof grew: %d -> %d", initialSize, len(encoded))
		}
	}
	if a.GroundAccountOrdinal != 500 || b.GroundAccountOrdinal != 500 || !reflect.DeepEqual(a.Inventory[0], item) {
		t.Fatal("ordered round trips changed custody or metadata")
	}
	a.Inventory[0] = Item{} // Legitimate consumption after all saved transfers.
	for _, op := range []database.GroundItemOperation{firstDrop, firstPickup} {
		if changed, err := w.ApplyDurableGroundItem(op); err != nil || changed {
			t.Fatal("historical canonical replay reapplied custody", changed, err)
		}
	}
	if a.Inventory[0].ID != "" || b.Inventory[0].ID != "" {
		t.Fatal("replay recreated consumed equipment")
	}
	copy := w.GetEntityCopy(a.ID)
	if copy.GroundAccountOrdinal != a.GroundAccountOrdinal || copy.GroundAccountOperationID != a.GroundAccountOperationID || copy.GroundAccountFingerprint != a.GroundAccountFingerprint {
		t.Fatal("entity copy lost private recovery proof")
	}
	public, err := json.Marshal(copy)
	if err != nil || strings.Contains(string(public), a.GroundAccountOperationID) || strings.Contains(string(public), a.GroundAccountFingerprint) || strings.Contains(string(public), "GroundAccount") {
		t.Fatal("public JSON exposed checkpoint", err)
	}
	t.Logf("1000 custody effects, 500 ordered checkpoints per character; BSON saved-proof fixture stays %d bytes; legacy entries unchanged", initialSize)
}

func TestGroundItemCheckpointRejectsGapMalformedHeadAndConflictingIdentity(t *testing.T) {
	for _, mode := range []string{"gap", "malformed-head", "legacy-conflict", "current-id-conflict"} {
		t.Run(mode, func(t *testing.T) {
			w, a, _, item := groundItemFixture(t)
			op, err := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1)
			if err != nil {
				t.Fatal(err)
			}
			switch mode {
			case "gap":
				op.AccountOrdinal = 2
				op.Fingerprint, _ = database.GroundItemFingerprint(op)
			case "malformed-head":
				a.GroundAccountOrdinal = 4
			case "legacy-conflict":
				a.ItemDeliveryReceipts = map[string]string{op.ID: "conflicting-legacy-proof"}
			case "current-id-conflict":
				a.GroundAccountOrdinal = 1
				a.GroundAccountOperationID = database.GroundItemOperationID("different-record")
				a.GroundAccountFingerprint = op.Fingerprint
			}
			before := cloneItems(a.Inventory)
			if changed, err := a.ApplyGroundItemCharacterEffect(op); err == nil || changed || !reflect.DeepEqual(before, a.Inventory) {
				t.Fatal("invalid checkpoint changed custody", changed, err)
			}
		})
	}
}

func TestGroundItemCheckpointLegacyEffectStillWritesItsExactReceipt(t *testing.T) {
	w, a, _, item := groundItemFixture(t)
	op, err := w.PrepareDurableInventoryDrop(a.ID, 0, item.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	// A retained pre-upgrade intent is recovered in its original V1 format,
	// never rehashed or converted into a new ordinal decision.
	op.Version, op.AccountOrdinal = 1, 0
	op.Fingerprint, _ = database.GroundItemFingerprint(op)
	if changed, err := w.ApplyDurableGroundItem(op); err != nil || !changed || a.GroundAccountOrdinal != 0 || a.ItemDeliveryReceipts[op.ID] != op.Fingerprint {
		t.Fatal("legacy effect no longer saves its original receipt", changed, err)
	}
	if changed, err := w.ApplyDurableGroundItem(op); err != nil || changed || a.Inventory[0].ID != "" || !database.GroundItemCharacterReceiptMatches(groundSavedReceipt(a), op) {
		t.Fatal("legacy replay recreated consumed custody", changed, err)
	}
}
