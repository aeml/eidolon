package main

import (
	"testing"

	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func TestDecodeStateFrameAppliesFullAndDeltaSnapshots(t *testing.T) {
	full := &statepb.StateEnvelope{
		Version: uint32(stateFrameVersion),
		Payload: &statepb.StateEnvelope_Full{Full: &statepb.StateFull{Entities: []*statepb.Entity{
			{Id: "player-1", Type: "Player", X: 2, Z: 3, Health: 100, Level: 4, Equipment: map[string]*statepb.Item{
				"mainHand": {Id: "sword-1", Name: "Sword", Slot: "mainHand", Level: 4, Rarity: "Rare", Value: 20},
			}},
			{Id: "enemy-1", Type: "Enemy", X: 8, Z: 9, Health: 50, Level: 3},
		}}},
	}
	world := map[string]Entity{"stale": {ID: "stale"}}
	applyDecodedFrame(t, world, full)
	if len(world) != 2 || world["player-1"].Equipment["mainHand"].ID != "sword-1" {
		t.Fatalf("full frame did not replace state: %+v", world)
	}

	delta := &statepb.StateEnvelope{
		Version: uint32(stateFrameVersion),
		Payload: &statepb.StateEnvelope_Delta{Delta: &statepb.StateDelta{
			Entities:   []*statepb.Entity{{Id: "player-1", Type: "Player", X: 12, Z: 13, Health: 90, Level: 4}},
			RemovedIds: []string{"enemy-1"},
		}},
	}
	applyDecodedFrame(t, world, delta)
	if len(world) != 1 || world["player-1"].X != 12 || world["player-1"].Health != 90 {
		t.Fatalf("delta frame did not merge state: %+v", world)
	}
}

func TestDecodeStateFrameRejectsMalformedVersions(t *testing.T) {
	if _, recognized, err := decodeStateFrame([]byte("EDPB")); !recognized || err == nil {
		t.Fatalf("truncated frame recognized=%t err=%v", recognized, err)
	}
	if _, recognized, err := decodeStateFrame(append([]byte("EDPB"), 9)); !recognized || err == nil {
		t.Fatalf("invalid version recognized=%t err=%v", recognized, err)
	}
	if _, recognized, err := decodeStateFrame([]byte(`{"type":"inventory"}`)); recognized || err != nil {
		t.Fatalf("JSON frame recognized=%t err=%v", recognized, err)
	}
}

func applyDecodedFrame(t *testing.T, world map[string]Entity, envelope *statepb.StateEnvelope) {
	t.Helper()
	payload, err := proto.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	frame := append(append([]byte{}, stateFrameMagic...), stateFrameVersion)
	frame = append(frame, payload...)
	update, recognized, err := decodeStateFrame(frame)
	if err != nil || !recognized {
		t.Fatalf("decode recognized=%t err=%v", recognized, err)
	}
	applyStateUpdate(world, update)
}
