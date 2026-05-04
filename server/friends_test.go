package main

// Tests for 0.38.1 friend helper functions:
//   - usernameToPlayerID / playerIDToUsername (pure, no DB)
//   - buildFriendListPayload (DB required — skipped without MONGO_URI)
//   - MsgFriendList / MsgFriendRequest / MsgFriendAccept / MsgFriendDecline / MsgFriendRemove handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// ---------------------------------------------------------------------------
// Pure helper tests (no DB, no network)
// ---------------------------------------------------------------------------

func TestUsernameToPlayerID(t *testing.T) {
	cases := []struct {
		username string
		want     string
	}{
		{"alice", "player-alice"},
		{"bob123", "player-bob123"},
		{"", "player-"},
	}
	for _, tc := range cases {
		got := usernameToPlayerID(tc.username)
		if got != tc.want {
			t.Errorf("usernameToPlayerID(%q) = %q, want %q", tc.username, got, tc.want)
		}
	}
}

func TestPlayerIDToUsername(t *testing.T) {
	cases := []struct {
		playerID string
		want     string
	}{
		{"player-alice", "alice"},
		{"player-bob123", "bob123"},
		{"player-", ""},
		{"noplayer", "noplayer"}, // no prefix — returned as-is
	}
	for _, tc := range cases {
		got := playerIDToUsername(tc.playerID)
		if got != tc.want {
			t.Errorf("playerIDToUsername(%q) = %q, want %q", tc.playerID, got, tc.want)
		}
	}
}

func TestUsernameToPlayerID_RoundTrip(t *testing.T) {
	usernames := []string{"alice", "bob", "xyzzy99", "test-user"}
	for _, u := range usernames {
		if got := playerIDToUsername(usernameToPlayerID(u)); got != u {
			t.Errorf("round-trip failed for %q: got %q", u, got)
		}
	}
}

// ---------------------------------------------------------------------------
// buildFriendListPayload — requires real MongoDB; skip without MONGO_URI
// ---------------------------------------------------------------------------

func newFriendTestDB(t *testing.T) *database.DB {
	t.Helper()
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("Skipping friend handler DB test: MONGO_URI not set")
	}
	d, err := database.New(uri)
	if err != nil {
		t.Fatalf("database.New: %v", err)
	}
	return d
}

func TestBuildFriendListPayload_EmptyForNewPlayer(t *testing.T) {
	d := newFriendTestDB(t)

	// Temporarily replace the global db used by buildFriendListPayload.
	origDB := db
	db = d
	defer func() { db = origDB }()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	playerID := "player-buildtest-" + randomSuffix()
	payload := buildFriendListPayload(playerID)

	if len(payload.Friends) != 0 {
		t.Errorf("expected 0 friends for new player, got %d", len(payload.Friends))
	}
	if len(payload.Pending) != 0 {
		t.Errorf("expected 0 pending for new player, got %d", len(payload.Pending))
	}
}

func TestBuildFriendListPayload_ReflectsAcceptedFriend(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "bfl-a-" + randomSuffix()
	userB := "bfl-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	if err := d.SendFriendRequest(pidA, pidB); err != nil {
		t.Fatalf("SendFriendRequest: %v", err)
	}
	if err := d.AcceptFriendRequest(pidA, pidB); err != nil {
		t.Fatalf("AcceptFriendRequest: %v", err)
	}

	payload := buildFriendListPayload(pidA)

	if len(payload.Friends) != 1 {
		t.Fatalf("expected 1 friend, got %d", len(payload.Friends))
	}
	if payload.Friends[0].Username != userB {
		t.Errorf("expected friend username %q, got %q", userB, payload.Friends[0].Username)
	}
	// B is not in activeSessions → should be offline
	if payload.Friends[0].Online {
		t.Errorf("expected friend to be offline")
	}
}

func TestBuildFriendListPayload_FriendOnlineWhenSessionActive(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "bflo-a-" + randomSuffix()
	userB := "bflo-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	_ = d.SendFriendRequest(pidA, pidB)
	_ = d.AcceptFriendRequest(pidA, pidB)

	// Simulate B being online by adding a session + world entity.
	entityB := newSocialBroadcastPlayer(pidB, userB, "Wizard", "available")
	world.AddEntity(entityB)
	clientB := newSocialBroadcastClient(pidB)
	clientB.username = userB
	activeSessions[userB] = clientB

	payload := buildFriendListPayload(pidA)

	if len(payload.Friends) != 1 {
		t.Fatalf("expected 1 friend, got %d", len(payload.Friends))
	}
	if !payload.Friends[0].Online {
		t.Errorf("expected friend to be online (session active)")
	}
}

func TestBuildFriendListPayload_PendingIncoming(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "bfp-a-" + randomSuffix()
	userB := "bfp-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	// A sends to B — B has a pending incoming request.
	_ = d.SendFriendRequest(pidA, pidB)

	payload := buildFriendListPayload(pidB)

	if len(payload.Pending) != 1 {
		t.Fatalf("expected 1 pending entry for B, got %d", len(payload.Pending))
	}
	if payload.Pending[0] != userA {
		t.Errorf("expected pending username %q, got %q", userA, payload.Pending[0])
	}
}

// ---------------------------------------------------------------------------
// MsgFriendList handler — smoke test (DB required)
// ---------------------------------------------------------------------------

func TestMsgFriendList_ReturnsPayload(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	username := "fl-handler-" + randomSuffix()
	playerID := usernameToPlayerID(username)

	entity := newSocialBroadcastPlayer(playerID, username, "Fighter", "available")
	world.AddEntity(entity)

	c := newSocialBroadcastClient(playerID)
	c.username = username
	activeSessions[username] = c

	c.handleMessage(Message{Type: MsgFriendList})

	time.Sleep(10 * time.Millisecond)

	msgs := drainSentMessages(c.send)
	found := false
	for _, m := range msgs {
		if m.Type == MsgFriendList {
			found = true
			var p FriendListPayload
			if err := json.Unmarshal(m.Payload, &p); err != nil {
				t.Fatalf("unmarshal friend_list payload: %v", err)
			}
		}
	}
	if !found {
		t.Fatal("expected friend_list response, got none")
	}
}

// ---------------------------------------------------------------------------
// MsgFriendRequest handler
// ---------------------------------------------------------------------------

func TestMsgFriendRequest_SendsRequestAndEchoes(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "fr-a-" + randomSuffix()
	userB := "fr-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	entityA := newSocialBroadcastPlayer(pidA, userA, "Rogue", "available")
	entityB := newSocialBroadcastPlayer(pidB, userB, "Cleric", "available")
	world.AddEntity(entityA)
	world.AddEntity(entityB)

	clientA := newSocialBroadcastClient(pidA)
	clientA.username = userA
	clientB := newSocialBroadcastClient(pidB)
	clientB.username = userB
	activeSessions[userA] = clientA
	activeSessions[userB] = clientB

	payload, _ := json.Marshal(FriendUsernamePayload{Username: userB})
	clientA.handleMessage(Message{Type: MsgFriendRequest, Payload: payload})

	time.Sleep(20 * time.Millisecond)

	// B should receive a friend_request notification.
	msgsB := drainSentMessages(clientB.send)
	foundNotify := false
	for _, m := range msgsB {
		if m.Type == MsgFriendRequest {
			foundNotify = true
		}
	}
	if !foundNotify {
		t.Errorf("expected B to receive a %s notification, got %+v", MsgFriendRequest, msgsB)
	}

	// DB should have a pending relationship.
	f, err := d.GetFriendship(pidA, pidB)
	if err != nil || f == nil {
		t.Fatalf("expected pending friendship in DB: %v, %v", f, err)
	}
	if f.Status != database.FriendshipPending {
		t.Errorf("expected status pending, got %q", f.Status)
	}
}

// ---------------------------------------------------------------------------
// MsgFriendAccept handler
// ---------------------------------------------------------------------------

func TestMsgFriendAccept_AcceptsAndPushesLists(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "fa-a-" + randomSuffix()
	userB := "fa-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	// Pre-seed a pending request A→B.
	_ = d.SendFriendRequest(pidA, pidB)

	entityA := newSocialBroadcastPlayer(pidA, userA, "Wizard", "available")
	entityB := newSocialBroadcastPlayer(pidB, userB, "Fighter", "available")
	world.AddEntity(entityA)
	world.AddEntity(entityB)

	clientA := newSocialBroadcastClient(pidA)
	clientA.username = userA
	clientB := newSocialBroadcastClient(pidB)
	clientB.username = userB
	activeSessions[userA] = clientA
	activeSessions[userB] = clientB

	// B accepts A's request.
	payload, _ := json.Marshal(FriendUsernamePayload{Username: userA})
	clientB.handleMessage(Message{Type: MsgFriendAccept, Payload: payload})

	time.Sleep(20 * time.Millisecond)

	// DB should now show accepted.
	f, err := d.GetFriendship(pidA, pidB)
	if err != nil || f == nil {
		t.Fatalf("GetFriendship: %v, %v", f, err)
	}
	if f.Status != database.FriendshipAccepted {
		t.Errorf("expected accepted, got %q", f.Status)
	}

	// Both clients should receive a fresh friend_list.
	for name, ch := range map[string]chan []byte{"A": clientA.send, "B": clientB.send} {
		msgs := drainSentMessages(ch)
		found := false
		for _, m := range msgs {
			if m.Type == MsgFriendList {
				found = true
			}
		}
		if !found {
			t.Errorf("client %s: expected friend_list refresh after accept", name)
		}
	}
}

// ---------------------------------------------------------------------------
// MsgFriendDecline handler
// ---------------------------------------------------------------------------

func TestMsgFriendDecline_RemovesPendingRequest(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "fd-a-" + randomSuffix()
	userB := "fd-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	_ = d.SendFriendRequest(pidA, pidB)

	entityB := newSocialBroadcastPlayer(pidB, userB, "Fighter", "available")
	world.AddEntity(entityB)
	clientB := newSocialBroadcastClient(pidB)
	clientB.username = userB
	activeSessions[userB] = clientB

	payload, _ := json.Marshal(FriendUsernamePayload{Username: userA})
	clientB.handleMessage(Message{Type: MsgFriendDecline, Payload: payload})

	time.Sleep(10 * time.Millisecond)

	f, err := d.GetFriendship(pidA, pidB)
	if err != nil {
		t.Fatalf("GetFriendship: %v", err)
	}
	if f != nil {
		t.Fatal("expected friendship to be removed after decline, got document")
	}
}

// ---------------------------------------------------------------------------
// MsgFriendRemove handler
// ---------------------------------------------------------------------------

func TestMsgFriendRemove_DeletesAcceptedFriendship(t *testing.T) {
	d := newFriendTestDB(t)

	origDB := db
	db = d
	defer func() { db = origDB }()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	userA := "frm-a-" + randomSuffix()
	userB := "frm-b-" + randomSuffix()
	pidA := usernameToPlayerID(userA)
	pidB := usernameToPlayerID(userB)

	_ = d.SendFriendRequest(pidA, pidB)
	_ = d.AcceptFriendRequest(pidA, pidB)

	entityA := newSocialBroadcastPlayer(pidA, userA, "Cleric", "available")
	world.AddEntity(entityA)
	clientA := newSocialBroadcastClient(pidA)
	clientA.username = userA
	activeSessions[userA] = clientA

	payload, _ := json.Marshal(FriendUsernamePayload{Username: userB})
	clientA.handleMessage(Message{Type: MsgFriendRemove, Payload: payload})

	time.Sleep(10 * time.Millisecond)

	f, err := d.GetFriendship(pidA, pidB)
	if err != nil {
		t.Fatalf("GetFriendship: %v", err)
	}
	if f != nil {
		t.Fatal("expected friendship to be removed, got document")
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// randomSuffix returns a short string unique within a test run.
func randomSuffix() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
