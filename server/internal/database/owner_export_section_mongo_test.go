package database

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerExportSectionMongoProjectionAndSourceBudgets(t *testing.T) {
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
	// This uniquely named collection exists only in the owned disposable server.
	db.users = db.users.Database().Collection(uniqueID("owner-export"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	hash, err := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	item := bson.M{"id": "earned-item", "name": "Earned blade", "type": "WEAPON", "stats": bson.M{"strength": 17}}
	character := bson.M{"name": "My fighter", "class": "Fighter", "level": 30, "gold": 123, "inventory": bson.A{item}, "last_save_id": strings.Repeat("private-checkpoint-", 40000)}
	user := bson.M{"username": "owner", "public_name": "Owner", "email": "submitted@example.invalid", "password_hash": string(hash),
		"roles": bson.M{"admin": "private-staff-data"}, "password_recovery": bson.M{"digest": "private-token"},
		"characters": bson.A{character, bson.M{"name": "Other wizard", "inventory": bson.A{bson.M{"description": strings.Repeat("another-character-", 40000)}}}},
	}
	if _, err := db.users.InsertOne(ctx, user); err != nil {
		t.Fatal(err)
	}
	for _, section := range []string{"profile", "progress"} {
		name := ""
		if section == "progress" {
			name = "My fighter"
		}
		data, err := db.readOwnerExportSection(ctx, "owner", "synthetic owner proof", section, name, time.Now(), maximumOwnerExportResponse)
		if err != nil || !json.Valid(data) || strings.Contains(string(data), "private-") || strings.Contains(string(data), "another-character") {
			t.Fatal("bounded owner source failed or disclosed unrelated fields", section, err)
		}
		if section == "progress" {
			var view ownerProgressSnapshot
			if json.Unmarshal(data, &view) != nil || view.Character.Gold != 123 || len(view.Character.Inventory) != 1 || view.Character.Inventory[0].Stats["strength"] != 17 {
				t.Fatal("projection lost earned gameplay state")
			}
		}
	}
	for _, name := range []string{"Missing fighter", "Another owner's fighter"} {
		if result, err := db.readOwnerExportSection(ctx, "owner", "synthetic owner proof", "progress", name, time.Now(), maximumOwnerExportResponse); err != errOwnerExportSection || result != nil {
			t.Fatal("unknown character produced a partial snapshot")
		}
	}
	if _, err := db.users.UpdateOne(ctx, bson.M{"username": "owner"}, bson.M{"$set": bson.M{"public_name": strings.Repeat("x", 20<<10)}}); err != nil {
		t.Fatal(err)
	}
	if result, err := db.readOwnerExportSection(ctx, "owner", "synthetic owner proof", "profile", "", time.Now(), maximumOwnerExportResponse); err != errOwnerExportSection || result != nil {
		t.Fatal("profile input budget was not enforced by actual Mongo")
	}
	if _, err := db.users.UpdateOne(ctx, bson.M{"username": "owner"}, bson.M{"$set": bson.M{"characters.0.inventory.0.description": strings.Repeat("x", 280<<10)}}); err != nil {
		t.Fatal(err)
	}
	if result, err := db.readOwnerExportSection(ctx, "owner", "synthetic owner proof", "progress", "My fighter", time.Now(), maximumOwnerExportResponse); err != errOwnerExportSection || result != nil {
		t.Fatal("oversized inventory was silently truncated or unbounded")
	}
	// A failed export never modifies credentials, held items, other characters,
	// private receipts or the source that needs separate handling for its size.
	var retained bson.M
	if err := db.users.FindOne(ctx, bson.M{"username": "owner"}).Decode(&retained); err != nil || retained["password_hash"] != string(hash) {
		t.Fatal("source changed during export", err)
	}
	characters := retained["characters"].(bson.A)
	if len(characters) != 2 || characters[0].(bson.M)["last_save_id"] != character["last_save_id"] {
		t.Fatal("export changed private replay state or another character")
	}
}
