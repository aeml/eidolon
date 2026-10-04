package main

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Real indexed paging and production TradingSystem startup, not a campaign,
// network session, auction settlement or peak-memory capacity benchmark.
func TestAuctionStartupActualMongoPagesAndLateInvalidIntent(t *testing.T) {
	uri := os.Getenv("EIDOLON_PERSISTENCE_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" || !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 25*time.Second)
	defer cancel()
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	market := client.Database("eidolon").Collection("auctions")
	intents := client.Database("eidolon").Collection("auction_bid_operations")
	prefix := fmt.Sprintf("market-pages-%d", time.Now().UnixNano())
	const count = 151
	auctionIDs, operationIDs := make([]string, 0, count), make([]string, 0, count+1)
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		for _, target := range []struct {
			collection *mongo.Collection
			ids        []string
		}{{market, auctionIDs}, {intents, operationIDs}} {
			if len(target.ids) > 0 {
				if _, err := target.collection.DeleteMany(cleanupCtx, bson.M{"id": bson.M{"$in": target.ids}}); err != nil {
					t.Error(err)
				}
			}
		}
	})
	now := time.Now().UTC().Truncate(time.Millisecond)
	auctionRows, operationRows := make([]any, 0, count), make([]any, 0, count+1)
	want := make(map[string]database.AuctionBidOperation)
	for i := 0; i < count; i++ {
		id := fmt.Sprintf("%s-%04d", prefix, i)
		op := database.AuctionBidOperation{ID: id + "-decision", AuctionID: id, PlayerID: "player-" + prefix,
			CharacterName: prefix, Kind: database.AuctionOperationSellerPayout, Amount: 43, Fee: 1, EndTime: now}
		a := database.Auction{ID: id, SellerID: op.PlayerID, SellerName: prefix, Status: "SOLD", ItemClaimed: true,
			LastBidOperationID: "original-" + id, Item: database.Item{ID: "earned-" + id, Potency: 3, Stack: 1, MaxStack: 1, Stats: map[string]int{"strength": 17}, StatScaleVersion: game.ItemStatScaleVersion},
			PendingRefunds: []database.AuctionRefund{{ID: id + "-refund", PlayerID: op.PlayerID, CharacterName: prefix, Amount: 17}}}
		if i == 0 {
			a.Item.StatScaleVersion = 0
			a.Item.Stats["strength"] = 100
		}
		auctionIDs, operationIDs = append(auctionIDs, id), append(operationIDs, op.ID)
		auctionRows, operationRows = append(auctionRows, a), append(operationRows, op)
		want[id] = op
	}
	listing := database.AuctionBidOperation{ID: prefix + "-z-unpublished", AuctionID: prefix + "-z-new-listing", PlayerID: "player-" + prefix,
		CharacterName: prefix, Kind: database.AuctionOperationListing, Amount: 1, ListingBid: 10, ListingBuyout: 20, ListingHours: 24,
		ListingStart: now, EndTime: now.Add(24 * time.Hour), ItemPayload: `{"id":"earned-unpublished","stack":1,"maxStack":1}`}
	operationIDs, operationRows = append(operationIDs, listing.ID), append(operationRows, listing)
	want[listing.AuctionID] = listing
	if _, err := market.InsertMany(ctx, auctionRows); err != nil {
		t.Fatal(err)
	}
	if _, err := intents.InsertMany(ctx, operationRows); err != nil {
		t.Fatal(err)
	}
	for restart := 0; restart < 2; restart++ {
		started := time.Now()
		trading := game.NewTradingSystem(repo)
		if trading.ReadinessError() != nil || len(trading.Auctions) != count {
			t.Fatal("actual paged startup lost market state", trading.ReadinessError())
		}
		pending := trading.PendingBidOperations("player-" + prefix)
		if len(pending) != len(want) {
			t.Fatal("actual startup lost late pending listing or payout", len(pending))
		}
		for _, op := range pending {
			if !reflect.DeepEqual(op, want[op.AuctionID]) {
				t.Fatal("actual startup changed frozen intent", op.ID)
			}
		}
		for i, id := range auctionIDs {
			a := trading.Auctions[id]
			wantStrength := 17
			if i == 0 {
				wantStrength = 4 // Existing pre-squish normalization, not a paging migration.
			}
			if a.Status != game.AuctionSold || !a.ItemClaimed || a.SellerClaimed || a.LastBidOperationID != "original-"+id ||
				a.Item.Potency != 3 || a.Item.Stats["strength"] != wantStrength || len(a.PendingRefunds) != 1 || a.PendingRefunds[0].Amount != 17 {
				t.Fatal("actual startup changed saved claim, metadata or refund", id)
			}
		}
		t.Logf("startup=%d auctions=%d decisions=%d pageLimit=%d elapsed=%s", restart, len(trading.Auctions), len(pending), database.AuctionRecoveryPageSize, time.Since(started))
	}
	var legacy database.Auction
	if err := market.FindOne(ctx, bson.M{"id": auctionIDs[0]}).Decode(&legacy); err != nil || legacy.Item.StatScaleVersion != 0 || legacy.Item.Stats["strength"] != 100 {
		t.Fatal("read-only paged startup rewrote legacy stored equipment", err)
	}
	// The invalid decision sorts beyond three complete pages. Do not publish the
	// preceding valid decisions as a ready partial ledger, or repair/delete it.
	if _, err := intents.UpdateOne(ctx, bson.M{"id": listing.ID}, bson.M{"$set": bson.M{"kind": "future-invalid"}}); err != nil {
		t.Fatal(err)
	}
	failed := game.NewTradingSystem(repo)
	if failed.ReadinessError() == nil || failed.RetryPendingRefunds() == nil || len(failed.PendingBidOperations("")) != 0 {
		t.Fatal("late invalid stored intent produced a ready partial market")
	}
	var retained database.AuctionBidOperation
	if err := intents.FindOne(ctx, bson.M{"id": listing.ID}).Decode(&retained); err != nil || retained.Kind != "future-invalid" || retained.ItemPayload != listing.ItemPayload {
		t.Fatal("rejected intent evidence was changed or removed", err)
	}
}
