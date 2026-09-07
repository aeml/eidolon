package main

import (
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
	"testing"
	"time"
)

func TestSpiritAreaProtocolSnapshotAndDeltas(t *testing.T) {
	e := &game.Entity{ID: "spirit-snapshot", Type: game.TypePlayer, SubType: "Cleric", SpiritsActive: true, SpiritsBoosted: true,
		SpiritRadius: 34.5, SpiritGuardiansRuneID: "spirits_expanded", SpiritEndTime: time.Now().Add(time.Minute)}
	data, err := proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.SpiritRadius != 34.5 || decoded.SpiritRune != "spirits_expanded" || !decoded.SpiritsBoosted || decoded.SpiritDuration <= 0 {
		t.Fatal("snapshot lost active variant/area")
	}
	snapshot := entityToSnapshot(e)
	if hasEntityChanged(e, snapshot) {
		t.Fatal("unchanged state emits delta")
	}
	e.SpiritRadius = 30
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("radius-only change missing")
	}
	snapshot = entityToSnapshot(e)
	e.SpiritGuardiansRuneID = "spirits_vengeful"
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("rune-only change missing")
	}
	e.SpiritsActive = false
	wire := entityToProto(e)
	if wire.SpiritRadius != 0 || wire.SpiritRune != "" || entityToSnapshot(e).SpiritRadius != 0 {
		t.Fatal("inactive variant retained")
	}
}
