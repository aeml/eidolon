package database

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerEncounterExportMongoProjectionPagingAndNoRewardMutation(t *testing.T) {
	uri := os.Getenv("EIDOLON_OWNER_EXPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable owner-export Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("explicit disposable loopback Mongo required")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	base := db.users.Database()
	db.users = base.Collection(uniqueID("encounter-export-users"))
	db.reports = base.Collection(uniqueID("encounter-export-cases"))
	db.dungeonRoomRewards = base.Collection(uniqueID("encounter-export-rooms"))
	db.bossVictories = base.Collection(uniqueID("encounter-export-bosses"))
	db.auctions = base.Collection(uniqueID("encounter-export-auctions"))
	all := []*mongo.Collection{db.users, db.reports, db.dungeonRoomRewards, db.bossVictories, db.auctions}
	t.Cleanup(func() {
		for _, collection := range all {
			_ = collection.Drop(context.Background())
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC().Truncate(time.Millisecond)
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": string(hash)}); err != nil {
		t.Fatal(err)
	}
	caseID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "username": "owner", "report_type": "Account Data Export", "export_approval": bson.M{"enabled": true, "revision": int64(1), "at": now}}); err != nil {
		t.Fatal(err)
	}
	collections := map[string]*mongo.Collection{"rooms": db.dungeonRoomRewards, "bosses": db.bossVictories, "market-items": db.auctions}
	expected := map[string]map[string]bool{"rooms": {}, "bosses": {}, "market-items": {}}
	for i := 0; i < 12; i++ {
		for _, section := range []string{"rooms", "bosses"} {
			id := DungeonRoomRewardID(fmt.Sprintf("dungeon_synthetic_%d", i), i)
			if section == "bosses" {
				id = BossVictoryID(fmt.Sprintf("dungeon_synthetic_%d", i), "synthetic-boss")
			}
			expected[section][strings.TrimPrefix(id, ownerOperationPrefix(section))] = true
			own := bson.M{"username": "owner", "player_id": "player-owner", "gold": 17, "xp": 23, "items": bson.A{`{"id":"earned","stack":1,"potency":4,"stats":{"strength":9},"gems":[{"type":"Ruby","quality":"Rare","stats":{"wisdom":3},"private":"private-own-gem"}],"forgeBasis":{"private":"private-own-basis"},"privateReplay":"private-own-item"}`}}
			row := bson.M{"_id": id, "version": 1, "state": "complete", "created_at": now, "dungeon_type": "verdant_bastion_catacombs", "difficulty": "normal", "run_level": 30, "room_index": i,
				"instance_id": "private-instance", "boss_id": "private-boss-id", "fingerprint": "private-fingerprint", "drops": bson.A{bson.M{"item": strings.Repeat("private-shared-drop-", 10000)}}, "dungeon_clear": bson.M{"guild_runs": bson.A{bson.M{"members": "private-guild-run"}}}}
			if i%2 == 0 {
				row["state"] = "pending"
			}
			if section == "rooms" {
				row["room_type"] = "elite"
				row["room_hook"] = "shrine"
				row["objective"] = -1
				own["health"] = 5
				own["mana"] = 7
			} else {
				row["boss_type"] = "HollowSentinel"
				own["quests"] = bson.A{bson.M{"quest_id": "story-earth", "target": "HollowSentinel", "amount": 1, "maximum": 1, "private_receipt": strings.Repeat("private-own-credit-", 10000)}}
			}
			row["participants"] = bson.A{own, bson.M{"username": "private-other-account", "player_id": "private-other-player", "gold": "private-invalid-other-gold", "items": bson.A{strings.Repeat("private-other-reward-", 10000)}, "quests": bson.A{bson.M{"quest_id": "private-other-quest"}}}}
			if _, err := collections[section].InsertOne(ctx, row); err != nil {
				t.Fatal(err)
			}
		}
		id := primitive.NewObjectID()
		expected["market-items"][id.Hex()] = true
		auction := bson.M{"_id": id, "id": fmt.Sprintf("public-auction-%d", i), "seller_id": "private-seller", "bidder_id": "private-bidder", "buyer_id": "private-buyer", "pending_refunds": bson.A{bson.M{"player_id": "private-other-refund", "amount": 999}}, "last_bid_operation_id": "private-replay", "item": bson.M{"id": "earned", "name": "Earned Blade", "slot": "mainHand", "stats": bson.M{"strength": 9}, "potency": 4, "sockets": 1, "stack": 1, "max_stack": 1, "set_id": "earth", "unique_effect": "flame", "gems": bson.A{bson.M{"type": "Ruby", "quality": "Rare", "stats": bson.M{"wisdom": 3}, "private_payload": strings.Repeat("private-gem-", 10000)}}, "forge_basis": bson.M{"private": strings.Repeat("private-forge-", 10000)}, "icon": "private-cache", "private_payload": strings.Repeat("private-auction-item-", 10000)}}
		switch i % 4 {
		case 0:
			auction["seller_id"] = "player-owner"
		case 1:
			auction["bidder_id"] = "player-owner"
		case 2:
			auction["buyer_id"] = "player-owner"
		case 3:
			auction["pending_refunds"] = bson.A{bson.M{"player_id": "player-owner", "amount": 5}, bson.M{"player_id": "private-other-refund", "amount": 999}}
		}
		if _, err := db.auctions.InsertOne(ctx, auction); err != nil {
			t.Fatal(err)
		}
	}
	for section, collection := range collections {
		row := bson.M{"_id": ownerOperationPrefix(section) + strings.Repeat("e", 64), "participants": bson.A{bson.M{"username": "unrelated"}}, "private_payload": "private-unrelated"}
		if section == "market-items" {
			row = bson.M{"_id": primitive.NewObjectID(), "seller_id": "unrelated", "private_payload": "private-unrelated"}
		}
		if _, err := collection.InsertOne(ctx, row); err != nil {
			t.Fatal(err)
		}
	}
	checksum := func(collection *mongo.Collection) string {
		cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
		if err != nil {
			t.Fatal(err)
		}
		defer cursor.Close(ctx)
		h := sha256.New()
		count := 0
		for cursor.Next(ctx) {
			_, _ = h.Write(cursor.Current)
			count++
		}
		if cursor.Err() != nil || count != 13 {
			t.Fatal("source checksum/count failed", cursor.Err(), count)
		}
		return fmt.Sprintf("%x", h.Sum(nil))
	}
	initial := map[string]string{}
	for section, collection := range collections {
		initial[section] = checksum(collection)
	}
	read := func(section, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, "owner", "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: section, Before: before}, now, maximumOwnerExportResponse)
	}
	for section, collection := range collections {
		seen := map[string]bool{}
		before := ""
		for pageNumber := 0; pageNumber < 2; pageNumber++ {
			data, err := read(section, before)
			if err != nil || strings.Contains(string(data), "private-") {
				t.Fatal("owner projection failed or shared secret leaked", section, err)
			}
			var page struct {
				Entries  []json.RawMessage   `json:"entries"`
				Next     string              `json:"next"`
				Coverage ownerExportCoverage `json:"coverage"`
			}
			if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport {
				t.Fatal("invalid owner envelope")
			}
			want := 10
			if pageNumber == 1 {
				want = 2
			}
			if len(page.Entries) != want {
				t.Fatal("source rows lost", section, len(page.Entries))
			}
			for _, raw := range page.Entries {
				key := ""
				if section == "market-items" {
					var entry ownerMarketItemEntry
					if json.Unmarshal(raw, &entry) != nil || entry.Item.Stats["strength"] != 9 || entry.Item.Potency != 4 || entry.Item.Gems[0].Stats["wisdom"] != 3 || entry.Item.SetID != "earth" || entry.Item.UniqueEffect != "flame" || !entry.Seller && !entry.Bidder && !entry.Buyer && !entry.Refund {
						t.Fatal("market item/owner fields lost")
					}
					key = entry.ID.Hex()
				} else {
					var entry ownerEncounterEntry
					if json.Unmarshal(raw, &entry) != nil || entry.Gold != 17 || entry.XP != 23 || len(entry.Items) != 1 || entry.Items[0].Stats["strength"] != 9 || entry.Items[0].Potency != 4 || entry.Items[0].Gems[0].Stats["wisdom"] != 3 {
						t.Fatal("own frozen reward fields lost")
					}
					key = entry.Reference
					if section == "rooms" && (entry.Room == nil || entry.Room.Health != 5 || entry.Room.Mana != 7 || entry.Room.Objective != -1 || entry.BossType != "" || len(entry.QuestCredits) != 0) {
						t.Fatal("room/shrine projection incorrect")
					}
					if section == "bosses" && (entry.Room != nil || entry.BossType != "HollowSentinel" || len(entry.QuestCredits) != 1 || entry.QuestCredits[0].Amount != 1 || entry.QuestCredits[0].Maximum != 1) {
						t.Fatal("boss quest projection incorrect")
					}
				}
				if !expected[section][key] || seen[key] {
					t.Fatal("unrelated/duplicate source exported")
				}
				seen[key] = true
			}
			if pageNumber == 0 && (!ValidOwnerExportQuery(OwnerExportQuery{Section: section, Before: page.Next}) || page.Next == "") || pageNumber == 1 && page.Next != "" {
				t.Fatal("pagination incorrect")
			}
			before = page.Next
		}
		if len(seen) != 12 || checksum(collection) != initial[section] {
			t.Fatal("pagination omitted rows or mutated custody/rewards")
		}
		badID := any(ownerOperationPrefix(section) + strings.Repeat("f", 64))
		bad := bson.M{"_id": badID, "version": 1, "state": "pending", "created_at": now, "dungeon_type": "verdant_bastion_catacombs", "difficulty": "normal", "run_level": 30, "room_index": 0, "room_type": "normal", "boss_type": "HollowSentinel"}
		bytes := 150 << 10
		if section == "bosses" {
			bytes = 580 << 10
		}
		bad["participants"] = bson.A{bson.M{"username": "owner", "player_id": "player-owner", "items": bson.A{strings.Repeat("x", bytes)}}}
		if section == "market-items" {
			badID = primitive.NewObjectID()
			bad = bson.M{"_id": badID, "id": "oversized", "seller_id": "player-owner", "item": bson.M{"id": "earned", "description": strings.Repeat("x", 90<<10)}}
		}
		if _, err := collection.InsertOne(ctx, bad); err != nil {
			t.Fatal(err)
		}
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil {
			t.Fatal("oversized owned source silently omitted", section)
		}
		if _, err := collection.DeleteOne(ctx, bson.M{"_id": badID}); err != nil {
			t.Fatal(err)
		}
		if checksum(collection) != initial[section] {
			t.Fatal("failure path changed reward/item source")
		}
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	for section, collection := range collections {
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil || checksum(collection) != initial[section] {
			t.Fatal("revoke failed or executed reward effects", section)
		}
	}
}
