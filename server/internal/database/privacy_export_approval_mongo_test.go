package database

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

func TestPrivacyExportApprovalMongoReplayRevokeAndOwnerRead(t *testing.T) {
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
	db.reports = db.reports.Database().Collection(uniqueID("privacy-approval"))
	db.users = db.users.Database().Collection(uniqueID("privacy-approval-users"))
	t.Cleanup(func() { _ = db.reports.Drop(context.Background()); _ = db.users.Drop(context.Background()) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if _, err := db.users.InsertOne(ctx, bson.M{"username": "owner", "password_hash": string(hash), "email": "owner@example.invalid"}); err != nil {
		t.Fatal(err)
	}
	report, err := db.CreateReport("owner", "Account Data Export", "Please review my account export request")
	if err != nil {
		t.Fatal(err)
	}
	_, request := privacyApprovalFixture()
	request.ReportID = report.ID.Hex()
	read := func(owner string, revision int64) ([]byte, error) {
		return db.ReadApprovedOwnerExportSection(ctx, owner, "synthetic owner proof", request.ReportID, revision, "profile", "", time.Now(), 4096)
	}
	if data, err := read("owner", 1); err != errOwnerExportSection || data != nil {
		t.Fatal("unapproved request supplied data")
	}
	// Ordinary resolve is not approval; permission remains absent.
	review := ReportReviewRequest{ID: "privacy-case-review-001", ReportID: report.ID.Hex(), ExpectedStatus: "open", Status: "resolved", Reason: "Review only", Confirmed: true}
	if _, err := db.ReviewReport("staff", review); err != nil {
		t.Fatal(err)
	}
	if data, err := read("owner", 1); err != errOwnerExportSection || data != nil {
		t.Fatal("case resolution automatically approved export")
	}
	request.ExpectedStatus = "resolved"
	request.ExpectedReviewRevision = 1
	// Concurrent identical retries yield one immutable approval, never another
	// revision or a distinct permission decision.
	var wg sync.WaitGroup
	results := make([]PrivacyExportApprovalReceipt, 8)
	errs := make([]error, 8)
	for i := range results {
		wg.Add(1)
		go func(i int) { defer wg.Done(); results[i], errs[i] = db.SetPrivacyExportApproval("staff", request) }(i)
	}
	wg.Wait()
	for i := range results {
		if errs[i] != nil || !reflect.DeepEqual(results[0], results[i]) || results[i].Revision != 1 {
			t.Fatal("concurrent approval replay diverged", errs[i])
		}
	}
	if data, err := read("another-owner", 1); err != errOwnerExportSection || data != nil {
		t.Fatal("approval read crossed account boundary")
	}
	if data, err := read("owner", 1); err != nil || !strings.Contains(string(data), "owner@example.invalid") {
		t.Fatal("proved approved owner could not read", err)
	}
	revoke := request
	revoke.ID = "privacy-revoke-000002"
	revoke.ExpectedRevision = 1
	revoke.Enabled = false
	if _, err := db.SetPrivacyExportApproval("staff", revoke); err != nil {
		t.Fatal(err)
	}
	// Replaying an old approval after revoke returns its historical receipt,
	// but cannot re-enable the current permission.
	if saved, err := db.SetPrivacyExportApproval("staff", request); err != nil || saved.Revision != 1 {
		t.Fatal(err)
	}
	if data, err := read("owner", 1); err != errOwnerExportSection || data != nil {
		t.Fatal("revocation failed to fence a subsequent read")
	}
	changed := request
	changed.Reason = "Different decision"
	if _, err := db.SetPrivacyExportApproval("staff", changed); !errors.Is(err, ErrPrivacyExportApprovalConflict) {
		t.Fatal("changed nonce decision admitted")
	}
	reapprove := request
	reapprove.ID = "privacy-reapprove-003"
	reapprove.ExpectedRevision = 2
	if _, err := db.SetPrivacyExportApproval("staff", reapprove); err != nil {
		t.Fatal(err)
	}
	if data, err := read("owner", 1); err != errOwnerExportSection || data != nil {
		t.Fatal("old permission version reused after reapproval")
	}
	if _, err := read("owner", 3); err != nil {
		t.Fatal("reapproved owner read unavailable", err)
	}
	ownerView, err := db.OwnReportStatus("owner", request.ReportID)
	if err != nil || ownerView.Status != "resolved" || !ownerView.ExportApproved || ownerView.ExportApprovalRevision != 3 {
		t.Fatal("independent approval mutated case review status", err)
	}
	encoded, _ := json.Marshal(ownerView)
	if strings.Contains(string(encoded), "Owner and requested scope") || strings.Contains(string(encoded), "fingerprint") || strings.Contains(string(encoded), "actor") {
		t.Fatal("owner status disclosed staff approval details")
	}
	removal, err := db.CreateReport("owner", "Account Removal Request", "Please review removal")
	if err != nil {
		t.Fatal(err)
	}
	other := request
	other.ID = "privacy-wrong-case-01"
	other.ReportID = removal.ID.Hex()
	other.ExpectedStatus = "open"
	other.ExpectedReviewRevision = 0
	if _, err := db.SetPrivacyExportApproval("staff", other); err == nil {
		t.Fatal("removal request obtained export authority")
	}
	var retained bson.M
	if err := db.users.FindOne(ctx, bson.M{"username": "owner"}).Decode(&retained); err != nil || retained["password_hash"] != string(hash) {
		t.Fatal("approval/read modified or removed account", err)
	}
}
