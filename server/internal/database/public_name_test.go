package database

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

func publicNameFixture(t *testing.T) (AccountChatModeration, PublicNameCorrectionRequest) {
	t.Helper()
	id, change, now := chatModerationFixture()
	state := AccountChatModeration{}
	for i, kind := range []string{ChatModerationMute, ModerationSuspend, ModerationRequireNameChange} {
		change.Action, change.ID, change.ExpectedRevision = kind, "name-fixture-"+kind, int64(i)
		if kind == ModerationRequireNameChange {
			change.DurationSeconds = 0
		}
		var err error
		state, _, _, err = PrepareChatModeration(state, "operator", id, change, now)
		if err != nil {
			t.Fatal(err)
		}
	}
	return state, PublicNameCorrectionRequest{ID: "correct-name-request-001", NoticeID: state.NameChange.ID, PublicName: "Arcanis Dawn", Confirmed: true}
}

func TestPublicNameCorrectionClearsOnlyQuotedNoticeAndPreservesLedger(t *testing.T) {
	state, request := publicNameFixture(t)
	id, _, now := chatModerationFixture()
	before, _ := json.Marshal(state.Receipts)
	next, receipt, replay, err := PreparePublicNameCorrection(state, "owner", id, request, now.Add(time.Second))
	if err != nil || replay || next.NameChange != nil || next.Revision != 4 || len(next.Receipts) != 4 ||
		!reflect.DeepEqual(next.Mute, state.Mute) || !reflect.DeepEqual(next.Suspension, state.Suspension) ||
		!request.matches(receipt, "owner", id) || state.NameChange == nil || len(state.Receipts) != 3 {
		t.Fatal(next, receipt, replay, err)
	}
	after, _ := json.Marshal(state.Receipts)
	if string(before) != string(after) {
		t.Fatal("input ledger mutated")
	}
	retried, saved, replay, err := PreparePublicNameCorrection(next, "owner", id, request, now.Add(24*time.Hour))
	if err != nil || !replay || !reflect.DeepEqual(saved, receipt) || !reflect.DeepEqual(retried, next) {
		t.Fatal("retry changed state", err)
	}
	encoded, _ := json.Marshal(receipt)
	if string(encoded) != "{}" {
		t.Fatal("private correction receipt leaked", string(encoded))
	}
	changed := request
	changed.PublicName = "Changed Replay"
	if _, _, _, err := PreparePublicNameCorrection(next, "owner", id, changed, now); !errors.Is(err, ErrChatModerationConflict) {
		t.Fatal("changed replay accepted", err)
	}
	if _, _, _, err := PreparePublicNameCorrection(next, "another-owner", id, request, now); err == nil {
		t.Fatal("another owner replayed correction")
	}
}

func TestPublicNameCorrectionRequiresActualCurrentNoticeAndExplicitConfirmation(t *testing.T) {
	state, request := publicNameFixture(t)
	id, _, now := chatModerationFixture()
	for _, name := range []string{"", "aa", "2Arcanis", " Arcanis", "Arcanis ", "Arcanis\n", "A<script>", "A\u202eHidden", strings.Repeat("A", 25)} {
		bad := request
		bad.PublicName = name
		if _, _, _, err := PreparePublicNameCorrection(state, "owner", id, bad, now); err == nil {
			t.Fatal("invalid label accepted", name)
		}
	}
	for _, name := range []string{"Arcanis", "Arcanis Dawn", "Arcanis-Dawn", "O'Ryn", strings.Repeat("A", 24)} {
		valid := request
		valid.PublicName = name
		if valid.Validate() != nil {
			t.Fatal("valid label rejected", name)
		}
	}
	unconfirmed := request
	unconfirmed.Confirmed = false
	wrongNotice := request
	wrongNotice.NoticeID = strings.Repeat("a", 64)
	wrongID := request
	wrongID.ID = "bad.id"
	for _, bad := range []PublicNameCorrectionRequest{unconfirmed, wrongNotice, wrongID} {
		if _, _, _, err := PreparePublicNameCorrection(state, "owner", id, bad, now); err == nil {
			t.Fatal("invalid correction accepted", bad)
		}
	}
	if _, _, _, err := PreparePublicNameCorrection(AccountChatModeration{}, "owner", id, request, now); err == nil {
		t.Fatal("free name change without notice")
	}
	if _, _, _, err := PreparePublicNameCorrection(state, "owner", id, request, state.NameChange.StartedAt.Add(-time.Millisecond)); err == nil {
		t.Fatal("future notice corrected")
	}
	corrupt := state
	corrupt.Revision++
	if _, _, _, err := PreparePublicNameCorrection(corrupt, "owner", id, request, now); err == nil {
		t.Fatal("corrupt ledger accepted")
	}
}

func TestPublicNameCorrectionHistoricalRetryCannotClearNewerRequirement(t *testing.T) {
	state, request := publicNameFixture(t)
	id, change, now := chatModerationFixture()
	next, original, _, err := PreparePublicNameCorrection(state, "owner", id, request, now)
	if err != nil {
		t.Fatal(err)
	}
	change.Action, change.ID, change.ExpectedRevision, change.DurationSeconds = ModerationRequireNameChange, "new-name-requirement-001", next.Revision, 0
	newer, _, _, err := PrepareChatModeration(next, "operator", id, change, now.Add(time.Second))
	if err != nil {
		t.Fatal(err)
	}
	retried, saved, replay, err := PreparePublicNameCorrection(newer, "owner", id, request, now.Add(2*time.Second))
	if err != nil || !replay || !reflect.DeepEqual(saved, original) || !reflect.DeepEqual(retried, newer) || retried.NameChange == nil {
		t.Fatal("old correction removed newer requirement", err)
	}
}
