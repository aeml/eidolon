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

func TestOwnerEconomyExportMongoProjectionPagingAndNoExecution(t *testing.T) {
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
	db.users = base.Collection(uniqueID("economy-export-users"))
	db.reports = base.Collection(uniqueID("economy-export-cases"))
	db.groundItemOperations = base.Collection(uniqueID("economy-export-ground"))
	db.auctionBids = base.Collection(uniqueID("economy-export-auctions"))
	db.adminOperations = base.Collection(uniqueID("economy-export-admin"))
	all := []*mongo.Collection{db.users, db.reports, db.groundItemOperations, db.auctionBids, db.adminOperations}
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
	collections := map[string]*mongo.Collection{"ground": db.groundItemOperations, "auction-ops": db.auctionBids, "admin-ops": db.adminOperations}
	expected := map[string]map[string]bool{"ground": {}, "auction-ops": {}, "admin-ops": {}}
	item := `{"id":"earned","stack":1,"maxStack":1,"potency":4,"stats":{"strength":9},"forgeBasis":{"private":"private-own-basis"},"privateCustody":"private-own-item"}`
	for i := 0; i < 12; i++ {
		groundID := GroundItemOperationID(fmt.Sprintf("synthetic-ground-%d", i))
		expected["ground"][strings.TrimPrefix(groundID, groundItemPrefix)] = true
		ground := bson.M{"_id": groundID, "version": 1, "username": "owner", "player_id": "player-owner", "kind": "pickup", "state": "complete", "created_at": now, "available_at": now, "expires_at": now.Add(time.Minute), "moved_payload": item, "before_payload": strings.Repeat("private-before-", 10000), "remaining_payload": strings.Repeat("private-remaining-", 10000), "fingerprint": "private-fingerprint", "loot_id": "private-loot", "loot_owner_id": "private-other-owner", "loot_party_id": "private-party", "instance_id": "private-instance", "x": 100, "z": 200}
		if i%3 == 0 {
			ground["kind"] = "drop"
			ground["state"] = "pending"
			delete(ground, "available_at")
			delete(ground, "expires_at")
		}
		if i%3 == 1 {
			ground["kind"] = "drop"
		}
		if _, err := db.groundItemOperations.InsertOne(ctx, ground); err != nil {
			t.Fatal(err)
		}
		auctionID := primitive.NewObjectID()
		expected["auction-ops"][auctionID.Hex()] = true
		auction := bson.M{"_id": auctionID, "id": "private-operation-id", "auction_id": fmt.Sprintf("public-auction-%d", i), "player_id": "player-owner", "character_name": "owner", "amount": 17, "end_time": now.Add(time.Hour), "previous_bidder_id": "private-other-bidder", "previous_bidder_name": strings.Repeat("private-other-name-", 10000), "refund_id": "private-refund"}
		switch i % 5 {
		case 1:
			auction["kind"] = AuctionOperationListing
			auction["listing_bid"] = 50
			auction["listing_buyout"] = 100
			auction["listing_hours"] = 1
			auction["listing_start"] = now
			auction["amount"] = 5
			auction["item_payload"] = item
		case 2:
			auction["kind"] = AuctionOperationBuyout
			auction["item_payload"] = item
		case 3:
			auction["kind"] = AuctionOperationItemClaim
			auction["claim_status"] = "SOLD"
			auction["amount"] = 0
			auction["item_payload"] = item
		case 4:
			auction["kind"] = AuctionOperationSellerPayout
			auction["fee"] = 1
		}
		if _, err := db.auctionBids.InsertOne(ctx, auction); err != nil {
			t.Fatal(err)
		}
		adminID := AdminOperationID("private-staff", fmt.Sprintf("synthetic-admin-%d", i))
		expected["admin-ops"][strings.TrimPrefix(adminID, "admin:")] = true
		admin := bson.M{"_id": adminID, "version": 1, "target": "owner", "actor": "private-staff", "action": "admin_grant_gold", "state": "pending", "payload": []byte(`{"action":"admin_grant_gold","amount":17}`), "fingerprint": "private-fingerprint", "request_id": "private-request", "audit": bson.M{"at": now, "result": "success", "actor": "private-staff-key", "target": "private-target-key", "summary": strings.Repeat("private-staff-summary-", 10000), "reason": "private-reason"}}
		switch i % 4 {
		case 1:
			admin["action"] = "admin_grant_item"
			admin["payload"] = []byte(`{"action":"admin_grant_item","items":[` + item + `]}`)
		case 2:
			admin["state"] = "complete"
			admin["payload"] = []byte(strings.Repeat("private-discarded-plan-", 10000))
		case 3:
			admin["action"] = "admin_teleport"
			admin["payload"] = []byte(strings.Repeat("private-other-anchor-", 10000))
		}
		if _, err := db.adminOperations.InsertOne(ctx, admin); err != nil {
			t.Fatal(err)
		}
	}
	for section, collection := range collections {
		row := bson.M{"_id": ownerOperationPrefix(section) + strings.Repeat("e", 64), "username": "other", "target": "other", "player_id": "player-other", "private_payload": "private-unrelated"}
		if section == "auction-ops" {
			row["_id"] = primitive.NewObjectID()
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
			t.Fatal("fixture checksum/count failed", cursor.Err(), count)
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
				t.Fatal("owner economy projection failed/leaked", section, err)
			}
			var page struct {
				Entries  []json.RawMessage   `json:"entries"`
				Next     string              `json:"next"`
				Coverage ownerExportCoverage `json:"coverage"`
			}
			if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport {
				t.Fatal("invalid envelope")
			}
			want := 10
			if pageNumber == 1 {
				want = 2
			}
			if len(page.Entries) != want {
				t.Fatal("economy rows lost", section, len(page.Entries))
			}
			for _, raw := range page.Entries {
				key := ""
				if section == "ground" {
					var entry ownerGroundEntry
					if json.Unmarshal(raw, &entry) != nil || entry.Item.Stats["strength"] != 9 || entry.Item.Potency != 4 {
						t.Fatal("own moved item lost")
					}
					key = entry.Reference
					if entry.OperationState == "pending" && (entry.AvailableAt != nil || entry.ExpiresAt != nil) {
						t.Fatal("invented pending ground availability")
					}
					if entry.OperationState == "complete" && (entry.AvailableAt == nil || entry.ExpiresAt == nil || !entry.ExpiresAt.Equal(entry.AvailableAt.Add(time.Minute))) {
						t.Fatal("recorded lifetime lost")
					}
				} else if section == "auction-ops" {
					var entry ownerAuctionOperationEntry
					if json.Unmarshal(raw, &entry) != nil || entry.RecordedEndTime.IsZero() {
						t.Fatal("auction intent fields lost")
					}
					key = entry.ID.Hex()
					if entry.Kind == "bid" && (entry.Item != nil || entry.PlannedGoldAmount != 17) {
						t.Fatal("legacy missing-kind bid changed")
					}
					if entry.Kind == "listing" && (entry.Listing == nil || entry.Listing.Buyout != 100 || entry.PlannedGoldAmount != 5) {
						t.Fatal("listing plan lost")
					}
					if entry.Item != nil && (entry.Item.Stats["strength"] != 9 || entry.Item.Potency != 4) {
						t.Fatal("planned auction item lost")
					}
				} else {
					var entry ownerAdminOperationEntry
					if json.Unmarshal(raw, &entry) != nil || entry.RecordedAuditResult != "success" {
						t.Fatal("recorded admin fields lost")
					}
					key = entry.Reference
					if entry.OperationState == "complete" || entry.Action == "admin_teleport" {
						if entry.RetainedGrantPlan != nil {
							t.Fatal("discarded/other landing plan exposed")
						}
					} else if entry.Action == "admin_grant_gold" {
						if entry.RetainedGrantPlan == nil || entry.RetainedGrantPlan.Gold != 17 {
							t.Fatal("own retained Gold plan lost")
						}
					} else {
						if entry.RetainedGrantPlan == nil || len(entry.RetainedGrantPlan.Items) != 1 || entry.RetainedGrantPlan.Items[0].Stats["strength"] != 9 {
							t.Fatal("own retained item plan lost")
						}
					}
				}
				if !expected[section][key] || seen[key] {
					t.Fatal("unrelated/duplicate record exported")
				}
				seen[key] = true
			}
			if pageNumber == 0 && (page.Next == "" || !ValidOwnerExportQuery(OwnerExportQuery{Section: section, Before: page.Next})) || pageNumber == 1 && page.Next != "" {
				t.Fatal("continuation incorrect")
			}
			before = page.Next
		}
		if len(seen) != 12 || checksum(collection) != initial[section] {
			t.Fatal("rows omitted or economic records mutated")
		}
		id := any(ownerOperationPrefix(section) + strings.Repeat("f", 64))
		bad := bson.M{"_id": id, "version": 1, "username": "owner", "player_id": "player-owner", "target": "owner", "kind": "drop", "state": "pending", "created_at": now, "moved_payload": strings.Repeat("x", 74<<10)}
		if section == "auction-ops" {
			id = primitive.NewObjectID()
			bad = bson.M{"_id": id, "player_id": "player-owner", "character_name": "owner", "auction_id": "public-oversized", "kind": AuctionOperationBuyout, "amount": 17, "end_time": now.Add(time.Hour), "item_payload": strings.Repeat("x", 74<<10)}
		}
		if section == "admin-ops" {
			bad = bson.M{"_id": id, "version": 1, "target": "owner", "action": "admin_grant_gold", "state": "pending", "audit": bson.M{"at": now, "result": "success"}, "payload": []byte(strings.Repeat("x", 70<<10))}
		}
		if _, err := collection.InsertOne(ctx, bad); err != nil {
			t.Fatal(err)
		}
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil {
			t.Fatal("oversized selected owner record silently omitted", section)
		}
		if _, err := collection.DeleteOne(ctx, bson.M{"_id": id}); err != nil {
			t.Fatal(err)
		}
		if checksum(collection) != initial[section] {
			t.Fatal("failure path mutated retained custody")
		}
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	for section, collection := range collections {
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil || checksum(collection) != initial[section] {
			t.Fatal("revocation failed or mutated economic source")
		}
	}
}
