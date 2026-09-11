package main

import (
	"math"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestSpellFocusStoredMultiplierSnapshotAndWire(t *testing.T) {
	for _, value := range []float64{0, 2.5, 2.6, 3} {
		e := &game.Entity{ID: "focus-wire", Type: game.TypePlayer, SubType: "Wizard", State: "IDLE",
			SpellFocusActive: true, SpellFocusEndTime: time.Now().Add(15 * time.Second), SpellFocusMultiplier: value}
		want := value
		if want == 0 {
			want = 2.5
		}
		snapshot := entityToSnapshot(e)
		data, err := proto.Marshal(entityToProto(e))
		if err != nil {
			t.Fatal(err)
		}
		var received statepb.Entity
		if err := proto.Unmarshal(data, &received); err != nil {
			t.Fatal(err)
		}
		if snapshot.SpellFocusMultiplier != want || math.Abs(float64(received.SpellFocusMultiplier)-want) > .00001 {
			t.Fatalf("stored%v snapshot%v wire%v", value, snapshot.SpellFocusMultiplier, received.SpellFocusMultiplier)
		}
		e.SpellFocusMultiplier = 2.9
		if !hasEntityChanged(e, snapshot) {
			t.Fatal("scalar-only refresh not included in delta")
		}
		e.SpellFocusActive = false
		inactive := entityToSnapshot(e)
		if inactive.SpellFocusMultiplier != 0 || entityToProto(e).SpellFocusMultiplier != 0 {
			t.Fatal("inactive Focus advertises damage bonus")
		}
		if hasEntityChanged(e, inactive) {
			t.Fatal("inactive coefficient generates spurious deltas")
		}
	}
}

func TestSpellFocusDetachedCopyPreservesPaidCharge(t *testing.T) {
	w := game.NewWorld(nil)
	defer w.StopBackground()
	e := &game.Entity{ID: "focus-copy", Type: game.TypePlayer, SubType: "Wizard", State: "IDLE",
		SpellFocusActive: true, SpellFocusEndTime: time.Now().Add(15 * time.Second), SpellFocusMultiplier: 3}
	w.AddEntity(e)
	copy := w.GetEntityCopy(e.ID)
	if copy == nil || !copy.SpellFocusActive || !copy.SpellFocusEndTime.Equal(e.SpellFocusEndTime) || copy.SpellFocusMultiplier != 3 {
		t.Fatal("detached copy lost paid charge")
	}
}
