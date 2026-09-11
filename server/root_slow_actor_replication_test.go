package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestEnemyAndNPCRootSlowChangesReachProtobuf(t *testing.T) {
	for _, kind := range []game.EntityType{game.TypeEnemy, game.TypeNPC} {
		t.Run(string(kind), func(t *testing.T) {
			e := &game.Entity{ID: "control-observer", Type: kind, State: "IDLE",
				Health: 100, MaxHealth: 100, BaseSpeed: 8, Speed: 8}
			before := entityToSnapshot(e)
			decodeChange := func() *statepb.Entity {
				t.Helper()
				if !hasEntityChanged(e, before) {
					t.Fatal("control transition omitted from observer delta")
				}
				wire, err := proto.Marshal(entityToProto(e))
				if err != nil {
					t.Fatal(err)
				}
				decoded := &statepb.Entity{}
				if err := proto.Unmarshal(wire, decoded); err != nil {
					t.Fatal(err)
				}
				before = entityToSnapshot(e)
				return decoded
			}
			e.Rooted, e.Slowed, e.SlowFactor = true, true, .5
			e.RootEndTime, e.SlowEndTime = time.Now().Add(time.Minute), time.Now().Add(time.Minute)
			e.RecalculateStats()
			active := decodeChange()
			if !active.Rooted || !active.Slowed || active.SlowFactor != .5 || active.Speed != 4 ||
				active.RootDuration <= 0 || active.SlowDuration <= 0 {
				t.Fatalf("active controls lost in wire snapshot: root=%v slow=%v speed=%v", active.Rooted, active.Slowed, active.Speed)
			}
			// Actual world expiry is covered by paid-cast game tests. At the wire
			// boundary, clearing root alone must retain a still-active slow.
			e.Rooted = false
			rootCleared := decodeChange()
			if rootCleared.Rooted || rootCleared.RootDuration != 0 || !rootCleared.Slowed || rootCleared.Speed != 4 {
				t.Fatal("root clear lost or removed independent slow")
			}
			e.Slowed, e.SlowFactor = false, 0
			e.RecalculateStats()
			cleared := decodeChange()
			if cleared.Slowed || cleared.SlowDuration != 0 || cleared.SlowFactor != 0 || cleared.Speed != 8 || cleared.Rooted {
				t.Fatal("expired controls or stale slowed speed survived protobuf")
			}
		})
	}
}
