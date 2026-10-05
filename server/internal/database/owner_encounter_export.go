package database

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownerEncounterRecipientSource struct {
	PlayerID string                  `bson:"player_id" json:"-"`
	Gold     int                     `bson:"gold" json:"-"`
	XP       int                     `bson:"xp" json:"-"`
	Items    []string                `bson:"items" json:"-"`
	Health   int                     `bson:"health" json:"-"`
	Mana     int                     `bson:"mana" json:"-"`
	Quests   []BossVictoryKillCredit `bson:"quests" json:"-"`
}

type ownerEncounterSource struct {
	ID          string                          `bson:"_id" json:"-"`
	Version     int                             `bson:"version" json:"-"`
	State       string                          `bson:"state" json:"-"`
	CreatedAt   time.Time                       `bson:"created_at" json:"-"`
	DungeonType string                          `bson:"dungeon_type" json:"-"`
	Difficulty  string                          `bson:"difficulty" json:"-"`
	RunLevel    int                             `bson:"run_level" json:"-"`
	RoomIndex   int                             `bson:"room_index" json:"-"`
	RoomType    string                          `bson:"room_type" json:"-"`
	RoomHook    string                          `bson:"room_hook" json:"-"`
	Objective   int                             `bson:"objective" json:"-"`
	BossType    string                          `bson:"boss_type" json:"-"`
	Own         []ownerEncounterRecipientSource `bson:"own" json:"-"`
}

type ownerRoomRewardSnapshot struct {
	Type      string `json:"type"`
	Hook      string `json:"hook"`
	Objective int    `json:"objective"`
	Health    int    `json:"health"`
	Mana      int    `json:"mana"`
}

type ownerBossCreditSnapshot struct {
	QuestID string `json:"quest_id"`
	Target  string `json:"target"`
	Amount  int    `json:"amount"`
	Maximum int    `json:"maximum"`
}

type ownerEncounterEntry struct {
	Reference      string                    `json:"reference"`
	CreatedAt      time.Time                 `json:"created_at"`
	OperationState string                    `json:"operation_state"`
	DungeonType    string                    `json:"dungeon_type"`
	Difficulty     string                    `json:"difficulty"`
	RunLevel       int                       `json:"run_level"`
	RoomIndex      int                       `json:"room_index"`
	Gold           int                       `json:"gold"`
	XP             int                       `json:"xp"`
	Items          []ownerItemSnapshot       `json:"items"`
	Room           *ownerRoomRewardSnapshot  `json:"room,omitempty"`
	BossType       string                    `json:"boss_type,omitempty"`
	QuestCredits   []ownerBossCreditSnapshot `json:"quest_credits,omitempty"`
}

func snapshotOwnerRewardItems(payloads []string, maximum int) ([]ownerItemSnapshot, error) {
	if len(payloads) > maximum {
		return nil, errOwnerExportSection
	}
	items := make([]ownerItemSnapshot, 0, len(payloads))
	seen := map[string]bool{}
	for _, payload := range payloads {
		if _, _, err := groundItemPayload(payload); err != nil {
			return nil, errOwnerExportSection
		}
		var item Item
		if json.Unmarshal([]byte(payload), &item) != nil || seen[item.ID] {
			return nil, errOwnerExportSection
		}
		seen[item.ID] = true
		items = append(items, snapshotOwnerItem(item))
	}
	return items, nil
}

func ownerEncounterPagePipeline(owner, section, before string) mongo.Pipeline {
	projection := bson.M{"_id": 1, "version": 1, "state": 1, "created_at": 1, "dungeon_type": 1, "difficulty": 1, "run_level": 1, "room_index": 1}
	fields := bson.M{"player_id": "$$party.player_id", "gold": "$$party.gold", "xp": "$$party.xp", "items": "$$party.items"}
	bound := 144 << 10
	if section == "rooms" {
		projection["room_type"] = 1
		projection["room_hook"] = 1
		projection["objective"] = 1
		fields["health"] = "$$party.health"
		fields["mana"] = "$$party.mana"
	} else {
		bound = 576 << 10
		projection["boss_type"] = 1
		fields["quests"] = bson.M{"$map": bson.M{"input": bson.M{"$ifNull": bson.A{"$$party.quests", bson.A{}}}, "as": "credit", "in": bson.M{"quest_id": "$$credit.quest_id", "target": "$$credit.target", "amount": "$$credit.amount", "maximum": "$$credit.maximum"}}}
	}
	projection["own"] = bson.M{"$map": bson.M{"input": bson.M{"$filter": bson.M{"input": bson.M{"$ifNull": bson.A{"$participants", bson.A{}}}, "as": "party", "cond": bson.M{"$eq": bson.A{"$$party.username", owner}}}}, "as": "party", "in": fields}}
	return ownerOperationPagePipeline(bson.M{"participants.username": owner}, projection, ownerOperationPrefix(section), before, bound)
}

func validOwnerEncounterSource(row ownerEncounterSource, owner, section string) bool {
	if row.Version != 1 || row.CreatedAt.IsZero() || !boundedActivityText(row.DungeonType, 100, true) || row.RunLevel < 1 || row.RunLevel > 100 || row.RoomIndex < 0 || row.RoomIndex > 10000 ||
		(row.Difficulty != "normal" && row.Difficulty != "heroic" && row.Difficulty != "mythic") || (row.State != "pending" && row.State != "complete") || len(row.Own) != 1 {
		return false
	}
	own := row.Own[0]
	if own.PlayerID != "player-"+owner || own.Gold < 0 || own.Gold > 1_000_000 || own.XP < 0 || own.XP > 1_000_000 {
		return false
	}
	if section == "rooms" {
		if (row.RoomType != "normal" && row.RoomType != "elite") || !boundedActivityText(row.RoomHook, 100, false) || row.Objective < -1 || row.Objective > 10000 || own.Health < 0 || own.Health > 1_000_000_000 || own.Mana < 0 || own.Mana > 1_000_000_000 ||
			row.RoomHook != "shrine" && (own.Health != 0 || own.Mana != 0) {
			return false
		}
		_, err := snapshotOwnerRewardItems(own.Items, 2)
		return err == nil
	}
	if !boundedActivityText(row.BossType, 100, true) || len(own.Quests) > 100 {
		return false
	}
	seen := map[string]bool{}
	for _, credit := range own.Quests {
		if !boundedActivityText(credit.QuestID, 256, true) || !boundedActivityText(credit.Target, 100, true) || seen[credit.QuestID] || credit.Amount < 1 || credit.Maximum < credit.Amount || credit.Maximum > 10000 {
			return false
		}
		seen[credit.QuestID] = true
	}
	_, err := snapshotOwnerRewardItems(own.Items, 8)
	return err == nil
}

func (db *DB) readOwnerEncounterPage(ctx context.Context, owner, section, before string, at time.Time, maxBytes int) ([]byte, error) {
	var collection *mongo.Collection
	maximum := 2
	switch section {
	case "rooms":
		collection = db.dungeonRoomRewards
	case "bosses":
		collection = db.bossVictories
		maximum = 8
	default:
		return nil, errOwnerExportSection
	}
	prefix := ownerOperationPrefix(section)
	sources, next, err := readOwnerOperationPage(ctx, collection, ownerEncounterPagePipeline(owner, section, before), prefix, before, func(row ownerEncounterSource) string { return row.ID }, func(row ownerEncounterSource) bool { return validOwnerEncounterSource(row, owner, section) })
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerEncounterEntry, 0, len(sources))
	for _, row := range sources {
		own := row.Own[0]
		items, err := snapshotOwnerRewardItems(own.Items, maximum)
		if err != nil {
			return nil, errOwnerExportSection
		}
		entry := ownerEncounterEntry{Reference: strings.TrimPrefix(row.ID, prefix), CreatedAt: row.CreatedAt.UTC(), OperationState: row.State, DungeonType: row.DungeonType, Difficulty: row.Difficulty, RunLevel: row.RunLevel, RoomIndex: row.RoomIndex, Gold: own.Gold, XP: own.XP, Items: items}
		if section == "rooms" {
			entry.Room = &ownerRoomRewardSnapshot{row.RoomType, row.RoomHook, row.Objective, own.Health, own.Mana}
		} else {
			entry.BossType = row.BossType
			for _, credit := range own.Quests {
				entry.QuestCredits = append(entry.QuestCredits, ownerBossCreditSnapshot{credit.QuestID, credit.Target, credit.Amount, credit.Maximum})
			}
		}
		entries = append(entries, entry)
	}
	return encodeOwnerDataPage(OwnerExportFormat(section), section, at, entries, next, maxBytes)
}
