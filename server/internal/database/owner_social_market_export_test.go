package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerSocialMarketExportProjectionResetAndPrivateChoices(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Now()
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, kind := range []string{"social", "market"} {
		for _, scenario := range []string{"valid", "wrong-owner", "oversized", "reset-after-read", "empty", "private-or-invalid"} {
			mt.Run(kind+"/"+scenario, func(mt *mtest.T) {
				ns := mt.DB.Name() + "." + mt.Coll.Name()
				proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
				id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
				row := bson.M{"_id": id, "requester_id": "player-owner", "addressee_id": "player-public-counterpart", "status": "blocked", "created_at": now, "updated_at": now}
				if kind == "market" {
					row = bson.M{"_id": id, "id": "public-auction", "seller_id": "player-private-seller", "bidder_id": "player-owner", "buyer_id": "player-private-buyer", "item": bson.M{"id": "item-public", "name": "Blade"}, "bid": 17, "status": "ACTIVE", "start_time": now, "end_time": now.Add(time.Hour), "deposit": 3, "seller_claimed": true, "item_claimed": true}
				}
				if scenario == "wrong-owner" {
					if kind == "social" {
						row["requester_id"] = "player-other"
					} else {
						row["bidder_id"] = "player-other"
					}
				}
				if scenario == "private-or-invalid" {
					if kind == "social" {
						row["requester_id"] = "player-other"
						row["addressee_id"] = "player-owner"
					} else {
						row["bid"] = -1
					}
				}
				page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: row}})
				if scenario == "empty" {
					page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				last := proof
				if scenario == "reset-after-read" {
					last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				mt.AddMockResponses(proof, page, last)
				db := &DB{users: mt.Coll, friendships: mt.Coll, auctions: mt.Coll}
				data, err := db.readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: kind, Before: "0123456789abcdef01234565"}, now, maximumOwnerExportResponse)
				if scenario == "valid" || scenario == "empty" {
					if err != nil || !json.Valid(data) || strings.Contains(string(data), "private-") {
						mt.Fatal("owner summary failed or disclosed private counterpart", err)
					}
					if kind == "market" && (strings.Contains(string(data), "seller_deposit") || strings.Contains(string(data), "own_item_claimed") || strings.Contains(string(data), "seller_payout_claimed")) {
						mt.Fatal("another participant claim/deposit exposed")
					}
				} else if err != errOwnerExportSection || data != nil {
					mt.Fatal("invalid/private/reset row delivered partial data")
				}
				events := mt.GetAllStartedEvents()
				command := events[1].Command
				stages, _ := command.Lookup("pipeline").Array().Values()
				if command.Lookup("maxTimeMS").Int64() != 3000 || command.Lookup("cursor").Document().Lookup("batchSize").Int32() != 11 || stages[2].Document().Lookup("$limit").Int32() != 11 || stages[0].Document().Lookup("$match").Document().Lookup("_id").Document().Lookup("$lt").ObjectID().Hex() != "0123456789abcdef01234565" {
					mt.Fatal("query deadline/page/keyset bound lost")
				}
				projection := stages[3].Document().Lookup("$project").Document()
				for _, field := range []string{"private_note", "last_bid_operation_id", "seller_name", "bidder_name", "pending_refunds", "item.stats"} {
					if projection.Lookup(field).Type != 0 {
						mt.Fatal("private/raw source projection widened")
					}
				}
			})
		}
	}
	for _, source := range []any{ownerFriendSource{RequesterID: "private-account"}, ownerMarketSource{SellerID: "private-account"}} {
		encoded, err := json.Marshal(source)
		if err != nil || string(encoded) != "{}" {
			t.Fatal("source DTO became a public export")
		}
	}
}
