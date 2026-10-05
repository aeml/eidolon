package database

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerSocialMarketExportMongoPagesChoicesRefundsAndCustody(t *testing.T) {
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
	db.users = db.users.Database().Collection(uniqueID("social-market-users"))
	db.reports = db.reports.Database().Collection(uniqueID("social-market-cases"))
	db.friendships = db.friendships.Database().Collection(uniqueID("social-market-friends"))
	db.auctions = db.auctions.Database().Collection(uniqueID("social-market-auctions"))
	t.Cleanup(func() {
		_ = db.users.Drop(context.Background())
		_ = db.reports.Drop(context.Background())
		_ = db.friendships.Drop(context.Background())
		_ = db.auctions.Drop(context.Background())
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
	friendIDs := make(map[string]bool)
	marketIDs := make(map[string]bool)
	for i := 0; i < 12; i++ {
		id := primitive.NewObjectID()
		friendIDs[id.Hex()] = true
		friend := bson.M{"_id": id, "requester_id": "player-owner", "addressee_id": fmt.Sprintf("player-public-%d", i), "status": []string{"pending", "accepted", "blocked", "ignored"}[i%4], "created_at": now, "updated_at": now, "private_note": strings.Repeat("private-friend-", 50000)}
		if i%4 < 2 {
			friend["requester_id"] = fmt.Sprintf("player-public-%d", i)
			friend["addressee_id"] = "player-owner"
		}
		if _, err := db.friendships.InsertOne(ctx, friend); err != nil {
			t.Fatal(err)
		}
		auctionID := primitive.NewObjectID()
		marketIDs[auctionID.Hex()] = true
		auction := bson.M{"_id": auctionID, "id": fmt.Sprintf("public-auction-%d", i), "seller_id": "player-private-seller", "bidder_id": "player-private-bidder", "buyer_id": "player-private-buyer", "item": bson.M{"id": "public-item", "name": "Blade", "type": "WEAPON", "rarity": "Rare", "level": 30, "stack": 1, "stats": bson.M{"hidden": strings.Repeat("private-item-", 50000)}}, "bid": 100, "buyout": 1000, "deposit": 7, "sale_price": 1000, "status": "SOLD", "start_time": now, "end_time": now.Add(time.Hour), "seller_claimed": true, "item_claimed": true, "last_bid_operation_id": "private-replay", "pending_refunds": bson.A{bson.M{"player_id": "player-private-other", "amount": 999999, "id": "private-other-refund"}}}
		switch i % 4 {
		case 0:
			auction["seller_id"] = "player-owner"
		case 1:
			auction["bidder_id"] = "player-owner"
		case 2:
			auction["buyer_id"] = "player-owner"
		case 3:
			auction["pending_refunds"] = append(auction["pending_refunds"].(bson.A), bson.M{"player_id": "player-owner", "amount": 17, "id": "private-own-refund"})
		}
		if _, err := db.auctions.InsertOne(ctx, auction); err != nil {
			t.Fatal(err)
		}
	}
	for _, status := range []string{"blocked", "ignored"} {
		if _, err := db.friendships.InsertOne(ctx, bson.M{"requester_id": "player-private-other", "addressee_id": "player-owner", "status": status, "created_at": now, "updated_at": now}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.friendships.InsertOne(ctx, bson.M{"requester_id": "player-private-other", "addressee_id": "player-another", "status": "accepted", "created_at": now, "updated_at": now}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.auctions.InsertOne(ctx, bson.M{"id": "private-unrelated", "seller_id": "player-other", "bidder_id": "player-another", "buyer_id": "player-third"}); err != nil {
		t.Fatal(err)
	}
	read := func(section, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, "owner", "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: section, Before: before}, now, maximumOwnerExportResponse)
	}
	for _, section := range []string{"social", "market"} {
		before := ""
		seen := make(map[string]bool)
		for pageNumber := 0; pageNumber < 2; pageNumber++ {
			data, err := read(section, before)
			if err != nil || strings.Contains(string(data), "private-") {
				t.Fatal("owner summaries failed or disclosed private shared data", section, err)
			}
			var page struct {
				Coverage ownerExportCoverage `json:"coverage"`
				Entries  []json.RawMessage   `json:"entries"`
				Next     string              `json:"next"`
			}
			if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport {
				t.Fatal("invalid/inaccurate summary envelope")
			}
			want := 10
			if pageNumber == 1 {
				want = 2
			}
			if len(page.Entries) != want {
				t.Fatal("scope/page boundary lost")
			}
			for _, raw := range page.Entries {
				var key struct {
					ID primitive.ObjectID `json:"id"`
				}
				if json.Unmarshal(raw, &key) != nil || seen[key.ID.Hex()] {
					t.Fatal("duplicate/invalid summary ID")
				}
				seen[key.ID.Hex()] = true
				if section == "social" {
					if !friendIDs[key.ID.Hex()] {
						t.Fatal("another player's private choice exposed")
					}
				} else {
					if !marketIDs[key.ID.Hex()] {
						t.Fatal("unrelated market data exposed")
					}
					var entry ownerMarketEntry
					if json.Unmarshal(raw, &entry) != nil {
						t.Fatal("invalid market summary")
					}
					if !entry.Seller && (entry.SellerDeposit != nil || entry.SellerClaimed != nil) || !entry.Buyer && entry.ItemClaimed != nil {
						t.Fatal("another participant claim/deposit exposed")
					}
					for _, amount := range entry.OwnPendingRefunds {
						if amount != 17 {
							t.Fatal("another participant refund exposed")
						}
					}
				}
			}
			if pageNumber == 0 && page.Next == "" || pageNumber == 1 && page.Next != "" {
				t.Fatal("incorrect summary continuation")
			}
			before = page.Next
		}
		if len(seen) != 12 {
			t.Fatal("owner summary missing")
		}
	}
	oversizedID := primitive.NewObjectID()
	if _, err := db.auctions.InsertOne(ctx, bson.M{"_id": oversizedID, "id": "public-oversized", "seller_id": "player-owner", "item": bson.M{"id": "item", "name": strings.Repeat("x", 20<<10)}, "status": "ACTIVE", "start_time": now, "end_time": now.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("market", ""); err != errOwnerExportSection || data != nil {
		t.Fatal("oversized selected market source silently omitted")
	}
	if count, err := db.friendships.CountDocuments(ctx, bson.M{}); err != nil || count != 15 {
		t.Fatal("export altered relationship state")
	}
	if count, err := db.auctions.CountDocuments(ctx, bson.M{}); err != nil || count != 14 {
		t.Fatal("export altered escrow/refunds")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	for _, section := range []string{"social", "market"} {
		if data, err := read(section, oversizedID.Hex()); err != errOwnerExportSection || data != nil {
			t.Fatal("revoked approval read older summaries")
		}
	}
}
