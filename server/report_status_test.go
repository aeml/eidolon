package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const reportStatusPayload = `{"requestId":"lookup-request-000001","reportId":"0123456789abcdef01234567"}`

type fakeOwnReportStatus struct {
	username string
	calls    int
	err      error
}

func (s *fakeOwnReportStatus) OwnReportStatus(username, reference string) (database.ReportStatusView, error) {
	s.username = username
	s.calls++
	id, _ := primitive.ObjectIDFromHex(reference)
	return database.ReportStatusView{ID: id, ReportType: "Moderation Appeal", Status: "open"}, s.err
}

func TestReportStatusSchemaRejectsTargetIdentityAndMalformedRequests(t *testing.T) {
	id, reference, err := decodeReportStatus([]byte(reportStatusPayload))
	if err != nil || id != "lookup-request-000001" || reference != "0123456789abcdef01234567" {
		t.Fatal(id, reference, err)
	}
	for _, payload := range []string{
		strings.Replace(reportStatusPayload, `}`, `,"username":"other"}`, 1),
		strings.Replace(reportStatusPayload, `}`, `,"reportId":"abcdef0123456789abcdef01"}`, 1),
		strings.Replace(reportStatusPayload, `"0123456789abcdef01234567"`, `null`, 1),
		strings.Replace(reportStatusPayload, `0123456789abcdef01234567`, `0123456789ABCDEF01234567`, 1),
		strings.Replace(reportStatusPayload, `0123456789abcdef01234567`, strings.Repeat("0", 24), 1),
		`{"requestId":"lookup-request-000001"}`, reportStatusPayload + `{}`, strings.Repeat(" ", 513),
	} {
		if _, _, err := decodeReportStatus([]byte(payload)); err == nil {
			t.Fatal("invalid request accepted", payload)
		}
	}
}

func TestReportStatusUsesCurrentAuthenticatedOwnerAndNoAdminPrivileges(t *testing.T) {
	c, roles := adminReadFixture(t)
	roles.roles[c.username] = false
	store := &fakeOwnReportStatus{}
	previous := reportStatuses
	reportStatuses = store
	t.Cleanup(func() { reportStatuses = previous })
	lookup := func(payload string) string {
		t.Helper()
		c.handleMessage(Message{Type: MsgReportStatus, Payload: json.RawMessage(payload)})
		messages := drainSentMessages(c.send)
		if len(messages) != 1 || messages[0].Type != MsgReportStatus+"_result" {
			t.Fatal(messages)
		}
		return string(messages[0].Payload)
	}
	result := lookup(reportStatusPayload)
	if store.calls != 1 || store.username != c.username || !strings.Contains(result, `"success":true`) ||
		strings.Contains(result, "username") || strings.Contains(result, "lastReview") || strings.Contains(result, "reason") {
		t.Fatal("owner lookup or privacy failed", result, store)
	}
	store.err = errors.New("private database diagnostic")
	missing := lookup(reportStatusPayload)
	if strings.Contains(missing, "private database") || !strings.Contains(missing, `"success":false`) || strings.Contains(missing, `"report":`) {
		t.Fatal(missing)
	}
	// Malformed owner override must never reach the database.
	before := store.calls
	_ = lookup(strings.Replace(reportStatusPayload, `}`, `,"username":"other"}`, 1))
	if store.calls != before {
		t.Fatal("caller supplied owner reached query")
	}
	// Call the handler directly to check the defense against a retired connection.
	activeSessions[c.username] = &Client{username: c.username}
	handleOwnReportStatus(c, Message{Type: MsgReportStatus, Payload: json.RawMessage(reportStatusPayload)})
	messages := drainSentMessages(c.send)
	if store.calls != before || len(messages) != 1 || strings.Contains(string(messages[0].Payload), `"success":true`) {
		t.Fatal("retired connection queried case")
	}
}
