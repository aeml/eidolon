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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerSessionExportMongoRetentionDigestAndAccountProjection(t *testing.T) {
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
	db.users = db.users.Database().Collection(uniqueID("session-export-users"))
	db.reports = db.reports.Database().Collection(uniqueID("session-export-cases"))
	db.adminActivity = db.adminActivity.Database().Collection(uniqueID("session-export-activity"))
	db.adminActivityRetentionDays = 90
	t.Cleanup(func() {
		_ = db.users.Drop(context.Background())
		_ = db.reports.Drop(context.Background())
		_ = db.adminActivity.Drop(context.Background())
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	now := time.Now().UTC().Truncate(time.Millisecond)
	owner := "legacy\nowner"
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	period, _ := NewVIPPeriod(now.Add(-24*time.Hour), now.Add(29*24*time.Hour))
	if _, err := db.users.InsertOne(ctx, bson.M{"username": owner, "password_hash": string(hash), "vip_periods": bson.A{bson.M{"id": period.ID, "starts_at": period.StartsAt, "ends_at": period.EndsAt, "revoked": false, "private_provider": strings.Repeat("private-provider-", 60000)}},
		"characters":      bson.A{bson.M{"name": "My fighter", "class": "Fighter", "level": 30, "inventory": bson.A{bson.M{"description": strings.Repeat("private-item-", 60000)}}}},
		"chat_moderation": bson.M{"mute": bson.M{"id": strings.Repeat("a", 64), "started_at": now.Add(-time.Minute), "expires_at": now.Add(time.Minute), "reason": "Owner-visible public reason"}, "receipts": bson.M{"hidden": strings.Repeat("private-staff-", 60000)}}}); err != nil {
		t.Fatal(err)
	}
	caseID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": caseID, "username": owner, "report_type": "Account Data Export", "export_approval": bson.M{"enabled": true, "revision": int64(1), "at": now}}); err != nil {
		t.Fatal(err)
	}
	expected := make(map[string]bool)
	for i := 0; i < 12; i++ {
		id := primitive.NewObjectID()
		expected[id.Hex()] = true
		entry := bson.M{"_id": id, "actor": AdminActivityAccountKey(owner), "target": "", "at": now.Add(-time.Hour), "expires_at": now.Add(24 * time.Hour), "action": "disconnect", "result": "success", "reason": strings.Repeat("private-reason-", 60000), "summary": "private-summary", "request_id": "private-correlation"}
		if i%2 == 0 {
			entry["session_started_at"] = now.Add(-2 * time.Hour)
		}
		if _, err := db.adminActivity.InsertOne(ctx, entry); err != nil {
			t.Fatal(err)
		}
	}
	for _, variant := range []string{"other-account", "expired", "outside-retention", "staff-action", "future-event", "target-other"} {
		entry := bson.M{"actor": AdminActivityAccountKey(owner), "target": "", "at": now.Add(-time.Hour), "expires_at": now.Add(time.Hour), "action": "login", "result": "success", "reason": "private-filtered"}
		switch variant {
		case "other-account":
			entry["actor"] = "other"
		case "expired":
			entry["expires_at"] = now
		case "outside-retention":
			entry["at"] = now.Add(-91 * 24 * time.Hour)
		case "staff-action":
			entry["action"] = "admin_grant_gold"
		case "future-event":
			entry["at"] = now.Add(time.Hour)
		case "target-other":
			entry["target"] = "other"
		}
		if _, err := db.adminActivity.InsertOne(ctx, entry); err != nil {
			t.Fatal(err)
		}
	}
	read := func(section, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, owner, "synthetic owner proof", caseID.Hex(), 1, OwnerExportQuery{Section: section, Before: before}, now, maximumOwnerExportResponse)
	}
	profile, err := read("profile", "")
	if err != nil || strings.Contains(string(profile), "private-") {
		t.Fatal("account projection failed or disclosed private data", err)
	}
	var account ownerProfileSnapshot
	if json.Unmarshal(profile, &account) != nil || len(account.Profile.VIPPeriods) != 1 || len(account.Profile.Characters) != 1 || account.Profile.Characters[0].Name != "My fighter" || len(account.Profile.ModerationNotices) != 1 || account.Profile.ModerationNotices[0].PublicReason != "Owner-visible public reason" {
		t.Fatal("Mongo projection lost account-level owner fields")
	}
	before := ""
	seen := make(map[string]bool)
	for pageNumber := 0; pageNumber < 2; pageNumber++ {
		data, err := read("sessions", before)
		if err != nil || strings.Contains(string(data), "private-") || strings.Contains(string(data), "sha256:") {
			t.Fatal("retained owner history failed or leaked metadata", err)
		}
		var page ownerSessionSnapshot
		if json.Unmarshal(data, &page) != nil || page.RetentionDays != 90 || !page.Cutoff.Equal(now.Add(-90*24*time.Hour)) || page.Coverage.CompleteAccountExport {
			t.Fatal("retention/coverage envelope incorrect")
		}
		want := 10
		if pageNumber == 1 {
			want = 2
		}
		if len(page.Entries) != want {
			t.Fatal("retention filter or page bound lost")
		}
		for _, entry := range page.Entries {
			key := entry.ID.Hex()
			if !expected[key] || seen[key] {
				t.Fatal("other/expired/staff entry or duplicate returned")
			}
			seen[key] = true
		}
		if pageNumber == 0 && page.Next == "" || pageNumber == 1 && page.Next != "" {
			t.Fatal("incorrect session page continuation")
		}
		before = page.Next
	}
	if len(seen) != 12 {
		t.Fatal("owner history missing")
	}
	oversized := primitive.NewObjectID()
	if _, err := db.adminActivity.InsertOne(ctx, bson.M{"_id": oversized, "actor": AdminActivityAccountKey(owner), "target": "", "at": now.Add(-time.Hour), "expires_at": now.Add(time.Hour), "action": "login", "result": strings.Repeat("x", 3000)}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("sessions", ""); err != errOwnerExportSection || data != nil {
		t.Fatal("oversized selected record omitted or partially returned")
	}
	if count, err := db.adminActivity.CountDocuments(ctx, bson.M{}); err != nil || count != 19 {
		t.Fatal("export changed retained source history")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("sessions", oversized.Hex()); err != errOwnerExportSection || data != nil {
		t.Fatal("revoked approval read older sessions")
	}
}
