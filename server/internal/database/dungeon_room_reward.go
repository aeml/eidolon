package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const dungeonRoomRewardPrefix = "roomreward:"

// One immutable, server-owned room outcome for the entire eligible cohort.
// It must reach the shared durable store BEFORE any recipient effect or saved
// cleared-room projection. The model alone is not connected runtime recovery.
// ItemDeliveryReceipts retain its fingerprint with each complete character save.
type DungeonRoomRewardOperation struct {
	Version      int                          `bson:"version"`
	ID           string                       `bson:"_id"`
	InstanceID   string                       `bson:"instance_id"`
	RoomIndex    int                          `bson:"room_index"`
	RoomType     string                       `bson:"room_type"`
	RoomHook     string                       `bson:"room_hook"`
	DungeonType  string                       `bson:"dungeon_type"`
	Difficulty   string                       `bson:"difficulty"`
	RunLevel     int                          `bson:"run_level"`
	Objective    int                          `bson:"objective"`
	CreatedAt    time.Time                    `bson:"created_at"`
	Participants []DungeonRoomRewardRecipient `bson:"participants"`
	Fingerprint  string                       `bson:"fingerprint"`
}

type DungeonRoomRewardRecipient struct {
	Username string   `bson:"username"`
	PlayerID string   `bson:"player_id"`
	Gold     int      `bson:"gold"`
	XP       int      `bson:"xp"`
	Items    []string `bson:"items"`
	Health   int      `bson:"health"`
	Mana     int      `bson:"mana"`
}

func DungeonRoomRewardID(instanceID string, roomIndex int) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%d", instanceID, roomIndex)))
	return dungeonRoomRewardPrefix + hex.EncodeToString(digest[:])
}

func DungeonRoomRewardFingerprint(op DungeonRoomRewardOperation) (string, error) {
	op.Fingerprint = ""
	encoded, err := json.Marshal(op)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func (op DungeonRoomRewardOperation) Validate() error {
	fingerprint, err := DungeonRoomRewardFingerprint(op)
	if err != nil || op.Version != 1 || op.ID != DungeonRoomRewardID(op.InstanceID, op.RoomIndex) || fingerprint != op.Fingerprint ||
		!boundedActivityText(op.InstanceID, 200, true) || !strings.HasPrefix(op.InstanceID, "dungeon_") ||
		op.RoomIndex < 0 || op.RoomIndex > 10000 || op.Objective < -1 || op.Objective > 10000 ||
		op.RunLevel < 1 || op.RunLevel > 100 || !boundedActivityText(op.DungeonType, 100, true) ||
		(op.Difficulty != "normal" && op.Difficulty != "heroic" && op.Difficulty != "mythic") ||
		(op.RoomType != "normal" && op.RoomType != "elite") || !boundedActivityText(op.RoomHook, 100, false) ||
		op.CreatedAt.IsZero() || op.CreatedAt.Location() != time.UTC || !op.CreatedAt.Equal(op.CreatedAt.Truncate(time.Millisecond)) ||
		len(op.Participants) > 100 {
		return errors.New("invalid frozen dungeon room reward")
	}
	previous := ""
	itemIDs := map[string]bool{}
	payloadBytes := 0
	for _, participant := range op.Participants {
		if !boundedActivityText(participant.Username, 256, true) || participant.Username <= previous || participant.PlayerID != "player-"+participant.Username ||
			participant.Gold < 0 || participant.Gold > 1_000_000 || participant.XP < 0 || participant.XP > 1_000_000 ||
			participant.Health < 0 || participant.Health > 1_000_000_000 || participant.Mana < 0 || participant.Mana > 1_000_000_000 || len(participant.Items) > 2 {
			return errors.New("invalid dungeon room reward recipient")
		}
		previous = participant.Username
		if op.RoomHook != "shrine" && (participant.Health != 0 || participant.Mana != 0) {
			return errors.New("non-shrine room cannot award recovery")
		}
		for _, payload := range participant.Items {
			fields, _, err := groundItemPayload(payload)
			var id string
			if err != nil || json.Unmarshal(fields["id"], &id) != nil || itemIDs[id] {
				return errors.New("invalid or shared dungeon reward item")
			}
			itemIDs[id] = true
			payloadBytes += len(payload)
			if payloadBytes > 2<<20 {
				return errors.New("dungeon room reward payload exceeds bound")
			}
		}
	}
	return nil
}

func DungeonRoomRewardRecipientFor(op DungeonRoomRewardOperation, username string) (DungeonRoomRewardRecipient, bool) {
	for _, participant := range op.Participants {
		if participant.Username == username {
			return participant, true
		}
	}
	return DungeonRoomRewardRecipient{}, false
}

func DungeonRoomRewardCharacterReceiptMatches(character *Character, op DungeonRoomRewardOperation) bool {
	if character == nil || op.Validate() != nil {
		return false
	}
	_, eligible := DungeonRoomRewardRecipientFor(op, character.Name)
	return eligible && character.ItemDeliveryReceipts[op.ID] == op.Fingerprint
}
