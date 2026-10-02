package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const validAdminChatMutePayload = `{"id":"mute-request-000001","accountId":"abcdef012345678901234567","reportId":"0123456789abcdef01234567","expectedRevision":0,"action":"mute","durationSeconds":600,"noticeId":"","publicReason":"Public explanation","privateReason":"Private evidence","confirmed":true}`

type fakeAdminChatModerationStore struct {
	calls     int
	actor     string
	accountID primitive.ObjectID
	request   database.ChatModerationRequest
	err       error
}

func (s *fakeAdminChatModerationStore) ApplyChatModeration(actor string, accountID primitive.ObjectID, request database.ChatModerationRequest) (database.ChatModerationReceipt, error) {
	s.calls++
	s.actor, s.accountID, s.request = actor, accountID, request
	return database.ChatModerationReceipt{Revision: request.ExpectedRevision + 1}, s.err
}

type changingChatModerationAudit struct {
	*fakeAdminActivityStore
	afterAppend func()
}

func (s *changingChatModerationAudit) AppendAdminActivity(event database.AdminActivity) error {
	err := s.fakeAdminActivityStore.AppendAdminActivity(event)
	if s.afterAppend != nil {
		s.afterAppend()
	}
	return err
}

func chatModerationStoreFixture(t *testing.T) *fakeAdminChatModerationStore {
	t.Helper()
	previous := adminChatModerations
	store := &fakeAdminChatModerationStore{}
	adminChatModerations = store
	t.Cleanup(func() { adminChatModerations = previous })
	return store
}

func moderateChat(t *testing.T, c *Client, payload string) adminMutationResult {
	t.Helper()
	handleAdminChatModeration(c, Message{Type: MsgAdminChatModeration, Payload: json.RawMessage(payload)})
	messages := drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminChatModeration+"_result" {
		t.Fatal(messages)
	}
	var result adminMutationResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestAdminChatModerationClosedSchemaAndExplicitReversal(t *testing.T) {
	request, err := decodeAdminChatModeration([]byte(validAdminChatMutePayload))
	if err != nil || request.AccountID.Hex() != "abcdef012345678901234567" || request.Change.DurationSeconds != 600 {
		t.Fatal(request, err)
	}
	reversal := strings.NewReplacer(`"action":"mute"`, `"action":"revoke"`, `"durationSeconds":600`, `"durationSeconds":0`,
		`"noticeId":""`, `"noticeId":"`+strings.Repeat("a", 64)+`"`, `"publicReason":"Public explanation"`, `"publicReason":""`).Replace(validAdminChatMutePayload)
	if request, err := decodeAdminChatModeration([]byte(reversal)); err != nil || request.Change.Action != database.ChatModerationRevoke {
		t.Fatal(request, err)
	}
	for _, kind := range []string{database.ModerationSuspend, database.ModerationRequireNameChange} {
		payload := strings.Replace(validAdminChatMutePayload, `"action":"mute"`, `"action":"`+kind+`"`, 1)
		if kind == database.ModerationRequireNameChange {
			payload = strings.Replace(payload, `"durationSeconds":600`, `"durationSeconds":0`, 1)
		}
		if request, err := decodeAdminChatModeration([]byte(payload)); err != nil || request.Change.Action != kind {
			t.Fatal("approved action failed strict decoding", kind, request, err)
		}
	}
	invalid := []string{
		`null`, `[]`, `{}`, validAdminChatMutePayload + `{}`, strings.Repeat(" ", 12289), string([]byte{255}),
		strings.Replace(validAdminChatMutePayload, `"confirmed":true`, `"confirmed":false`, 1),
		strings.Replace(validAdminChatMutePayload, `"confirmed":true`, `"confirmed":"true"`, 1),
		strings.Replace(validAdminChatMutePayload, `,"confirmed":true`, ``, 1),
		strings.Replace(validAdminChatMutePayload, `"confirmed":true`, `"confirmed":true,"actor":"owner"`, 1),
		strings.Replace(validAdminChatMutePayload, `"expectedRevision":0`, `"expectedRevision":0,"expectedRevision":1`, 1),
		strings.Replace(validAdminChatMutePayload, `"expectedRevision":0`, `"expectedRevision":0.0`, 1),
		strings.Replace(validAdminChatMutePayload, `"durationSeconds":600`, `"durationSeconds":6e2`, 1),
		strings.Replace(validAdminChatMutePayload, `"durationSeconds":600`, `"durationSeconds":0`, 1),
		strings.Replace(validAdminChatMutePayload, `"durationSeconds":600`, `"durationSeconds":"600"`, 1),
		strings.Replace(validAdminChatMutePayload, `"accountId":"abcdef012345678901234567"`, `"accountId":"ABCDEF012345678901234567"`, 1),
		strings.Replace(validAdminChatMutePayload, `"accountId":"abcdef012345678901234567"`, `"accountId":"000000000000000000000000"`, 1),
		strings.Replace(validAdminChatMutePayload, `"publicReason":"Public explanation"`, `"publicReason":{}`, 1),
		strings.Replace(validAdminChatMutePayload, `"action":"mute"`, `"action":"permanent_ban"`, 1),
	}
	for _, payload := range invalid {
		if _, err := decodeAdminChatModeration([]byte(payload)); err == nil {
			t.Fatal("invalid request admitted", payload)
		}
	}
}

func TestAdminChatModerationAuditAuthorizationAndPrivateReceiptBoundary(t *testing.T) {
	c, roles := adminReadFixture(t)
	store := chatModerationStoreFixture(t)
	result := moderateChat(t, c, validAdminChatMutePayload)
	if !result.Authorized || !result.Success || !result.Final || result.Pending || store.calls != 1 || store.actor != c.username ||
		store.accountID.Hex() != "abcdef012345678901234567" || store.request.PrivateReason != "Private evidence" {
		t.Fatal(result, store)
	}
	encoded, _ := json.Marshal(adminActivities.(*fakeAdminActivityStore).events)
	if strings.Contains(string(encoded), "Private evidence") || strings.Contains(string(encoded), "Public explanation") ||
		!strings.Contains(string(encoded), "consult the private account receipt") || strings.Contains(result.Message, "Private evidence") {
		t.Fatal("private evidence leak or false final audit", string(encoded), result)
	}
	roles.roles[c.username] = false
	if result := moderateChat(t, c, validAdminChatMutePayload); result.Success || result.Authorized || store.calls != 1 {
		t.Fatal("revoked admin acted", result)
	}
	roles.roles[c.username] = true
	roles.lookupErr = errors.New("private authorization diagnostic")
	if result := moderateChat(t, c, validAdminChatMutePayload); result.Success || result.Authorized || store.calls != 1 || strings.Contains(result.Message, "private") {
		t.Fatal(result)
	}
}

func TestAdminChatModerationAuditFailureConflictAndUnknownOutcome(t *testing.T) {
	c, _ := adminReadFixture(t)
	sessionActivityFixture(t)
	store := chatModerationStoreFixture(t)
	audit := adminActivities.(*fakeAdminActivityStore)
	audit.appendErr = errors.New("unavailable audit")
	if result := moderateChat(t, c, validAdminChatMutePayload); result.Success || store.calls != 0 {
		t.Fatal("unaudited write", result)
	}
	audit.appendErr = nil
	store.err = database.ErrChatModerationConflict
	if result := moderateChat(t, c, validAdminChatMutePayload); result.Success || !result.Final || result.Pending {
		t.Fatal(result)
	}
	store.err = errors.New("private uncertain-write diagnostic")
	if result := moderateChat(t, c, validAdminChatMutePayload); result.Success || result.Final || !result.Pending || strings.Contains(result.Message, "private") {
		t.Fatal(result)
	}
	before := store.calls
	if result := moderateChat(t, c, strings.Replace(validAdminChatMutePayload, `"confirmed":true`, `"confirmed":false`, 1)); result.Success || store.calls != before {
		t.Fatal("unconfirmed write", result)
	}
}

func TestAdminChatModerationRechecksSessionAndRoleAfterAudit(t *testing.T) {
	for _, change := range []string{"replacement", "revocation", "owner", "closed"} {
		t.Run(change, func(t *testing.T) {
			c, roles := adminReadFixture(t)
			store := chatModerationStoreFixture(t)
			base := adminActivities.(*fakeAdminActivityStore)
			adminActivities = &changingChatModerationAudit{fakeAdminActivityStore: base, afterAppend: func() {
				switch change {
				case "replacement":
					activeSessions[c.username] = &Client{username: c.username}
				case "revocation":
					roles.roles[c.username] = false
				case "owner":
					c.username = "other"
				case "closed":
					c.transportClosed.Store(true)
				}
			}}
			result := moderateChat(t, c, validAdminChatMutePayload)
			if result.Success || result.Authorized || store.calls != 0 {
				t.Fatal("retired authority wrote", result, store.calls)
			}
		})
	}
}

func TestPreparedChatModerationIsNotActivated(t *testing.T) {
	if _, ok := inboundMessagePolicies[MsgAdminChatModeration]; ok {
		t.Fatal("incomplete moderation action admitted before full activation")
	}
	if _, ok := messageHandlers[MsgAdminChatModeration]; ok {
		t.Fatal("incomplete moderation action registered before full activation")
	}
	if newStructuredChatService(50).authorizeSend != nil {
		t.Fatal("partial moderation enforcement installed before full activation")
	}
}
