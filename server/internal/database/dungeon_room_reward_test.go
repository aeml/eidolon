package database

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func dungeonRoomRewardFixture() DungeonRoomRewardOperation {
	op := DungeonRoomRewardOperation{Version: 1, InstanceID: "dungeon_room_fixture", RoomIndex: 2, RoomType: "elite", RoomHook: "elite_ambush",
		DungeonType: "verdant_bastion_catacombs", Difficulty: "normal", RunLevel: 40, Objective: 3, CreatedAt: time.Unix(1790990000, 0).UTC(),
		Participants: []DungeonRoomRewardRecipient{
			{Username: "alice", PlayerID: "player-alice", Gold: 234, XP: 780, Items: []string{`{"id":"earned-alice","stack":1,"maxStack":1,"potency":4,"stats":{"damage":23},"futureArt":{"identity":"retain-exactly"}}`}},
			{Username: "bob", PlayerID: "player-bob", Gold: 234, XP: 780},
		}}
	op.ID = DungeonRoomRewardID(op.InstanceID, op.RoomIndex)
	op.Fingerprint, _ = DungeonRoomRewardFingerprint(op)
	return op
}

func TestDungeonRoomRewardFrozenCohortBSONAndActualCharacterReceipts(t *testing.T) {
	op := dungeonRoomRewardFixture()
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	encoded, err := bson.Marshal(op)
	if err != nil {
		t.Fatal(err)
	}
	var loaded DungeonRoomRewardOperation
	if err := bson.Unmarshal(encoded, &loaded); err != nil || loaded.Validate() != nil || !reflect.DeepEqual(loaded, op) {
		t.Fatal("BSON restart changed frozen recipients, roll or identity", err)
	}
	for _, username := range []string{"alice", "bob", "other"} {
		character := &Character{Name: username, ItemDeliveryReceipts: map[string]string{op.ID: op.Fingerprint}}
		if DungeonRoomRewardCharacterReceiptMatches(character, op) != (username != "other") {
			t.Fatal("receipt ignored the frozen recipient", username)
		}
		character.ItemDeliveryReceipts[op.ID] = "other-room-roll"
		if DungeonRoomRewardCharacterReceiptMatches(character, op) {
			t.Fatal("wrong frozen outcome proved completion")
		}
	}
	if DungeonRoomRewardCharacterReceiptMatches(nil, op) {
		t.Fatal("absent character proved completion")
	}
	var item map[string]json.RawMessage
	if json.Unmarshal([]byte(loaded.Participants[0].Items[0]), &item) != nil || !strings.Contains(string(item["futureArt"]), "retain-exactly") {
		t.Fatal("opaque earned metadata was reconstructed or dropped")
	}
}

func TestDungeonRoomRewardRejectsInvalidOrChangedCohort(t *testing.T) {
	for _, invalid := range []string{"changed fingerprint", "wrong stable identity", "unsorted recipients", "duplicate recipient", "foreign player", "negative Gold", "excessive XP", "duplicate item", "invalid item quantity", "boss room", "non-shrine healing", "noncanonical timestamp", "unknown version"} {
		t.Run(invalid, func(t *testing.T) {
			op := dungeonRoomRewardFixture()
			switch invalid {
			case "changed fingerprint":
				op.Participants[0].Gold++
			case "wrong stable identity":
				op.RoomIndex++
			case "unsorted recipients":
				op.Participants[0], op.Participants[1] = op.Participants[1], op.Participants[0]
			case "duplicate recipient":
				op.Participants[1] = op.Participants[0]
			case "foreign player":
				op.Participants[0].PlayerID = "player-bob"
			case "negative Gold":
				op.Participants[0].Gold = -1
			case "excessive XP":
				op.Participants[0].XP = 1_000_001
			case "duplicate item":
				op.Participants[1].Items = op.Participants[0].Items
			case "invalid item quantity":
				op.Participants[0].Items[0] = strings.Replace(op.Participants[0].Items[0], `"stack":1`, `"stack":2`, 1)
			case "boss room":
				op.RoomType = "boss"
			case "non-shrine healing":
				op.Participants[0].Health = 30
			case "noncanonical timestamp":
				op.CreatedAt = op.CreatedAt.Add(time.Nanosecond)
			case "unknown version":
				op.Version = 2
			}
			if invalid != "changed fingerprint" {
				op.Fingerprint, _ = DungeonRoomRewardFingerprint(op)
			}
			if op.Validate() == nil {
				t.Fatal("invalid room outcome accepted", invalid)
			}
		})
	}
}
