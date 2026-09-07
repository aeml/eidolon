package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestChronicleInspectionDispatchAcknowledgesOnlyAuthoritativePersonalEvidence(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	chapter := game.ChronicleInvestigationCatalog()[0]
	site := chapter.Sites[0]
	player.X, player.Z = site.X, site.Z
	player.Quests = []game.Quest{{ID: chapter.ID, Type: "INVESTIGATE", Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 1}}
	world.AddEntity(player)
	world.AddEntity(&game.Entity{ID: site.EntityID, Type: game.TypeNPC, SubType: "ChronicleSite", X: site.X, Z: site.Z})
	gold, xp := player.Gold, player.Experience
	for attempt := 0; attempt < 3; attempt++ {
		// A forged credit count is ignored; only the real authored object counts.
		payload, _ := json.Marshal(map[string]interface{}{"entityId": site.EntityID, "count": 999, "completed": true})
		client.handleMessage(Message{Type: MsgChronicleInspect, Payload: payload})
		messages := drainSentMessages(client.send)
		if len(messages) != 2 || messages[0].Type != MsgQuestUpdate || messages[1].Type != MsgChronicleDiscovery {
			t.Fatalf("missing ordered quest/reading acknowledgement: %+v", messages)
		}
		var receipt game.ChronicleDiscoveryReceipt
		if err := json.Unmarshal(messages[1].Payload, &receipt); err != nil {
			t.Fatal(err)
		}
		if receipt.QuestID != chapter.ID || receipt.SiteID != site.ID || receipt.Count != 1 || receipt.Recorded != (attempt == 0) {
			t.Fatalf("incorrect personal receipt: %+v", receipt)
		}
		if player.Quests[0].Completed || player.Gold != gold || player.Experience != xp {
			t.Fatal("inspection paid or completed a quest")
		}
	}
	player.X += 10
	payload, _ := json.Marshal(map[string]string{"entityId": site.EntityID})
	client.handleMessage(Message{Type: MsgChronicleInspect, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError {
		t.Fatal("remote request exposed a discovery receipt")
	}
}

func TestChronicleInspectionDispatchCannotClaimCombatCredit(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	chapter := game.ChronicleInvestigationCatalog()[5]
	anchor := chapter.Sites[1]
	player.X, player.Z = anchor.X, anchor.Z
	player.Quests = []game.Quest{{ID: chapter.ID, Type: "INVESTIGATE", Accepted: true, MaxCount: 3, InvestigationMask: 1, Count: 1}}
	world.AddEntity(player)
	world.AddEntity(&game.Entity{ID: anchor.EntityID, Type: game.TypeEnemy, SubType: anchor.Model, X: anchor.X, Z: anchor.Z,
		SpawnX: anchor.X, SpawnZ: anchor.Z, State: "DEAD"})
	payload, _ := json.Marshal(map[string]interface{}{"entityId": anchor.EntityID, "combat": true})
	client.handleMessage(Message{Type: MsgChronicleInspect, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError || player.Quests[0].InvestigationMask != 1 {
		t.Fatal("client claimed an anchor kill")
	}
}
