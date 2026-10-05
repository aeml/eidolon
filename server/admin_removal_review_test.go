package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

const validRemovalReviewPayload = `{"id":"removal-read-000001","reportId":"0123456789abcdef01234567","expectedRevision":0,"expectedStatus":"open"}`

type fakeRemovalReviewStore struct {
	calls int
	hook  func()
	err   error
}

func (s *fakeRemovalReviewStore) ReadRemovalReview(q database.RemovalReviewQuery) (database.RemovalReviewSnapshot, error) {
	s.calls++
	if s.hook != nil {
		s.hook()
	}
	return database.RemovalReviewSnapshot{Owner: "private-case-owner", ReportID: q.ReportID, ReviewRevision: q.ExpectedRevision, CaseStatus: q.ExpectedStatus,
		CheckedAt: time.Now(), References: []database.RemovalReferenceCheck{}, RequiredReview: []string{"Independent authorization required"}}, s.err
}

func TestAdminRemovalReviewClosedSchemaAndAdmissionPolicy(t *testing.T) {
	if _, err := decodeAdminRemovalReview([]byte(validRemovalReviewPayload)); err != nil {
		t.Fatal(err)
	}
	for _, payload := range []string{
		strings.Replace(validRemovalReviewPayload, `"expectedRevision":0`, `"expectedRevision":null`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedRevision":0`, `"expectedRevision":"0"`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedRevision":0`, `"expectedRevision":-1`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedRevision":0`, `"expectedRevision":257`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedRevision":0`, `"expectedRevision":0,"expectedRevision":1`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedStatus":"open"`, `"expectedStatus":"deleted"`, 1),
		strings.Replace(validRemovalReviewPayload, `"expectedStatus":"open"`, `"expectedStatus":"open","target":"other"`, 1),
		strings.Replace(validRemovalReviewPayload, `"reportId":"0123456789abcdef01234567"`, `"reportId":"000000000000000000000000"`, 1),
		validRemovalReviewPayload + " {}", strings.Repeat("x", 1025),
	} {
		if _, err := decodeAdminRemovalReview([]byte(payload)); err == nil {
			t.Fatal("invalid review schema accepted")
		}
	}
	if messageHandlers[MsgAdminRemovalReview] == nil {
		t.Fatal("missing module handler")
	}
	// The common protocol-policy suite also checks registry completeness.
}

func TestAdminRemovalReviewRoleAuditSessionFencesAndNoOwnerDisclosure(t *testing.T) {
	for _, scenario := range []string{"valid", "denied", "store-failure", "audit-failure", "late-role-revoke", "late-session-replace", "journal-error"} {
		t.Run(scenario, func(t *testing.T) {
			c, roles := adminReadFixture(t)
			sessionActivityFixture(t)
			previous, previousJournal := adminRemovalReviews, characterSaveJournal
			store := &fakeRemovalReviewStore{}
			adminRemovalReviews, characterSaveJournal = store, nil
			t.Cleanup(func() { adminRemovalReviews, characterSaveJournal = previous, previousJournal })
			switch scenario {
			case "denied":
				roles.roles["operator"] = false
			case "store-failure":
				store.err = errors.New("private-store-diagnostic")
			case "audit-failure":
				adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("private-audit-failure")
			case "late-role-revoke":
				store.hook = func() { roles.roles["operator"] = false }
			case "late-session-replace":
				store.hook = func() { activeSessions[c.username] = &Client{username: c.username} }
			case "journal-error":
				dir := t.TempDir()
				journal, err := database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				characterSaveJournal = journal
				digest := sha256.Sum256([]byte("private-case-owner"))
				if err := os.Mkdir(filepath.Join(dir, hex.EncodeToString(digest[:])+".bson"), 0700); err != nil {
					t.Fatal(err)
				}
			}
			messageHandlers[MsgAdminRemovalReview](c, Message{Type: MsgAdminRemovalReview, Payload: json.RawMessage(validRemovalReviewPayload)})
			messages := drainSentMessages(c.send)
			var result adminReadResult
			if len(messages) != 1 || json.Unmarshal(messages[0].Payload, &result) != nil || messages[0].Type != MsgAdminRemovalReview+"_result" {
				t.Fatal("missing correlated response")
			}
			if scenario == "valid" {
				if !result.Success || !result.Authorized || result.Removal == nil || result.Removal.OnlineObserved == nil || *result.Removal.OnlineObserved || result.Removal.PendingCharacterSave != nil || result.Removal.RemovalSupported || result.Removal.RemovalAuthorized {
					t.Fatal("invalid read-only/unknown observation", result)
				}
			} else if result.Success || result.Removal != nil {
				t.Fatal("failed review disclosed dependencies")
			}
			if scenario == "denied" && store.calls != 0 || strings.Contains(string(messages[0].Payload), "private-") {
				t.Fatal("denied read/internal owner/error disclosure")
			}
			audits, _ := json.Marshal(adminActivities.(*fakeAdminActivityStore).events)
			if strings.Contains(string(audits), "private-case-owner") {
				t.Fatal("case owner copied into general history")
			}
		})
	}
}
