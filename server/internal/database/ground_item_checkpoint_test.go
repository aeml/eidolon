package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestGroundItemCheckpointLegacyFingerprintCompatibility(t *testing.T) {
	for _, kind := range []string{GroundItemDrop, GroundItemPickup} {
		op := groundOperationFixture(kind)
		unhashed := op
		unhashed.Fingerprint = ""
		encoded, err := json.Marshal(unhashed)
		if err != nil || strings.Contains(string(encoded), "AccountOrdinal") {
			t.Fatal("legacy hash acquired a new field", err)
		}
		// Independently emulate the original field-ordered JSON encoder by
		// rebuilding all original fields, with no checkpoint field at all.
		var ordered map[string]json.RawMessage
		if err := json.Unmarshal(encoded, &ordered); err != nil {
			t.Fatal(err)
		}
		keys := []string{"Version", "ID", "Kind", "Username", "PlayerID", "LootID", "Generation", "BeforePayload", "MovedPayload", "RemainingPayload", "InstanceID", "LootOwnerID", "LootPartyID", "X", "Z", "CreatedAt", "LootTime", "LootCreatedAt", "Fingerprint"}
		var legacy strings.Builder
		legacy.WriteByte('{')
		for i, key := range keys {
			if i > 0 {
				legacy.WriteByte(',')
			}
			label, _ := json.Marshal(key)
			legacy.Write(label)
			legacy.WriteByte(':')
			legacy.Write(ordered[key])
		}
		legacy.WriteByte('}')
		digest := sha256.Sum256([]byte(legacy.String()))
		if hex.EncodeToString(digest[:]) != op.Fingerprint {
			t.Fatal("legacy frozen hash changed")
		}
		raw, _ := bson.Marshal(op)
		if _, err := bson.Raw(raw).LookupErr("account_ordinal"); err == nil {
			t.Fatal("legacy BSON acquired an ordinal")
		}
		op.AccountOrdinal = 1
		op.Fingerprint, _ = GroundItemFingerprint(op)
		if op.Validate() == nil {
			t.Fatal("version1 accepted an ordered checkpoint")
		}
	}
}

func TestGroundItemCheckpointSavedProofAndConflicts(t *testing.T) {
	op := groundOperationFixture(GroundItemDrop)
	op.Version, op.AccountOrdinal = 2, 3
	op.Fingerprint, _ = GroundItemFingerprint(op)
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	character := Character{Name: op.Username, GroundAccountOrdinal: 3, GroundAccountOperationID: op.ID, GroundAccountFingerprint: op.Fingerprint}
	for _, mode := range []string{"exact", "later", "missing", "gap", "wrong-id", "wrong-fingerprint", "malformed-head", "foreign-owner", "legacy-conflict"} {
		t.Run(mode, func(t *testing.T) {
			c := character
			want := mode == "exact" || mode == "later"
			switch mode {
			case "later":
				c.GroundAccountOrdinal = 4
				c.GroundAccountOperationID = GroundItemOperationID("canonical-later-head")
			case "missing":
				c.GroundAccountOrdinal = 0
				c.GroundAccountOperationID = ""
				c.GroundAccountFingerprint = ""
			case "gap":
				c.GroundAccountOrdinal = 2
			case "wrong-id":
				c.GroundAccountOperationID = GroundItemOperationID("other-decision")
			case "wrong-fingerprint":
				c.GroundAccountFingerprint = strings.Repeat("a", 64)
			case "malformed-head":
				c.GroundAccountOrdinal = 4
				c.GroundAccountFingerprint = "missing"
			case "foreign-owner":
				c.Name = "different-account"
			case "legacy-conflict":
				c.ItemDeliveryReceipts = map[string]string{op.ID: "other-fingerprint"}
			}
			if got := GroundItemCharacterReceiptMatches(&c, op); got != want {
				t.Fatalf("proof %v, want %v", got, want)
			}
		})
	}
	for _, ordinal := range []int64{0, -1} {
		invalid := op
		invalid.AccountOrdinal = ordinal
		invalid.Fingerprint, _ = GroundItemFingerprint(invalid)
		if invalid.Validate() == nil || GroundItemCharacterReceiptMatches(&character, invalid) {
			t.Fatal("invalid ordinal accepted")
		}
	}
}
