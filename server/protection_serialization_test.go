package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestProtectionSnapshotAndWire(t *testing.T) {
	for _, remaining := range []time.Duration{-time.Second, 0, time.Second, 1200 * time.Millisecond, 3 * time.Second} {
		for _, state := range []string{"IDLE", "DEAD"} {
			e := &game.Entity{ID: "protected", Type: game.TypePlayer, SubType: "Wizard", State: state,
				Health: 100, MaxHealth: 100, InvulnerableEndTime: time.Now().Add(remaining)}
			snapshot := entityToSnapshot(e)
			message := entityToProto(e)
			active := remaining > 0 && state != "DEAD"
			if snapshot.InvulnerableActive != active || message.InvulnerableActive != active {
				t.Fatalf("%v/%s snapshot/proto active %v/%v want%v", remaining, state, snapshot.InvulnerableActive, message.InvulnerableActive, active)
			}
			if active {
				for _, value := range []float64{snapshot.InvulnerableDuration, float64(message.InvulnerableDuration)} {
					if value <= remaining.Seconds()-.1 || value > remaining.Seconds() {
						t.Fatalf("restarted/lost protection duration: %v vs%v", value, remaining)
					}
				}
			} else if snapshot.InvulnerableDuration != 0 || message.InvulnerableDuration != 0 {
				t.Fatal("expired/dead protection retained")
			}
			data, err := proto.Marshal(message)
			if err != nil {
				t.Fatal(err)
			}
			var decoded statepb.Entity
			if err := proto.Unmarshal(data, &decoded); err != nil {
				t.Fatal(err)
			}
			if decoded.InvulnerableActive != message.InvulnerableActive || decoded.InvulnerableDuration != message.InvulnerableDuration {
				t.Fatal("real wire dropped protection")
			}
		}
	}
}

func TestProtectionDeltaTracksStartRefreshAndShortExpiry(t *testing.T) {
	e := &game.Entity{ID: "protected-delta", Type: game.TypePlayer, SubType: "Wizard", State: "IDLE"}
	before := entityToSnapshot(e)
	e.InvulnerableEndTime = time.Now().Add(time.Second)
	if !hasEntityChanged(e, before) {
		t.Fatal("activation missing from delta")
	}
	before = entityToSnapshot(e)
	e.InvulnerableEndTime = time.Now().Add(3 * time.Second)
	if !hasEntityChanged(e, before) {
		t.Fatal("refresh missing from delta")
	}
	e.InvulnerableEndTime = time.Now().Add(20 * time.Millisecond)
	before = entityToSnapshot(e)
	e.InvulnerableEndTime = time.Now().Add(-time.Second)
	if !hasEntityChanged(e, before) {
		t.Fatal("explicit expiry smaller than duration threshold missing from delta")
	}
}

func TestProtectionDetachedEntityCopyKeepsDeadline(t *testing.T) {
	w := game.NewWorld(nil)
	defer w.StopBackground()
	e := &game.Entity{ID: "protected-copy", Type: game.TypePlayer, SubType: "Wizard", State: "IDLE",
		InvulnerableEndTime: time.Now().Add(1200 * time.Millisecond)}
	w.AddEntity(e)
	copy := w.GetEntityCopy(e.ID)
	if copy == nil || !copy.InvulnerableEndTime.Equal(e.InvulnerableEndTime) {
		t.Fatal("detached snapshot lost existing combat protection")
	}
	if !entityToProto(copy).InvulnerableActive {
		t.Fatal("late observer lost protection")
	}
}
