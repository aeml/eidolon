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

func TestOwnerReportExportMongoBoundedPagesAndRedaction(t *testing.T) {
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
	db.users = db.users.Database().Collection(uniqueID("report-export-users"))
	db.reports = db.reports.Database().Collection(uniqueID("report-export-reports"))
	t.Cleanup(func() { _ = db.users.Drop(context.Background()); _ = db.reports.Drop(context.Background()) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": string(hash)}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "other", "password_hash": string(hash)}); err != nil {
		t.Fatal(err)
	}
	ids := make(map[string]bool)
	var caseID primitive.ObjectID
	for i := 0; i < 25; i++ {
		id := primitive.NewObjectID()
		ids[id.Hex()] = true
		entry := bson.M{"_id": id, "username": "owner", "report_type": "Bug Report", "text": "My authored submission", "status": "open", "created_at": time.Now(), "review": bson.M{"reason": strings.Repeat("private-staff-note-", 60000)}, "export_approval_receipts": bson.M{"private-nonce": "private-receipt"}}
		if i == 0 {
			caseID = id
			entry["report_type"] = "Account Data Export"
			entry["export_approval"] = bson.M{"enabled": true, "revision": int64(1), "at": time.Now(), "reason": "private-approval-reason"}
		}
		if _, err := db.reports.InsertOne(ctx, entry); err != nil {
			t.Fatal(err)
		}
		if _, err := db.reports.InsertOne(ctx, bson.M{"username": "other", "report_type": "Bug Report", "text": "another-owner-private-text", "status": "open", "created_at": time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	read := func(owner, password, before string) ([]byte, error) {
		return db.ReadApprovedOwnerExportQuery(ctx, owner, password, caseID.Hex(), 1, OwnerExportQuery{Section: "reports", Before: before}, time.Now(), maximumOwnerExportResponse)
	}
	seen := make(map[string]bool)
	before := ""
	for pageNumber := 0; pageNumber < 3; pageNumber++ {
		data, err := read("owner", "synthetic owner proof", before)
		if err != nil || strings.Contains(string(data), "private-") {
			t.Fatal("owner page failed or disclosed staff/other-owner data", err)
		}
		var page ownerReportSnapshot
		if json.Unmarshal(data, &page) != nil || page.Coverage.CompleteAccountExport || page.Format != "eidolon-owner-report-submissions" {
			t.Fatal("incorrect page envelope/coverage")
		}
		want := 10
		if pageNumber == 2 {
			want = 5
		}
		if len(page.Reports) != want {
			t.Fatal("source pages skipped or repeated entries")
		}
		for _, entry := range page.Reports {
			id := entry.ID.Hex()
			if !ids[id] || seen[id] || entry.Text != "My authored submission" {
				t.Fatal("cross-owner, duplicate or lost authored text")
			}
			seen[id] = true
		}
		if pageNumber < 2 && page.Next != page.Reports[len(page.Reports)-1].ID.Hex() {
			t.Fatal("incorrect keyset continuation")
		}
		if pageNumber == 2 && page.Next != "" {
			t.Fatal("invented extra page")
		}
		before = page.Next
	}
	if len(seen) != 25 {
		t.Fatal("missing owner submissions")
	}
	for _, sample := range []struct{ owner, password string }{{"other", "synthetic owner proof"}, {"owner", "wrong"}} {
		if data, err := read(sample.owner, sample.password, ""); err != errOwnerExportSection || data != nil {
			t.Fatal("owner/proof boundary admitted another account")
		}
	}
	// An oversized projection is a bounded sentinel, not a silently omitted row.
	oversizedID := primitive.NewObjectID()
	if _, err := db.reports.InsertOne(ctx, bson.M{"_id": oversizedID, "username": "owner", "report_type": "Bug Report", "text": strings.Repeat("x", 20<<10), "status": "open", "created_at": time.Now()}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("owner", "synthetic owner proof", ""); err != errOwnerExportSection || data != nil {
		t.Fatal("oversized projected submission omitted or partially delivered")
	}
	var preserved bson.M
	if err := db.reports.FindOne(ctx, bson.M{"_id": oversizedID}).Decode(&preserved); err != nil || len(preserved["text"].(string)) != 20<<10 {
		t.Fatal("export altered an oversized source")
	}
	if _, err := db.reports.UpdateOne(ctx, bson.M{"_id": caseID}, bson.M{"$set": bson.M{"export_approval.enabled": false, "export_approval.revision": int64(2)}}); err != nil {
		t.Fatal(err)
	}
	if data, err := read("owner", "synthetic owner proof", oversizedID.Hex()); err != errOwnerExportSection || data != nil {
		t.Fatal("revoked case continued to read older pages")
	}
}
