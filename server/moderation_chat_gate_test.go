package main

import (
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

type fakeChatMuteGateStore struct {
	notices   map[string]*database.ChatMuteNotice
	err       error
	afterRead func()
	owners    []string
}

func (s *fakeChatMuteGateStore) OwnChatMuteNotice(owner string) (*database.ChatMuteNotice, error) {
	s.owners = append(s.owners, owner)
	notice := s.notices[owner]
	if s.afterRead != nil {
		s.afterRead()
	}
	return notice, s.err
}

func TestTemporaryChatMuteAllChannelsLeaveNoDeliveryOrHistory(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "party-1")
	bob := addChatTestClient("bob", "party-1")
	now := time.Now()
	notice := &database.ChatMuteNotice{ID: strings.Repeat("b", 64), StartedAt: now.Add(-time.Minute),
		ExpiresAt: now.Add(time.Minute), Reason: "Public conduct explanation must not be broadcast."}
	store := &fakeChatMuteGateStore{notices: map[string]*database.ChatMuteNotice{"alice": notice}}
	chatService.authorizeSend = newTemporaryChatMuteGuard(store, func() time.Time { return now })
	inputs := []ChatPayload{
		{Message: "world"}, {Channel: "global", Message: "global"},
		{Channel: "party", Message: "party"}, {Channel: "guild", Message: "guild"},
		{Channel: "whisper", Recipient: "bob", Message: "whisper"},
		{Message: "/p party"}, {Message: "/party party"}, {Message: "/g guild"}, {Message: "/guild guild"},
		{Message: "/w bob whisper"}, {Message: "/whisper bob whisper"}, {Message: "/world world"}, {Message: "/r reply"},
	}
	chatService.history.replyTarget["alice"] = "bob"
	for _, input := range inputs {
		err := chatService.Send(alice, input)
		if err == nil || !strings.Contains(err.Error(), notice.ID) || strings.Contains(err.Error(), notice.Reason) {
			t.Fatalf("route bypass or private explanation leak: %+v: %v", input, err)
		}
		assertNoChat(t, alice)
		assertNoChat(t, bob)
	}
	if len(store.owners) != len(inputs) || len(chatService.history.worlds) != 0 ||
		len(chatService.history.parties) != 0 || len(chatService.history.guilds) != 0 || len(chatService.history.whispers) != 0 {
		t.Fatal("denied sends touched delivery history", chatService.history)
	}
	// A chat mute restricts sending, not receiving or playing the character.
	if err := chatService.Send(bob, ChatPayload{Message: "incoming"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "incoming", "")
	assertChat(t, bob, "world", "incoming", "")
	if entity := world.GetEntityCopy(alice.playerID); entity == nil || entity.PartyID != "party-1" {
		t.Fatal("chat denial changed the character")
	}
	// Reversal takes effect on the next send, without a relog or cached denial.
	delete(store.notices, "alice")
	if err := chatService.Send(alice, ChatPayload{Message: "reversed"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "reversed", "")
	assertChat(t, bob, "world", "reversed", "")
	store.notices["alice"] = notice
	now = notice.ExpiresAt // Exact expiry must not require an extra tick.
	if err := chatService.Send(alice, ChatPayload{Message: "expired"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "expired", "")
	assertChat(t, bob, "world", "expired", "")
}

func TestTemporaryChatMuteGuardFailsClosedWithoutPrivateErrors(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	c := addChatTestClient("alice", "")
	clock := time.Now()
	store := &fakeChatMuteGateStore{notices: make(map[string]*database.ChatMuteNotice)}
	guard := newTemporaryChatMuteGuard(store, func() time.Time { return clock })
	store.err = errors.New("private database credentials and staff information")
	if err := guard(c); err == nil || strings.Contains(err.Error(), "private") {
		t.Fatal(err)
	}
	store.err = nil
	for _, kind := range []string{database.ModerationSuspend, database.ModerationRequireNameChange} {
		notice := &database.ChatMuteNotice{Kind: kind, ID: strings.Repeat("d", 64), StartedAt: clock.Add(-time.Minute),
			ExpiresAt: clock.Add(time.Minute), Reason: "Public explanation"}
		if kind == database.ModerationRequireNameChange {
			notice.ExpiresAt = time.Time{}
		}
		store.notices["alice"] = notice
		if err := guard(c); err == nil {
			t.Fatal("non-mute returned through mute-only store admitted chat", kind)
		}
	}
	store.notices["alice"] = &database.ChatMuteNotice{ID: "malformed", Reason: "private malformed state"}
	if err := guard(c); err == nil || strings.Contains(err.Error(), "malformed") {
		t.Fatal(err)
	}
	delete(store.notices, "alice")
	if err := guard(c); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []func(*Client) error{
		newTemporaryChatMuteGuard(nil, time.Now), newTemporaryChatMuteGuard(store, nil),
	} {
		if err := bad(c); err == nil {
			t.Fatal("missing authority admitted chat")
		}
	}
	if err := guard(nil); err == nil {
		t.Fatal("nil client admitted")
	}
	before := len(store.owners)
	c.retired.Store(true)
	if err := guard(c); err == nil || len(store.owners) != before {
		t.Fatal("retired session read authority")
	}
	c.retired.Store(false)
	c.transportClosed.Store(true)
	if err := guard(c); err == nil || len(store.owners) != before {
		t.Fatal("closed session read authority")
	}
	c.transportClosed.Store(false)
	store.afterRead = func() { activeSessions["alice"] = &Client{username: "alice"} }
	if err := guard(c); err == nil {
		t.Fatal("replacement during read admitted old sender")
	}
	activeSessions["alice"] = c
	store.afterRead = func() { c.username = "bob" }
	if err := guard(c); err == nil {
		t.Fatal("changed owner admitted old sender")
	}
}

func TestTemporaryChatMuteGuardDoesNotBlockOwnerNoticeAppealRoute(t *testing.T) {
	c, _ := adminReadFixture(t)
	now := time.Now()
	notice := &database.ChatMuteNotice{ID: strings.Repeat("c", 64), StartedAt: now.Add(-time.Minute),
		ExpiresAt: now.Add(time.Minute), Reason: "Public notice for an appeal."}
	store := &fakeChatMuteGateStore{notices: map[string]*database.ChatMuteNotice{c.username: notice}}
	if err := newTemporaryChatMuteGuard(store, time.Now)(c); err == nil {
		t.Fatal("mute not enforced")
	}
	previous := moderationNotices
	moderationNotices = store
	t.Cleanup(func() { moderationNotices = previous })
	handleOwnModerationNotice(c, Message{Type: MsgModerationNotice, Payload: []byte(moderationNoticePayload)})
	responses := drainSentMessages(c.send)
	if len(responses) != 1 || !strings.Contains(string(responses[0].Payload), `"success":true`) ||
		!strings.Contains(string(responses[0].Payload), notice.ID) {
		t.Fatal("muted owner cannot obtain appeal reference", responses)
	}
}
