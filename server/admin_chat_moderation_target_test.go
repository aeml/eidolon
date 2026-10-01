package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const validModerationTargetPayload = `{"id":"target-request-000001","target":"alice"}`

type fakeChatModerationTargetStore struct {
	target         database.ChatModerationTarget
	err            error
	calls          int
	actor, account string
	afterRead      func()
}

func (s *fakeChatModerationTargetStore) ReadChatModerationTarget(actor, account string) (database.ChatModerationTarget, error) {
	s.calls++
	s.actor, s.account = actor, account
	if s.afterRead != nil {
		s.afterRead()
	}
	return s.target, s.err
}

func moderationTargetFixture(t *testing.T) *fakeChatModerationTargetStore {
	t.Helper()
	id, _ := primitive.ObjectIDFromHex("abcdef012345678901234567")
	store := &fakeChatModerationTargetStore{target: database.ChatModerationTarget{AccountID: id, Account: "alice", Revision: 0}}
	previous := adminChatModerationTargets
	adminChatModerationTargets = store
	t.Cleanup(func() { adminChatModerationTargets = previous })
	return store
}

func previewModerationTarget(t *testing.T, c *Client, payload string) string {
	t.Helper()
	handleAdminChatModerationTarget(c, Message{Type: MsgAdminChatModerationTarget, Payload: json.RawMessage(payload)})
	messages := drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminChatModerationTarget+"_result" {
		t.Fatal(messages)
	}
	return string(messages[0].Payload)
}

func TestAdminChatModerationTargetClosedSchemaAndInactiveProtocol(t *testing.T) {
	request, err := decodeAdminChatModerationTarget([]byte(validModerationTargetPayload))
	if err != nil || request.Target != "alice" {
		t.Fatal(request, err)
	}
	for _, payload := range []string{
		`null`, `[]`, `{}`, validModerationTargetPayload + `{}`, strings.Repeat(" ", 3073), string([]byte{255}),
		`{"id":"target-request-000001","target":"alice","target":"bob"}`,
		`{"id":"target-request-000001","target":"alice","actor":"owner"}`,
		`{"id":"target-request-000001","target":7}`, `{"id":"target-request-000001","target":{}}`,
		`{"id":"target-request-000001","target":" "}`, `{"id":"target-request-000001","target":"alice\n"}`,
	} {
		if _, err := decodeAdminChatModerationTarget([]byte(payload)); err == nil {
			t.Fatal("invalid target admitted", payload)
		}
	}
	if _, ok := inboundMessagePolicies[MsgAdminChatModerationTarget]; ok {
		t.Fatal("unapproved target protocol admitted")
	}
	if _, ok := messageHandlers[MsgAdminChatModerationTarget]; ok {
		t.Fatal("unapproved target protocol registered")
	}
}

func TestAdminChatModerationTargetChoosesSubjectAndFailsClosed(t *testing.T) {
	c, roles := adminReadFixture(t)
	sessionActivityFixture(t)
	store := moderationTargetFixture(t)
	result := previewModerationTarget(t, c, validModerationTargetPayload)
	if !strings.Contains(result, `"success":true`) || !strings.Contains(result, `"accountId":"abcdef012345678901234567"`) ||
		store.actor != c.username || store.account != "alice" {
		t.Fatal("wrong account preview", result, store)
	}
	roles.roles[c.username] = false
	if result := previewModerationTarget(t, c, validModerationTargetPayload); strings.Contains(result, `"target":`) || strings.Contains(result, `"authorized":true`) || store.calls != 1 {
		t.Fatal("ordinary account read moderation", result)
	}
	roles.roles[c.username] = true
	store.err = errors.New("private credentials and database diagnostics")
	if result := previewModerationTarget(t, c, validModerationTargetPayload); strings.Contains(result, `"target":`) || strings.Contains(result, "credentials") {
		t.Fatal(result)
	}
	store.err = nil
	store.target.Account = "bob"
	if result := previewModerationTarget(t, c, validModerationTargetPayload); strings.Contains(result, `"target":`) {
		t.Fatal("mismatched subject returned", result)
	}
	store.target.Account = "alice"
	store.target.Revision = 300
	if result := previewModerationTarget(t, c, validModerationTargetPayload); strings.Contains(result, `"target":`) {
		t.Fatal("malformed account state returned", result)
	}
	store.target.Revision = 0
	adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("audit unavailable")
	if result := previewModerationTarget(t, c, validModerationTargetPayload); strings.Contains(result, `"target":`) || strings.Contains(result, `"success":true`) {
		t.Fatal("unaudited preview returned", result)
	}
}

func TestAdminChatModerationTargetRetiresAuthorityDuringReadAndAudit(t *testing.T) {
	for _, stage := range []string{"read", "audit"} {
		for _, change := range []string{"replacement", "revocation", "owner", "closed"} {
			t.Run(stage+"-"+change, func(t *testing.T) {
				c, roles := adminReadFixture(t)
				store := moderationTargetFixture(t)
				alter := func() {
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
				}
				if stage == "read" {
					store.afterRead = alter
				} else {
					adminActivities = &changingChatModerationAudit{fakeAdminActivityStore: adminActivities.(*fakeAdminActivityStore), afterAppend: alter}
				}
				result := previewModerationTarget(t, c, validModerationTargetPayload)
				if strings.Contains(result, `"target":`) || strings.Contains(result, `"authorized":true`) || strings.Contains(result, `"success":true`) {
					t.Fatal("retired authority saw target", result)
				}
			})
		}
	}
}
