package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestStructuredChatRoutesWorldPartyWhisperAndReply(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()

	alice := addChatTestClient("alice", "party-1")
	bob := addChatTestClient("bob", "party-1")
	charlie := addChatTestClient("charlie", "")
	clock := time.Unix(1_700_000_000, 0)
	chatService.now = func() time.Time {
		clock = clock.Add(time.Millisecond)
		return clock
	}

	if err := chatService.Send(alice, ChatPayload{Message: "hello world"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "hello world", "")
	assertChat(t, bob, "world", "hello world", "")
	assertChat(t, charlie, "world", "hello world", "")

	if err := chatService.Send(alice, ChatPayload{Message: "/p party only"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "party", "party only", "")
	assertChat(t, bob, "party", "party only", "")
	assertNoChat(t, charlie)

	if err := chatService.Send(alice, ChatPayload{Message: "/w bob secret route"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "whisper", "secret route", "bob")
	assertChat(t, bob, "whisper", "secret route", "bob")
	assertNoChat(t, charlie)

	if err := chatService.Send(bob, ChatPayload{Message: "/r acknowledged"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "whisper", "acknowledged", "alice")
	assertChat(t, bob, "whisper", "acknowledged", "alice")
}

func TestStructuredChatReplaysBoundedRelevantHistory(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	chatService = newStructuredChatService(2)

	alice := addChatTestClient("alice", "party-1")
	bob := addChatTestClient("bob", "party-1")
	for _, message := range []string{"one", "two", "three"} {
		if err := chatService.Send(alice, ChatPayload{Message: message}); err != nil {
			t.Fatal(err)
		}
	}
	drainChatTestClient(alice)
	drainChatTestClient(bob)

	reconnected := &Client{username: "alice", playerID: "player-alice", send: make(chan []byte, 16)}
	chatService.Replay(reconnected, "party-1")
	first := readChat(t, reconnected)
	second := readChat(t, reconnected)
	if first.Message != "two" || second.Message != "three" || !first.History || !second.History {
		t.Fatalf("unexpected replay: first=%+v second=%+v", first, second)
	}
	assertNoChat(t, reconnected)
}

func TestStructuredWorldChatAndReplayAreInstanceScoped(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "")
	bob := addChatTestClient("bob", "")
	charlie := addChatTestClient("charlie", "")
	world.GetEntity(alice.playerID).InstanceID = "dungeon-a"
	world.GetEntity(bob.playerID).InstanceID = "dungeon-a"
	world.GetEntity(charlie.playerID).InstanceID = "dungeon-b"

	if err := chatService.Send(alice, ChatPayload{Message: "instance route"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "instance route", "")
	assertChat(t, bob, "world", "instance route", "")
	assertNoChat(t, charlie)

	reconnected := &Client{username: "charlie", playerID: charlie.playerID, send: make(chan []byte, 4)}
	chatService.Replay(reconnected, "")
	assertNoChat(t, reconnected)
}

func TestStructuredChatRejectsInvalidDestinationsAndMessages(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "")

	for _, input := range []ChatPayload{
		{Message: "/p no party"},
		{Message: "/w offline hello"},
		{Message: "/r hello"},
		{Message: strings.Repeat("x", maximumChatCharacters+1)},
	} {
		if err := chatService.Send(alice, input); err == nil {
			t.Fatalf("expected rejection for %+v", input)
		}
	}
}

func TestStructuredChatBlockIsBidirectionalAcrossDeliveryAndReplay(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "")
	bob := addChatTestClient("bob", "")
	chatService.SetBlocked(bob.username, alice.username, true)

	if err := chatService.Send(alice, ChatPayload{Message: "hidden from bob"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "hidden from bob", "")
	assertNoChat(t, bob)
	if err := chatService.Send(alice, ChatPayload{Message: "/w bob hidden"}); err == nil {
		t.Fatal("blocked whisper was delivered")
	}

	reconnectedBob := &Client{username: "bob", playerID: "player-bob", send: make(chan []byte, 4)}
	chatService.Replay(reconnectedBob, "")
	assertNoChat(t, reconnectedBob)
}

func TestStructuredChatIgnoreFiltersOnlyTheOwnersIncomingMessages(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	alice := addChatTestClient("alice", "")
	bob := addChatTestClient("bob", "")
	chatService.SetIgnored(bob.username, alice.username, true)

	if err := chatService.Send(alice, ChatPayload{Message: "muted by bob"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "muted by bob", "")
	assertNoChat(t, bob)
	if err := chatService.Send(bob, ChatPayload{Message: "still visible to alice"}); err != nil {
		t.Fatal(err)
	}
	assertChat(t, alice, "world", "still visible to alice", "")
	assertChat(t, bob, "world", "still visible to alice", "")
}

func installChatTestState(t *testing.T) func() {
	t.Helper()
	originalWorld := world
	originalSessions := activeSessions
	originalService := chatService
	world = game.NewWorld(nil)
	activeSessions = make(map[string]*Client)
	chatService = newStructuredChatService(50)
	return func() {
		world = originalWorld
		activeSessions = originalSessions
		chatService = originalService
	}
}

func addChatTestClient(username, partyID string) *Client {
	playerID := "player-" + username
	client := &Client{username: username, playerID: playerID, send: make(chan []byte, 32)}
	activeSessions[username] = client
	world.AddEntity(&game.Entity{ID: playerID, Name: username, Type: game.TypePlayer, PartyID: partyID})
	return client
}

func readChat(t *testing.T, client *Client) ChatPayload {
	t.Helper()
	select {
	case raw := <-client.send:
		var message Message
		if err := json.Unmarshal(raw, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type != MsgChat {
			t.Fatalf("message type = %q, want chat", message.Type)
		}
		var payload ChatPayload
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		return payload
	default:
		t.Fatal("expected chat message")
		return ChatPayload{}
	}
}

func assertChat(t *testing.T, client *Client, channel, message, recipient string) {
	t.Helper()
	payload := readChat(t, client)
	if payload.Channel != channel || payload.Message != message || payload.Recipient != recipient {
		t.Fatalf("chat = %+v, want channel=%q message=%q recipient=%q", payload, channel, message, recipient)
	}
}

func assertNoChat(t *testing.T, client *Client) {
	t.Helper()
	select {
	case raw := <-client.send:
		t.Fatalf("unexpected chat message: %s", raw)
	default:
	}
}

func drainChatTestClient(client *Client) {
	for {
		select {
		case <-client.send:
		default:
			return
		}
	}
}
