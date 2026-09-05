package main

// Tests for 0.37.3: proactive social-status broadcast.
// Verifies that when a player changes their social status, all connected
// clients receive a fresh MsgSocial list within the same handler call.

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

// ---------------------------------------------------------------------------
// Helpers shared across social broadcast tests
// ---------------------------------------------------------------------------

func newSocialBroadcastPlayer(id, name, class, status string) *game.Entity {
	e := &game.Entity{
		ID:           id,
		Type:         game.TypePlayer,
		SubType:      class,
		Name:         name,
		State:        "IDLE",
		Level:        1,
		SocialStatus: status,
		TalentRanks:  map[string]int{},
		Inventory:    make([]game.Item, game.MaxInventorySize),
		Equipment:    make(map[string]game.Item),
		Cooldowns:    make(map[string]time.Time),
		SkillRunes:   make(map[string]string),
	}
	e.RecalculateStats()
	return e
}

func newSocialBroadcastClient(playerID string) *Client {
	return &Client{
		send:      make(chan []byte, 32),
		username:  playerID,
		playerID:  playerID,
		seenIDs:   make(map[string]bool),
		lastState: make(map[string]*EntitySnapshot),
	}
}

// ---------------------------------------------------------------------------
// buildSocialList
// ---------------------------------------------------------------------------

func TestBuildSocialList_ReturnsOnlinePlayers(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	playerA := newSocialBroadcastPlayer("a1", "Alice", "Wizard", "available")
	playerB := newSocialBroadcastPlayer("b1", "Bob", "Fighter", "looking_party")
	world.AddEntity(playerA)
	world.AddEntity(playerB)

	clientA := newSocialBroadcastClient("a1")
	clientB := newSocialBroadcastClient("b1")
	activeSessions["a1"] = clientA
	activeSessions["b1"] = clientB

	list := buildSocialList()

	if len(list) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(list))
	}

	byName := make(map[string]SocialEntry)
	for _, e := range list {
		byName[e.Name] = e
	}

	if byName["Alice"].Class != "Wizard" {
		t.Errorf("expected Alice.Class=Wizard, got %q", byName["Alice"].Class)
	}
	if byName["Bob"].SocialStatus != "looking_party" {
		t.Errorf("expected Bob.SocialStatus=looking_party, got %q", byName["Bob"].SocialStatus)
	}
}

func TestBuildSocialList_ExcludesSessionsWithoutPlayerID(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	player := newSocialBroadcastPlayer("p1", "Alice", "Rogue", "available")
	world.AddEntity(player)

	// One real session, one unauthenticated (empty playerID).
	activeSessions["p1"] = newSocialBroadcastClient("p1")
	activeSessions["anon"] = &Client{
		send:      make(chan []byte, 8),
		playerID:  "",
		seenIDs:   make(map[string]bool),
		lastState: make(map[string]*EntitySnapshot),
	}

	list := buildSocialList()
	if len(list) != 1 {
		t.Fatalf("expected 1 entry (authenticated player only), got %d", len(list))
	}
	if list[0].Name != "Alice" {
		t.Errorf("expected entry for Alice, got %q", list[0].Name)
	}
}

// ---------------------------------------------------------------------------
// MsgSocialStatus handler → broadcast
// ---------------------------------------------------------------------------

func TestMsgSocialStatus_BroadcastsSocialListToAllSessions(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	// Two online players.
	playerA := newSocialBroadcastPlayer("a1", "Alice", "Cleric", "available")
	playerB := newSocialBroadcastPlayer("b1", "Bob", "Fighter", "available")
	world.AddEntity(playerA)
	world.AddEntity(playerB)

	clientA := newSocialBroadcastClient("a1")
	clientB := newSocialBroadcastClient("b1")
	activeSessions["a1"] = clientA
	activeSessions["b1"] = clientB

	// Alice changes her status to "in_run".
	statusPayload, _ := json.Marshal(SocialStatusPayload{Status: "in_run"})
	clientA.handleMessage(Message{Type: MsgSocialStatus, Payload: statusPayload})

	// Wait for every recipient before restoring shared globals in teardown.
	received := waitAutoStatusBroadcasts(t, clientA, clientB)

	// Both clients should have received a MsgSocial message.
	for _, name := range []string{"Alice (clientA)", "Bob (clientB)"} {
		var client *Client
		if name == "Alice (clientA)" {
			client = clientA
		} else {
			client = clientB
		}
		msgs := received[client]
		found := false
		for _, m := range msgs {
			if m.Type == MsgSocial {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("%s: expected to receive a %s message after status change, got %+v", name, MsgSocial, msgs)
		}
	}
}

func TestMsgSocialStatus_BroadcastReflectsNewStatus(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	playerA := newSocialBroadcastPlayer("a1", "Alice", "Rogue", "available")
	playerB := newSocialBroadcastPlayer("b1", "Bob", "Wizard", "available")
	world.AddEntity(playerA)
	world.AddEntity(playerB)

	clientA := newSocialBroadcastClient("a1")
	clientB := newSocialBroadcastClient("b1")
	activeSessions["a1"] = clientA
	activeSessions["b1"] = clientB

	statusPayload, _ := json.Marshal(SocialStatusPayload{Status: "busy"})
	clientA.handleMessage(Message{Type: MsgSocialStatus, Payload: statusPayload})

	received := waitAutoStatusBroadcasts(t, clientA, clientB)

	// Bob's broadcast MsgSocial should contain Alice's new "busy" status.
	msgs := received[clientB]
	var socialMsg *Message
	for i := range msgs {
		if msgs[i].Type == MsgSocial {
			socialMsg = &msgs[i]
		}
	}
	if socialMsg == nil {
		t.Fatal("Bob did not receive a MsgSocial broadcast")
	}

	var entries []SocialEntry
	if err := json.Unmarshal(socialMsg.Payload, &entries); err != nil {
		t.Fatalf("failed to unmarshal social list: %v", err)
	}
	byName := make(map[string]SocialEntry)
	for _, e := range entries {
		byName[e.Name] = e
	}
	if byName["Alice"].SocialStatus != "busy" {
		t.Errorf("expected Alice.SocialStatus=busy in broadcast, got %q", byName["Alice"].SocialStatus)
	}
}

func TestMsgSocialStatus_NoEntityInWorldDoesNotBroadcast(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	// Session registered but entity NOT added to world.
	clientA := newSocialBroadcastClient("ghost-1")
	activeSessions["ghost-1"] = clientA

	statusPayload, _ := json.Marshal(SocialStatusPayload{Status: "in_run"})
	clientA.handleMessage(Message{Type: MsgSocialStatus, Payload: statusPayload})

	time.Sleep(20 * time.Millisecond)

	msgs := drainSentMessages(clientA.send)
	for _, m := range msgs {
		if m.Type == MsgSocial {
			t.Errorf("expected no MsgSocial broadcast when entity is not in world, got one")
		}
	}
}
