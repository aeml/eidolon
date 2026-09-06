package main

import (
	"encoding/json"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestBuildActionReceiptsDescribeActualServerChanges(t *testing.T) {
	previous := world
	defer func() { world = previous }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("phone-build")
	player := newAutoStatusPlayer(client.playerID, "Builder", "available")
	player.Level = 100
	player.Health, player.MaxHealth = 100, 100
	world.AddEntity(player)
	run := func(action, payload string, ok bool) {
		t.Helper()
		client.handleMessage(Message{Type: action, Payload: json.RawMessage(payload)})
		var receipt struct {
			RequestID string `json:"requestId"`
			OK        bool   `json:"ok"`
			Message   string `json:"message"`
		}
		found := false
		for _, message := range drainSentMessages(client.send) {
			if message.Type != "build_action" {
				continue
			}
			if err := json.Unmarshal(message.Payload, &receipt); err != nil {
				t.Fatal(err)
			}
			found = true
		}
		if !found || receipt.RequestID != "test-action" || receipt.OK != ok || receipt.Message == "" {
			t.Fatalf("%s receipt = %+v, found %v", action, receipt, found)
		}
	}
	run(MsgSelectBranch, `{"branch":"A","requestId":"test-action"}`, true)
	if player.SelectedBranch != "A" || len(player.UnlockedSkills) != 5 {
		t.Fatal("branch receipt preceded an actual branch change")
	}
	run(MsgUnlockTalent, `{"talentId":"FTR_01","requestId":"test-action"}`, true)
	if player.TalentRanks["FTR_01"] != 1 {
		t.Fatal("rank was not applied exactly once")
	}
	run(MsgSelectRune, `{"skill":"Iron Fortress","runeId":"ironfortress_extended","requestId":"test-action"}`, true)
	if player.SkillRunes["Iron Fortress"] != "ironfortress_extended" {
		t.Fatal("rune was not equipped")
	}
	run(MsgSelectRune, `{"skill":"Iron Fortress","runeId":"invalid","requestId":"test-action"}`, false)
	if player.SkillRunes["Iron Fortress"] != "ironfortress_extended" {
		t.Fatal("rejected rune changed the build")
	}
	run(MsgSelectBranch, `{"branch":"invalid","requestId":"test-action"}`, false)
	if player.SelectedBranch != "A" {
		t.Fatal("rejected branch changed the build")
	}
	run(MsgUnlockTalent, `{"talentId":"invalid","requestId":"test-action"}`, false)
	run(MsgResetTalents, `{"requestId":"test-action"}`, true)
	if len(player.TalentRanks) != 0 {
		t.Fatal("talent reset was not applied")
	}
}

func TestBuildRequestValidationAndLegacyCompatibility(t *testing.T) {
	previous := world
	defer func() { world = previous }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("legacy-build")
	player := newAutoStatusPlayer(client.playerID, "Builder", "available")
	world.AddEntity(player)
	for _, payload := range []string{`{"branch":"B","requestId":42}`, `{"branch":"B","requestId":"` + strings.Repeat("x", 65) + `"}`} {
		client.handleMessage(Message{Type: MsgSelectBranch, Payload: json.RawMessage(payload)})
		if player.SelectedBranch != "" {
			t.Fatal("malformed receipt ID mutated build")
		}
		messages := drainSentMessages(client.send)
		if len(messages) != 1 || messages[0].Type != MsgError {
			t.Fatal("malformed request should return an error")
		}
	}
	client.handleMessage(Message{Type: MsgSelectBranch, Payload: json.RawMessage(`{"branch":"B"}`)})
	if player.SelectedBranch != "B" {
		t.Fatal("legacy branch selection stopped working")
	}
	for _, message := range drainSentMessages(client.send) {
		if message.Type == "build_action" {
			t.Fatal("legacy request received an unsolicited receipt")
		}
	}
}
