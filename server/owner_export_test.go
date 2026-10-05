package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

const validOwnerExportPayload = `{"requestId":"owner-section-00001","reportId":"0123456789abcdef01234567","approvalRevision":1,"currentPassword":"synthetic owner proof","section":"profile","characterName":""}`

type fakeOwnerExportStore struct {
	calls           int
	owner, password string
	data            []byte
	err             error
	after           func()
}

func (s *fakeOwnerExportStore) ReadApprovedOwnerExportQuery(ctx context.Context, owner, password, report string, revision int64, query database.OwnerExportQuery, at time.Time, budget int) ([]byte, error) {
	s.calls++
	s.owner = owner
	s.password = password
	if s.after != nil {
		s.after()
	}
	return s.data, s.err
}
func ownerExportFixture(t *testing.T) (*Client, *fakeOwnerExportStore) {
	c, _ := adminReadFixture(t)
	sessionActivityFixture(t)
	previousStore, previousGate := ownerExports, credentialAdmission
	store := &fakeOwnerExportStore{data: []byte(`{"format":"eidolon-owner-account-profile","version":1,"generated_at":"2026-10-05T12:00:00Z","profile":{"username":"operator","submitted_email":"owner@example.invalid"}}`)}
	ownerExports = store
	credentialAdmission = newCredentialWorkGate(2)
	t.Cleanup(func() { ownerExports = previousStore; credentialAdmission = previousGate })
	return c, store
}
func ownerExportReply(t *testing.T, c *Client, payload string) map[string]interface{} {
	t.Helper()
	messageHandlers[MsgOwnerExportSection](c, Message{Type: MsgOwnerExportSection, Payload: json.RawMessage(payload)})
	frames := drainSentMessages(c.send)
	var result map[string]interface{}
	if len(frames) != 1 || frames[0].Type != MsgOwnerExportSection+"_result" || json.Unmarshal(frames[0].Payload, &result) != nil {
		t.Fatal("missing correlated owner export reply")
	}
	return result
}
func TestOwnerExportStrictSchemaCurrentOwnerAndPrivateAudit(t *testing.T) {
	for _, payload := range []string{
		strings.Replace(validOwnerExportPayload, `"approvalRevision":1`, `"approvalRevision":null`, 1),
		strings.Replace(validOwnerExportPayload, `"approvalRevision":1`, `"approvalRevision":1.0`, 1),
		strings.Replace(validOwnerExportPayload, `"approvalRevision":1`, `"approvalRevision":2`, 1),
		strings.Replace(validOwnerExportPayload, `"currentPassword":"synthetic owner proof"`, `"currentPassword":null`, 1),
		strings.Replace(validOwnerExportPayload, `"section":"profile"`, `"section":"users"`, 1),
		strings.Replace(validOwnerExportPayload, `"characterName":""`, `"characterName":"","username":"victim"`, 1),
		strings.Replace(validOwnerExportPayload, `"section":"profile"`, `"section":"profile","section":"progress"`, 1),
		strings.Replace(validOwnerExportPayload, `"characterName":""`, `"characterName":"","before":null`, 1),
		strings.Replace(validOwnerExportPayload, `"characterName":""`, `"characterName":"","before":"0123456789abcdef01234560"`, 1),
		validOwnerExportPayload + ` {}`, strings.Repeat("x", 2049),
	} {
		if _, err := decodeOwnerExport([]byte(payload)); err == nil {
			t.Fatal("forged/malformed export admitted")
		}
	}
	c, store := ownerExportFixture(t)
	result := ownerExportReply(t, c, validOwnerExportPayload)
	if result["success"] != true || result["requestId"] != "owner-section-00001" || store.owner != c.username || store.password != "synthetic owner proof" {
		t.Fatal("export lost session owner/proof binding")
	}
	encoded, _ := json.Marshal(adminActivities.(*fakeAdminActivityStore).events)
	if strings.Contains(string(encoded), "synthetic owner proof") || strings.Contains(string(encoded), "owner@example.invalid") || !strings.Contains(string(encoded), MsgOwnerExportSection) {
		t.Fatal("read admission audit missing or leaked export contents")
	}
}

func TestOwnerExportPagedSectionsStrictCursor(t *testing.T) {
	for _, section := range []string{"reports", "sessions", "social", "market", "guilds", "invites", "pvp", "raids"} {
		t.Run(section, func(t *testing.T) {
			payload := strings.Replace(validOwnerExportPayload, `"section":"profile"`, `"section":"`+section+`"`, 1)
			for _, cursor := range []string{"", "0123456789abcdef01234560"} {
				request, err := decodeOwnerExport([]byte(strings.Replace(payload, `"characterName":""`, `"characterName":"","before":"`+cursor+`"`, 1)))
				if err != nil || request.Before != cursor || request.Section != section {
					t.Fatal("valid bounded page rejected", err)
				}
			}
			for _, cursor := range []string{"000000000000000000000000", "0123456789ABCDEF01234560", "another-account", strings.Repeat("a", 25)} {
				if _, err := decodeOwnerExport([]byte(strings.Replace(payload, `"characterName":""`, `"characterName":"","before":"`+cursor+`"`, 1))); err == nil {
					t.Fatal("invalid cursor accepted")
				}
			}
			if _, err := decodeOwnerExport([]byte(strings.Replace(payload, `"characterName":""`, `"characterName":"Other character"`, 1))); err == nil {
				t.Fatal("paged section used character target")
			}
		})
	}
}
func TestOwnerExportFailsClosedOnAuditAndConnectionChange(t *testing.T) {
	for _, mode := range []string{"audit", "superseded-after-source", "superseded-during-audit", "store", "oversized", "malformed"} {
		t.Run(mode, func(t *testing.T) {
			c, store := ownerExportFixture(t)
			if mode == "audit" {
				adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("unavailable")
			}
			if mode == "superseded-after-source" {
				store.after = func() { activeSessions[c.username] = &Client{username: c.username} }
			}
			if mode == "superseded-during-audit" {
				audit := adminActivities.(*fakeAdminActivityStore)
				adminActivities = &approvalAuditAuthorityHook{fakeAdminActivityStore: audit, after: func() { activeSessions[c.username] = &Client{username: c.username} }}
			}
			if mode == "store" {
				store.err = errors.New("private database detail")
			}
			if mode == "oversized" {
				store.data = []byte(strings.Repeat("x", maximumOwnerSectionBytes+1))
			}
			if mode == "malformed" {
				store.data = []byte(`{"password_hash":"never-deliver"}`)
			}
			result := ownerExportReply(t, c, validOwnerExportPayload)
			if result["success"] == true || result["data"] != nil {
				t.Fatal("failed/replaced owner received data")
			}
			encoded, _ := json.Marshal(result)
			if strings.Contains(string(encoded), "private database") || strings.Contains(string(encoded), "synthetic owner proof") {
				t.Fatal("private failure detail leaked")
			}
			if (mode == "audit" || mode == "superseded-during-audit") && store.calls != 0 {
				t.Fatal("data queried before durable audit/current-session gate")
			}
		})
	}
}
func TestOwnerExportAdmissionReceiptAndSharedCredentialConcurrency(t *testing.T) {
	c, store := ownerExportFixture(t)
	message := Message{Type: MsgOwnerExportSection, Payload: json.RawMessage(validOwnerExportPayload)}
	if (&Client{}).acceptInboundMessage(message, time.Now()) == nil {
		t.Fatal("anonymous owner export admitted")
	}
	c.sendInboundRejection(message, "rate limited")
	frames := drainSentMessages(c.send)
	if len(frames) != 1 || frames[0].Type != MsgOwnerExportSection+"_result" || strings.Contains(string(frames[0].Payload), "synthetic owner proof") {
		t.Fatal("admission did not return private correlated failure")
	}
	credentialAdmission = newCredentialWorkGate(1)
	done, err := credentialAdmission.begin(MsgLogin, "other", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	defer done()
	if result := ownerExportReply(t, c, validOwnerExportPayload); result["success"] == true || store.calls != 0 {
		t.Fatal("export bypassed shared password-work concurrency")
	}
}

func TestOwnerExportFreshConnectionsShareAccountBudget(t *testing.T) {
	c, store := ownerExportFixture(t)
	for attempt := 0; attempt < 4; attempt++ {
		fresh := &Client{username: c.username, send: make(chan []byte, 4)}
		activeSessions[c.username] = fresh
		result := ownerExportReply(t, fresh, validOwnerExportPayload)
		if (result["success"] == true) != (attempt < 3) {
			t.Fatal("fresh connection changed the three-per-minute owner read limit")
		}
	}
	if store.calls != 3 {
		t.Fatal("account budget failed to bound credential/data reads")
	}
}
