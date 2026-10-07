package main

import (
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestFrameCacheIndependentActorsDoNotShareWorkLocks(t *testing.T) {
	for _, kind := range []string{"delta", "public", "prepared-delta", "prepared-public"} {
		t.Run(kind, func(t *testing.T) {
			// Equal IDs must not conflate distinct detached snapshots.
			slow := &game.Entity{ID: "same-id", Type: game.TypePlayer, Health: 10}
			fast := &game.Entity{ID: "same-id", Type: game.TypePlayer, Health: 20}
			var lookup func(*game.Entity) int
			var work *sync.Mutex
			public, delta := newBroadcastFrameCaches(map[string]map[string]*game.Entity{
				"first": {slow.ID: slow}, "second": {fast.ID: fast},
			})
			if kind == "delta" || kind == "prepared-delta" {
				frame := &stateDeltaFrame{}
				if kind == "prepared-delta" {
					frame = delta
				}
				work = &frame.entry(slow).mu
				lookup = func(actor *game.Entity) int { return frame.snapshot(actor).Health }
			} else {
				frame := &publicFrameEncoding{}
				if kind == "prepared-public" {
					frame = public
				}
				work = &frame.entry(slow).mu
				lookup = func(actor *game.Entity) int { return int(frame.forRecipient(actor, "observer").Health) }
			}
			work.Lock()
			var release sync.Once
			slowResult := make(chan int, 1)
			t.Cleanup(func() {
				release.Do(work.Unlock)
				select {
				case value := <-slowResult:
					if value != 10 {
						t.Error("slow actor lost its own snapshot")
					}
				case <-time.After(2 * time.Second):
					t.Error("blocked actor work did not finish after release")
				}
			})
			go func() { slowResult <- lookup(slow) }()
			fastResult := make(chan int, 1)
			go func() { fastResult <- lookup(fast) }()
			select {
			case value := <-fastResult:
				if value != 20 {
					t.Fatal("actor identity was conflated with equal ID")
				}
			case <-time.After(2 * time.Second):
				t.Fatal("unrelated actor waited for another actor's cache work")
			}
		})
	}
}

func TestBroadcastFrameCachesKeepFrozenMembershipAndOwnerPrivacy(t *testing.T) {
	actor := publicEncodingActor()
	public, delta := newBroadcastFrameCaches(map[string]map[string]*game.Entity{
		"owner": {actor.ID: actor}, "observer": {actor.ID: actor, "nil": nil},
	})
	if len(public.entries) != 1 || len(delta.entries) != 1 {
		t.Fatal("duplicate or nil actor entry")
	}
	owner := public.forRecipient(actor, actor.ID)
	if owner.Gold != int32(actor.Gold) || public.entries[actor].encoded != nil {
		t.Fatal("private owner message was cached or changed")
	}
	peer := public.forRecipient(actor, "observer")
	if peer.Gold != 0 || peer.Experience != 0 || peer != public.forRecipient(actor, "other") {
		t.Fatal("public encoding leaked progression or failed to reuse the actor")
	}
	foreign := &game.Entity{ID: actor.ID, Type: game.TypePlayer, Health: 7}
	if delta.snapshot(foreign).Health != 7 || public.forRecipient(foreign, "observer").Health != 7 {
		t.Fatal("foreign detached identity borrowed the cached actor")
	}
	if len(public.entries) != 1 || len(delta.entries) != 1 {
		t.Fatal("foreign lookup mutated frozen membership")
	}
}
