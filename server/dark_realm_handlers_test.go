package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestDarkRealmDispatchTransfersOnlyEligibleCallerWithAuthoritativeScene(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	defer world.StopBackground()
	a := addChatTestClient("realm-traveler", "")
	b := addChatTestClient("realm-party", "")
	party := world.CreateParty(a.playerID)
	if err := world.JoinParty(party.ID, b.playerID); err != nil {
		t.Fatal(err)
	}
	oldRun := world.CreateDungeon(party.ID, "molten_core", game.DifficultyNormal, 70)
	p := world.Entities[a.playerID]
	p.Level, p.X, p.Z = 100, 0, 240
	p.Health, p.State = 100, "IDLE"
	other := world.Entities[b.playerID]
	other.Level, other.Health, other.State, other.Z = 70, 100, "IDLE", 240
	for _, id := range []string{game.ChronicleEarthRestoredID, game.ChronicleWaterRestoredID, game.ChronicleFireRestoredID, game.ChronicleAirRestoredID} {
		p.Quests = append(p.Quests, game.Quest{ID: id, Completed: true})
	}
	drainSentMessages(a.send)
	drainSentMessages(b.send)
	messageHandlers[MsgEnterDarkRealm](a, Message{Type: MsgEnterDarkRealm, Payload: json.RawMessage(`{"playerId":"realm-party","instanceId":"forged"}`)})
	if p.InstanceID != game.DarkRealmInstanceID || world.Entities[b.playerID].InstanceID != "" {
		t.Fatal("transition did not use only the authenticated eligible caller")
	}
	if run, ok := world.GetPartyDungeonRun(party.ID); !ok || run.InstanceID != oldRun {
		t.Fatal("expedition reset the party dungeon")
	}
	found := false
	for _, message := range drainSentMessages(a.send) {
		if message.Type != MsgEnterInstance {
			continue
		}
		var scene struct {
			InstanceID string                    `json:"instanceId"`
			Type       string                    `json:"type"`
			Layout     game.DungeonLayout        `json:"layout"`
			Spawn      struct{ X, Y, Z float64 } `json:"spawn"`
		}
		if err := json.Unmarshal(message.Payload, &scene); err != nil {
			t.Fatal(err)
		}
		if scene.InstanceID != game.DarkRealmInstanceID || scene.Type != game.DarkRealmInstanceType || scene.Spawn.X != p.X || scene.Spawn.Z != p.Z || len(scene.Layout.Rooms) != 5 {
			t.Fatal("scene did not describe the authoritative shared world")
		}
		found = true
	}
	if !found {
		t.Fatal("missing scene transition")
	}
	messageHandlers[MsgEnterDarkRealm](b, Message{Type: MsgEnterDarkRealm, Payload: json.RawMessage(`{}`)})
	if world.Entities[b.playerID].InstanceID != "" {
		t.Fatal("leader carried an ineligible party member in")
	}
	for _, message := range drainSentMessages(b.send) {
		if message.Type == MsgEnterInstance {
			t.Fatal("ineligible member received an expedition scene")
		}
	}
}

func TestDarkRealmReentryPublishesFreshMovementContext(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	defer world.StopBackground()
	client := addChatTestClient("realm-returner", "")
	p := world.Entities[client.playerID]
	p.Level, p.Health, p.State = 100, 100, "IDLE"
	for _, id := range []string{game.ChronicleEarthRestoredID, game.ChronicleWaterRestoredID, game.ChronicleFireRestoredID, game.ChronicleAirRestoredID} {
		p.Quests = append(p.Quests, game.Quest{ID: id, Completed: true})
	}
	if err := world.PerformRecall(p.ID, "expedition-return"); err != nil {
		t.Fatal(err)
	}
	// The fixture approaches the town guide; the transition and all movement
	// admission below use the real handler/world paths.
	p.X, p.Z = 0, 240
	drainSentMessages(client.send)
	handleEnterDarkRealm(client, Message{Type: MsgEnterDarkRealm, Payload: json.RawMessage(`{}`)})
	assertRecoveryContextMessage(t, client, "")
	// Empty-context scene transitions retain their existing brief movement
	// grace. Model its expiry without sleeping or weakening production guards.
	p.LastRespawnTime, p.MoveLockUntil = time.Now().Add(-2*time.Second), time.Time{}
	if world.UpdatePlayerMovementWithContext(p.ID, 40009, 0, 40800, 0, "IDLE", 1, "expedition-return") {
		t.Fatal("departed town context displaced expedition entrant")
	}
	if !world.UpdatePlayerMovementWithContext(p.ID, 40009, 0, 40800, 0, "IDLE", 2, "") || p.X != 40009 || p.Z != 40800 {
		t.Fatal("fresh movement toward camp Ilyra was rejected")
	}
}
