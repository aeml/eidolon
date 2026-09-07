package main

import (
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"go.mongodb.org/mongo-driver/bson"
	"google.golang.org/protobuf/proto"
)

func TestChronicleDiscoveryMaskSurvivesRealSaveLoadAndWire(t *testing.T) {
	p := &game.Entity{ID: "saved-discoveries", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		Quests: []game.Quest{{ID: "chronicle_earth_returning_scar", Type: "INVESTIGATE", Category: game.QuestCategoryChronicle,
			Accepted: true, MaxCount: 3, Count: 2, InvestigationMask: 5}},
	}
	snapshot := characterSnapshot("saved-discoveries", p, time.Now())
	encoded, err := bson.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	var saved database.Character
	if err := bson.Unmarshal(encoded, &saved); err != nil {
		t.Fatal(err)
	}
	loaded := questFromDatabase(saved.Quests[0])
	if loaded.InvestigationMask != 5 || loaded.Count != 2 || !loaded.Accepted || loaded.Completed {
		t.Fatalf("discovery state lost: %+v", loaded)
	}
	w := game.NewWorld(nil)
	p.Quests = []game.Quest{loaded}
	w.AddEntity(p)
	w.GenerateDailyQuests(p.ID)
	if p.Quests[0].InvestigationMask != 5 || p.Quests[0].Completed {
		t.Fatal("daily reset discarded discovery state")
	}
	wire, err := proto.Marshal(questsToProto([]game.Quest{p.Quests[0]})[0])
	if err != nil {
		t.Fatal(err)
	}
	var received statepb.Quest
	if err := proto.Unmarshal(wire, &received); err != nil {
		t.Fatal(err)
	}
	if received.GetInvestigationMask() != 5 {
		t.Fatal("client cannot identify its recorded discoveries")
	}
}
