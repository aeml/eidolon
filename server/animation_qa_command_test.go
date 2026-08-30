package main

import (
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestPreparePlayerForAnimationQAClearsOnlyReadinessGates(t *testing.T) {
	w := game.NewWorld(nil)
	player := newLevelCommandPlayer("player-animation-ready")
	player.Health = 1
	player.Mana = 0
	player.AbilityCooldown = time.Minute
	player.LastAbilityTime = time.Now()
	player.Cooldowns["Iron Fortress"] = time.Now().Add(time.Minute)
	player.InvulnerableEndTime = time.Now().Add(time.Minute)
	w.AddEntity(player)

	if !w.PreparePlayerForAnimationQA(player.ID, false, false, false) {
		t.Fatal("expected player readiness reset")
	}
	if player.Health != player.MaxHealth || player.Mana != player.MaxMana {
		t.Fatalf("expected health/mana refill, got hp=%d mana=%d", player.Health, player.Mana)
	}
	if player.AbilityCooldown != 0 || !player.LastAbilityTime.IsZero() || len(player.Cooldowns) != 0 {
		t.Fatal("expected local and named server cooldown gates to clear")
	}
	if player.InvulnerableEndTime.IsZero() {
		t.Fatal("animation readiness must not silently alter waypoint protection")
	}
}

func TestPreparePlayerForAnimationQACanSetARealCastPrecondition(t *testing.T) {
	w := game.NewWorld(nil)
	player := newLevelCommandPlayer("player-animation-low-health")
	player.Health = player.MaxHealth
	w.AddEntity(player)

	if !w.PreparePlayerForAnimationQA(player.ID, true, false, false) {
		t.Fatal("expected low-health readiness reset")
	}
	if player.Health != max(1, player.MaxHealth/4) {
		t.Fatalf("expected 25%% health precondition, got hp=%d max=%d", player.Health, player.MaxHealth)
	}
}

func TestPreparePlayerForAnimationQACanArmRealHostileDeathCheck(t *testing.T) {
	w := game.NewWorld(nil)
	player := newLevelCommandPlayer("player-animation-near-death")
	player.Health = player.MaxHealth
	player.HpRegen = float64(player.MaxHealth)
	w.AddEntity(player)

	if !w.PreparePlayerForAnimationQA(player.ID, false, false, true) {
		t.Fatal("expected near-death readiness reset")
	}
	if player.Health != 1 {
		t.Fatalf("expected one health before a real hostile hit, got %d", player.Health)
	}
	if player.QAHealthRegenPausedUntil.Before(time.Now()) {
		t.Fatal("expected near-death readiness to pause health regeneration")
	}
	w.Update(1.1)
	if player.Health != 1 {
		t.Fatalf("expected retained gear regeneration to stay paused, got %d health", player.Health)
	}

	w.PerformRespawn(player.ID)
	if !player.QAHealthRegenPausedUntil.IsZero() {
		t.Fatal("expected respawn to restore normal health regeneration")
	}
}

func TestAnimationQACommandsRequireAllowlistAndUseDedicatedSignal(t *testing.T) {
	originalWorld := world
	originalQAUsernames := qaUsernames
	defer func() {
		world = originalWorld
		qaUsernames = originalQAUsernames
	}()
	world = game.NewWorld(nil)
	qaUsernames = parseQAUsernames("qa_level_test")
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Cooldowns["Charge"] = time.Now().Add(time.Minute)
	player.InvulnerableEndTime = time.Now().Add(time.Minute)
	world.AddEntity(player)

	if !client.handleChatCommand("/qa-animation-ready") {
		t.Fatal("expected animation readiness command to be handled")
	}
	messages := drainSentMessages(client.send)
	foundSignal := false
	for _, message := range messages {
		if message.Type == MsgQAAnimationReady {
			foundSignal = true
		}
	}
	if !foundSignal {
		t.Fatalf("expected dedicated client readiness signal, got %+v", messages)
	}

	if !client.handleChatCommand("/qa-animation-ready low-health") {
		t.Fatal("expected low-health animation readiness command to be handled")
	}
	if player.Health != max(1, player.MaxHealth/4) {
		t.Fatalf("expected low-health command to set a legitimate cast precondition, got %d", player.Health)
	}

	if !client.handleChatCommand("/qa-animation-ready persistent") {
		t.Fatal("expected persistent-effect animation readiness command to be handled")
	}
	if player.QAPersistentDuration != 45*time.Second {
		t.Fatalf("expected bounded one-shot persistent duration, got %s", player.QAPersistentDuration)
	}

	if !client.handleChatCommand("/qa-animation-ready near-death") {
		t.Fatal("expected near-death animation readiness command to be handled")
	}
	if player.Health != 1 {
		t.Fatalf("expected near-death command to leave one health, got %d", player.Health)
	}

	if !client.handleChatCommand("/qa-protection off") {
		t.Fatal("expected protection command to be handled")
	}
	if !player.InvulnerableEndTime.IsZero() {
		t.Fatal("expected allowlisted protection disable")
	}

	qaUsernames = parseQAUsernames("someone_else")
	client.handleChatCommand("/qa-animation-ready")
	for _, message := range drainSentMessages(client.send) {
		if message.Type == MsgError && strings.Contains(messagePayloadString(t, message), "QA command unavailable") {
			return
		}
	}
	t.Fatal("expected non-allowlisted readiness command to be rejected")
}
