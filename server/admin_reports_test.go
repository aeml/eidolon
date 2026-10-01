package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
)

type fakeAdminReports struct {
	reads int
	query database.ReportQuery
	err   error
}

func (s *fakeAdminReports) ReadReportPage(q database.ReportQuery) (database.ReportPage, error) {
	s.reads++
	s.query = q
	return database.ReportPage{Reports: []database.Report{{Username: "reporter", Text: "private allegation", Status: "open"}}}, s.err
}

func TestAdminReportsAuthorizeEveryReadAndAuditWithoutReportText(t *testing.T) {
	c, roles := adminReadFixture(t)
	sessionActivityFixture(t)
	previous := adminReports
	store := &fakeAdminReports{}
	adminReports = store
	t.Cleanup(func() { adminReports = previous })
	result := adminRead(t, c, MsgAdminReports, "")
	if !result.Success || result.Reports == nil || len(result.Reports.Reports) != 1 || store.reads != 1 {
		t.Fatal(result, store.reads)
	}
	events, _ := json.Marshal(adminActivities.(*fakeAdminActivityStore).events)
	if !strings.Contains(string(events), "admin_reports") || strings.Contains(string(events), "private allegation") || strings.Contains(string(events), "reporter") {
		t.Fatalf("incorrect read audit: %s", events)
	}
	roles.roles["operator"] = false
	result = adminRead(t, c, MsgAdminReports, "")
	if result.Authorized || result.Success || result.Reports != nil || store.reads != 1 {
		t.Fatal("revoked role read reports", result)
	}
	roles.roles["operator"] = true
	store.err = errors.New("sensitive database error")
	result = adminRead(t, c, MsgAdminReports, "")
	if result.Success || result.Reports != nil || strings.Contains(result.Message, "sensitive") {
		t.Fatal(result)
	}
	store.err = nil
	adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("audit failure")
	result = adminRead(t, c, MsgAdminReports, "")
	if result.Success || result.Authorized || result.Reports != nil {
		t.Fatal("unlogged report read escaped", result)
	}
}

func TestAdminReportRequestSchema(t *testing.T) {
	for _, fields := range []string{`,"actor":"other"`, `,"status":"deleted"`, `,"status":null`, `,"before":"` + strings.Repeat("a", 25) + `"`, `,"status":"open","status":"resolved"`, `,"after":"next"`} {
		_, err := decodeAdminRead(Message{Type: MsgAdminReports, Payload: json.RawMessage(`{"id":"report-read-000001"` + fields + `}`)})
		if err == nil {
			t.Fatal("accepted invalid report query", fields)
		}
	}
	request, err := decodeAdminRead(Message{Type: MsgAdminReports, Payload: json.RawMessage(`{"id":"report-read-000001","before":"0123456789abcdef01234567","status":"resolved"}`)})
	if err != nil || request.Status != "resolved" || request.Before != "0123456789abcdef01234567" {
		t.Fatal(request, err)
	}
}

func TestAdminReportCategoryFilterIsStrictAndReachesAuthorizedStore(t *testing.T) {
	c, _ := adminReadFixture(t)
	sessionActivityFixture(t)
	previous := adminReports
	store := &fakeAdminReports{}
	adminReports = store
	t.Cleanup(func() { adminReports = previous })
	for _, category := range []string{"", "Bug Report", "Feature Request", "Player Report", "Moderation Appeal"} {
		payload, _ := json.Marshal(map[string]string{"id": "report-read-000001", "reportType": category, "status": "open"})
		handleAdminRead(c, Message{Type: MsgAdminReports, Payload: payload})
		messages := drainSentMessages(c.send)
		var result adminReadResult
		if len(messages) != 1 || json.Unmarshal(messages[0].Payload, &result) != nil || !result.Success || store.query.ReportType != category || store.query.Status != "open" {
			t.Fatal("category lost between authorization and repository", category, result, store.query)
		}
	}
	for _, fields := range []string{`,"reportType":"$ne"`, `,"reportType":"moderation appeal"`, `,"reportType":null`, `,"reportType":{"$ne":""}`, `,"reportType":"Bug Report","reportType":"Player Report"`} {
		if _, err := decodeAdminRead(Message{Type: MsgAdminReports, Payload: json.RawMessage(`{"id":"report-read-000001"` + fields + `}`)}); err == nil {
			t.Fatal("accepted invalid category", fields)
		}
	}
	for _, kind := range []string{MsgAdminPlayers, MsgAdminHistory, MsgAdminStatus} {
		if _, err := decodeAdminRead(Message{Type: kind, Payload: json.RawMessage(`{"id":"report-read-000001","reportType":"Player Report"}`)}); err == nil {
			t.Fatal("report category escaped its schema", kind)
		}
	}
}
