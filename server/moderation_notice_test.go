package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

const moderationNoticePayload = `{"requestId":"notice-request-000001"}`

type fakeOwnModerationNotice struct {
	username  string
	calls     int
	notice    *database.ChatMuteNotice
	err       error
	afterRead func()
}

func (s *fakeOwnModerationNotice) OwnChatMuteNotice(username string) (*database.ChatMuteNotice, error) {
	s.calls++
	s.username = username
	if s.afterRead != nil {
		s.afterRead()
	}
	return s.notice, s.err
}

func TestModerationNoticeStrictOwnerOnlySchema(t *testing.T) {
	id, err := decodeModerationNoticeRequest([]byte(moderationNoticePayload))
	if err != nil || id != "notice-request-000001" {
		t.Fatal(id, err)
	}
	for _, payload := range []string{
		`{}`, `null`, `[]`, `{"requestId":null}`, `{"requestId":7}`, `{"requestId":{}}`,
		`{"requestId":"invalid.id"}`, `{"requestId":"notice-request-000001","username":"other"}`,
		`{"requestId":"notice-request-000001","noticeId":"other"}`,
		`{"requestId":"notice-request-000001","requestId":"notice-request-000002"}`,
		moderationNoticePayload + `{}`, strings.Repeat(" ", 257), string([]byte{255}),
	} {
		if _, err := decodeModerationNoticeRequest([]byte(payload)); err == nil {
			t.Fatal("invalid owner lookup admitted", payload)
		}
	}
}

func TestModerationNoticeCurrentOwnerPrivacyFailureAndRetirement(t *testing.T) {
	c, roles := adminReadFixture(t)
	roles.roles[c.username] = false // Ordinary players must be able to appeal.
	store := &fakeOwnModerationNotice{notice: &database.ChatMuteNotice{ID: strings.Repeat("a", 64),
		StartedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(9 * time.Minute), Reason: "Public explanation."}}
	previous := moderationNotices
	moderationNotices = store
	t.Cleanup(func() { moderationNotices = previous })
	firstDispatch := true
	lookup := func(payload string) string {
		t.Helper()
		message := Message{Type: MsgModerationNotice, Payload: json.RawMessage(payload)}
		// First probe proves actual protocol registration. Subsequent handler
		// boundary probes bypass admission rather than changing its live limits.
		if firstDispatch {
			c.handleMessage(message)
			firstDispatch = false
		} else {
			handleOwnModerationNotice(c, message)
		}
		messages := drainSentMessages(c.send)
		if len(messages) != 1 || messages[0].Type != MsgModerationNotice+"_result" {
			t.Fatal(messages)
		}
		return string(messages[0].Payload)
	}
	result := lookup(moderationNoticePayload)
	if store.calls != 1 || store.username != c.username || !strings.Contains(result, `"success":true`) ||
		!strings.Contains(result, "Public explanation.") || strings.Contains(result, "operator") || strings.Contains(result, "reportId") {
		t.Fatal("owner/privacy boundary failed", result, store)
	}
	store.notice = nil
	if result := lookup(moderationNoticePayload); !strings.Contains(result, `"success":true`) || strings.Contains(result, `"notice":`) {
		t.Fatal("empty notice is not an error or a claim about other sanctions", result)
	}
	store.err = errors.New("private database diagnostic")
	result = lookup(moderationNoticePayload)
	if !strings.Contains(result, `"success":false`) || strings.Contains(result, "private database") {
		t.Fatal(result)
	}
	store.err = nil
	before := store.calls
	_ = lookup(`{"requestId":"notice-request-000001","username":"other"}`)
	if store.calls != before {
		t.Fatal("owner override reached store")
	}
	store.notice = &database.ChatMuteNotice{ID: "invalid", Reason: "Untrusted malformed notice"}
	if result := lookup(moderationNoticePayload); !strings.Contains(result, `"success":false`) || strings.Contains(result, "Untrusted") {
		t.Fatal(result)
	}
	store.notice = &database.ChatMuteNotice{ID: strings.Repeat("a", 64), StartedAt: time.Now().Add(-20 * time.Minute), ExpiresAt: time.Now().Add(-10 * time.Minute), Reason: "Expired explanation"}
	if result := lookup(moderationNoticePayload); !strings.Contains(result, `"success":true`) || strings.Contains(result, `"notice":`) {
		t.Fatal("expired notice sent as active", result)
	}
	// Session replacement during the read must not disclose an old owner's notice.
	store.notice = &database.ChatMuteNotice{ID: strings.Repeat("a", 64), StartedAt: time.Now().Add(-time.Minute), ExpiresAt: time.Now().Add(time.Minute), Reason: "Must not escape retired session."}
	store.afterRead = func() { activeSessions[c.username] = &Client{username: c.username} }
	if result := lookup(moderationNoticePayload); !strings.Contains(result, `"success":false`) || strings.Contains(result, "escape") {
		t.Fatal(result)
	}
	before = store.calls
	handleOwnModerationNotice(c, Message{Type: MsgModerationNotice, Payload: json.RawMessage(moderationNoticePayload)})
	_ = drainSentMessages(c.send)
	if store.calls != before {
		t.Fatal("retired connection reached notice store")
	}
	activeSessions[c.username] = c
	store.afterRead = func() { c.username = "another-account"; activeSessions[c.username] = c }
	if result := lookup(moderationNoticePayload); !strings.Contains(result, `"success":false`) || strings.Contains(result, "escape") {
		t.Fatal("same connection changing authenticated owner leaked a notice", result)
	}
}
