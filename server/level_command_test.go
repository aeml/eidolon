package main

import (
	"encoding/json"
	"math"
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
		send:     make(chan []byte, 32),
		username: "qa_level_test",
		playerID: "player-qa_level_test",
		seenIDs:  make(map[string]bool),
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

func TestHandleMessageLevelCommandSetsPlayerLevelAndResponds(t *testing.T) {
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
