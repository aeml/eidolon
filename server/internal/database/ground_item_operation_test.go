package database

import (
	"encoding/json"
	"maps"
	"math"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func groundOperationFixture(kind string) GroundItemOperation {
	before := `{"id":"earned-stack","stack":5,"maxStack":10,"stats":{"strength":7},"potency":3}`
	op := GroundItemOperation{Version: 1, ID: GroundItemOperationID("owned-test-nonce"), Kind: kind,
		Username: "owner", PlayerID: "player-owner", LootID: "ground-owned", InstanceID: "dungeon_fixture",
		BeforePayload: before, MovedPayload: before, CreatedAt: time.Unix(1790990000, 0).UTC(), X: 50000, Z: 20000}
	if kind == GroundItemPickup {
		op.Generation = 1
		op.MovedPayload = strings.Replace(before, `"stack":5`, `"stack":2`, 1)
		op.RemainingPayload = strings.Replace(before, `"stack":5`, `"stack":3`, 1)
	}
	op.Fingerprint, _ = GroundItemFingerprint(op)
	return op
}

func TestGroundItemOperationConservationFingerprintAndPrivateSavedReceipt(t *testing.T) {
	for _, kind := range []string{GroundItemDrop, GroundItemPickup} {
		t.Run(kind, func(t *testing.T) {
			op := groundOperationFixture(kind)
			if err := op.Validate(); err != nil {
				t.Fatal("valid frozen custody rejected", err)
			}
			encoded, err := bson.Marshal(op)
			if err != nil {
				t.Fatal(err)
			}
			var loaded GroundItemOperation
			if err := bson.Unmarshal(encoded, &loaded); err != nil || loaded.Validate() != nil || loaded.Fingerprint != op.Fingerprint {
				t.Fatal("BSON restart copy changed frozen identity", err)
			}
			character := &Character{Name: op.Username, ItemDeliveryReceipts: map[string]string{op.ID: op.Fingerprint}}
			if !GroundItemCharacterReceiptMatches(character, op) {
				t.Fatal("exact saved receipt rejected")
			}
			character.ItemDeliveryReceipts = maps.Clone(character.ItemDeliveryReceipts)
			character.ItemDeliveryReceipts[op.ID] = "other effect"
			if GroundItemCharacterReceiptMatches(character, op) || GroundItemCharacterReceiptMatches(nil, op) {
				t.Fatal("absent or wrong saved receipt accepted")
			}
		})
	}
}

func TestGroundItemOperationRejectsChangedAuthorityOrConservation(t *testing.T) {
	for _, mode := range []string{"fingerprint", "owner", "kind", "generation", "metadata", "quantity", "capacity", "remainder", "nan", "infinity", "oversized", "foreign receipt"} {
		t.Run(mode, func(t *testing.T) {
			op := groundOperationFixture(GroundItemPickup)
			switch mode {
			case "fingerprint":
				op.Fingerprint = "unfrozen"
			case "owner":
				op.Username = "other-owner"
			case "kind":
				op.Kind = "grant_gold"
			case "generation":
				op.Generation = 0
			case "metadata":
				op.MovedPayload = strings.Replace(op.MovedPayload, `"strength":7`, `"strength":99`, 1)
			case "quantity":
				op.MovedPayload = strings.Replace(op.MovedPayload, `"stack":2`, `"stack":6`, 1)
			case "capacity":
				op.BeforePayload = strings.Replace(op.BeforePayload, `"maxStack":10`, `"maxStack":2`, 1)
			case "remainder":
				op.RemainingPayload = strings.Replace(op.RemainingPayload, `"stack":3`, `"stack":2`, 1)
			case "nan":
				op.X = math.NaN()
			case "infinity":
				op.Z = math.Inf(1)
			case "oversized":
				op.MovedPayload += strings.Repeat(" ", 65536)
			case "foreign receipt":
				character := &Character{Name: "other-owner", ItemDeliveryReceipts: map[string]string{op.ID: op.Fingerprint}}
				if GroundItemCharacterReceiptMatches(character, op) {
					t.Fatal("another character authorized ground custody")
				}
				return
			}
			if mode != "fingerprint" {
				op.Fingerprint, _ = GroundItemFingerprint(op)
			}
			if err := op.Validate(); err == nil {
				t.Fatal("changed or nonconserving item plan accepted", mode)
			}
		})
	}
}

func TestGroundItemOpaqueFuturePayloadIsRetainedWithoutMetadataProjection(t *testing.T) {
	op := groundOperationFixture(GroundItemDrop)
	var fields map[string]any
	json.Unmarshal([]byte(op.BeforePayload), &fields)
	fields["futureCosmetic"] = map[string]any{"material": "moon-silk", "seed": 123}
	payload, _ := json.Marshal(fields)
	op.BeforePayload, op.MovedPayload = string(payload), string(payload)
	op.Fingerprint, _ = GroundItemFingerprint(op)
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	encoded, _ := bson.Marshal(op)
	var restored GroundItemOperation
	bson.Unmarshal(encoded, &restored)
	if restored.BeforePayload != op.BeforePayload || restored.MovedPayload != op.MovedPayload {
		t.Fatal("frozen unknown metadata was silently rebuilt or dropped")
	}
}
