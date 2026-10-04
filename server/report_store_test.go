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

func TestReportAppealAdmissionWithoutCharacterKeepsAuthenticationRateAndPayloadLimits(t *testing.T) {
	now := time.Now()
	message := Message{Type: MsgReport, Payload: json.RawMessage(`{"requestId":"appeal-login-001","reportType":"Moderation Appeal","text":"Please review my notice."}`)}
	if err := (&Client{}).acceptInboundMessage(message, now); err == nil {
		t.Fatal("anonymous account admitted an appeal")
	}
	client := &Client{username: "appellant"}
	for i := 0; i < 2; i++ {
		if err := client.acceptInboundMessage(message, now); err != nil {
			t.Fatal("authenticated appeal required world entry", err)
		}
	}
	if err := client.acceptInboundMessage(message, now); err == nil {
		t.Fatal("outside-world appeal bypassed shared report rate limit")
	}
	// Report envelopes allow JSON escaping of the unchanged 4000-character
	// text limit; check the current explicit byte boundary, not the old 16KiB.
	if limit := inboundMessagePolicies[MsgReport].maxPayloadBytes; limit != 32<<10 {
		t.Fatalf("report byte limit changed: %d", limit)
	}
	message.Payload = make([]byte, inboundMessagePolicies[MsgReport].maxPayloadBytes+1)
	if err := (&Client{username: "appellant"}).acceptInboundMessage(message, now); err == nil {
		t.Fatal("outside-world appeal bypassed size bound")
	}
}

func TestReportWithoutCharacterRejectsNonAppealWithCorrelatedFailure(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	for _, category := range []string{"Bug Report", "Player Report", "Feature Request", "Unknown"} {
		client := &Client{username: "appellant", send: make(chan []byte, 4)}
		payload, _ := json.Marshal(ReportPayload{RequestID: "outside-world-001", ReportType: category, Text: "Private details must not be echoed."})
		client.handleReport(payload)
		messages := drainSentMessages(client.send)
		if len(messages) != 2 || messages[0].Type != "report_result" {
			t.Fatal("missing correlated failure", category, messages)
		}
		var result struct {
			RequestID string `json:"requestId"`
			Success   bool   `json:"success"`
		}
		if err := json.Unmarshal(messages[0].Payload, &result); err != nil || result.Success || result.RequestID != "outside-world-001" {
			t.Fatal("unexpected submission", category, result, err)
		}
		if strings.Contains(string(messages[0].Payload), "Private") {
			t.Fatal("report body leaked")
		}
	}
}

func TestReportOutsideWorldAppealStoreFailureDoesNotPretendSuccess(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	previous := db
	db = nil
	t.Cleanup(func() { db = previous })
	client := &Client{username: "appellant", send: make(chan []byte, 4)}
	client.handleMessage(Message{Type: MsgReport, Payload: json.RawMessage(`{"requestId":"appeal-login-001","reportType":"Moderation Appeal","text":"Private appeal details."}`)})
	messages := drainSentMessages(client.send)
	if len(messages) != 2 || messages[0].Type != "report_result" {
		t.Fatal("missing authenticated appeal response", messages)
	}
	var result struct {
		RequestID string `json:"requestId"`
		Success   bool   `json:"success"`
	}
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil || result.Success || result.RequestID != "appeal-login-001" {
		t.Fatal("failure was not correlated", result, err)
	}
}

func TestReportPersistsBeforeAcknowledgementAndReachesOperatorQueue(t *testing.T) {
	uri := os.Getenv("EIDOLON_REPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable report Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires disposable loopback Mongo")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	previous := db
	db = repo
	t.Cleanup(func() { db = previous })
	c := &Client{username: "report-fixture", playerID: "player-report-fixture", send: make(chan []byte, 4)}
	body := "Door blocks the passage\n\nClient-reported context:\nbuild: Alpha test\narea: Lanternhold\nquality: low"
	payload, _ := json.Marshal(ReportPayload{RequestID: "report-test-saved", ReportType: "Bug Report", Text: body})
	c.dispatchMessage(Message{Type: MsgReport, Payload: payload})
	var message Message
	if err := json.Unmarshal(<-c.send, &message); err != nil {
		t.Fatal(err)
	}
	var result struct {
		RequestID string `json:"requestId"`
		Success   bool   `json:"success"`
		ReportID  string `json:"reportId"`
	}
	if err := json.Unmarshal(message.Payload, &result); err != nil {
		t.Fatal(err)
	}
	if message.Type != "report_result" || !result.Success || result.RequestID != "report-test-saved" || len(result.ReportID) != 24 {
		t.Fatalf("bad saved acknowledgement: %+v", result)
	}
	if strings.Contains(string(message.Payload), "Door blocks") {
		t.Fatal("echoed private report body")
	}
	// This is the same read path used by cmd/reports, not an invented inbox.
	reports, err := repo.ListReports(database.ReportStatusOpen, 100)
	if err != nil {
		t.Fatal(err)
	}
	for _, report := range reports {
		if report.ID.Hex() == result.ReportID {
			if report.Username != c.username || report.Text != body || report.ReportType != "Bug Report" {
				t.Fatalf("stored report mismatch: %+v", report)
			}
			return
		}
	}
	t.Fatal("acknowledged report was absent from the operator queue")
}

func TestReportAcknowledgementPreservesRequestOnStoreFailure(t *testing.T) {
	previous := db
	db = nil
	t.Cleanup(func() { db = previous })
	c := &Client{username: "reporter", playerID: "player-reporter", send: make(chan []byte, 4)}
	c.dispatchMessage(Message{Type: MsgReport, Payload: json.RawMessage(`{"requestId":"report-test-123","reportType":"Bug Report","text":"private report body"}`)})
	var message Message
	if err := json.Unmarshal(<-c.send, &message); err != nil {
		t.Fatal(err)
	}
	if message.Type != "report_result" {
		t.Fatalf("missing report acknowledgement: %s", message.Type)
	}
	var result struct {
		RequestID string `json:"requestId"`
		Success   bool   `json:"success"`
		ReportID  string `json:"reportId"`
	}
	if err := json.Unmarshal(message.Payload, &result); err != nil {
		t.Fatal(err)
	}
	if result.RequestID != "report-test-123" || result.Success || result.ReportID != "" {
		t.Fatalf("bad failed acknowledgement: %+v", result)
	}
	if strings.Contains(string(message.Payload), "private") || strings.Contains(string(message.Payload), "database") {
		t.Fatal("leaked report body or database error")
	}
}

func TestReportRejectsMalformedCorrelationBeforeStorage(t *testing.T) {
	for _, payload := range []string{`{`, `{"requestId":"bad\nrequest"}`, `{"requestId":"` + strings.Repeat("x", 65) + `"}`} {
		c := &Client{username: "reporter", send: make(chan []byte, 4)}
		c.handleReport([]byte(payload))
		var message Message
		if err := json.Unmarshal(<-c.send, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type != "error" || !strings.Contains(string(message.Payload), "Invalid report request") {
			t.Fatalf("invalid correlation was accepted: %+v", message)
		}
	}
}
