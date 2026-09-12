package main

import (
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestClericUtilitySnapshotFullDeltaAndClear(t *testing.T) {
	for _, tc := range []struct {
		field, active, wire string
		number              protoreflect.FieldNumber
		base, maximum       float64
	}{
		{"BlessingResolvePower", "BlessingResolveActive", "blessing_resolve_power", 124, 1, 1.2},
		{"ZealPower", "ZealActive", "zeal_power", 125, 1, 1.2},
		{"MarkWeaknessFactor", "MarkWeakness", "mark_weakness_factor", 126, .2, .5},
	} {
		t.Run(tc.field, func(t *testing.T) {
			for _, value := range []float64{0, tc.base, tc.maximum, -1, 100, math.NaN(), math.Inf(1)} {
				e := &game.Entity{ID: "cleric-wire-recipient", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE"}
				e.BlessingResolveEndTime, e.ZealEndTime, e.MarkWeaknessEndTime = time.Now().Add(time.Minute), time.Now().Add(time.Minute), time.Now().Add(time.Minute)
				entity := reflect.ValueOf(e).Elem()
				entity.FieldByName(tc.active).SetBool(true)
				entity.FieldByName(tc.field).SetFloat(value)
				want := value
				if !(value >= tc.base && value <= tc.maximum) {
					want = tc.base
				}
				snapshot := entityToSnapshot(e)
				if got := reflect.ValueOf(snapshot).Elem().FieldByName(tc.field).Float(); got != want {
					t.Fatalf("stored%v snapshot%v want%v", value, got, want)
				}
				for _, delta := range []bool{false, true} {
					envelope := &statepb.StateEnvelope{}
					if delta {
						envelope.Payload = &statepb.StateEnvelope_Delta{Delta: &statepb.StateDelta{Entities: []*statepb.Entity{entityToProto(e)}}}
					} else {
						envelope.Payload = &statepb.StateEnvelope_Full{Full: &statepb.StateFull{Entities: []*statepb.Entity{entityToProto(e)}}}
					}
					data, err := proto.Marshal(envelope)
					if err != nil {
						t.Fatal(err)
					}
					var received statepb.StateEnvelope
					if err := proto.Unmarshal(data, &received); err != nil {
						t.Fatal(err)
					}
					var actor *statepb.Entity
					if delta {
						actor = received.GetDelta().Entities[0]
					} else {
						actor = received.GetFull().Entities[0]
					}
					descriptor := actor.ProtoReflect().Descriptor().Fields().ByName(protoreflect.Name(tc.wire))
					if descriptor == nil || descriptor.Number() != tc.number || math.Abs(actor.ProtoReflect().Get(descriptor).Float()-want) > 1e-6 {
						t.Fatal("wire identity or recipient potency lost")
					}
				}
				if hasEntityChanged(e, snapshot) {
					t.Fatal("unchanged potency generated delta")
				}
				next := tc.maximum
				if want == next {
					next = tc.base
				}
				entity.FieldByName(tc.field).SetFloat(next)
				if !hasEntityChanged(e, snapshot) {
					t.Fatal("scalar-only refresh omitted from delta")
				}
				entity.FieldByName(tc.active).SetBool(false)
				inactive := entityToSnapshot(e)
				if reflect.ValueOf(inactive).Elem().FieldByName(tc.field).Float() != 0 || reflect.ValueOf(entityToProto(e)).Elem().FieldByName(tc.field).Float() != 0 {
					t.Fatal("inactive effect advertises potency")
				}
				if hasEntityChanged(e, inactive) {
					t.Fatal("stale inactive potency generated delta")
				}
			}
		})
	}
}
