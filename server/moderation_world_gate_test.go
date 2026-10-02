package main

import (
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

type fakeWorldModerationStore struct {
	notices   []database.ChatMuteNotice
	err       error
	afterRead func()
	owners    []string
}

func (store *fakeWorldModerationStore) OwnModerationNotices(owner string) ([]database.ChatMuteNotice, error) {
	store.owners = append(store.owners, owner)
	if store.afterRead != nil {
		store.afterRead()
	}
	return store.notices, store.err
}

func TestWorldModerationGateIndependentRestrictionsExpiryAndReversal(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	client := addChatTestClient("alice", "party-1")
	now := time.Now()
	makeNotice := func(kind, id string) database.ChatMuteNotice {
		notice := database.ChatMuteNotice{Kind: kind, ID: strings.Repeat(id, 64), StartedAt: now.Add(-time.Minute),
			ExpiresAt: now.Add(time.Minute), Reason: "Public owner-only explanation"}
		if kind == database.ModerationRequireNameChange {
			notice.ExpiresAt = time.Time{}
		}
		return notice
	}
	mute, suspension, name := makeNotice(database.ChatModerationMute, "a"), makeNotice(database.ModerationSuspend, "b"), makeNotice(database.ModerationRequireNameChange, "c")
	store := &fakeWorldModerationStore{notices: []database.ChatMuteNotice{mute}}
	gate := newWorldModerationGate(store, func() time.Time { return now })
	if notice, err := gate(client); notice != nil || err != nil {
		t.Fatal("mute blocked gameplay", notice, err)
	}
	store.notices = []database.ChatMuteNotice{name, mute, suspension}
	if notice, err := gate(client); err != nil || notice == nil || notice.ID != suspension.ID {
		t.Fatal("simultaneous restrictions", notice, err)
	}
	// Removing or correcting the name cannot clear the separate suspension.
	store.notices = []database.ChatMuteNotice{mute, suspension}
	if notice, err := gate(client); err != nil || notice == nil || notice.ID != suspension.ID {
		t.Fatal("name reversal cleared suspension", notice, err)
	}
	// Exact timed expiry is honored on the next check, without stale caching.
	now = suspension.ExpiresAt
	if notice, err := gate(client); notice != nil || err != nil {
		t.Fatal("expiry retained suspension", notice, err)
	}
	store.notices = []database.ChatMuteNotice{name}
	now = now.Add(365 * 24 * time.Hour)
	if notice, err := gate(client); err != nil || notice == nil || notice.ID != name.ID {
		t.Fatal("name correction silently expired", notice, err)
	}
	// Returned owner projection is a copy, never mutable store state.
	notice, _ := gate(client)
	notice.Reason = "changed"
	if store.notices[0].Reason == "changed" {
		t.Fatal("gate returned aliased state")
	}
	store.notices = nil
	if notice, err := gate(client); notice != nil || err != nil {
		t.Fatal("independent reversal stayed cached", notice, err)
	}
	if entity := world.GetEntityCopy(client.playerID); entity == nil || entity.PartyID != "party-1" {
		t.Fatal("reading gate changed world or saved character")
	}
	for _, owner := range store.owners {
		if owner != "alice" {
			t.Fatal("untrusted target read", owner)
		}
	}
}

func TestWorldModerationGateFailsClosedWithoutLeakingPrivateReadErrors(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	client := addChatTestClient("alice", "")
	now := time.Now()
	store := &fakeWorldModerationStore{}
	gate := newWorldModerationGate(store, func() time.Time { return now })
	checkDenied := func(gate worldModerationGate, client *Client) {
		t.Helper()
		if notice, err := gate(client); notice != nil || err == nil || strings.Contains(err.Error(), "private") {
			t.Fatal("failed-open or private-error leak", notice, err)
		}
	}
	checkDenied(newWorldModerationGate(nil, time.Now), client)
	checkDenied(newWorldModerationGate(store, nil), client)
	checkDenied(gate, nil)
	store.err = errors.New("private database error with staff metadata")
	checkDenied(gate, client)
	store.err = nil
	valid := database.ChatMuteNotice{Kind: database.ModerationSuspend, ID: strings.Repeat("d", 64), StartedAt: now.Add(-time.Second), ExpiresAt: now.Add(time.Minute), Reason: "Public explanation"}
	for _, bad := range [][]database.ChatMuteNotice{
		{valid, valid}, {valid, valid, valid, valid}, {{Kind: "unknown", ID: valid.ID, StartedAt: valid.StartedAt, ExpiresAt: valid.ExpiresAt, Reason: valid.Reason}}, {{Kind: database.ModerationSuspend, ID: "malformed"}},
	} {
		store.notices = bad
		checkDenied(gate, client)
	}
	store.notices = nil
	client.retired.Store(true)
	checkDenied(gate, client)
	client.retired.Store(false)
	client.transportClosed.Store(true)
	checkDenied(gate, client)
	client.transportClosed.Store(false)
	before := len(store.owners)
	store.afterRead = func() { activeSessions["alice"] = &Client{username: "alice"} }
	checkDenied(gate, client)
	if len(store.owners) != before+1 {
		t.Fatal("authority was not read exactly once")
	}
	activeSessions["alice"] = client
	store.afterRead = func() { client.username = "bob" }
	checkDenied(gate, client)
}

func TestWorldModerationGateDoesNotTreatFutureSuspensionAsActive(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	client := addChatTestClient("alice", "")
	now := time.Now()
	store := &fakeWorldModerationStore{notices: []database.ChatMuteNotice{{Kind: database.ModerationSuspend, ID: strings.Repeat("e", 64), StartedAt: now.Add(time.Minute), ExpiresAt: now.Add(2 * time.Minute), Reason: "Public explanation"}}}
	gate := newWorldModerationGate(store, func() time.Time { return now })
	if notice, err := gate(client); notice != nil || err != nil {
		t.Fatal("future restriction started early", notice, err)
	}
	now = now.Add(time.Minute)
	if notice, err := gate(client); notice == nil || err != nil {
		t.Fatal("start boundary not honored", notice, err)
	}
}
