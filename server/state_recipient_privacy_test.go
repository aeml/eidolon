package main

import (
	"bytes"
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func TestStateBroadcastFullAndDeltaKeepProgressionOwnerPrivate(t *testing.T) {
	previousWorld, previousSessions := world, activeSessions
	t.Cleanup(func() { world, activeSessions = previousWorld, previousSessions })
	world = game.NewWorld(nil)
	world.Entities = make(map[string]*game.Entity)
	world.Grid = game.NewSpatialMap(50)
	activeSessions = make(map[string]*Client)
	players := []*game.Entity{
		{ID: "private-a", Name: "alpha", Type: game.TypePlayer, SubType: "Wizard", State: "IDLE", Health: 100,
			Level: 20, Gold: 1234, Experience: 101, MaxExperience: 999, SkillPoints: 4,
			UnlockedSkills: []string{"Fireball"}, SkillRunes: map[string]string{"Fireball": "private-rune"},
			Quests:    []game.Quest{{ID: "private-story-a", Count: 7, MaxCount: 10}},
			Equipment: map[string]game.Item{"mainHand": {ID: "visible-staff"}}},
		{ID: "private-b", Name: "beta", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE", Health: 100,
			Level: 30, Gold: 4321, Experience: 202, MaxExperience: 1999, SkillPoints: 8,
			UnlockedSkills: []string{"Charge"}, TalentRanks: map[string]int{"FTR_01": 2},
			Quests: []game.Quest{{ID: "private-story-b", Count: 2, MaxCount: 20}}},
	}
	for _, p := range players {
		world.AddEntity(p)
		activeSessions[p.Name] = &Client{username: p.Name, playerID: p.ID,
			send: make(chan []byte, 16), prioritySend: make(chan []byte, 16)}
	}
	// An unchanged public actor keeps the second broadcast on the actual
	// delta path even when both nearby players have changed.
	world.AddEntity(&game.Entity{ID: "unchanged-public-actor", Type: game.TypeEnemy, Health: 50})
	for round := 0; round < 2; round++ {
		if round > 0 {
			for _, p := range players {
				p.Mu.Lock()
				p.Health-- // Both peers must appear in the delta, not only self.
				p.Gold++
				p.Mu.Unlock()
			}
		}
		broadcastState()
		for _, owner := range players {
			client := activeSessions[owner.Name]
			var data []byte
			select {
			case data = <-client.send:
			default:
				t.Fatal("recipient did not receive its state")
			}
			if len(data) < 5 || !bytes.Equal(data[:4], stateProtoMagic) {
				t.Fatal("expected production protobuf state envelope")
			}
			var envelope statepb.StateEnvelope
			if err := proto.Unmarshal(data[5:], &envelope); err != nil {
				t.Fatal(err)
			}
			var entities []*statepb.Entity
			if round == 0 {
				if envelope.GetFull() == nil {
					t.Fatal("expected initial full state")
				}
				entities = envelope.GetFull().Entities
			} else {
				if envelope.GetDelta() == nil {
					t.Fatal("expected subsequent delta state")
				}
				entities = envelope.GetDelta().Entities
			}
			wantCount := 3 - round
			if len(entities) != wantCount {
				t.Fatal("expected both nearby players in this state")
			}
			for _, encoded := range entities {
				if encoded.Id == "unchanged-public-actor" {
					continue
				}
				if encoded.Id == owner.ID {
					// Quests already use the separate private quest-update route;
					// world snapshots omit them even for the owner.
					if encoded.Gold != int32(owner.Gold) || encoded.Experience != int64(owner.Experience) ||
						encoded.MaxExperience != int64(owner.MaxExperience) || encoded.SkillPoints != int32(owner.SkillPoints) ||
						len(encoded.Quests) != 0 || len(encoded.UnlockedSkills) != 1 {
						t.Fatal("owner progression was lost or replaced by the peer's")
					}
				} else if encoded.Gold != 0 || encoded.Experience != 0 || encoded.MaxExperience != 0 || encoded.SkillPoints != 0 ||
					len(encoded.Quests) != 0 || len(encoded.UnlockedSkills) != 0 || len(encoded.SkillRunes) != 0 ||
					encoded.TalentPoints != 0 || len(encoded.UnlockedTalents) != 0 || len(encoded.TalentRanks) != 0 {
					t.Fatalf("round %d leaked another player's progression to %s", round, owner.ID)
				}
				if encoded.Health != 100-int32(round) || encoded.Level == 0 || encoded.Name == "" {
					t.Fatal("public actor presentation was lost")
				}
				if encoded.Id == "private-a" && encoded.Equipment["mainHand"].Id != "visible-staff" {
					t.Fatal("visible peer equipment was lost")
				}
			}
		}
	}
}

func TestStateRecipientEncodingDoesNotMutateSharedActorOrOwner(t *testing.T) {
	actor := &game.Entity{ID: "shared-owner", Type: game.TypePlayer, SubType: "Wizard", Level: 20,
		Gold: 5432, Experience: 123, MaxExperience: 999, SkillPoints: 2,
		UnlockedSkills: []string{"Fireball"}, SkillRunes: map[string]string{"Fireball": "private"},
		Quests: []game.Quest{{ID: "future-private-quest", Count: 5, MaxCount: 10}},
		Health: 50, MaxHealth: 100, Mana: 30, MaxMana: 80, SelectedBranch: "Pyromancer",
		Equipment: map[string]game.Item{"mainHand": {ID: "visible-staff"}}}
	before := entityToProto(actor)
	for _, recipient := range []string{"peer", ""} {
		remote := entityToProtoForRecipient(actor, recipient)
		if remote.Gold != 0 || remote.Experience != 0 || remote.MaxExperience != 0 || remote.SkillPoints != 0 ||
			remote.TalentPoints != 0 || len(remote.Quests) != 0 || len(remote.SkillRunes) != 0 || len(remote.UnlockedSkills) != 0 {
			t.Fatal("remote or unidentified recipient received private progression")
		}
		if remote.Health != 50 || remote.Mana != 30 || remote.SelectedBranch != "Pyromancer" || remote.Equipment["mainHand"].Id != "visible-staff" {
			t.Fatal("public combat/appearance fields were stripped")
		}
		if !proto.Equal(before, entityToProtoForRecipient(actor, actor.ID)) || !proto.Equal(before, entityToProto(actor)) {
			t.Fatal("encoding a peer mutated the shared source or owner message")
		}
	}
	if entityToProtoForRecipient(nil, "peer") != nil {
		t.Fatal("nil actor was not preserved")
	}
	loot := &game.Entity{ID: "public-loot", Type: game.TypeLoot, LootItem: &game.Item{ID: "public-drop"}}
	if !proto.Equal(entityToProto(loot), entityToProtoForRecipient(loot, "peer")) {
		t.Fatal("public non-player loot changed")
	}
}
