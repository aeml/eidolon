package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
)

const validReportReviewPayload = `{"id":"review-request-000001","reportId":"0123456789abcdef01234567","expectedRevision":0,"expectedStatus":"open","status":"resolved","reason":"Private staff reasoning","confirmed":true}`

type fakeReportReviewStore struct {
	calls   int
	actor   string
	request database.ReportReviewRequest
	err     error
}

func (s *fakeReportReviewStore) ReviewReport(actor string, request database.ReportReviewRequest) (database.ReportReviewReceipt, error) {
	s.calls++
	s.actor, s.request = actor, request
	return database.ReportReviewReceipt{Revision: request.ExpectedRevision + 1}, s.err
}

func reviewReport(t *testing.T, c *Client, payload string) adminMutationResult {
	t.Helper()
	handleAdminReportReview(c, Message{Type: MsgAdminReportReview, Payload: json.RawMessage(payload)})
	messages := drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminReportReview+"_result" {
		t.Fatal(messages)
	}
	var result adminMutationResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func reportReviewStoreFixture(t *testing.T) *fakeReportReviewStore {
	t.Helper()
	previous := adminReportReviews
	store := &fakeReportReviewStore{}
	adminReportReviews = store
	t.Cleanup(func() { adminReportReviews = previous })
	return store
}

func TestAdminReportReviewStrictSchema(t *testing.T) {
	request, err := decodeAdminReportReview([]byte(validReportReviewPayload))
	if err != nil || request.ReportID != "0123456789abcdef01234567" || !request.Confirmed {
		t.Fatal(request, err)
	}
	invalid := []string{
		strings.Replace(validReportReviewPayload, `"confirmed":true`, `"confirmed":false`, 1),
		strings.Replace(validReportReviewPayload, `"confirmed":true`, `"confirmed":"true"`, 1),
		strings.Replace(validReportReviewPayload, `"expectedRevision":0`, `"expectedRevision":0.0`, 1),
		strings.Replace(validReportReviewPayload, `"expectedRevision":0`, `"expectedRevision":0e0`, 1),
		strings.Replace(validReportReviewPayload, `"expectedRevision":0`, `"expectedRevision":null`, 1),
		strings.Replace(validReportReviewPayload, `"status":"resolved"`, `"status":"resolved","status":"open"`, 1),
		strings.Replace(validReportReviewPayload, `"reason":"Private staff reasoning"`, `"reason":{}`, 1),
		strings.Replace(validReportReviewPayload, `"confirmed":true`, `"confirmed":true,"actor":"owner"`, 1),
		strings.Replace(validReportReviewPayload, `,"confirmed":true`, ``, 1),
		validReportReviewPayload + `{}`, `[]`, `null`, strings.Repeat(" ", 4097),
	}
	for _, payload := range invalid {
		if _, err := decodeAdminReportReview([]byte(payload)); err == nil {
			t.Fatal("invalid schema accepted", payload)
		}
	}
}

func TestAdminReportReviewAuthorizesEachActionAndKeepsPrivateReasonOnCase(t *testing.T) {
	c, roles := adminReadFixture(t)
	store := reportReviewStoreFixture(t)
	result := reviewReport(t, c, validReportReviewPayload)
	if !result.Success || !result.Authorized || !result.Final || result.Pending || store.calls != 1 || store.actor != c.username {
		t.Fatal(result, store.calls)
	}
	if store.request.Reason != "Private staff reasoning" || store.request.ExpectedStatus != "open" {
		t.Fatal(store.request)
	}
	encoded, _ := json.Marshal(adminActivities.(*fakeAdminActivityStore).events)
	if strings.Contains(string(encoded), "Private staff reasoning") || !strings.Contains(string(encoded), "consult the case receipt") {
		t.Fatal("admission audit leaked note or claimed final outcome", string(encoded))
	}
	roles.roles[c.username] = false
	result = reviewReport(t, c, validReportReviewPayload)
	if result.Authorized || result.Success || store.calls != 1 {
		t.Fatal("revoked role changed case", result)
	}
	events := adminActivities.(*fakeAdminActivityStore).events
	if events[len(events)-1].Result != "denied" {
		t.Fatal("denial not audited", events)
	}
	roles.roles[c.username] = true
	roles.lookupErr = errors.New("sensitive storage error")
	result = reviewReport(t, c, validReportReviewPayload)
	if result.Success || result.Authorized || store.calls != 1 || strings.Contains(result.Message, "sensitive") {
		t.Fatal(result)
	}
}

func TestAdminReportReviewFailsClosedAndDistinguishesConflictFromUnknownOutcome(t *testing.T) {
	c, _ := adminReadFixture(t)
	sessionActivityFixture(t)
	store := reportReviewStoreFixture(t)
	audit := adminActivities.(*fakeAdminActivityStore)
	audit.appendErr = errors.New("storage unavailable")
	result := reviewReport(t, c, validReportReviewPayload)
	if result.Success || store.calls != 0 {
		t.Fatal("unaudited case change admitted", result)
	}
	audit.appendErr = nil
	store.err = database.ErrReportReviewConflict
	result = reviewReport(t, c, validReportReviewPayload)
	if result.Success || !result.Final || result.Pending || !result.Authorized {
		t.Fatal(result)
	}
	store.err = errors.New("private database error")
	result = reviewReport(t, c, validReportReviewPayload)
	if result.Success || result.Final || !result.Pending || strings.Contains(result.Message, "private database") {
		t.Fatal(result)
	}
	before := store.calls
	result = reviewReport(t, c, strings.Replace(validReportReviewPayload, `"confirmed":true`, `"confirmed":false`, 1))
	if result.Success || store.calls != before {
		t.Fatal("unconfirmed change", result)
	}
	activeSessions[c.username] = &Client{username: c.username}
	result = reviewReport(t, c, validReportReviewPayload)
	if result.Success || result.Authorized || store.calls != before {
		t.Fatal("replaced connection changed case", result)
	}
}
