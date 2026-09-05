package main

import (
	"encoding/json"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestDungeonMenuRecognizesLeaderAndProtectsOccupiedReset(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	leader := addChatTestClient("dungeon-leader", "")
	member := addChatTestClient("dungeon-member", "")
	party := world.CreateParty(leader.playerID)
	if err := world.JoinParty(party.ID, member.playerID); err != nil {
		t.Fatal(err)
	}
	instanceID := world.CreateDungeon(party.ID, "abyssal_well", game.DifficultyNormal, 60)
	readMessage := func(client *Client) Message {
		t.Helper()
		select {
		case raw := <-client.send:
			var message Message
			if err := json.Unmarshal(raw, &message); err != nil {
				t.Fatal(err)
			}
			return message
		default:
			t.Fatal("missing dungeon response")
			return Message{}
		}
	}
	for _, client := range []*Client{leader, member} {
		client.dispatchMessage(Message{Type: MsgGetDungeonStatus})
		message := readMessage(client)
		var payload struct {
			IsLeader    bool `json:"isLeader"`
			HasInstance bool `json:"hasInstance"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if message.Type != MsgGetDungeonStatus || payload.IsLeader != (client == leader) || !payload.HasInstance {
			t.Fatalf("incorrect dungeon authority for %s: %+v", client.playerID, payload)
		}
	}
	member.dispatchMessage(Message{Type: MsgResetDungeon})
	if message := readMessage(member); !strings.Contains(string(message.Payload), "Only the party leader") {
		t.Fatalf("member reset was not rejected: %s", message.Payload)
	}
	if err := world.EnterInstance(member.playerID, instanceID); err != nil {
		t.Fatal(err)
	}
	leader.dispatchMessage(Message{Type: MsgResetDungeon})
	if message := readMessage(leader); !strings.Contains(string(message.Payload), "still inside") {
		t.Fatalf("occupied reset was not rejected: %s", message.Payload)
	}
	if entity := world.GetEntityCopy(member.playerID); entity == nil || entity.InstanceID != instanceID {
		t.Fatal("reset removed or displaced a party member")
	}
	if _, exists := world.GetInstanceLayout(instanceID); !exists {
		t.Fatal("reset deleted an occupied run")
	}
	world.PerformRecall(member.playerID)
	leader.dispatchMessage(Message{Type: MsgResetDungeon})
	if message := readMessage(leader); message.Type != MsgChat || !strings.Contains(string(message.Payload), "Dungeon reset.") {
		t.Fatalf("leader could not reset empty run: %s", message.Payload)
	}
	if _, exists := world.GetInstanceLayout(instanceID); exists {
		t.Fatal("empty run survived authorized reset")
	}
}
