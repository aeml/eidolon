package database

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

const bossVictoryPrefix = "bossvictory:"

// Freeze the original physical encounter and its entire kill-time cohort BEFORE
// credits. Personal receipts and pending full-bag loot are saved together. This
// record is independent of any one member's earlier dungeon checkpoint.
type BossVictoryOperation struct {
	Version      int                      `bson:"version"`
	ID           string                   `bson:"_id"`
	InstanceID   string                   `bson:"instance_id"`
	BossID       string                   `bson:"boss_id"`
	BossType     string                   `bson:"boss_type"`
	DungeonType  string                   `bson:"dungeon_type"`
	RoomIndex    int                      `bson:"room_index"`
	Difficulty   string                   `bson:"difficulty"`
	RunLevel     int                      `bson:"run_level"`
	CreatedAt    time.Time                `bson:"created_at"`
	Participants []BossVictoryRecipient   `bson:"participants"`
	Drops        []BossVictoryDrop        `bson:"drops"`
	DungeonClear *BossVictoryDungeonClear `bson:"dungeon_clear,omitempty" json:",omitempty"`
	Fingerprint  string                   `bson:"fingerprint"`
}

// Ordinary final guardians end their dungeon at the ORIGINAL kill time. A
// crystal raid is deliberately excluded: its separate three-wave defense,
// not the guardian kill, completes that run and awards its repair objective.
type BossVictoryDungeonClear struct {
	DurationMS int64             `bson:"duration_ms"`
	GuildRuns  []GuildDungeonRun `bson:"guild_runs"`
}

func BossVictoryFinishesDungeon(bossType, dungeonType string) bool {
	switch bossType {
	case "HollowSentinel":
		return dungeonType == "verdant_bastion_catacombs"
	case "LordInfernax":
		return dungeonType == "molten_core"
	case "Zephyrion":
		return dungeonType == "tempest_spire"
	case "Thalorath":
		return dungeonType == "abyssal_well"
	case "EidolonDevourer":
		return dungeonType == "umbral_nexus"
	}
	return false
}

// Original public loot projections also belong to the first victory. Preserve
// identity, position and lifetime; a recovery may not create another reroll or
// renew a previously picked-up/expired item's availability.
type BossVictoryDrop struct {
	LootID      string    `bson:"loot_id"`
	Item        string    `bson:"item"`
	PartyID     string    `bson:"party_id"`
	X           float64   `bson:"x"`
	Y           float64   `bson:"y"`
	Z           float64   `bson:"z"`
	AvailableAt time.Time `bson:"available_at"`
	ExpiresAt   time.Time `bson:"expires_at"`
}

type BossVictoryRecipient struct {
	Username string                  `bson:"username"`
	PlayerID string                  `bson:"player_id"`
	Gold     int                     `bson:"gold"`
	XP       int                     `bson:"xp"`
	Items    []string                `bson:"items"`
	Quests   []BossVictoryKillCredit `bson:"quests"`
}

// An accepted kill's incremental credit, not a stale complete quest snapshot.
// The character receipt makes this increment once-only; later independent
// kills are retained rather than swallowed by an absolute progress floor.
type BossVictoryKillCredit struct {
	QuestID string `bson:"quest_id"`
	Target  string `bson:"target"`
	Amount  int    `bson:"amount"`
	Maximum int    `bson:"maximum"`
}

func BossVictoryID(instanceID, bossID string) string {
	digest := sha256.Sum256([]byte(instanceID + "\x00" + bossID))
	return bossVictoryPrefix + hex.EncodeToString(digest[:])
}

func BossVictoryFingerprint(op BossVictoryOperation) (string, error) {
	op.Fingerprint = ""
	encoded, err := json.Marshal(op)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func (op BossVictoryOperation) Validate() error {
	fingerprint, err := BossVictoryFingerprint(op)
	if err != nil || op.Version != 1 || op.ID != BossVictoryID(op.InstanceID, op.BossID) || fingerprint != op.Fingerprint ||
		!boundedActivityText(op.InstanceID, 200, true) || !strings.HasPrefix(op.InstanceID, "dungeon_") ||
		!boundedActivityText(op.BossType, 100, true) || op.BossID != fmt.Sprintf("%s-%s", op.BossType, op.InstanceID) ||
		!boundedActivityText(op.DungeonType, 100, true) || op.RoomIndex < 0 || op.RoomIndex > 10000 ||
		(op.Difficulty != "normal" && op.Difficulty != "heroic" && op.Difficulty != "mythic") || op.RunLevel < 1 || op.RunLevel > 100 ||
		op.CreatedAt.IsZero() || op.CreatedAt.Location() != time.UTC || !op.CreatedAt.Equal(op.CreatedAt.Truncate(time.Millisecond)) ||
		len(op.Participants) < 1 || len(op.Participants) > 100 || len(op.Drops) > 16 {
		return errors.New("invalid frozen boss victory")
	}
	previous := ""
	itemIDs := map[string]bool{}
	payloadBytes := 0
	for _, participant := range op.Participants {
		if !boundedActivityText(participant.Username, 256, true) || participant.Username <= previous || participant.PlayerID != "player-"+participant.Username ||
			participant.Gold < 0 || participant.Gold > 1_000_000 || participant.XP < 0 || participant.XP > 1_000_000 ||
			len(participant.Items) > 8 || len(participant.Quests) > 100 {
			return errors.New("invalid boss victory recipient")
		}
		previous = participant.Username
		for _, payload := range participant.Items {
			fields, _, err := groundItemPayload(payload)
			var id string
			if err != nil || json.Unmarshal(fields["id"], &id) != nil || itemIDs[id] {
				return errors.New("invalid or shared boss victory roll")
			}
			itemIDs[id] = true
			payloadBytes += len(payload)
			if payloadBytes > 2<<20 {
				return errors.New("boss victory payload exceeds bound")
			}
		}
		questIDs := map[string]bool{}
		for _, credit := range participant.Quests {
			if !boundedActivityText(credit.QuestID, 256, true) || !boundedActivityText(credit.Target, 100, true) || questIDs[credit.QuestID] ||
				credit.Amount < 1 || credit.Maximum < credit.Amount || credit.Maximum > 10000 {
				return errors.New("invalid boss kill credit")
			}
			questIDs[credit.QuestID] = true
		}
	}
	for index, drop := range op.Drops {
		fields, _, err := groundItemPayload(drop.Item)
		var itemID string
		if err != nil || json.Unmarshal(fields["id"], &itemID) != nil || itemIDs[itemID] ||
			drop.LootID != fmt.Sprintf("loot-boss-%s-%d", strings.TrimPrefix(op.ID, bossVictoryPrefix), index) ||
			!boundedActivityText(drop.PartyID, 256, false) || !drop.AvailableAt.Equal(op.CreatedAt) || drop.AvailableAt.Location() != time.UTC ||
			drop.ExpiresAt.Location() != time.UTC || !drop.ExpiresAt.Equal(drop.ExpiresAt.Truncate(time.Millisecond)) ||
			!drop.ExpiresAt.After(drop.AvailableAt) || drop.ExpiresAt.Sub(drop.AvailableAt) > 24*time.Hour {
			return errors.New("invalid frozen boss ground drop")
		}
		for _, value := range []float64{drop.X, drop.Y, drop.Z} {
			if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > 10_000_000 {
				return errors.New("invalid boss ground coordinates")
			}
		}
		itemIDs[itemID] = true
		payloadBytes += len(drop.Item)
		if payloadBytes > 2<<20 {
			return errors.New("boss victory payload exceeds bound")
		}
	}
	if BossVictoryFinishesDungeon(op.BossType, op.DungeonType) != (op.DungeonClear != nil) {
		return errors.New("boss victory lost or invented a dungeon finale")
	}
	if clear := op.DungeonClear; clear != nil {
		if clear.DurationMS < 1 || clear.DurationMS > math.MaxInt64/int64(time.Millisecond) {
			return errors.New("invalid original dungeon clear duration")
		}
		if len(clear.GuildRuns) > 0 {
			if err := validateGuildClear(GuildClearReceipt{InstanceID: op.InstanceID, Runs: clear.GuildRuns}); err != nil {
				return err
			}
			members, previous := 0, ""
			for _, run := range clear.GuildRuns {
				if run.GuildID <= previous || run.DungeonType != op.DungeonType || run.Difficulty != op.Difficulty || run.RunLevel != op.RunLevel ||
					run.DurationMS != clear.DurationMS || !run.FirstClearAt.Equal(op.CreatedAt) || !run.UpdatedAt.IsZero() {
					return errors.New("guild clear does not match original boss victory")
				}
				previous = run.GuildID
				members += run.MemberCount
			}
			if members > len(op.Participants) {
				return errors.New("guild clear exceeds original boss cohort")
			}
		}
	}
	return nil
}

func BossVictoryRecipientFor(op BossVictoryOperation, username string) (BossVictoryRecipient, bool) {
	for _, participant := range op.Participants {
		if participant.Username == username {
			return participant, true
		}
	}
	return BossVictoryRecipient{}, false
}

func BossVictoryCharacterReceiptMatches(character *Character, op BossVictoryOperation) bool {
	if character == nil || op.Validate() != nil {
		return false
	}
	_, eligible := BossVictoryRecipientFor(op, character.Name)
	return eligible && character.ItemDeliveryReceipts[op.ID] == op.Fingerprint
}
