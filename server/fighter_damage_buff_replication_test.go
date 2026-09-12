package main

import (
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestFighterDamageBuffStoredStrengthSnapshotWireAndDelta(t *testing.T) {
	for _, tc := range []struct {
		field, wire   string
		number        protoreflect.FieldNumber
		base, trained float64
	}{
		{"BerserkerModeMultiplier", "berserker_mode_multiplier", 121, 1.5, 1.8},
		{"LastStandMultiplier", "last_stand_multiplier", 122, 3, 3.6},
	} {
		for _, value := range []float64{0, tc.base, tc.trained} {
			t.Run(tc.field+"/"+fmt.Sprint(value), func(t *testing.T) {
				e := &game.Entity{ID: "damage-buff-wire", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE"}
				if tc.number == 121 {
					e.BerserkerModeActive = true
					e.BerserkerModeEndTime = time.Now().Add(time.Minute)
					e.BerserkerModeMultiplier = value
				} else {
					e.LastStandActive = true
					e.LastStandEndTime = time.Now().Add(time.Minute)
					e.LastStandMultiplier = value
				}
				want := value
				if want == 0 {
					want = tc.base
				}
				snapshot := entityToSnapshot(e)
				field := reflect.Indirect(reflect.ValueOf(snapshot)).FieldByName(tc.field)
				if !field.IsValid() || field.Float() != want {
					t.Fatalf("snapshot lost %s=%v", tc.field, want)
				}
				encoded, err := proto.Marshal(entityToProto(e))
				if err != nil {
					t.Fatal(err)
				}
				var received statepb.Entity
				if err := proto.Unmarshal(encoded, &received); err != nil {
					t.Fatal(err)
				}
				descriptor := received.ProtoReflect().Descriptor().Fields().ByName(protoreflect.Name(tc.wire))
				if descriptor == nil || descriptor.Number() != tc.number {
					t.Fatal("missing stable wire field")
				}
				if math.Abs(received.ProtoReflect().Get(descriptor).Float()-want) > .00001 {
					t.Fatal("wire lost stored strength")
				}
				if tc.number == 121 {
					e.BerserkerModeMultiplier = 1.56
				} else {
					e.LastStandMultiplier = 3.12
				}
				if !hasEntityChanged(e, snapshot) {
					t.Fatal("scalar-only strength refresh missing from delta")
				}
				e.BerserkerModeActive, e.LastStandActive = false, false
				inactive := entityToSnapshot(e)
				if reflect.Indirect(reflect.ValueOf(inactive)).FieldByName(tc.field).Float() != 0 || entityToProto(e).ProtoReflect().Get(descriptor).Float() != 0 {
					t.Fatal("inactive buff advertises strength")
				}
				if hasEntityChanged(e, inactive) {
					t.Fatal("inactive stored strength generates spurious delta")
				}
			})
		}
	}
}
