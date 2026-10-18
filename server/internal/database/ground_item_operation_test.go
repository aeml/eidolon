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
		op.LootTime = op.CreatedAt.Add(-10 * time.Second)
		op.LootCreatedAt = op.LootTime
		op.Generation = 1
		op.MovedPayload = strings.Replace(before, `"stack":5`, `"stack":2`, 1)
		op.RemainingPayload = strings.Replace(before, `"stack":5`, `"stack":3`, 1)
	}
	op.Fingerprint, _ = GroundItemFingerprint(op)
	return op
}

func TestGroundItemRoofFormatPreservesHistoricalFingerprints(t *testing.T) {
	// Golden hashes generated with the actual pre-roof struct at66d54b808.
	want := map[string]string{
		"1drop":   "2af36c7604ebea97b9592914e8dffe3c600c8282f82cd18321d57804417856eb",
		"1pickup": "ae6bd2a0a87e46e992bd99507378390e557d3849d767dd209b8df218f2ad39df",
		"2drop":   "bca67dbec92d5989bd02ae7a2e1e1cbe1cb5571ff0e402085bdf56cb8c2a1657",
		"2pickup": "1101315a9ded586ff5c3b927770990926e8a777d4741a3ef3dd458aea0b42cdf",
	}
	for _, version := range []int{1, 2} {
		for _, kind := range []string{GroundItemDrop, GroundItemPickup} {
			op := groundOperationFixture(kind)
			op.Version = version
			if version == 2 {
				op.AccountOrdinal = 1
			}
			op.Fingerprint, _ = GroundItemFingerprint(op)
			key := string(rune('0'+version)) + kind
			if op.Fingerprint != want[key] || op.Validate() != nil {
				t.Fatal("historical ledger fingerprint changed", key, op.Fingerprint)
			}
		}
	}
}

func TestGroundItemRoofFloorIsFrozenAcrossBSONAndCheckpointReplay(t *testing.T) {
	op := groundOperationFixture(GroundItemDrop)
	op.Version, op.AccountOrdinal, op.InstanceID = 3, 1, ""
	op.Y, op.SupportSurface = 9.28, "town-home-0"
	op.Fingerprint, _ = GroundItemFingerprint(op)
	encoded, err := bson.Marshal(op)
	if err != nil {
		t.Fatal(err)
	}
	var restored GroundItemOperation
	if err := bson.Unmarshal(encoded, &restored); err != nil || restored.Validate() != nil || restored != op {
		t.Fatal("roof ledger lost exact persisted floor", err)
	}
	character := &Character{Name: op.Username, GroundAccountOrdinal: 1,
		GroundAccountOperationID: op.ID, GroundAccountFingerprint: op.Fingerprint}
	if !GroundItemCharacterReceiptMatches(character, restored) {
		t.Fatal("roof format lost the ordered saved checkpoint")
	}
	for _, mode := range []string{"height", "floor", "old-version", "instance", "nan"} {
		changed := restored
		switch mode {
		case "height":
			changed.Y++
		case "floor":
			changed.SupportSurface = "other-floor"
		case "old-version":
			changed.Version = 2
		case "instance":
			changed.InstanceID = "dungeon_fixture"
		case "nan":
			changed.Y = math.NaN()
		}
		if changed.Validate() == nil || GroundItemCharacterReceiptMatches(character, changed) {
			t.Fatal("changed roof authority accepted", mode)
		}
	}
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

func TestGroundItemOperationRequiresCanonicalBSONTimestamps(t *testing.T) {
	for _, field := range []string{"created", "available", "birth"} {
		for _, invalid := range []string{"nanoseconds", "offset"} {
			t.Run(field+"-"+invalid, func(t *testing.T) {
				op := groundOperationFixture(GroundItemPickup)
				stamp := &op.CreatedAt
				if field == "available" {
					stamp = &op.LootTime
				} else if field == "birth" {
					stamp = &op.LootCreatedAt
				}
				if invalid == "nanoseconds" {
					*stamp = stamp.Add(time.Nanosecond)
				} else {
					*stamp = stamp.In(time.FixedZone("non-canonical", 3600))
				}
				op.Fingerprint, _ = GroundItemFingerprint(op)
				if err := op.Validate(); err == nil {
					t.Fatal("BSON restart would change frozen timestamp identity")
				}
			})
		}
	}
}
