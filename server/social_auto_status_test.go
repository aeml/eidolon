package main

// Tests for 0.37.4: autoSetSocialStatus — system-driven status transitions
// on dungeon entry ("in_run") and overworld return ("available").

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newAutoStatusPlayer(id, name, status string) *game.Entity {
	e := &game.Entity{
		ID:           id,
		Type:         game.TypePlayer,
		SubType:      "Fighter",
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

func newAutoStatusClient(playerID string) *Client {
	return &Client{
		send:      make(chan []byte, 32),
		username:  playerID,
		playerID:  playerID,
		seenIDs:   make(map[string]bool),
		lastState: make(map[string]*EntitySnapshot),
	}
}

// ---------------------------------------------------------------------------
// autoSetSocialStatus — in_run path
// ---------------------------------------------------------------------------

func TestAutoSetSocialStatus_SetInRun_AcksClientAndBroadcasts(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	p := newAutoStatusPlayer("p1", "Player1", "available")
	world.AddEntity(p)
	c := newAutoStatusClient("p1")
	activeSessions["p1"] = c

	autoSetSocialStatus(c, "p1", "in_run")
	time.Sleep(20 * time.Millisecond)

	msgs := drainSentMessages(c.send)

	// Must have received a MsgSocialStatus ack with the new value.
	var ack *Message
	for i := range msgs {
		if msgs[i].Type == MsgSocialStatus {
			ack = &msgs[i]
		}
	}
	if ack == nil {
		t.Fatal("expected MsgSocialStatus ack, got none")
	}
	var payload SocialStatusPayload
	if err := json.Unmarshal(ack.Payload, &payload); err != nil {
		t.Fatalf("failed to unmarshal ack payload: %v", err)
	}
	if payload.Status != "in_run" {
		t.Errorf("expected ack status=in_run, got %q", payload.Status)
	}

	// Must also have received the social broadcast.
	found := false
	for _, m := range msgs {
		if m.Type == MsgSocial {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected MsgSocial broadcast, got none")
	}
}

func TestAutoSetSocialStatus_BusyPlayer_NoAckNoBroadcast(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	p := newAutoStatusPlayer("p2", "Player2", "busy")
	world.AddEntity(p)
	c := newAutoStatusClient("p2")
	activeSessions["p2"] = c

	autoSetSocialStatus(c, "p2", "in_run")
	time.Sleep(20 * time.Millisecond)

	msgs := drainSentMessages(c.send)
	for _, m := range msgs {
		if m.Type == MsgSocialStatus {
			t.Error("expected no MsgSocialStatus ack for busy player")
		}
		if m.Type == MsgSocial {
			t.Error("expected no MsgSocial broadcast for busy player")
		}
	}

	// Status must remain busy.
	got := world.GetEntityCopy("p2")
	if got.SocialStatus != "busy" {
		t.Errorf("busy must be preserved; got %q", got.SocialStatus)
	}
}

// ---------------------------------------------------------------------------
// autoSetSocialStatus — available (exit) path
// ---------------------------------------------------------------------------

func TestAutoSetSocialStatus_InRunToAvailable_AcksAndBroadcasts(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	p := newAutoStatusPlayer("p3", "Player3", "in_run")
	world.AddEntity(p)
	c := newAutoStatusClient("p3")
	activeSessions["p3"] = c

	autoSetSocialStatus(c, "p3", "available")
	time.Sleep(20 * time.Millisecond)

	msgs := drainSentMessages(c.send)

	var ack *Message
	for i := range msgs {
		if msgs[i].Type == MsgSocialStatus {
			ack = &msgs[i]
		}
	}
	if ack == nil {
		t.Fatal("expected MsgSocialStatus ack on return from dungeon, got none")
	}
	var payload SocialStatusPayload
	if err := json.Unmarshal(ack.Payload, &payload); err != nil {
		t.Fatalf("failed to unmarshal ack payload: %v", err)
	}
	if payload.Status != "available" {
		t.Errorf("expected ack status=available, got %q", payload.Status)
	}

	found := false
	for _, m := range msgs {
		if m.Type == MsgSocial {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected MsgSocial broadcast on return from dungeon, got none")
	}
}

func TestAutoSetSocialStatus_NonInRunExit_NoOp(t *testing.T) {
	// Player manually set themselves to "looking_party" before returning —
	// the system must not clobber it with "available".
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	p := newAutoStatusPlayer("p4", "Player4", "looking_party")
	world.AddEntity(p)
	c := newAutoStatusClient("p4")
	activeSessions["p4"] = c

	autoSetSocialStatus(c, "p4", "available")
	time.Sleep(20 * time.Millisecond)

	msgs := drainSentMessages(c.send)
	for _, m := range msgs {
		if m.Type == MsgSocialStatus {
			t.Error("expected no MsgSocialStatus ack when status was not in_run")
		}
	}

	got := world.GetEntityCopy("p4")
	if got.SocialStatus != "looking_party" {
		t.Errorf("looking_party must be preserved; got %q", got.SocialStatus)
	}
}

// ---------------------------------------------------------------------------
// autoSetSocialStatus — broadcast reaches all sessions
// ---------------------------------------------------------------------------

func TestAutoSetSocialStatus_BroadcastReachesOtherSessions(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	p1 := newAutoStatusPlayer("pa", "Alice", "available")
	p2 := newAutoStatusPlayer("pb", "Bob", "available")
	world.AddEntity(p1)
	world.AddEntity(p2)

	cA := newAutoStatusClient("pa")
	cB := newAutoStatusClient("pb")
	activeSessions["pa"] = cA
	activeSessions["pb"] = cB

	// Alice enters dungeon.
	autoSetSocialStatus(cA, "pa", "in_run")
	time.Sleep(20 * time.Millisecond)

	// Bob must receive a MsgSocial broadcast that shows Alice as in_run.
	msgsB := drainSentMessages(cB.send)
	var socialMsg *Message
	for i := range msgsB {
		if msgsB[i].Type == MsgSocial {
			socialMsg = &msgsB[i]
		}
	}
	if socialMsg == nil {
		t.Fatal("Bob did not receive MsgSocial broadcast after Alice entered dungeon")
	}

	var entries []SocialEntry
	if err := json.Unmarshal(socialMsg.Payload, &entries); err != nil {
		t.Fatalf("unmarshal social list: %v", err)
	}
	byName := make(map[string]SocialEntry)
	for _, e := range entries {
		byName[e.Name] = e
	}
	if byName["Alice"].SocialStatus != "in_run" {
		t.Errorf("expected Alice.SocialStatus=in_run in Bob's broadcast, got %q", byName["Alice"].SocialStatus)
	}
}
