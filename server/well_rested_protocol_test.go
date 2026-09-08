package main

import (
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestWellRestedReplicationAndExplicitExpiry(t *testing.T) {
	e := &game.Entity{ID: "rest-wire", Type: game.TypePlayer, Health: 50, MaxHealth: 100, State: "IDLE", WellRestedSeconds: 1.25, SafeZoneID: "lanternhold"}
	encoded, err := proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.WellRestedSeconds != 1.25 || decoded.SafeZoneId != "lanternhold" {
		t.Fatal("wire lost rest/safe-zone state")
	}
	snapshot := entityToSnapshot(e)
	e.WellRestedSeconds = 1.20
	if hasEntityChanged(e, snapshot) {
		t.Fatal("rest-only observer delta should not flood every frame")
	}
	e.WellRestedSeconds = .9
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("observer missed one-second boundary")
	}
	e.WellRestedSeconds, e.SafeZoneID = 1.25, ""
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("observer missed leaving safe zone")
	}
	snapshot = entityToSnapshot(e)
	e.WellRestedSeconds = 0
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("observer missed expiry")
	}
	encoded, err = proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	if err := proto.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.WellRestedSeconds != 0 || decoded.SafeZoneId != "" {
		t.Fatal("expired state did not clear on wire")
	}
}

func TestWellRestedWorldCopiesKeepPublicBank(t *testing.T) {
	w := game.NewWorld(nil)
	e := &game.Entity{ID: "rest-copy", Type: game.TypePlayer, Health: 50, MaxHealth: 100, State: "IDLE", WellRestedSeconds: 7200, SafeZoneID: "lanternhold"}
	w.AddEntity(e)
	for _, copied := range []*game.Entity{w.GetEntityCopy(e.ID), w.GetState()[e.ID], w.GetStateForPlayer(e.ID, 200)[e.ID]} {
		if copied == nil || copied.WellRestedSeconds != 7200 || copied.SafeZoneID != "lanternhold" {
			t.Fatal("world copy lost rest bank")
		}
		copied.WellRestedSeconds = 1
		if e.WellRestedSeconds != 7200 {
			t.Fatal("copy aliases live rest state")
		}
	}
}
