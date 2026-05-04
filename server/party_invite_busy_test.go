package main

// Tests for 0.37.4: busy social status blocks party invites at the handler level.

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newBusyTestPlayer(id, name, status string) *game.Entity {
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

func newBusyTestClient(playerID, username string) *Client {
	return &Client{
		send:      make(chan []byte, 32),
		username:  username,
		playerID:  playerID,
		seenIDs:   make(map[string]bool),
		lastState: make(map[string]*EntitySnapshot),
	}
}

func sendPartyInvite(c *Client, targetName string) {
	payload, _ := json.Marshal(PartyInvitePayload{TargetName: targetName})
	c.handleMessage(Message{Type: MsgPartyInvite, Payload: payload})
}

// ---------------------------------------------------------------------------
// Busy blocks invite
// ---------------------------------------------------------------------------

func TestPartyInvite_BusyTarget_SendsErrorToInviter(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	inviterEntity := newBusyTestPlayer("inv-1", "Alice", "available")
	targetEntity := newBusyTestPlayer("tgt-1", "Bob", "busy")
	world.AddEntity(inviterEntity)
	world.AddEntity(targetEntity)

	inviterClient := newBusyTestClient("inv-1", "Alice")
	targetClient := newBusyTestClient("tgt-1", "Bob")
	// activeSessions is keyed by username (see getClientByUsername).
	activeSessions["Alice"] = inviterClient
	activeSessions["Bob"] = targetClient

	sendPartyInvite(inviterClient, "Bob")

	msgs := drainSentMessages(inviterClient.send)
	if len(msgs) == 0 {
		t.Fatal("expected an error message to inviter, got none")
	}
	found := false
	for _, m := range msgs {
		if m.Type != MsgError {
			continue
		}
		var errStr string
		json.Unmarshal(m.Payload, &errStr)
		if strings.Contains(errStr, "busy") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected a 'busy' error to inviter, got messages: %+v", msgs)
	}
}

func TestPartyInvite_BusyTarget_DoesNotDeliverRequestToTarget(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	inviterEntity := newBusyTestPlayer("inv-2", "Carol", "available")
	targetEntity := newBusyTestPlayer("tgt-2", "Dave", "busy")
	world.AddEntity(inviterEntity)
	world.AddEntity(targetEntity)

	inviterClient := newBusyTestClient("inv-2", "Carol")
	targetClient := newBusyTestClient("tgt-2", "Dave")
	activeSessions["Carol"] = inviterClient
	activeSessions["Dave"] = targetClient

	sendPartyInvite(inviterClient, "Dave")

	msgs := drainSentMessages(targetClient.send)
	for _, m := range msgs {
		if m.Type == MsgPartyRequest {
			t.Errorf("expected no MsgPartyRequest delivered to busy player, but got one")
		}
	}
}

func TestPartyInvite_BusyTarget_DoesNotCreatePartyForInviter(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	inviterEntity := newBusyTestPlayer("inv-3", "Eve", "available")
	targetEntity := newBusyTestPlayer("tgt-3", "Frank", "busy")
	world.AddEntity(inviterEntity)
	world.AddEntity(targetEntity)

	inviterClient := newBusyTestClient("inv-3", "Eve")
	targetClient := newBusyTestClient("tgt-3", "Frank")
	activeSessions["Eve"] = inviterClient
	activeSessions["Frank"] = targetClient

	sendPartyInvite(inviterClient, "Frank")

	// Inviter should still be partyless — invite was rejected before party creation.
	updated := world.GetEntity("inv-3")
	if updated == nil {
		t.Fatal("inviter entity not found")
	}
	if updated.PartyID != "" {
		t.Errorf("expected inviter to have no party after blocked invite, got PartyID=%q", updated.PartyID)
	}
	_ = targetClient // suppress unused warning
}

func TestPartyInvite_AvailableTarget_DeliversRequest(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	inviterEntity := newBusyTestPlayer("inv-4", "Grace", "available")
	targetEntity := newBusyTestPlayer("tgt-4", "Hank", "available")
	world.AddEntity(inviterEntity)
	world.AddEntity(targetEntity)

	inviterClient := newBusyTestClient("inv-4", "Grace")
	targetClient := newBusyTestClient("tgt-4", "Hank")
	activeSessions["Grace"] = inviterClient
	activeSessions["Hank"] = targetClient

	sendPartyInvite(inviterClient, "Hank")

	msgs := drainSentMessages(targetClient.send)
	found := false
	for _, m := range msgs {
		if m.Type == MsgPartyRequest {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected MsgPartyRequest delivered to available player, got messages: %+v", msgs)
	}
}

func TestPartyInvite_LookingPartyTarget_DeliversRequest(t *testing.T) {
	origWorld := world
	origSessions := activeSessions
	defer func() {
		world = origWorld
		activeSessions = origSessions
	}()

	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)

	inviterEntity := newBusyTestPlayer("inv-5", "Iris", "available")
	targetEntity := newBusyTestPlayer("tgt-5", "Jack", "looking_party")
	world.AddEntity(inviterEntity)
	world.AddEntity(targetEntity)

	inviterClient := newBusyTestClient("inv-5", "Iris")
	targetClient := newBusyTestClient("tgt-5", "Jack")
	activeSessions["Iris"] = inviterClient
	activeSessions["Jack"] = targetClient

	sendPartyInvite(inviterClient, "Jack")

	msgs := drainSentMessages(targetClient.send)
	found := false
	for _, m := range msgs {
		if m.Type == MsgPartyRequest {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected MsgPartyRequest delivered to looking_party player, got messages: %+v", msgs)
	}
}
