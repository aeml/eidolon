package main

import (
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestRoofSupportCopiesWireAndExplicitClear(t *testing.T) {
	w := game.NewWorld(nil)
	e := &game.Entity{ID: "roof-wire", Type: game.TypePlayer, Health: 100, MaxHealth: 100, State: "IDLE", X: 300, Z: 200, SupportSurface: "town-home-0"}
	w.AddEntity(e)
	e.SupportSurface = "town-home-0" // Isolate replication from admission's separate geometry validation.
	for _, copy := range []*game.Entity{w.GetEntityCopy(e.ID), w.GetState()[e.ID], w.GetStateForPlayer(e.ID, 200)[e.ID]} {
		if copy == nil || copy.SupportSurface != e.SupportSurface {
			t.Fatal("public world copy lost its floor")
		}
	}
	before := entityToSnapshot(e)
	encoded, err := proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(encoded, &decoded); err != nil || decoded.SupportSurface != e.SupportSurface {
		t.Fatal("wire lost roof ownership", err)
	}
	e.SupportSurface = ""
	if !hasEntityChanged(e, before) {
		t.Fatal("floor transition omitted its delta")
	}
	encoded, err = proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	if err := proto.Unmarshal(encoded, &decoded); err != nil || decoded.SupportSurface != "" {
		t.Fatal("wire did not clear roof ownership", err)
	}
}
