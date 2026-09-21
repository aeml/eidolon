package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestDungeonResumeSceneCarriesAuthoritativeLanding(t *testing.T) {
	for _, dungeonType := range []string{"verdant_bastion_catacombs", "molten_core", "tempest_spire", "abyssal_well", "umbral_nexus", "weekly_raid", "fire_crystal_raid"} {
		t.Run(dungeonType, func(t *testing.T) {
			restore := installChatTestState(t)
			defer restore()
			defer world.StopBackground()
			client := addChatTestClient("resume-landing", "")
			player := world.GetEntity(client.playerID)
			player.SocialStatus = "busy"
			party := world.CreateParty(player.ID)
			id := world.CreateDungeon(party.ID, dungeonType, game.DifficultyNormal, 100)
			layout, ok := world.GetInstanceLayout(id)
			if !ok || len(layout.Rooms) < 2 {
				t.Fatal("missing real dungeon layout")
			}
			room := layout.Rooms[1]
			player.InstanceID, player.X, player.Y, player.Z = id, room.X+2, 0, room.Z+3
			drainSentMessages(client.send)
			sendInitialPlayerState(client, player, id)
			found := false
			for _, message := range drainSentMessages(client.send) {
				if message.Type != MsgEnterInstance {
					continue
				}
				var payload struct {
					InstanceID string                     `json:"instanceId"`
					Spawn      *struct{ X, Y, Z float64 } `json:"spawn"`
					RoomState  *game.DungeonRoomSummary   `json:"roomState"`
				}
				if err := json.Unmarshal(message.Payload, &payload); err != nil {
					t.Fatal(err)
				}
				if payload.InstanceID != id || payload.Spawn == nil || payload.Spawn.X != player.X || payload.Spawn.Y != player.Y || payload.Spawn.Z != player.Z || payload.RoomState == nil {
					t.Fatalf("resume must carry the saved landing, not rely on first-room placement: %+v", payload)
				}
				found = true
			}
			if !found {
				t.Fatal("missing resume scene")
			}
		})
	}
}

func TestDungeonTownReturnSceneCarriesCheckpointLanding(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	defer world.StopBackground()
	client := addChatTestClient("checkpoint-scene", "")
	player := world.GetEntity(client.playerID)
	player.SocialStatus = "busy"
	party := world.CreateParty(player.ID)
	id := world.CreateDungeon(party.ID, "molten_core", game.DifficultyNormal, 70)
	layout, _ := world.GetInstanceLayout(id)
	var boss game.DungeonRoom
	for _, room := range layout.Rooms {
		if room.Type == "boss" {
			boss = room
			break
		}
	}
	// Payload must preserve whatever authoritative landing entry selected,
	// rather than let async scene construction silently choose room zero.
	player.InstanceID, player.X, player.Y, player.Z = id, boss.X, 0, boss.Z
	drainSentMessages(client.send)
	sendDungeonEntry(game.PartyDungeonRun{InstanceID: id, DungeonType: "molten_core"}, []string{player.ID})
	found := false
	for _, message := range drainSentMessages(client.send) {
		if message.Type != MsgEnterInstance {
			continue
		}
		var payload struct {
			Spawn *struct{ X, Y, Z float64 } `json:"spawn"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Spawn == nil || payload.Spawn.X != boss.X || payload.Spawn.Y != 0 || payload.Spawn.Z != boss.Z {
			t.Fatal("town re-entry scene omitted authoritative checkpoint")
		}
		found = true
	}
	if !found {
		t.Fatal("missing town re-entry scene")
	}
}
