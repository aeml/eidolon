package database

import (
	"strings"
	"testing"
	"time"
)

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
		{name: "type", username: "player", reportType: "Player Report", text: "text"},
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
