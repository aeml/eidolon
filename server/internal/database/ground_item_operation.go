package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	GroundItemDrop   = "drop"
	GroundItemPickup = "pickup"
	groundItemPrefix = "grounditem:"
)

// A server-owned frozen plan. The shared ground-loot coordinator must durably
// reserve this identity/loot generation BEFORE applying its character effect.
// Legacy ItemDeliveryReceipts remain intact; version2 uses a private contiguous
// checkpoint through complete saves. Neither proof is exposed publicly.
// The shared store retains this plan; ordinary command/recovery integration is
// separate and must not infer durable custody from this model alone.
type GroundItemOperation struct {
	// Version2 uses a contiguous account checkpoint instead of adding one
	// character-side map entry forever. Omit zero to preserve legacy hashes.
	AccountOrdinal   int64     `bson:"account_ordinal,omitempty" json:",omitempty"`
	Version          int       `bson:"version"`
	ID               string    `bson:"_id"`
	Kind             string    `bson:"kind"`
	Username         string    `bson:"username"`
	PlayerID         string    `bson:"player_id"`
	LootID           string    `bson:"loot_id"`
	Generation       int64     `bson:"generation"`
	BeforePayload    string    `bson:"before_payload"`
	MovedPayload     string    `bson:"moved_payload"`
	RemainingPayload string    `bson:"remaining_payload"`
	InstanceID       string    `bson:"instance_id"`
	LootOwnerID      string    `bson:"loot_owner_id"`
	LootPartyID      string    `bson:"loot_party_id"`
	X                float64   `bson:"x"`
	Z                float64   `bson:"z"`
	CreatedAt        time.Time `bson:"created_at"`
	LootTime         time.Time `bson:"loot_time,omitempty"`
	LootCreatedAt    time.Time `bson:"loot_created_at,omitempty"`
	Fingerprint      string    `bson:"fingerprint"`
}

func GroundItemOperationID(nonce string) string {
	digest := sha256.Sum256([]byte(nonce))
	return groundItemPrefix + hex.EncodeToString(digest[:])
}

func GroundItemFingerprint(op GroundItemOperation) (string, error) {
	op.Fingerprint = ""
	encoded, err := json.Marshal(op)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

// Compare all opaque metadata, not just item names/types. Stack quantity is
// the only field a partial pickup can change. The game layer separately refuses
// unknown item fields rather than reconstructing an incomplete future item.
func groundItemPayload(payload string) (map[string]json.RawMessage, int, error) {
	var fields map[string]json.RawMessage
	if len(payload) == 0 || len(payload) > 65536 || !utf8.ValidString(payload) || json.Unmarshal([]byte(payload), &fields) != nil || fields == nil {
		return nil, 0, errors.New("invalid ground item payload")
	}
	var id string
	var stack, maxStack int
	if json.Unmarshal(fields["id"], &id) != nil || !boundedActivityText(id, 256, true) ||
		json.Unmarshal(fields["stack"], &stack) != nil || stack < 1 {
		return nil, 0, errors.New("invalid ground item identity/quantity")
	}
	if value, present := fields["maxStack"]; present && json.Unmarshal(value, &maxStack) != nil {
		return nil, 0, errors.New("invalid ground item capacity")
	}
	if maxStack < 0 || (maxStack > 0 && stack > maxStack) {
		return nil, 0, errors.New("invalid ground item stack")
	}
	delete(fields, "stack")
	return fields, stack, nil
}

func (op GroundItemOperation) Validate() error {
	id := strings.TrimPrefix(op.ID, groundItemPrefix)
	_, idErr := hex.DecodeString(id)
	fingerprint, err := GroundItemFingerprint(op)
	validVersion := op.Version == 1 && op.AccountOrdinal == 0 || op.Version == 2 && op.AccountOrdinal > 0
	if !validVersion || !strings.HasPrefix(op.ID, groundItemPrefix) || len(id) != 64 || idErr != nil ||
		!boundedActivityText(op.Username, 256, true) || op.PlayerID != "player-"+op.Username ||
		!boundedActivityText(op.LootID, 512, true) || !boundedActivityText(op.InstanceID, 512, false) ||
		!boundedActivityText(op.LootOwnerID, 512, false) || !boundedActivityText(op.LootPartyID, 512, false) ||
		op.CreatedAt.IsZero() || math.IsNaN(op.X) || math.IsInf(op.X, 0) || math.IsNaN(op.Z) || math.IsInf(op.Z, 0) ||
		math.Abs(op.X) > 1e7 || math.Abs(op.Z) > 1e7 || err != nil || op.Fingerprint != fingerprint {
		return errors.New("invalid ground item operation")
	}
	// BSON dates retain milliseconds in UTC. Freeze that precision before
	// hashing, otherwise generated loot's nanoseconds break restart identity.
	for _, stamp := range []time.Time{op.CreatedAt, op.LootTime, op.LootCreatedAt} {
		_, offset := stamp.Zone()
		if !stamp.IsZero() && (offset != 0 || !stamp.Equal(stamp.Truncate(time.Millisecond))) {
			return errors.New("ground item timestamp is not canonical BSON precision")
		}
	}
	before, beforeCount, err := groundItemPayload(op.BeforePayload)
	if err != nil {
		return err
	}
	moved, movedCount, err := groundItemPayload(op.MovedPayload)
	if err != nil || !reflect.DeepEqual(before, moved) || movedCount > beforeCount {
		return errors.New("ground item transfer changed metadata or quantity")
	}
	switch op.Kind {
	case GroundItemDrop:
		if op.Generation != 0 || op.BeforePayload != op.MovedPayload || op.RemainingPayload != "" || op.LootOwnerID != "" || op.LootPartyID != "" || !op.LootTime.IsZero() || !op.LootCreatedAt.IsZero() {
			return errors.New("invalid ground item drop plan")
		}
	case GroundItemPickup:
		if op.Generation < 1 || op.LootTime.IsZero() {
			return errors.New("invalid ground item pickup generation")
		}
		if movedCount == beforeCount {
			if op.RemainingPayload != "" {
				return errors.New("full pickup retained another copy")
			}
		} else {
			remaining, remainingCount, err := groundItemPayload(op.RemainingPayload)
			if err != nil || !reflect.DeepEqual(before, remaining) || remainingCount != beforeCount-movedCount {
				return errors.New("partial pickup failed custody conservation")
			}
		}
	default:
		return errors.New("unsupported ground item operation")
	}
	return nil
}

func GroundItemCharacterReceiptMatches(character *Character, op GroundItemOperation) bool {
	if character == nil || op.Validate() != nil || character.Name != op.Username {
		return false
	}
	if op.Version == 2 {
		if previous, found := character.ItemDeliveryReceipts[op.ID]; found && previous != op.Fingerprint {
			return false
		}
		return GroundItemCheckpointMatches(character.GroundAccountOrdinal, character.GroundAccountOperationID, character.GroundAccountFingerprint, op)
	}
	return character.ItemDeliveryReceipts[op.ID] == op.Fingerprint
}

func GroundItemCheckpointValid(ordinal int64, id, fingerprint string) bool {
	if ordinal == 0 {
		return id == "" && fingerprint == ""
	}
	decoded, err := hex.DecodeString(fingerprint)
	return ordinal > 0 && validGroundItemOperationID(id) && err == nil && len(decoded) == 32 && hex.EncodeToString(decoded) == fingerprint
}

// Only a canonical immutable version2 ledger record may use this proof. Its
// unique account ordinal and strict contiguous saved application establish all
// preceding deliveries; the current head additionally checks exact identity.
func GroundItemCheckpointMatches(ordinal int64, id, fingerprint string, op GroundItemOperation) bool {
	return op.Version == 2 && op.AccountOrdinal > 0 && GroundItemCheckpointValid(ordinal, id, fingerprint) &&
		(ordinal > op.AccountOrdinal || ordinal == op.AccountOrdinal && id == op.ID && fingerprint == op.Fingerprint)
}
