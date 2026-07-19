package main

import (
	"encoding/json"
	"math"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func drainSentMessages(ch chan []byte) []Message {
	msgs := make([]Message, 0)
	for {
		select {
		case raw := <-ch:
			var msg Message
			if err := json.Unmarshal(raw, &msg); err == nil {
				msgs = append(msgs, msg)
			}
		default:
			return msgs
		}
	}
}

func messagePayloadString(t *testing.T, msg Message) string {
	t.Helper()
	var s string
	if err := json.Unmarshal(msg.Payload, &s); err != nil {
		t.Fatalf("failed to unmarshal message payload: %v", err)
	}
	return s
}

func messagePayloadChat(t *testing.T, msg Message) ChatPayload {
	t.Helper()
	var payload ChatPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		t.Fatalf("failed to unmarshal chat payload: %v", err)
	}
	return payload
}

func newLevelCommandClient() *Client {
	return &Client{
		send:      make(chan []byte, 32),
		username:  "qa_level_test",
		playerID:  "player-qa_level_test",
		seenIDs:   make(map[string]bool),
		lastState: make(map[string]*EntitySnapshot),
	}
}

func newLevelCommandPlayer(id string) *game.Entity {
	p := &game.Entity{
		ID:             id,
		Type:           game.TypePlayer,
		SubType:        "Fighter",
		Level:          1,
		Experience:     0,
		MaxExperience:  100,
		Health:         100,
		MaxHealth:      100,
		Mana:           100,
		MaxMana:        100,
		Inventory:      make([]game.Item, game.MaxInventorySize),
		Equipment:      make(map[string]game.Item),
		Cooldowns:      make(map[string]time.Time),
		SkillRunes:     make(map[string]string),
		TalentRanks:    make(map[string]int),
		UnlockedSkills: []string{},
		BaseStats: game.Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
	}
	p.RecalculateStats()
	p.Health = p.MaxHealth
	p.Mana = p.MaxMana
	return p
}

func allowLevelCommandTestUser(t *testing.T) {
	t.Helper()
	original := qaUsernames
	qaUsernames = parseQAUsernames("qa_level_test")
	t.Cleanup(func() { qaUsernames = original })
}

func TestHandleMessageLevelCommandSetsPlayerLevelAndResponds(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/level 30", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated == nil {
		t.Fatal("expected player to remain in world")
	}
	if updated.Level != 30 {
		t.Fatalf("expected level 30, got %d", updated.Level)
	}
	if updated.Experience != 0 {
		t.Fatalf("expected experience reset to 0, got %d", updated.Experience)
	}
	expectedMaxXP := int(100 * math.Pow(1.2, float64(30-1)))
	if updated.MaxExperience != expectedMaxXP {
		t.Fatalf("expected max experience %d, got %d", expectedMaxXP, updated.MaxExperience)
	}
	if updated.BaseStats.Strength != 78 || updated.BaseStats.Vitality != 68 {
		t.Fatalf("expected level command to scale fighter primary stats to 78/68 at level 30, got str=%d vit=%d", updated.BaseStats.Strength, updated.BaseStats.Vitality)
	}
	if updated.Damage <= 2 {
		t.Fatalf("expected level command to recalculate useful damage, got %d", updated.Damage)
	}
	if updated.Health != updated.MaxHealth {
		t.Fatalf("expected health to refill to max, got health=%d max=%d", updated.Health, updated.MaxHealth)
	}
	if updated.Mana != updated.MaxMana {
		t.Fatalf("expected mana to refill to max, got mana=%d max=%d", updated.Mana, updated.MaxMana)
	}

	msgs := drainSentMessages(client.send)
	if len(msgs) == 0 {
		t.Fatal("expected command response message")
	}
	found := false
	for _, msg := range msgs {
		if msg.Type != MsgChat {
			continue
		}
		payload := messagePayloadChat(t, msg)
		if payload.Sender == "System" && strings.Contains(payload.Message, "Level set to 30") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected system chat success response in sent messages, got %+v", msgs)
	}
}

func TestHandleMessageLevelCommandRejectsInvalidInput(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/level nope", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated.Level != 1 {
		t.Fatalf("expected level to remain 1, got %d", updated.Level)
	}

	msgs := drainSentMessages(client.send)
	if len(msgs) == 0 {
		t.Fatal("expected error response message")
	}
	found := false
	for _, msg := range msgs {
		if msg.Type != MsgError {
			continue
		}
		payload := messagePayloadString(t, msg)
		if strings.Contains(payload, "Usage: /level <1-100>") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected usage error in sent messages, got %+v", msgs)
	}
}

func TestHandleMessageLevelCommandRejectsNonQAAccount(t *testing.T) {
	originalWorld := world
	originalQAUsernames := qaUsernames
	defer func() {
		world = originalWorld
		qaUsernames = originalQAUsernames
	}()
	world = game.NewWorld(nil)
	qaUsernames = parseQAUsernames("different_qa_account")

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/level 30", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	if got := world.GetEntity(client.playerID).Level; got != 1 {
		t.Fatalf("expected unauthorized command to leave level at 1, got %d", got)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "QA command unavailable") {
			return
		}
	}
	t.Fatalf("expected QA authorization error, got %+v", msgs)
}

func TestHandleMessageQAWaypointMovesAllowlistedOverworldPlayer(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.X = 100
	player.Z = 100
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-waypoint verdant", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated == nil {
		t.Fatal("expected player to remain in world")
	}
	if updated.X != 800 || updated.Y != 0 || updated.Z != 200 {
		t.Fatalf("expected Verdant QA waypoint at (800, 0, 200), got (%v, %v, %v)", updated.X, updated.Y, updated.Z)
	}
	if updated.TargetX != updated.X || updated.TargetZ != updated.Z || updated.State != "IDLE" {
		t.Fatalf("expected a stationary waypoint arrival, got target=(%v, %v) state=%q", updated.TargetX, updated.TargetZ, updated.State)
	}
	minimumProtection := time.Now().Add(game.QAWaypointProtectionDuration - time.Second)
	if updated.InvulnerableEndTime.Before(minimumProtection) {
		t.Fatalf("expected the full QA browser protection window, got %v", updated.InvulnerableEndTime)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgChat && strings.Contains(messagePayloadChat(t, msg).Message, "Verdant Bastion") {
			return
		}
	}
	t.Fatalf("expected QA waypoint success response, got %+v", msgs)
}

func TestHandleMessageQAWaypointRejectsInvalidDestination(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.X = 100
	player.Z = 100
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-waypoint arbitrary", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated.X != 100 || updated.Z != 100 {
		t.Fatalf("expected invalid waypoint to leave position unchanged, got (%v, %v)", updated.X, updated.Z)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "Usage: /qa-waypoint <combat|verdant>") {
			return
		}
	}
	t.Fatalf("expected waypoint usage error, got %+v", msgs)
}

func TestHandleMessageQAWaypointMovesAllowlistedPlayerOutsideTownForCombat(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-waypoint combat", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated.X != 120 || updated.Z != 200 {
		t.Fatalf("expected combat QA waypoint at (120, 200), got (%v, %v)", updated.X, updated.Z)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgChat && strings.Contains(messagePayloadChat(t, msg).Message, "east town gate") {
			return
		}
	}
	t.Fatalf("expected combat waypoint success response, got %+v", msgs)
}

func TestHandleMessageQAWaypointRejectsNonQAAccount(t *testing.T) {
	originalWorld := world
	originalQAUsernames := qaUsernames
	defer func() {
		world = originalWorld
		qaUsernames = originalQAUsernames
	}()
	world = game.NewWorld(nil)
	qaUsernames = parseQAUsernames("different_qa_account")

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.X = 100
	player.Z = 100
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-waypoint verdant", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated.X != 100 || updated.Z != 100 {
		t.Fatalf("expected unauthorized waypoint to leave position unchanged, got (%v, %v)", updated.X, updated.Z)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "QA command unavailable") {
			return
		}
	}
	t.Fatalf("expected QA authorization error, got %+v", msgs)
}

func TestHandleMessageQAWaypointRejectsPlayerInsideDungeon(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.InstanceID = "instance-qa-test"
	player.X = 40
	player.Z = 50
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-waypoint verdant", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	updated := world.GetEntity(client.playerID)
	if updated.X != 40 || updated.Z != 50 {
		t.Fatalf("expected dungeon player to remain at (%v, %v), got (%v, %v)", 40, 50, updated.X, updated.Z)
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "No active overworld character") {
			return
		}
	}
	t.Fatalf("expected overworld-only waypoint error, got %+v", msgs)
}

func TestHandleMessageQALootNextArmsAllowlistedPlayer(t *testing.T) {
	allowLevelCommandTestUser(t)
	originalWorld := world
	defer func() { world = originalWorld }()
	world = game.NewWorld(nil)

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-loot-next", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	if !world.GetEntity(client.playerID).QAGuaranteedLoot {
		t.Fatal("expected allowlisted QA player to arm the next loot drop")
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgChat && strings.Contains(messagePayloadChat(t, msg).Message, "Next enemy kill") {
			return
		}
	}
	t.Fatalf("expected QA loot success response, got %+v", msgs)
}

func TestHandleMessageQALootNextRejectsNonQAAccount(t *testing.T) {
	originalWorld := world
	originalQAUsernames := qaUsernames
	defer func() {
		world = originalWorld
		qaUsernames = originalQAUsernames
	}()
	world = game.NewWorld(nil)
	qaUsernames = parseQAUsernames("different_qa_account")

	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	world.AddEntity(player)

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-loot-next", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	if world.GetEntity(client.playerID).QAGuaranteedLoot {
		t.Fatal("expected unauthorized account not to arm a loot drop")
	}

	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "QA command unavailable") {
			return
		}
	}
	t.Fatalf("expected QA authorization error, got %+v", msgs)
}

func TestHandleMessageQADisconnectSchedulesAllowlistedConnectionFault(t *testing.T) {
	allowLevelCommandTestUser(t)
	client := newLevelCommandClient()
	disconnected := false
	client.qaDisconnect = func() { disconnected = true }

	payload, _ := json.Marshal(ChatPayload{Message: "/qa-disconnect", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	if !disconnected {
		t.Fatal("expected allowlisted QA account to schedule a connection fault")
	}
	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgChat && strings.Contains(messagePayloadChat(t, msg).Message, "reconnect fault scheduled") {
			return
		}
	}
	t.Fatalf("expected QA disconnect success response, got %+v", msgs)
}

func TestHandleMessageQADisconnectRejectsNonQAAccount(t *testing.T) {
	originalQAUsernames := qaUsernames
	defer func() { qaUsernames = originalQAUsernames }()
	qaUsernames = parseQAUsernames("different_qa_account")

	client := newLevelCommandClient()
	disconnected := false
	client.qaDisconnect = func() { disconnected = true }
	payload, _ := json.Marshal(ChatPayload{Message: "/qa-disconnect", Sender: client.username})
	client.handleMessage(Message{Type: MsgChat, Payload: payload})

	if disconnected {
		t.Fatal("expected unauthorized account not to schedule a connection fault")
	}
	msgs := drainSentMessages(client.send)
	for _, msg := range msgs {
		if msg.Type == MsgError && strings.Contains(messagePayloadString(t, msg), "QA command unavailable") {
			return
		}
	}
	t.Fatalf("expected QA authorization error, got %+v", msgs)
}

func TestCheckOriginAllowsKnownLocalAndProductionOrigins(t *testing.T) {
	cases := []struct {
		name   string
		origin string
		want   bool
	}{
		{name: "missing origin", origin: "", want: true},
		{name: "localhost client", origin: "http://localhost:8000", want: true},
		{name: "localhost secure dev", origin: "https://localhost:8080", want: true},
		{name: "loopback client", origin: "http://127.0.0.1:8000", want: true},
		{name: "production client", origin: "https://eidolon.mendola.tech", want: true},
		{name: "production websocket host page", origin: "https://eserver.mendola.tech", want: true},
		{name: "evil origin", origin: "https://evil.example", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://example.com/ws", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			got := upgrader.CheckOrigin(req)
			if got != tc.want {
				t.Fatalf("CheckOrigin(%q) = %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}
