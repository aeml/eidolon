package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestDungeonMenuDoesNotPromiseCacheWhenRewardStoreUnavailable(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	previousDB := db
	db = nil
	defer func() { db = previousDB }()
	client := addChatTestClient("raid-cache-reader", "")
	actor := world.GetEntity(client.playerID)
	actor.Mu.Lock()
	actor.Level = game.MaxPlayerLevel
	actor.Mu.Unlock()
	world.CreateParty(client.playerID)
	client.dispatchMessage(Message{Type: MsgGetDungeonStatus})
	select {
	case raw := <-client.send:
		var message Message
		if err := json.Unmarshal(raw, &message); err != nil {
			t.Fatal(err)
		}
		var payload struct {
			WeeklyRaidReward struct {
				Status   string
				ResetsAt time.Time
			}
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if message.Type != MsgGetDungeonStatus || payload.WeeklyRaidReward.Status != "unknown" || payload.WeeklyRaidReward.ResetsAt.Weekday() != time.Monday {
			t.Fatalf("menu invented available rewards: %s", message.Payload)
		}
	default:
		t.Fatal("missing cache status response")
	}
}

func TestDungeonMenuRecognizesLeaderAndProtectsOccupiedReset(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	leader := addChatTestClient("dungeon-leader", "")
	member := addChatTestClient("dungeon-member", "")
	// Chat-only fixtures do not initialize combat health. This scenario is a
	// living party member recalling, not a zero-health recovery attempt.
	actor := world.GetEntity(member.playerID)
	actor.Mu.Lock()
	actor.Health, actor.MaxHealth = 100, 100
	actor.Mu.Unlock()
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
			IsLeader    bool                 `json:"isLeader"`
			HasInstance bool                 `json:"hasInstance"`
			ActiveRun   game.PartyDungeonRun `json:"activeRun"`
			EntryLevels map[string]int       `json:"dungeonEntryLevels"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if message.Type != MsgGetDungeonStatus || payload.IsLeader != (client == leader) || !payload.HasInstance {
			t.Fatalf("incorrect dungeon authority for %s: %+v", client.playerID, payload)
		}
		if payload.ActiveRun.InstanceID != instanceID || payload.ActiveRun.DungeonType != "abyssal_well" || payload.ActiveRun.RunLevel != 60 {
			t.Fatalf("menu lost the actual run settings: %+v", payload.ActiveRun)
		}
		if len(payload.EntryLevels) != len(game.DungeonEntryLevels()) {
			t.Fatal("menu omitted dungeon family requirements")
		}
		for dungeonType, level := range payload.EntryLevels {
			if game.ValidateDungeonTypeEntry(level, dungeonType) != nil || game.ValidateDungeonTypeEntry(level-1, dungeonType) == nil {
				t.Fatalf("menu requirement differs from authority for %s: %d", dungeonType, level)
			}
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
	if err := world.PerformRecall(member.playerID); err != nil {
		t.Fatal(err)
	}
	leader.dispatchMessage(Message{Type: MsgResetDungeon})
	if message := readMessage(leader); message.Type != MsgChat || !strings.Contains(string(message.Payload), "Dungeon reset.") {
		t.Fatalf("leader could not reset empty run: %s", message.Payload)
	}
	if _, exists := world.GetInstanceLayout(instanceID); exists {
		t.Fatal("empty run survived authorized reset")
	}
}
