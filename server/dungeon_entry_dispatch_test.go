package main

import (
	"encoding/json"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func enterDungeonRequest(client *Client, dungeon string, difficulty string, level int) {
	payload, _ := json.Marshal(map[string]interface{}{"dungeonType": dungeon, "difficulty": difficulty, "runLevel": level})
	client.dispatchMessage(Message{Type: MsgEnterDungeon, Payload: payload})
}

func TestDungeonResumeDoesNotMoveOtherMembers(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	leader := addChatTestClient("resume-leader", "")
	member := addChatTestClient("resume-member", "")
	world.SetPlayerLevel(leader.playerID, 100)
	world.SetPlayerLevel(member.playerID, 100)
	// Presence broadcasts are covered separately; avoid an unrelated async
	// broadcaster outliving this test's replacement of the global world.
	world.Entities[leader.playerID].SocialStatus = "busy"
	world.Entities[member.playerID].SocialStatus = "busy"
	party := world.CreateParty(leader.playerID)
	if err := world.JoinParty(party.ID, member.playerID); err != nil {
		t.Fatal(err)
	}
	id := world.CreateDungeon(party.ID, "abyssal_well", game.DifficultyHeroic, 80)
	if err := world.EnterInstance(member.playerID, id); err != nil {
		t.Fatal(err)
	}
	actor := world.Entities[member.playerID]
	actor.X += 12
	actor.TargetX = actor.X + 3
	x, targetX := actor.X, actor.TargetX
	enterDungeonRequest(leader, "verdant_bastion_catacombs", "normal", 30)
	if actor.X != x || actor.TargetX != targetX {
		t.Fatal("resuming moved the member already fighting inside")
	}
	if world.GetEntityCopy(leader.playerID).InstanceID != id {
		t.Fatal("leader did not resume saved run")
	}
	select {
	case <-member.send:
		t.Fatal("remaining member received a redundant scene transition")
	default:
	}
	enterDungeonRequest(member, "verdant_bastion_catacombs", "normal", 30)
	if actor.X != x || actor.TargetX != targetX {
		t.Fatal("duplicate enter reset the caller's movement")
	}
}

func TestDungeonResumeValidatesActualSavedRun(t *testing.T) {
	for _, dungeon := range []string{"abyssal_well", "umbral_nexus", "earth_crystal_raid", "weekly_raid"} {
		t.Run(dungeon, func(t *testing.T) {
			restore := installChatTestState(t)
			defer restore()
			client := addChatTestClient("saved-run-entry", "")
			world.SetPlayerLevel(client.playerID, 30)
			party := world.CreateParty(client.playerID)
			world.CreateDungeon(party.ID, dungeon, game.DifficultyNormal, 30)
			enterDungeonRequest(client, "verdant_bastion_catacombs", "normal", 30)
			if world.GetEntityCopy(client.playerID).InstanceID != "" {
				t.Fatal("low-level dungeon request bypassed the saved run's access gate")
			}
		})
	}
}

func TestNewDungeonRequiresLeaderAndQualifiesAllMembers(t *testing.T) {
	restore := installChatTestState(t)
	defer restore()
	leader := addChatTestClient("new-run-leader", "")
	member := addChatTestClient("new-run-member", "")
	world.SetPlayerLevel(leader.playerID, 100)
	world.SetPlayerLevel(member.playerID, 30)
	party := world.CreateParty(leader.playerID)
	if err := world.JoinParty(party.ID, member.playerID); err != nil {
		t.Fatal(err)
	}
	enterDungeonRequest(member, "verdant_bastion_catacombs", "normal", 30)
	if exists, _ := world.GetDungeonStatus(party.ID); exists {
		t.Fatal("non-leader created a fresh run")
	}
	enterDungeonRequest(leader, "abyssal_well", "normal", 60)
	if exists, _ := world.GetDungeonStatus(party.ID); exists {
		t.Fatal("created a run before qualifying the whole party")
	}
	for _, client := range []*Client{leader, member} {
		if world.GetEntityCopy(client.playerID).InstanceID != "" {
			t.Fatal("failed group entry partially moved the party")
		}
	}
	var raw []byte
	select {
	case raw = <-leader.send:
	default:
		t.Fatal("missing actionable rejection")
	}
	if !strings.Contains(string(raw), "level") {
		t.Fatalf("unexpected rejection: %s", raw)
	}
}
