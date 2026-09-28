package database

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"strings"
	"testing"
	"time"
)

func TestReportQueueKeysetPagesAreStableAndReadOnly(t *testing.T) {
	db := newFriendshipDB(t)
	// A uniquely named disposable collection, never existing player reports.
	db.reports = db.reports.Database().Collection(uniqueID("report-pages"))
	t.Cleanup(func() { _ = db.reports.Drop(context.Background()) })
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	documents := []interface{}{}
	for i := 0; i < 25; i++ {
		status := ReportStatusOpen
		if i < 10 {
			status = ReportStatusResolved
		}
		documents = append(documents, Report{ID: primitive.NewObjectID(), Username: "fixture-reporter", ReportType: "Bug Report", Text: "private fixture text", Status: status, CreatedAt: time.Unix(1700000000, 0)})
	}
	if _, err := db.reports.InsertMany(ctx, documents); err != nil {
		t.Fatal(err)
	}
	first, err := db.ReadReportPage(ReportQuery{Status: ReportStatusOpen})
	if err != nil || len(first.Reports) != 10 || first.Next != first.Reports[9].ID.Hex() {
		t.Fatal(first, err)
	}
	// A newly submitted report should not shift/duplicate the next keyset page.
	if _, err := db.reports.InsertOne(ctx, Report{ID: primitive.NewObjectID(), Status: ReportStatusOpen}); err != nil {
		t.Fatal(err)
	}
	second, err := db.ReadReportPage(ReportQuery{Status: ReportStatusOpen, Before: first.Next})
	if err != nil || len(second.Reports) != 5 || second.Next != "" {
		t.Fatal(second, err)
	}
	seen := map[string]bool{}
	previous := "ffffffffffffffffffffffff"
	for _, report := range append(first.Reports, second.Reports...) {
		id := report.ID.Hex()
		if seen[id] || id >= previous || report.Status != ReportStatusOpen || report.Text != "private fixture text" {
			t.Fatal("unstable/private-data-changing read", report)
		}
		seen[id] = true
		previous = id
	}
	resolved, err := db.ReadReportPage(ReportQuery{Status: ReportStatusResolved})
	if err != nil || len(resolved.Reports) != 10 || resolved.Next != "" {
		t.Fatal(resolved, err)
	}
	if count, err := db.reports.CountDocuments(ctx, bson.M{"status": ReportStatusOpen}); err != nil || count != 16 {
		t.Fatal("read changed report state", count, err)
	}
}

func TestReportPageFilterIsBoundedAndStrict(t *testing.T) {
	id := primitive.NewObjectID()
	filter, err := reportPageFilter(ReportQuery{Before: id.Hex(), Status: ReportStatusOpen})
	if err != nil || filter["status"] != ReportStatusOpen || filter["_id"].(bson.M)["$lt"] != id || AdminReportPageSize != 10 {
		t.Fatal(filter, err)
	}
	for _, query := range []ReportQuery{{Before: "invalid"}, {Before: strings.Repeat("a", 25)}, {Status: "deleted"}, {Status: "$ne"}} {
		if _, err := reportPageFilter(query); err == nil {
			t.Fatal("accepted invalid report query", query)
		}
	}
	if filter, err := reportPageFilter(ReportQuery{}); err != nil || len(filter) != 0 {
		t.Fatal(filter, err)
	}
}

func TestNewReportValidatesAndNormalizesInput(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	report, err := NewReport(" player ", "Bug Report", "  collision failed  ", now)
	if err != nil {
		t.Fatal(err)
	}
	if report.Username != "player" || report.Text != "collision failed" || report.Status != ReportStatusOpen || !report.CreatedAt.Equal(now.UTC()) {
		t.Fatalf("unexpected report: %+v", report)
	}

	invalid := []struct {
		name       string
		username   string
		reportType string
		text       string
	}{
		{name: "username", reportType: "Bug Report", text: "text"},
		{name: "type", username: "player", reportType: "Unsupported Report", text: "text"},
		{name: "text", username: "player", reportType: "Bug Report"},
		{name: "length", username: "player", reportType: "Bug Report", text: strings.Repeat("x", maximumReportLength+1)},
	}
	for _, test := range invalid {
		t.Run(test.name, func(t *testing.T) {
			if _, err := NewReport(test.username, test.reportType, test.text, now); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestPlayerReportUsesExistingModerationQueue(t *testing.T) {
	report, err := NewReport("reporter", "Player Report", "Player: Bob\nContext: group listing\nRepeated harassment", time.Now())
	if err != nil || report.ReportType != "Player Report" || report.Status != ReportStatusOpen || report.Username != "reporter" {
		t.Fatal("player report was not queued as an allegation for review", report, err)
	}
}

func TestReportQueueLifecycle(t *testing.T) {
	db := newFriendshipDB(t)
	username := uniqueID("reporter")
	report, err := db.CreateReport(username, "Feature Request", "Add a training dummy")
	if err != nil {
		t.Fatalf("create report: %v", err)
	}
	if report.ID.IsZero() {
		t.Fatal("created report has no id")
	}

	reports, err := db.ListReports(ReportStatusOpen, 500)
	if err != nil {
		t.Fatalf("list reports: %v", err)
	}
	found := false
	for _, candidate := range reports {
		if candidate.ID == report.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("created report %s not found in open queue", report.ID.Hex())
	}

	if err := db.ResolveReport(report.ID.Hex()); err != nil {
		t.Fatalf("resolve report: %v", err)
	}
	if err := db.ResolveReport(report.ID.Hex()); err == nil {
		t.Fatal("resolved the same report twice")
	}
}
