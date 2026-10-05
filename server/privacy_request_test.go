package main

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestPrivacyRequestsKeepAuthenticatedSharedAdmissionBudget(t *testing.T) {
	now := time.Now()
	c := &Client{username: "privacy-owner"}
	for _, category := range []string{"Account Data Export", "Account Removal Request"} {
		payload, _ := json.Marshal(ReportPayload{ReportType: category, Text: "Review my request", RequestID: "privacy-request-001"})
		msg := Message{Type: MsgReport, Payload: payload}
		if err := (&Client{}).acceptInboundMessage(msg, now); err == nil {
			t.Fatal("anonymous privacy request admitted")
		}
		if err := c.acceptInboundMessage(msg, now); err != nil {
			t.Fatal("account support incorrectly required character entry", err)
		}
	}
	if err := c.acceptInboundMessage(Message{Type: MsgReport, Payload: json.RawMessage(`{}`)}, now); err == nil {
		t.Fatal("privacy categories bypassed shared report rate limit")
	}
	if err := (&Client{username: "privacy-owner"}).acceptInboundMessage(Message{Type: MsgReport,
		Payload: make([]byte, inboundMessagePolicies[MsgReport].maxPayloadBytes+1)}, now); err == nil {
		t.Fatal("privacy request bypassed payload budget")
	}
}

func TestPrivacyRequestMongoPersistsWithoutWorldEntryAndProtectsOwnerStatus(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable report Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicit disposable loopback Mongo")
	}
	restore := installChatTestState(t)
	defer restore()
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	previous := db
	db = repo
	t.Cleanup(func() { db = previous })
	for _, category := range []string{"Account Data Export", "Account Removal Request"} {
		c := &Client{username: "privacy-fixture-owner", send: make(chan []byte, 4)}
		body := "Review my own account; synthetic private request"
		payload, _ := json.Marshal(ReportPayload{ReportType: category, Text: body, RequestID: "privacy-request-001"})
		c.handleMessage(Message{Type: MsgReport, Payload: payload})
		messages := drainSentMessages(c.send)
		var result struct {
			Success bool   `json:"success"`
			ID      string `json:"reportId"`
		}
		if len(messages) != 2 || messages[0].Type != "report_result" || json.Unmarshal(messages[0].Payload, &result) != nil || !result.Success {
			t.Fatal("request not acknowledged after persistence", category)
		}
		if strings.Contains(string(messages[0].Payload), body) {
			t.Fatal("private request echoed in acknowledgement")
		}
		page, err := repo.ReadReportPage(database.ReportQuery{Status: "open", ReportType: category})
		if err != nil || len(page.Reports) == 0 || page.Reports[0].ID.Hex() != result.ID || page.Reports[0].Text != body {
			t.Fatal("persisted request absent from category queue", err)
		}
		if _, err := repo.OwnReportStatus("another-owner", result.ID); err == nil {
			t.Fatal("another account read privacy request status")
		}
		view, err := repo.OwnReportStatus(c.username, result.ID)
		if err != nil || view.ReportType != category || view.Status != "open" {
			t.Fatal("owner could not read own open request", err)
		}
		request := database.ReportReviewRequest{ID: "privacy-review-001", ReportID: result.ID,
			ExpectedStatus: "open", Status: "resolved", Reason: "Private review only", Confirmed: true}
		first, err := repo.ReviewReport("privacy-staff", request)
		if err != nil {
			t.Fatal(err)
		}
		replay, err := repo.ReviewReport("privacy-staff", request)
		if err != nil || first != replay || first.Revision != 1 {
			t.Fatal("review replay changed case twice", err)
		}
		view, err = repo.OwnReportStatus(c.username, result.ID)
		encoded, _ := json.Marshal(view)
		if err != nil || view.Status != "resolved" || strings.Contains(string(encoded), "Private review") || strings.Contains(string(encoded), c.username) {
			t.Fatal("review result leaked owner or staff case details", err)
		}
	}
}
