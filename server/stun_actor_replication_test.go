package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestEnemyAndNPCStunStartAndClearReachProtobuf(t *testing.T) {
	for _, kind := range []game.EntityType{game.TypeEnemy, game.TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			e := &game.Entity{ID: "stun-observer-target", Type: kind, SubType: "Skeleton", State: "IDLE",
				Health: 100, MaxHealth: 100, TalentRanks: map[string]int{}}
			before := entityToSnapshot(e)
			e.Stunned = true
			e.StunEndTime = time.Now().Add(1500 * time.Millisecond)
			if !hasEntityChanged(e, before) {
				t.Fatal("stun start was omitted from delta change detection")
			}
			decode := func() *statepb.Entity {
				t.Helper()
				wire, err := proto.Marshal(entityToProto(e))
				if err != nil {
					t.Fatal(err)
				}
				decoded := &statepb.Entity{}
				if err := proto.Unmarshal(wire, decoded); err != nil {
					t.Fatal(err)
				}
				return decoded
			}
			active := decode()
			if !active.Stunned || active.StunDuration <= 0 || active.StunDuration > 1.5 {
				t.Fatalf("stun start lost in protobuf: active=%v duration=%v", active.Stunned, active.StunDuration)
			}
			before = entityToSnapshot(e)
			// The normal world tick owns expiry (covered by the paid-cast game
			// tests); verify its resulting clear reaches the wire even while a
			// captured deadline is retained on the authoritative entity.
			e.Stunned = false
			if !hasEntityChanged(e, before) {
				t.Fatal("stun clear was omitted from delta change detection")
			}
			cleared := decode()
			if cleared.Stunned || cleared.StunDuration != 0 {
				t.Fatalf("stun clear lost in protobuf: active=%v duration=%v", cleared.Stunned, cleared.StunDuration)
			}
		})
	}
}
