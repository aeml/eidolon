package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestCrystalSanctumActualDungeonEntryPayload(t *testing.T) {
	for _, raidType := range []string{"earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid"} {
		t.Run(raidType, func(t *testing.T) {
			restore := installChatTestState(t)
			defer restore()
			defer world.StopBackground()
			client := addChatTestClient("crystal-entry", "")
			// Suppress the unrelated asynchronous social broadcaster only.
			world.GetEntity(client.playerID).SocialStatus = "busy"
			definition, _ := game.ElementalRaidDefinitionForType(raidType)
			party := world.CreateParty(client.playerID)
			id := world.CreateDungeon(party.ID, raidType, game.DifficultyNormal, definition.RequiredLevel)
			sendDungeonEntry(game.PartyDungeonRun{InstanceID: id, DungeonType: raidType}, []string{client.playerID})
			select {
			case raw := <-client.send:
				var message Message
				if err := json.Unmarshal(raw, &message); err != nil {
					t.Fatal(err)
				}
				var payload struct {
					InstanceID string                  `json:"instanceId"`
					RoomState  game.DungeonRoomSummary `json:"roomState"`
				}
				if err := json.Unmarshal(message.Payload, &payload); err != nil {
					t.Fatal(err)
				}
				crystal := payload.RoomState.Crystal
				if message.Type != MsgEnterInstance || payload.InstanceID != id || crystal == nil ||
					crystal.InstanceID != id || crystal.Element != definition.Element || crystal.Stage != "fractured" {
					t.Fatalf("actual scene-entry message omitted or mismatched the crystal: %+v / %+v", payload, crystal)
				}
			default:
				t.Fatal("missing scene-entry message")
			}
		})
	}
}
