package database

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestAccountModerationAllThreeIndependentReversalsAndExactRetries(t *testing.T) {
	account, base, now := chatModerationFixture()
	state := AccountChatModeration{}
	requests := []ChatModerationRequest{}
	issued := []ChatModerationReceipt{}
	for i, kind := range []string{ChatModerationMute, ModerationSuspend, ModerationRequireNameChange} {
		request := base
		request.ID, request.Action, request.ExpectedRevision = "moderation-request-"+kind, kind, int64(i)
		if kind == ModerationRequireNameChange {
			request.DurationSeconds = 0
		}
		next, receipt, replay, err := PrepareChatModeration(state, "operator", account, request, now)
		if err != nil || replay || len(next.ActiveNotices(now)) != i+1 {
			t.Fatal("adding one restriction erased another", kind, next, err)
		}
		state = next
		requests, issued = append(requests, request), append(issued, receipt)
	}
	if state.Mute == nil || state.Suspension == nil || state.NameChange == nil || !state.NameChange.ExpiresAt.IsZero() {
		t.Fatal("three independent restrictions were not preserved", state)
	}
	// Timed restrictions end precisely at expiry; name correction does not expire.
	remaining := state.ActiveNotices(state.Mute.ExpiresAt)
	if len(remaining) != 1 || remaining[0].Kind != ModerationRequireNameChange {
		t.Fatal("wrong exact-expiry semantics", remaining)
	}
	if got := state.ActiveNotices(now.Add(100 * 365 * 24 * time.Hour)); len(got) != 1 {
		t.Fatal(got)
	}
	remaining[0].Reason = "Local edit"
	if state.NameChange.Reason != base.PublicReason {
		t.Fatal("public projection aliases persisted state")
	}
	encoded, _ := bson.Marshal(state)
	var loaded AccountChatModeration
	if err := bson.Unmarshal(encoded, &loaded); err != nil || !reflect.DeepEqual(state, loaded) {
		t.Fatal("restart lost state", err)
	}
	public, _ := json.Marshal(state.ActiveNotices(now))
	for _, private := range []string{base.ReportID, base.PrivateReason, "operator", "fingerprint", "receipts"} {
		if strings.Contains(string(public), private) {
			t.Fatal("private staff data leaked", string(public))
		}
	}
	for i, receipt := range issued {
		revoke := base
		revoke.ID, revoke.Action, revoke.ExpectedRevision = "moderation-revoke-"+requests[i].Action, ChatModerationRevoke, state.Revision
		revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = receipt.Notice.ID, 0, ""
		old := state
		next, _, replay, err := PrepareChatModeration(state, "operator", account, revoke, now.Add(time.Minute))
		if err != nil || replay || len(next.ActiveNotices(now)) != 2-i || len(old.ActiveNotices(now)) != 3-i {
			t.Fatal("reversal erased another restriction or mutated its input", next, err)
		}
		state = next
		kept, saved, replay, err := PrepareChatModeration(state, "operator", account, requests[i], now.Add(time.Hour))
		if err != nil || !replay || !reflect.DeepEqual(saved, receipt) || !reflect.DeepEqual(kept, state) {
			t.Fatal("old retry reinstated restriction or restarted timer", err)
		}
	}
	if state.Revision != 6 || len(state.Receipts) != 6 || len(state.ActiveNotices(now)) != 0 {
		t.Fatal(state)
	}
}

func TestAccountModerationReserveReversalForEveryRestriction(t *testing.T) {
	account, base, now := chatModerationFixture()
	state := AccountChatModeration{}
	// Reach the real ceiling with genuine, validated receipts rather than fake history.
	for i := int64(0); i < MaximumChatModerationReceipts-2; i++ {
		request := base
		request.ID = "moderation-capacity-" + time.Unix(i, 0).UTC().Format("20060102150405")
		request.ExpectedRevision = i
		next, _, _, err := PrepareChatModeration(state, "operator", account, request, now)
		if err != nil {
			t.Fatal(i, err)
		}
		state = next
	}
	// Adding a second restriction would consume its own and the mute's reversal slots.
	newRestriction := base
	newRestriction.ID, newRestriction.Action, newRestriction.ExpectedRevision = "moderation-capacity-suspend", ModerationSuspend, state.Revision
	if _, _, _, err := PrepareChatModeration(state, "operator", account, newRestriction, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("storage ceiling stranded reversal capacity", err)
	}
	// Replacing the same restriction can still use the penultimate slot.
	replacement := base
	replacement.ID, replacement.ExpectedRevision = "moderation-capacity-final-mute", state.Revision
	state, receipt, _, err := PrepareChatModeration(state, "operator", account, replacement, now)
	if err != nil || state.Revision != 255 {
		t.Fatal(state, err)
	}
	revoke := base
	revoke.ID, revoke.Action, revoke.ExpectedRevision = "moderation-capacity-final-reversal", ChatModerationRevoke, state.Revision
	revoke.NoticeID, revoke.DurationSeconds, revoke.PublicReason = receipt.Notice.ID, 0, ""
	state, _, _, err = PrepareChatModeration(state, "operator", account, revoke, now.Add(24*time.Hour))
	if err != nil || state.Revision != 256 || state.Mute != nil {
		t.Fatal("last reversal was stranded", state, err)
	}
}

func TestAccountModerationRequiredNameChangeValidationAndCorruptKinds(t *testing.T) {
	account, request, now := chatModerationFixture()
	request.ID, request.Action, request.DurationSeconds = "required-name-request-001", ModerationRequireNameChange, 0
	state, _, _, err := PrepareChatModeration(AccountChatModeration{}, "operator", account, request, now)
	if err != nil {
		t.Fatal(err)
	}
	for _, duration := range []int64{-1, 1, MaximumChatMuteSeconds + 1} {
		bad := request
		bad.DurationSeconds = duration
		if bad.Validate() == nil {
			t.Fatal("required name change accepted a timer", duration)
		}
	}
	for _, kind := range []string{"", ChatModerationMute, ModerationSuspend, "permanent_ban"} {
		bad := state
		notice := *state.NameChange
		notice.Kind = kind
		bad.NameChange = &notice
		if bad.validate() == nil || bad.ActiveNotices(now) != nil {
			t.Fatal("wrong saved restriction kind accepted", kind)
		}
	}
	wrongExpiry := *state.NameChange
	wrongExpiry.ExpiresAt = now.Add(time.Hour)
	if wrongExpiry.Valid() {
		t.Fatal("required name change silently expires")
	}
	preview, err := projectChatModerationTarget(account, "target", state, now.Add(time.Hour))
	if err != nil || len(preview.Notices) != 1 || preview.Notices[0].Kind != ModerationRequireNameChange {
		t.Fatal(preview, err)
	}
	preview.Notices[0].Reason = "Local change"
	if state.NameChange.Reason != request.PublicReason {
		t.Fatal("staff projection aliases state")
	}
	var db *DB
	if _, err := db.OwnModerationNotices("target"); err == nil {
		t.Fatal("unavailable store returned a clean account")
	}
}
