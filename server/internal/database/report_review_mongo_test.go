package database

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Never use the ordinary MONGO_URI here: this exercise changes only cases in
// an explicitly disposable loopback service, with IDs allocated by this test.
func TestReportReviewMongoResolveReplayReopenAndConcurrentReview(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "mongodb" || parsed.Hostname() != "127.0.0.1" ||
		parsed.Port() == "" || os.Getenv("EIDOLON_REPORT_DISPOSABLE_DATABASE") != "1" {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	db.reports = db.reports.Database().Collection(uniqueID("report-review-triage"))
	t.Cleanup(func() { _ = db.reports.Drop(context.Background()) })
	report, err := db.CreateReport("disposable-reporter", "Moderation Appeal", "Please review this isolated notice.")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.reports.DeleteOne(context.Background(), bson.M{"_id": report.ID}) })
	_, request := reportReviewFixture()
	request.ReportID = report.ID.Hex()
	receipt, err := db.ReviewReport("operator", request)
	if err != nil || receipt.Revision != 1 || receipt.Status != ReportStatusResolved {
		t.Fatal(receipt, err)
	}
	replayed, err := db.ReviewReport("operator", request)
	if err != nil || !reflect.DeepEqual(replayed, receipt) {
		t.Fatal("replay changed result", replayed, err)
	}
	var saved Report
	read := func() {
		t.Helper()
		saved = Report{}
		if err := db.reports.FindOne(context.Background(), bson.M{"_id": report.ID}).Decode(&saved); err != nil {
			t.Fatal(err)
		}
	}
	read()
	if saved.ReviewRevision != 1 || saved.ResolvedAt == nil || len(saved.ReviewReceipts) != 1 || saved.LastReview == nil {
		t.Fatal("status and receipt not coupled", saved)
	}
	reopen := request
	reopen.ID, reopen.ExpectedRevision, reopen.ExpectedStatus, reopen.Status = "review-request-000002", 1, "resolved", "open"
	reopen.Reason = "New appeal evidence supplied."
	if _, err := db.ReviewReport("operator", reopen); err != nil {
		t.Fatal(err)
	}
	read()
	if saved.Status != "open" || saved.ReviewRevision != 2 || saved.ResolvedAt != nil || len(saved.ReviewReceipts) != 2 {
		t.Fatal(saved)
	}
	// Two staff members confirm the same displayed case. Exactly one wins.
	concurrent := request
	concurrent.ID, concurrent.ExpectedRevision = "review-request-000003", 2
	var group sync.WaitGroup
	outcomes := make(chan error, 2)
	for _, actor := range []string{"reviewer-one", "reviewer-two"} {
		group.Add(1)
		go func(actor string) { defer group.Done(); _, err := db.ReviewReport(actor, concurrent); outcomes <- err }(actor)
	}
	group.Wait()
	close(outcomes)
	won, conflict := 0, 0
	for err := range outcomes {
		if err == nil {
			won++
		} else if errors.Is(err, ErrReportReviewConflict) {
			conflict++
		} else {
			t.Fatal(err)
		}
	}
	read()
	if won != 1 || conflict != 1 || saved.ReviewRevision != 3 || len(saved.ReviewReceipts) != 3 || saved.Status != "resolved" {
		t.Fatal("concurrent reviewers lost CAS boundary", won, conflict, saved)
	}
	// Simultaneous retries of one confirmed decision all return one receipt.
	reopen.ID, reopen.ExpectedRevision = "review-request-000004", 3
	retries := make(chan ReportReviewReceipt, 8)
	for range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			receipt, err := db.ReviewReport("operator", reopen)
			if err != nil {
				t.Error(err)
				return
			}
			retries <- receipt
		}()
	}
	group.Wait()
	close(retries)
	var first ReportReviewReceipt
	count := 0
	for receipt := range retries {
		if count == 0 {
			first = receipt
		} else if !reflect.DeepEqual(first, receipt) {
			t.Fatal("retry receipts differ", first, receipt)
		}
		count++
	}
	read()
	if count != 8 || saved.Status != "open" || saved.ReviewRevision != 4 || len(saved.ReviewReceipts) != 4 || saved.ResolvedAt != nil {
		t.Fatal("duplicate retry effects", count, saved)
	}
	// A historical exact retry still acknowledges its original revision only.
	replayed, err = db.ReviewReport("operator", request)
	if err != nil || !reflect.DeepEqual(replayed, receipt) {
		t.Fatal(replayed, err)
	}
	page, err := db.ReadReportPage(ReportQuery{Status: "open"})
	found := false
	for _, entry := range page.Reports {
		if entry.ID == report.ID && entry.LastReview != nil {
			found = true
		}
	}
	if err != nil || !found {
		t.Fatal(page, err)
	}
	ownerView, err := db.OwnReportStatus("disposable-reporter", report.ID.Hex())
	if err != nil || ownerView.ID != report.ID || ownerView.Status != "open" || ownerView.ReportType != "Moderation Appeal" {
		t.Fatal("owner status view missing", ownerView, err)
	}
	encoded, err := json.Marshal(ownerView)
	if err != nil || strings.Contains(string(encoded), "review") || strings.Contains(string(encoded), "reason") ||
		strings.Contains(string(encoded), "disposable-reporter") || strings.Contains(string(encoded), "Please review") {
		t.Fatal("staff or report data leaked in owner view", string(encoded), err)
	}
	_, wrongOwner := db.OwnReportStatus("other-account", report.ID.Hex())
	_, absent := db.OwnReportStatus("disposable-reporter", primitive.NewObjectID().Hex())
	if !errors.Is(wrongOwner, mongo.ErrNoDocuments) || !errors.Is(absent, mongo.ErrNoDocuments) {
		t.Fatal("ownership query differs from missing case", wrongOwner, absent)
	}
	// Interleaved unrelated submissions must not displace appeals across pages.
	for i := 0; i < 12; i++ {
		if _, err := db.CreateReport("disposable-reporter", "Moderation Appeal", "Isolated appeal."); err != nil {
			t.Fatal(err)
		}
		if _, err := db.CreateReport("disposable-reporter", "Bug Report", "Unrelated isolated bug."); err != nil {
			t.Fatal(err)
		}
	}
	firstPage, err := db.ReadReportPage(ReportQuery{Status: "open", ReportType: "Moderation Appeal"})
	if err != nil || len(firstPage.Reports) != 10 || firstPage.Next == "" {
		t.Fatal("filtered first page", firstPage, err)
	}
	nextPage, err := db.ReadReportPage(ReportQuery{Status: "open", ReportType: "Moderation Appeal", Before: firstPage.Next})
	if err != nil || len(nextPage.Reports) != 3 || nextPage.Next != "" {
		t.Fatal("filtered next page", nextPage, err)
	}
	seen := map[primitive.ObjectID]bool{}
	for _, entry := range append(firstPage.Reports, nextPage.Reports...) {
		if seen[entry.ID] || entry.ReportType != "Moderation Appeal" || entry.Status != "open" {
			t.Fatal("mixed or duplicated filtered page", entry)
		}
		seen[entry.ID] = true
	}
	resolvedPage, err := db.ReadReportPage(ReportQuery{Status: "resolved", ReportType: "Moderation Appeal"})
	if err != nil || len(resolvedPage.Reports) != 0 {
		t.Fatal("status filter lost", resolvedPage, err)
	}
	read()
	if saved.ReviewRevision != 4 || len(saved.ReviewReceipts) != 4 {
		t.Fatal("triage read changed review state", saved)
	}
}
