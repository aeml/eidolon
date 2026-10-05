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
)

func TestRemovalReviewMongoPresenceCaseFencesAndSourceIntegrity(t *testing.T) {
	uri := os.Getenv("EIDOLON_OWNER_EXPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable review Mongo required")
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
	all := []*mongo.Collection{}
	collection := func(name string) *mongo.Collection {
		result := base.Collection(uniqueID("removal-review-" + name))
		all = append(all, result)
		return result
	}
	db.users, db.reports = collection("users"), collection("reports")
	db.auctions, db.auctionBids, db.directTradeOperations = collection("auctions"), collection("auction-intents"), collection("trades")
	db.guilds, db.guildInvites, db.guildBankOperations = collection("guilds"), collection("invites"), collection("bank")
	db.groundItemOperations, db.dungeonRoomRewards, db.bossVictories = collection("ground"), collection("rooms"), collection("bosses")
	db.raidLockouts, db.adminOperations, db.friendships = collection("raids"), collection("admin"), collection("friends")
	db.pvpProfiles, db.blackjackTables = collection("pvp"), collection("casino")
	t.Cleanup(func() {
		for _, col := range all {
			_ = col.Drop(context.Background())
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	caseID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "username": "owner", "report_type": "Account Removal Request", "status": "open",
		"text": strings.Repeat("private-case-", 10000), "review_receipts": bson.M{"private": strings.Repeat("private-reason-", 10000)}}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": "private-hash", "characters": bson.A{bson.M{"name": "hero", "gold": 123, "ep": 7, "ep_casino_receipts": bson.M{"private-replay": 17}}}}); err != nil {
		t.Fatal(err)
	}
	for _, source := range db.removalReferenceSources("owner") {
		if _, err := source.Collection.InsertOne(ctx, bson.M{"_id": "foreign", "username": "other", "player_id": "player-other", "target": "other", "participants": bson.A{bson.M{"username": "other"}},
			"members": bson.A{bson.M{"player_id": "player-other"}}, "requester_id": "player-other", "addressee_id": "player-unrelated", "private_payload": []byte(strings.Repeat("private-foreign-", 10000))}); err != nil {
			t.Fatal(err)
		}
	}
	query := RemovalReviewQuery{ReportID: caseID.Hex(), ExpectedStatus: "open"}
	result, err := db.ReadRemovalReview(query)
	if err != nil || !result.AccountPresent || result.RemovalSupported || result.RemovalAuthorized || len(result.References) != 14 || len(result.RequiredReview) != 6 {
		t.Fatal("empty dependency view failed", err)
	}
	for _, check := range result.References {
		if check.ReferencePresent {
			t.Fatal("foreign reference treated as owner match", check.Source)
		}
	}
	rows := map[*mongo.Collection]bson.M{
		db.auctions: {"seller_id": "player-owner"}, db.auctionBids: {"player_id": "player-owner"},
		db.directTradeOperations: {"participants": bson.A{bson.M{"username": "owner"}, bson.M{"username": "other"}}},
		db.guilds:                {"members": bson.A{bson.M{"player_id": "player-owner"}}}, db.guildInvites: {"target_id": "player-owner"},
		db.guildBankOperations: {"username": "owner"}, db.groundItemOperations: {"username": "owner"},
		db.dungeonRoomRewards: {"participants": bson.A{bson.M{"username": "owner"}}}, db.bossVictories: {"participants": bson.A{bson.M{"username": "owner"}}},
		db.raidLockouts: {"player_id": "player-owner"}, db.adminOperations: {"target": "owner"}, db.friendships: {"addressee_id": "player-owner"},
		db.pvpProfiles: {"player_id": "player-owner"}, db.blackjackTables: {"_id": "public-blackjack", "state": []byte(`{"players":[{"playerId":"player-other"}]}`)},
	}
	for col, row := range rows {
		if row["_id"] == nil {
			row["_id"] = "own"
		}
		row["private_payload"] = []byte(strings.Repeat("private-intent-", 20000))
		if _, err := col.InsertOne(ctx, row); err != nil {
			t.Fatal(err)
		}
	}
	checksum := func() string {
		h := sha256.New()
		count := 0
		for _, col := range all {
			_, _ = h.Write([]byte(col.Name()))
			cursor, err := col.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
			if err != nil {
				t.Fatal(err)
			}
			for cursor.Next(ctx) {
				_, _ = h.Write(cursor.Current)
				count++
			}
			if cursor.Err() != nil {
				t.Fatal(cursor.Err())
			}
			_ = cursor.Close(ctx)
		}
		if count != 30 {
			t.Fatal("source fixture rows changed", count)
		}
		return fmt.Sprintf("%x", h.Sum(nil))
	}
	initial := checksum()
	result, err = db.ReadRemovalReview(query)
	if err != nil || result.RemovalAuthorized || result.RemovalSupported || result.CheckedAt.IsZero() {
		t.Fatal("read-only snapshot failed", err)
	}
	for _, check := range result.References {
		if !check.ReferencePresent {
			t.Fatal("own reference lost", check.Source)
		}
	}
	data, _ := json.Marshal(result)
	if strings.Contains(string(data), "private-") || checksum() != initial {
		t.Fatal("raw private state leaked or custody changed")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"status": "resolved", "review_revision": int64(1)}}); err != nil {
		t.Fatal(err)
	}
	changed := checksum()
	if result, err := db.ReadRemovalReview(query); err != ErrRemovalReviewUnavailable || result.ReportID != "" || checksum() != changed {
		t.Fatal("stale quote delivered or mutated sources")
	}
	query.ExpectedStatus, query.ExpectedRevision = "resolved", 1
	if result, err := db.ReadRemovalReview(query); err != nil || result.RemovalAuthorized || result.RemovalSupported || checksum() != changed {
		t.Fatal("resolution became erasure authority", err)
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"username": strings.Repeat("x", 2048)}}); err != nil {
		t.Fatal(err)
	}
	oversized := checksum()
	if result, err := db.ReadRemovalReview(query); err != ErrRemovalReviewUnavailable || result.ReportID != "" || checksum() != oversized {
		t.Fatal("oversized case selector silently accepted")
	}
	// Existing journal commits are update-only. This scoped check does not prove
	// permanent removal fences or protection against an older archive/registration.
	if err := db.CommitCharacterSave("never-existed", &Character{Name: "old-journal", Gold: 999}, strings.Repeat("a", 32)); err == nil || checksum() != oversized {
		t.Fatal("journal commit created missing account")
	}
}
