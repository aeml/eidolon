package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestWhirlwindReplicatesDurationAndExplicitEnd(t *testing.T) {
	e := &game.Entity{ID: "spin-observer", Type: game.TypePlayer, State: "IDLE", Health: 500,
		WhirlwindActive: true, WhirlwindEndTime: time.Now().Add(2 * time.Second)}
	snapshot := entityToSnapshot(e)
	if !snapshot.WhirlwindActive || snapshot.WhirlwindDuration <= 0 || snapshot.WhirlwindDuration > 2 {
		t.Fatal("snapshot lost active spin")
	}
	full := entityToProto(e)
	encoded, err := proto.Marshal(full)
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded.WhirlwindActive || decoded.WhirlwindDuration <= 0 || decoded.WhirlwindDuration > 2 {
		t.Fatal("wire payload lost remaining duration")
	}
	e.WhirlwindEndTime = time.Now().Add(1500 * time.Millisecond)
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("observer delta omitted elapsed spin")
	}
	e.WhirlwindEndTime = time.Now().Add(-time.Second)
	if !hasEntityChanged(e, snapshot) {
		t.Fatal("observer delta omitted spin ending")
	}
	ended := entityToProto(e)
	if ended.WhirlwindActive || ended.WhirlwindDuration != 0 {
		t.Fatal("expired spin remained visible")
	}
}

func TestWhirlwindBroadcastCopiesPreserveOnlyPresentationState(t *testing.T) {
	w := game.NewWorld(nil)
	e := &game.Entity{ID: "spin-copy", Type: game.TypePlayer, State: "IDLE", Health: 500,
		WhirlwindActive: true, WhirlwindEndTime: time.Now().Add(2 * time.Second),
		WhirlwindDamageBudget: 999, WhirlwindHitTargets: map[string]bool{"private-target": true}}
	w.AddEntity(e)
	for _, copied := range []*game.Entity{w.GetEntityCopy(e.ID), w.GetState()[e.ID]} {
		wire := entityToProto(copied)
		if !wire.WhirlwindActive || wire.WhirlwindDuration <= 0 || wire.WhirlwindDuration > 2 || !copied.WhirlwindEndTime.Equal(e.WhirlwindEndTime) {
			t.Fatalf("broadcast copy lost active spin: active=%v duration=%f copiedDeadline=%v want=%v", wire.WhirlwindActive, wire.WhirlwindDuration, copied.WhirlwindEndTime, e.WhirlwindEndTime)
		}
		if copied.WhirlwindDamageBudget != 0 || copied.WhirlwindHitTargets != nil {
			t.Fatal("private pulse state leaked into broadcast copy")
		}
	}
}
