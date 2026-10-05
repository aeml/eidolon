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

func TestOwnerOperationExportMongoProjectionPagingAndCustodyUnchanged(t *testing.T) {
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
	db.users = base.Collection(uniqueID("operation-export-users"))
	db.reports = base.Collection(uniqueID("operation-export-cases"))
	db.directTradeOperations = base.Collection(uniqueID("operation-export-trades"))
	db.guildBankOperations = base.Collection(uniqueID("operation-export-bank"))
	collections := []*mongo.Collection{db.users, db.reports, db.directTradeOperations, db.guildBankOperations}
	t.Cleanup(func() {
		for _, collection := range collections {
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
	expected := map[string]map[string]bool{"trades": {}, "bank": {}}
	for i := 0; i < 12; i++ {
		tradeID := DirectTradeOperationID(fmt.Sprintf("synthetic-trade-%d", i))
		bankID := GuildBankOperationID("owner", fmt.Sprintf("synthetic-bank-%d", i))
		expected["trades"][strings.TrimPrefix(tradeID, "directtrade:")] = true
		expected["bank"][strings.TrimPrefix(bankID, "guildbank:")] = true
		decision := DirectTradeSettle
		peerPayload := `{"gold":3,"items":[{"id":"incoming","stack":1,"stats":{"dexterity":5},"privateCustody":"private-peer-item"}]}`
		if i%2 == 0 {
			decision = DirectTradeCancel
			peerPayload = strings.Repeat("private-peer-canceled-", 10000)
		}
		trade := bson.M{"_id": tradeID, "version": 1, "decision": decision, "state": DirectTradeComplete, "created_at": now,
			"participants": bson.A{bson.M{"username": "owner", "player_id": "player-owner", "character_name": "Owner Hero", "expected_revision": 9, "offer_payload": `{"gold":7,"items":[{"id":"outgoing","stack":1,"potency":4,"stats":{"strength":9},"forgeBasis":{"private":"private-owner-basis"}}]}`}, bson.M{"username": "private-peer-account", "player_id": "player-peer", "character_name": "private-peer-character", "offer_payload": peerPayload, "expected_revision": 777}},
			"fingerprint":  "private-fingerprint", "trade_id": "private-trade-id", "private_execution": strings.Repeat("private-execution-", 10000)}
		if i%3 == 0 {
			trade["state"] = DirectTradePending
		}
		if _, err := db.directTradeOperations.InsertOne(ctx, trade); err != nil {
			t.Fatal(err)
		}
		bank := bson.M{"_id": bankID, "version": 1, "username": "owner", "player_id": "player-owner", "character_name": "Owner Hero", "guild_id": "public-guild", "action": GuildBankDepositItem, "gold": 0, "item_payload": `{"id":"bank-earned","stack":1,"stats":{"wisdom":8},"privateReplay":"private-bank-item"}`, "created_at": now, "state": GuildBankComplete, "request_id": "private-request", "fingerprint": "private-fingerprint", "guild_version": 77, "character_bank_revision": 99, "private_execution": strings.Repeat("private-bank-execution-", 10000)}
		if i%3 == 0 {
			bank["state"] = GuildBankPending
		}
		if i%3 == 1 {
			bank["state"] = GuildBankRejected
			bank["action"] = GuildBankWithdrawGold
			bank["gold"] = 17
			bank["item_payload"] = ""
		}
		if _, err := db.guildBankOperations.InsertOne(ctx, bank); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.directTradeOperations.InsertOne(ctx, bson.M{"_id": DirectTradeOperationID("unrelated"), "participants": bson.A{bson.M{"username": "private-other-account"}}, "private_execution": strings.Repeat("private-unrelated-", 10000)}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.guildBankOperations.InsertOne(ctx, bson.M{"_id": GuildBankOperationID("other", "unrelated"), "username": "other", "private_execution": "private-unrelated"}); err != nil {
		t.Fatal(err)
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
			t.Fatal("fixture read/count failed", cursor.Err(), count)
		}
		return fmt.Sprintf("%x", h.Sum(nil))
	}
	initialTrades, initialBank := checksum(db.directTradeOperations), checksum(db.guildBankOperations)
	read := func(section, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, "owner", "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: section, Before: before}, now, maximumOwnerExportResponse)
	}
	for _, section := range []string{"trades", "bank"} {
		seen := map[string]bool{}
		before := ""
		for pageNumber := 0; pageNumber < 2; pageNumber++ {
			data, err := read(section, before)
			if err != nil {
				t.Fatal("actual owner operation read failed", section, err)
			}
			for _, private := range []string{"private-peer-", "private-owner-basis", "private-bank-item", "private-fingerprint", "private-request", "private-trade-id", "private-execution", "private-unrelated", `"offer_payload"`, `"expected_revision"`} {
				if strings.Contains(string(data), private) {
					t.Fatal("private operation data leaked", section, private)
				}
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
				t.Fatal("operation page lost rows", section, len(page.Entries))
			}
			for _, raw := range page.Entries {
				var key struct {
					Reference string `json:"reference"`
				}
				if json.Unmarshal(raw, &key) != nil || !expected[section][key.Reference] || seen[key.Reference] {
					t.Fatal("unrelated/duplicate operation")
				}
				seen[key.Reference] = true
				if section == "trades" {
					var entry ownerTradeEntry
					if json.Unmarshal(raw, &entry) != nil || entry.OwnOffer.Gold != 7 || entry.OwnOffer.Items[0].Stats["strength"] != 9 || entry.OwnOffer.Items[0].Potency != 4 {
						t.Fatal("own offer fields lost")
					}
					if entry.Decision == DirectTradeCancel && entry.AgreedIncoming != nil {
						t.Fatal("canceled peer plan exposed")
					}
					if entry.Decision == DirectTradeSettle && (entry.AgreedIncoming == nil || entry.AgreedIncoming.Gold != 3 || entry.AgreedIncoming.Items[0].Stats["dexterity"] != 5) {
						t.Fatal("agreed incoming offer lost")
					}
				} else {
					var entry ownerBankEntry
					if json.Unmarshal(raw, &entry) != nil {
						t.Fatal("bank decode failed")
					}
					if entry.Action == GuildBankDepositItem && (entry.Item == nil || entry.Item.Stats["wisdom"] != 8) {
						t.Fatal("own bank item lost")
					}
					if entry.Action == GuildBankWithdrawGold && (entry.Gold != 17 || entry.Item != nil) {
						t.Fatal("own Gold intent lost")
					}
				}
			}
			if pageNumber == 0 && (!ownerOperationCursorPattern.MatchString(page.Next) || before != "" && page.Next >= before) || pageNumber == 1 && page.Next != "" {
				t.Fatal("keyset continuation invalid")
			}
			before = page.Next
		}
		if len(seen) != 12 {
			t.Fatal("same-time operation pagination omitted rows")
		}
	}
	if checksum(db.directTradeOperations) != initialTrades || checksum(db.guildBankOperations) != initialBank {
		t.Fatal("owner reads changed custody/replay records")
	}
	for _, section := range []string{"trades", "bank"} {
		collection := db.directTradeOperations
		limit := 274 << 10
		bad := bson.M{"_id": ownerOperationPrefix(section) + strings.Repeat("f", 64), "version": 1, "state": "complete", "created_at": now}
		if section == "trades" {
			bad["decision"] = "cancel"
			bad["participants"] = bson.A{bson.M{"username": "owner", "player_id": "player-owner", "character_name": "Owner Hero", "offer_payload": strings.Repeat("x", limit)}, bson.M{"username": "other"}}
		} else {
			collection = db.guildBankOperations
			bad["username"] = "owner"
			bad["player_id"] = "player-owner"
			bad["character_name"] = "Owner Hero"
			bad["guild_id"] = "guild"
			bad["action"] = GuildBankDepositItem
			bad["item_payload"] = strings.Repeat("x", 74<<10)
		}
		if _, err := collection.InsertOne(ctx, bad); err != nil {
			t.Fatal(err)
		}
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil {
			t.Fatal("oversized owned operation silently omitted")
		}
		if _, err := collection.DeleteOne(ctx, bson.M{"_id": bad["_id"]}); err != nil {
			t.Fatal(err)
		}
	}
	if checksum(db.directTradeOperations) != initialTrades || checksum(db.guildBankOperations) != initialBank {
		t.Fatal("failure path changed custody/replay records")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	for _, section := range []string{"trades", "bank"} {
		if data, err := read(section, ""); err != errOwnerExportSection || data != nil {
			t.Fatal("revoked operation export still readable", err)
		}
	}
	if checksum(db.directTradeOperations) != initialTrades || checksum(db.guildBankOperations) != initialBank {
		t.Fatal("revocation changed economic source")
	}
}
