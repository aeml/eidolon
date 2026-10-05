package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

const validPrivacyApprovalPayload = `{"id":"export-approval-000001","reportId":"0123456789abcdef01234567","expectedRevision":0,"expectedReviewRevision":0,"expectedStatus":"open","enabled":true,"reason":"Private ownership review","confirmed":true}`

type fakePrivacyApprovalStore struct {
	calls   int
	actor   string
	request database.PrivacyExportApprovalRequest
	err     error
}

func (s *fakePrivacyApprovalStore) SetPrivacyExportApproval(actor string, request database.PrivacyExportApprovalRequest) (database.PrivacyExportApprovalReceipt, error) {
	s.calls++
	s.actor = actor
	s.request = request
	return database.PrivacyExportApprovalReceipt{Revision: request.ExpectedRevision + 1, Enabled: request.Enabled}, s.err
}
func privacyApprovalStoreFixture(t *testing.T) *fakePrivacyApprovalStore {
	previous := privacyExportApprovals
	store := &fakePrivacyApprovalStore{}
	privacyExportApprovals = store
	t.Cleanup(func() { privacyExportApprovals = previous })
	return store
}
func approvePrivacy(t *testing.T, c *Client, payload string) adminMutationResult {
	t.Helper()
	messageHandlers[MsgAdminPrivacyExportApproval](c, Message{Type: MsgAdminPrivacyExportApproval, Payload: json.RawMessage(payload)})
	messages := drainSentMessages(c.send)
	var result adminMutationResult
	if len(messages) != 1 || messages[0].Type != MsgAdminPrivacyExportApproval+"_result" || json.Unmarshal(messages[0].Payload, &result) != nil {
		t.Fatal("missing correlated approval result")
	}
	return result
}

func TestPrivacyExportApprovalStrictTransportSchemaAndBudget(t *testing.T) {
	if _, err := decodePrivacyExportApproval([]byte(validPrivacyApprovalPayload)); err != nil {
		t.Fatal(err)
	}
	for _, payload := range []string{
		strings.Replace(validPrivacyApprovalPayload, `"confirmed":true`, `"confirmed":false`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"enabled":true`, `"enabled":null`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"enabled":true`, `"enabled":"true"`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"expectedRevision":0`, `"expectedRevision":null`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"expectedRevision":0`, `"expectedRevision":0.0`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"expectedRevision":0`, `"expectedRevision":9223372036854775808`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"enabled":true`, `"enabled":true,"enabled":false`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"confirmed":true`, `"confirmed":true,"actor":"other"`, 1),
		strings.Replace(validPrivacyApprovalPayload, `"expectedReviewRevision":0,`, "", 1),
		validPrivacyApprovalPayload + ` {}`, strings.Repeat("x", 4097),
	} {
		if _, err := decodePrivacyExportApproval([]byte(payload)); err == nil {
			t.Fatal("invalid approval transport admitted")
		}
	}
	message := Message{Type: MsgAdminPrivacyExportApproval, Payload: json.RawMessage(validPrivacyApprovalPayload)}
	if err := (&Client{}).acceptInboundMessage(message, time.Now()); err == nil {
		t.Fatal("anonymous approval admitted")
	}
	c := &Client{username: "authenticated"}
	now := time.Now()
	for i := 0; i < 3; i++ {
		if err := c.acceptInboundMessage(message, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := c.acceptInboundMessage(message, now); err == nil {
		t.Fatal("approval rate bound lost")
	}
}

func TestPrivacyExportApprovalAuditedAuthorityAndKnownUnknownOutcomes(t *testing.T) {
	c, roles := adminReadFixture(t)
	_, audit := sessionActivityFixture(t)
	store := privacyApprovalStoreFixture(t)
	result := approvePrivacy(t, c, validPrivacyApprovalPayload)
	if !result.Success || !result.Final || !result.Authorized || store.calls != 1 || store.actor != c.username || !store.request.Enabled {
		t.Fatal("confirmed staff approval not routed")
	}
	encoded, _ := json.Marshal(audit.events)
	if !strings.Contains(string(encoded), MsgAdminPrivacyExportApproval) || strings.Contains(string(encoded), "Private ownership") || strings.Contains(string(encoded), "data was sent") {
		t.Fatal("admission audit leaked case note or claimed delivery")
	}
	roles.roles[c.username] = false
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || result.Authorized || store.calls != 1 {
		t.Fatal("revoked role approved export")
	}
	roles.roles[c.username] = true
	roles.lookupErr = errors.New("sensitive role failure")
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || store.calls != 1 || strings.Contains(result.Message, "sensitive") {
		t.Fatal("role failure did not fail closed")
	}
	roles.lookupErr = nil
	audit.appendErr = errors.New("audit unavailable")
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || store.calls != 1 {
		t.Fatal("unlogged approval admitted")
	}
	audit.appendErr = nil
	store.err = database.ErrPrivacyExportApprovalConflict
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || !result.Final || result.Pending {
		t.Fatal("known conflict became uncertain retry")
	}
	store.err = errors.New("sensitive case failure")
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || !result.Pending || result.Final || strings.Contains(result.Message, "sensitive") {
		t.Fatal("unconfirmed store outcome claimed approval")
	}
	before := store.calls
	activeSessions[c.username] = &Client{username: c.username}
	result = approvePrivacy(t, c, validPrivacyApprovalPayload)
	if result.Success || result.Authorized || store.calls != before {
		t.Fatal("superseded connection changed export permission")
	}
}

type approvalAuditAuthorityHook struct {
	*fakeAdminActivityStore
	after func()
}

func (a *approvalAuditAuthorityHook) AppendAdminActivity(event database.AdminActivity) error {
	if err := a.fakeAdminActivityStore.AppendAdminActivity(event); err != nil {
		return err
	}
	a.after()
	return nil
}
func TestPrivacyExportApprovalRechecksAuthorityAfterAdmissionAudit(t *testing.T) {
	for _, mode := range []string{"role", "connection", "transport"} {
		t.Run(mode, func(t *testing.T) {
			c, roles := adminReadFixture(t)
			_, audit := sessionActivityFixture(t)
			store := privacyApprovalStoreFixture(t)
			adminActivities = &approvalAuditAuthorityHook{fakeAdminActivityStore: audit, after: func() {
				if mode == "role" {
					roles.roles[c.username] = false
				}
				if mode == "connection" {
					activeSessions[c.username] = &Client{username: c.username}
				}
				if mode == "transport" {
					c.transportClosed.Store(true)
				}
			}}
			// Invoke directly because a transport close intentionally suppresses sendSafe.
			handleAdminPrivacyExportApproval(c, Message{Type: MsgAdminPrivacyExportApproval, Payload: json.RawMessage(validPrivacyApprovalPayload)})
			if store.calls != 0 {
				t.Fatal("authority changed during audit but approval proceeded")
			}
		})
	}
}
