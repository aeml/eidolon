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
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerCasinoExportMongoClosedSelectionPagingAndNoExecution(t *testing.T) {
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
	db.users = base.Collection(uniqueID("casino-export-users"))
	db.reports = base.Collection(uniqueID("casino-export-cases"))
	db.blackjackTables = base.Collection(uniqueID("casino-export-tables"))
	t.Cleanup(func() {
		_ = db.blackjackTables.Drop(context.Background())
		_ = db.reports.Drop(context.Background())
		_ = db.users.Drop(context.Background())
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC().Truncate(time.Millisecond)
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": string(hash), "characters": bson.A{bson.M{"name": "owner", "gold": 123, "ep": 7, "ep_casino_receipts": bson.M{"private-wallet-receipt": 17}}}}); err != nil {
		t.Fatal(err)
	}
	originalUser, err := db.users.FindOne(ctx, bson.M{"username": "owner"}).DecodeBytes()
	if err != nil {
		t.Fatal(err)
	}
	originalUserHash := sha256.Sum256(originalUser)
	caseID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "username": "owner", "report_type": "Account Data Export", "export_approval": bson.M{"enabled": true, "revision": int64(1), "at": now}}); err != nil {
		t.Fatal(err)
	}
	expected := map[string]bool{}
	original := map[string][]byte{}
	for i, candidate := range ownerCasinoCandidates("owner") {
		own := candidate.Game == "slots" || i >= 4
		playerID := "player-owner"
		if !own {
			playerID = "player-other"
		}
		state := map[string]any{"phase": "playing", "roundId": "private-round", "timedOutSeats": map[string]string{"player-owner": "private-seat"}, "players": []any{map[string]any{"playerId": playerID, "name": "Participant", "seat": 1, "bet": 20, "buyIn": 100, "paid": false, "sessionId": "private-session"}, map[string]any{"playerId": "player-unrelated", "buyIn": "private-other-buyin", "cards": []string{"private-other-cards"}}}}
		if candidate.Game == "blackjack" || candidate.Game == "poker" {
			state["round"] = map[string]any{"currency": candidate.Currency, "deck": []string{"private-deck"}, "burns": []string{"private-burns"}, "dealer": []string{"private-hole"}, "players": []any{map[string]any{"playerId": playerID, "seat": 1, "stack": 80, "committed": 20, "cards": []int{3, 16}, "hands": []any{map[string]any{"cards": []int{1, 14}, "bet": 20, "payout": 50, "done": true, "outcome": "blackjack"}}}, map[string]any{"playerId": "player-unrelated", "cards": []string{"private-other-cards"}}}}
		} else if candidate.Game != "slots" {
			state["game"] = candidate.Game
			state["players"] = []any{map[string]any{"playerId": playerID, "seat": 1, "wagers": []any{map[string]any{"spot": "red", "amount": 20}}, "sessionId": "private-session"}}
		}
		if candidate.Game == "slots" {
			state = map[string]any{"owner": "player-owner", "session": map[string]any{"currency": candidate.Currency, "theme": candidate.Theme, "bet": 2, "freeSpins": 3, "bonus": true, "bonusOffers": []string{"private-offer"}, "last": map[string]any{"payout": 4, "bonusPicked": -1, "stages": []string{"private-stage"}}}, "owed": 4, "payment": "spin"}
		}
		body, err := json.Marshal(state)
		if err != nil {
			t.Fatal(err)
		}
		original[candidate.ID] = body
		pending := bson.M{"player_id": "player-other", "amount": "private-other-amount", "currency": "private-other-currency", "id": "private-transfer", "next_state": []byte(strings.Repeat("private-next-state-", 20000))}
		if candidate.Reference == "public-blackjack" {
			// Owner has a pending join but is not yet present in current state.
			pending["player_id"], pending["amount"], pending["currency"] = "player-owner", -20, "gold"
			own = true
		}
		if own {
			expected[candidate.Reference] = true
		}
		if _, err := db.blackjackTables.InsertOne(ctx, bson.M{"_id": candidate.ID, "version": int64(3), "state": body, "pending": pending, "last_transfer_id": "private-transfer", "last_accepted": true}); err != nil {
			t.Fatal(err)
		}
	}
	// A foreign owner's corrupt slot must not enter the closed selection.
	foreign := ownerCasinoCandidates("other")[29]
	if _, err := db.blackjackTables.InsertOne(ctx, bson.M{"_id": foreign.ID, "version": -1, "state": []byte(strings.Repeat("private-unrelated-", 20000))}); err != nil {
		t.Fatal(err)
	}
	checksum := func() string {
		cursor, err := db.blackjackTables.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
		if err != nil {
			t.Fatal(err)
		}
		defer cursor.Close(ctx)
		h, count := sha256.New(), 0
		for cursor.Next(ctx) {
			_, _ = h.Write(cursor.Current)
			count++
		}
		if cursor.Err() != nil || count != 38 {
			t.Fatal("fixture checksum/count failed", cursor.Err(), count)
		}
		return fmt.Sprintf("%x", h.Sum(nil))
	}
	initial := checksum()
	read := func(before string, budget int) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, "owner", "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: "casino", Before: before}, now, budget)
	}
	seen, before := map[string]bool{}, ""
	for pageNumber := 0; pageNumber < 4; pageNumber++ {
		data, err := read(before, maximumOwnerExportResponse)
		if err != nil || strings.Contains(string(data), "private-") || strings.Contains(string(data), "player-owner") || strings.Contains(string(data), "player-other") || strings.Contains(string(data), "bonusOffers") {
			t.Fatal("owner casino selection failed/leaked", err)
		}
		var page struct {
			Entries  []ownerCasinoEntry  `json:"entries"`
			Next     string              `json:"next"`
			Coverage ownerExportCoverage `json:"coverage"`
		}
		if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport {
			t.Fatal("invalid coverage envelope")
		}
		want := 10
		if pageNumber == 3 {
			want = 4
		}
		if len(page.Entries) != want {
			t.Fatal("casino entries lost", pageNumber, len(page.Entries))
		}
		previous := before
		for _, entry := range page.Entries {
			if !expected[entry.ID] || seen[entry.ID] || previous != "" && entry.ID >= previous {
				t.Fatal("duplicate/unowned/unordered casino entry")
			}
			seen[entry.ID], previous = true, entry.ID
			if entry.ID == "public-blackjack" && (entry.Pending == nil || entry.Pending.Amount != -20 || entry.Participant != nil || entry.RoundPlayer != nil) {
				t.Fatal("pending-only participation incorrect")
			}
			if entry.Game == "slots" && (entry.Slot == nil || entry.Slot.FreeSpins != 3 || !entry.Slot.Bonus || entry.RecordedOwed == nil || *entry.RecordedOwed != 4) {
				t.Fatal("own slot entitlement lost")
			}
			if (entry.Game == "baccarat" || entry.Game == "roulette") && (entry.Participant == nil || len(entry.Participant.Wagers) != 1) {
				t.Fatal("own house wagers lost")
			}
		}
		if pageNumber < 3 && (page.Next != previous || !ValidOwnerExportQuery(OwnerExportQuery{Section: "casino", Before: page.Next})) || pageNumber == 3 && page.Next != "" {
			t.Fatal("logical continuation incorrect")
		}
		before = page.Next
	}
	if len(seen) != len(expected) || checksum() != initial {
		t.Fatal("source omitted or casino state mutated")
	}
	if data, err := read("", 1); data != nil || err != errOwnerExportSection || checksum() != initial {
		t.Fatal("budget failure changed casino state")
	}
	for _, body := range [][]byte{[]byte(strings.Repeat("x", 270<<10)), []byte(`null`)} {
		if _, err := db.blackjackTables.UpdateOne(ctx, bson.M{"_id": "public-blackjack-earth"}, bson.M{"$set": bson.M{"state": body}}); err != nil {
			t.Fatal(err)
		}
		invalidChecksum := checksum()
		if data, err := read("", maximumOwnerExportResponse); data != nil || err != errOwnerExportSection || checksum() != invalidChecksum {
			t.Fatal("known malformed unowned source silently omitted or mutated")
		}
	}
	if _, err := db.blackjackTables.UpdateOne(ctx, bson.M{"_id": "public-blackjack-earth"}, bson.M{"$set": bson.M{"state": original["public-blackjack-earth"]}}); err != nil || checksum() != initial {
		t.Fatal("fixture restoration failed", err)
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("", maximumOwnerExportResponse); data != nil || err != errOwnerExportSection || checksum() != initial {
		t.Fatal("revocation failed or casino state mutated")
	}
	finalUser, err := db.users.FindOne(ctx, bson.M{"username": "owner"}).DecodeBytes()
	if err != nil || sha256.Sum256(finalUser) != originalUserHash {
		t.Fatal("export changed character balances, receipts or account state", err)
	}
}
