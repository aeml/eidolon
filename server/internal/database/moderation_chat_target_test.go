package database

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestChatModerationTargetProjectsOnlyChosenAccountAndPublicNotice(t *testing.T) {
	account, request, now := chatModerationFixture()
	state, _, _, err := PrepareChatModeration(AccountChatModeration{}, "private-operator", account, request, now)
	if err != nil {
		t.Fatal(err)
	}
	target, err := projectChatModerationTarget(account, "chosen-account", state, now)
	if err != nil || !target.Valid() || target.AccountID != account || target.Account != "chosen-account" || target.Revision != 1 || target.Notice == nil {
		t.Fatal(target, err)
	}
	encoded, _ := json.Marshal(target)
	if strings.Contains(string(encoded), request.PrivateReason) || strings.Contains(string(encoded), request.ReportID) ||
		strings.Contains(string(encoded), "private-operator") || strings.Contains(string(encoded), "receipts") ||
		!strings.Contains(string(encoded), request.PublicReason) {
		t.Fatal("preview leaked private receipt", string(encoded))
	}
	target.Notice.Reason = "local edited copy"
	if state.Mute.Reason != request.PublicReason {
		t.Fatal("preview mutation changed authoritative state")
	}
	expired, err := projectChatModerationTarget(account, "chosen-account", state, state.Mute.ExpiresAt)
	if err != nil || expired.Notice != nil || expired.Revision != 1 {
		t.Fatal("expiry erased revision or exposed stale notice", expired, err)
	}
	empty, err := projectChatModerationTarget(account, "legacy-account", AccountChatModeration{}, now)
	if err != nil || empty.Revision != 0 || empty.Notice != nil {
		t.Fatal(empty, err)
	}
}

func TestChatModerationTargetRejectsBrokenStateAndMissingAuthority(t *testing.T) {
	account, _, now := chatModerationFixture()
	for _, candidate := range []struct {
		id    primitive.ObjectID
		name  string
		state AccountChatModeration
		at    time.Time
	}{
		{primitive.NilObjectID, "account", AccountChatModeration{}, now},
		{account, " ", AccountChatModeration{}, now},
		{account, "account\n", AccountChatModeration{}, now},
		{account, strings.Repeat("a", 257), AccountChatModeration{}, now},
		{account, "account", AccountChatModeration{Revision: 1}, now},
		{account, "account", AccountChatModeration{}, time.Time{}},
	} {
		if _, err := projectChatModerationTarget(candidate.id, candidate.name, candidate.state, candidate.at); err == nil {
			t.Fatal("invalid preview admitted", candidate)
		}
	}
	var unavailable *DB
	if _, err := unavailable.ReadChatModerationTarget("operator", "account"); err == nil {
		t.Fatal("missing store admitted staff read")
	}
	if _, err := (&DB{}).ReadChatModerationTarget("operator", "account"); err == nil {
		t.Fatal("uninitialized store admitted staff read")
	}
}
