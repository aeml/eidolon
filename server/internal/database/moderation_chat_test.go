package database

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func chatModerationFixture() (primitive.ObjectID, ChatModerationRequest, time.Time) {
	account, _ := primitive.ObjectIDFromHex("0123456789abcdef01234567")
	return account, ChatModerationRequest{ID: "chat-mute-request-000001", ReportID: "1123456789abcdef01234567",
			Action: ChatModerationMute, DurationSeconds: 600, PublicReason: "Repeated abusive chat. You may appeal this notice.",
			PrivateReason: "Reviewed the conduct case and selected message.", Confirmed: true},
		time.Date(2026, 10, 1, 22, 0, 0, 123456789, time.UTC)
}

func TestChatModerationMuteExpiryAndPrivateProjection(t *testing.T) {
	account, request, now := chatModerationFixture()
	original := AccountChatModeration{}
	state, receipt, replay, err := PrepareChatModeration(original, "operator", account, request, now)
	if err != nil || replay || state.Revision != 1 || original.Mute != nil || original.Receipts != nil ||
		!receipt.Notice.ExpiresAt.Equal(now.Truncate(time.Millisecond).Add(600*time.Second)) {
		t.Fatal(state, receipt, replay, err)
	}
	for _, at := range []time.Time{receipt.At, receipt.At.Add(time.Minute), receipt.Notice.ExpiresAt.Add(-time.Nanosecond)} {
		notice := state.ActiveNotice(at)
		if notice == nil || notice.ID != receipt.Notice.ID || notice.Reason != request.PublicReason {
			t.Fatal("active mute was lost", at, notice)
		}
		notice.Reason = "Changing returned data must not mutate durable state."
		if state.Mute.Reason != request.PublicReason {
			t.Fatal("public projection aliases state")
		}
	}
	for _, at := range []time.Time{time.Time{}, receipt.At.Add(-time.Nanosecond), receipt.Notice.ExpiresAt, receipt.Notice.ExpiresAt.Add(time.Hour)} {
		if state.ActiveNotice(at) != nil {
			t.Fatal("mute active outside its exact interval", at)
		}
	}
	public, _ := json.Marshal(state.ActiveNotice(now))
	if strings.Contains(string(public), request.ReportID) || strings.Contains(string(public), request.PrivateReason) ||
		strings.Contains(string(public), "operator") || !strings.Contains(string(public), request.PublicReason) {
		t.Fatal("notice leaked staff data or lost its public explanation", string(public))
	}
	privateJSON, _ := json.Marshal(state)
	if string(privateJSON) != "{}" {
		t.Fatal("private account state must not be a player payload", string(privateJSON))
	}
	encoded, err := bson.Marshal(state)
	var reloaded AccountChatModeration
	if err != nil {
		t.Fatal(err)
	}
	if err := bson.Unmarshal(encoded, &reloaded); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(reloaded, state) {
		t.Fatal("BSON restart lost moderation state", reloaded, state)
	}
}

func TestChatModerationRetryDoesNotExtendMuteAndReversalTargetsNotice(t *testing.T) {
	account, request, now := chatModerationFixture()
	state, issued, _, err := PrepareChatModeration(AccountChatModeration{}, "operator", account, request, now)
	if err != nil {
		t.Fatal(err)
	}
	unchanged, retry, replay, err := PrepareChatModeration(state, "operator", account, request, now.Add(time.Hour))
	if err != nil || !replay || !reflect.DeepEqual(retry, issued) || !reflect.DeepEqual(unchanged, state) {
		t.Fatal("retry extended or duplicated the mute", retry, replay, err)
	}
	revoke := request
	revoke.ID, revoke.Action, revoke.ExpectedRevision = "chat-revoke-request-001", ChatModerationRevoke, 1
	revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = issued.Notice.ID, 0, ""
	revoke.PrivateReason = "Appeal reviewed; reverse this exact notice."
	reversed, reversal, replay, err := PrepareChatModeration(state, "operator", account, revoke, now.Add(time.Minute))
	if err != nil || replay || reversed.Mute != nil || reversed.Revision != 2 || len(reversed.Receipts) != 2 || state.Mute == nil {
		t.Fatal(reversed, reversal, replay, err)
	}
	// Retrying an old mute after reversal returns its receipt, not a new mute.
	stillReversed, retry, replay, err := PrepareChatModeration(reversed, "operator", account, request, now.Add(time.Hour))
	if err != nil || !replay || retry.Revision != 1 || stillReversed.Mute != nil || stillReversed.Revision != 2 {
		t.Fatal("old retry reinstated a reversed mute", stillReversed, retry, replay, err)
	}
	newMute := request
	newMute.ID, newMute.ExpectedRevision = "chat-mute-request-000002", 2
	newState, _, _, err := PrepareChatModeration(reversed, "operator", account, newMute, now.Add(2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	// Exact old reversal acknowledges its old receipt without touching the new mute.
	kept, retry, replay, err := PrepareChatModeration(newState, "operator", account, revoke, now.Add(3*time.Minute))
	if err != nil || !replay || retry.Revision != 2 || kept.Mute.ID != newState.Mute.ID {
		t.Fatal(kept, retry, replay, err)
	}
	staleRevoke := revoke
	staleRevoke.ID, staleRevoke.ExpectedRevision = "chat-revoke-request-002", 3
	if _, _, _, err := PrepareChatModeration(newState, "operator", account, staleRevoke, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("reversal removed a different notice", err)
	}
}

func TestChatModerationValidationIdentityAndCorruptReceipts(t *testing.T) {
	account, request, now := chatModerationFixture()
	invalid := map[string]func(*ChatModerationRequest){
		"unconfirmed":            func(r *ChatModerationRequest) { r.Confirmed = false },
		"negative revision":      func(r *ChatModerationRequest) { r.ExpectedRevision = -1 },
		"reserve reversal slot":  func(r *ChatModerationRequest) { r.ExpectedRevision = MaximumChatModerationReceipts - 1 },
		"unsafe ID":              func(r *ChatModerationRequest) { r.ID = "unsafe.$id" },
		"missing case":           func(r *ChatModerationRequest) { r.ReportID = "" },
		"zero case":              func(r *ChatModerationRequest) { r.ReportID = strings.Repeat("0", 24) },
		"unknown action":         func(r *ChatModerationRequest) { r.Action = "suspend" },
		"zero duration":          func(r *ChatModerationRequest) { r.DurationSeconds = 0 },
		"negative duration":      func(r *ChatModerationRequest) { r.DurationSeconds = -1 },
		"huge duration":          func(r *ChatModerationRequest) { r.DurationSeconds = MaximumChatMuteSeconds + 1 },
		"blank private reason":   func(r *ChatModerationRequest) { r.PrivateReason = "  " },
		"blank public reason":    func(r *ChatModerationRequest) { r.PublicReason = "" },
		"invalid UTF8":           func(r *ChatModerationRequest) { r.PrivateReason = string([]byte{255}) },
		"control character":      func(r *ChatModerationRequest) { r.PublicReason = "hello\x00world" },
		"oversize public":        func(r *ChatModerationRequest) { r.PublicReason = strings.Repeat("x", 601) },
		"oversize private":       func(r *ChatModerationRequest) { r.PrivateReason = strings.Repeat("x", 1601) },
		"mute quotes old notice": func(r *ChatModerationRequest) { r.NoticeID = strings.Repeat("a", 64) },
	}
	for name, change := range invalid {
		t.Run(name, func(t *testing.T) {
			bad := request
			change(&bad)
			if bad.Validate() == nil {
				t.Fatal("invalid request accepted")
			}
		})
	}
	state, issued, _, _ := PrepareChatModeration(AccountChatModeration{}, "operator", account, request, now)
	identity, _ := request.identities("operator", account)
	for name, change := range map[string]func(*ChatModerationReceipt){
		"actor":         func(r *ChatModerationReceipt) { r.Actor = "another" },
		"time":          func(r *ChatModerationReceipt) { r.At = time.Time{} },
		"revision":      func(r *ChatModerationReceipt) { r.Revision++ },
		"action":        func(r *ChatModerationReceipt) { r.Action = ChatModerationRevoke },
		"case":          func(r *ChatModerationReceipt) { r.ReportID = "another" },
		"reason":        func(r *ChatModerationReceipt) { r.PrivateReason = "another" },
		"fingerprint":   func(r *ChatModerationReceipt) { r.Fingerprint = "another" },
		"expiry":        func(r *ChatModerationReceipt) { r.Notice.ExpiresAt = r.Notice.ExpiresAt.Add(time.Minute) },
		"notice":        func(r *ChatModerationReceipt) { r.Notice.ID = strings.Repeat("a", 64) },
		"public reason": func(r *ChatModerationReceipt) { r.Notice.Reason = "another" },
	} {
		t.Run("corrupt "+name, func(t *testing.T) {
			bad := issued
			change(&bad)
			copyState := state
			copyState.Receipts = map[string]ChatModerationReceipt{identity: bad}
			if _, _, _, err := PrepareChatModeration(copyState, "operator", account, request, now); !errors.Is(err, ErrChatModerationConflict) {
				t.Fatal(err)
			}
		})
	}
	changed := request
	changed.PrivateReason = "Different decision"
	if _, _, _, err := PrepareChatModeration(state, "operator", account, changed, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("nonce reuse accepted", err)
	}
	if _, _, _, err := PrepareChatModeration(state, "another", account, request, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("another actor replayed a receipt", err)
	}
	otherAccount := primitive.NewObjectID()
	if _, _, _, err := PrepareChatModeration(state, "operator", otherAccount, request, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("another account replayed a receipt", err)
	}
}

func TestChatModerationStoreUnavailableAndCASFilter(t *testing.T) {
	account, request, _ := chatModerationFixture()
	var db *DB
	if _, err := db.ApplyChatModeration("operator", account, request); err == nil {
		t.Fatal("nil store accepted action")
	}
	if _, err := db.ReadAccountChatModeration(account); err == nil {
		t.Fatal("nil store returned clean state")
	}
	filter := chatModerationFilter(account, 0)
	if filter["_id"] != account || len(filter["$or"].(bson.A)) != 2 {
		t.Fatal("legacy CAS lost immutable account key", filter)
	}
	filter = chatModerationFilter(account, 2)
	if filter["chat_moderation.revision"] != int64(2) || filter["$or"] != nil {
		t.Fatal("CAS lost revision", filter)
	}
}

func TestChatModerationRejectsBrokenSavedStateAndRetainsReversalCapacity(t *testing.T) {
	account, request, now := chatModerationFixture()
	state, issued, _, _ := PrepareChatModeration(AccountChatModeration{}, "operator", account, request, now)
	for name, change := range map[string]func(*AccountChatModeration){
		"negative revision": func(s *AccountChatModeration) { s.Revision = -1 },
		"missing receipt":   func(s *AccountChatModeration) { s.Receipts = nil },
		"missing revision":  func(s *AccountChatModeration) { s.Revision = 0 },
		"unknown notice":    func(s *AccountChatModeration) { s.Mute.ID = strings.Repeat("a", 64) },
		"altered expiry":    func(s *AccountChatModeration) { s.Mute.ExpiresAt = s.Mute.ExpiresAt.Add(time.Hour) },
	} {
		t.Run(name, func(t *testing.T) {
			bad := state
			notice := *state.Mute
			bad.Mute = &notice
			change(&bad)
			if bad.validate() == nil {
				t.Fatal("broken saved state accepted")
			}
			if _, _, _, err := PrepareChatModeration(bad, "operator", account, request, now); err == nil {
				t.Fatal("broken state acknowledged or overwritten")
			}
		})
	}
	revoke := request
	revoke.ID, revoke.Action, revoke.ExpectedRevision = "chat-revoke-request-001", ChatModerationRevoke, MaximumChatModerationReceipts-1
	revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = issued.Notice.ID, 0, ""
	if err := revoke.Validate(); err != nil {
		t.Fatal("last receipt must remain available for reversal", err)
	}
}
