package main

import (
	"sync"
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func publicEncodingActor() *game.Entity {
	return &game.Entity{ID: "owner", Type: game.TypePlayer, SubType: "Wizard",
		Health: 50, Mana: 30, Level: 20, Gold: 5432, Experience: 123,
		MaxExperience: 999, SkillPoints: 2, SelectedBranch: "Pyromancer",
		UnlockedSkills: []string{"Fireball"}, SkillRunes: map[string]string{"Fireball": "private"},
		Equipment: map[string]game.Item{"mainHand": {ID: "public-staff", Stats: map[string]int{"intelligence": 20}}}}
}

func TestPublicFrameEncodingConcurrentOwnerPrivacyAndLifetime(t *testing.T) {
	actor := publicEncodingActor()
	ownerBefore := entityToProto(actor)
	peerBefore := entityToProtoForRecipient(actor, "peer")
	frame := &publicFrameEncoding{}
	var wg sync.WaitGroup
	peers := make([]*statepb.Entity, 20)
	for index := range peers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			peers[index] = frame.forRecipient(actor, "peer")
			for range 10 {
				owner := frame.forRecipient(actor, actor.ID)
				if !proto.Equal(owner, ownerBefore) || !proto.Equal(peers[index], peerBefore) {
					t.Error("owner/public encoding changed or leaked progression")
					return
				}
				if _, err := proto.Marshal(peers[index]); err != nil {
					t.Error(err)
				}
			}
		}()
	}
	wg.Wait()
	if len(frame.entities) != 1 || frame.entities[actor] != peers[0] {
		t.Fatal("cache retained anything other than one public actor")
	}
	for _, peer := range peers {
		if peer != peers[0] {
			t.Fatal("public actor was re-encoded per recipient")
		}
	}
	if frame.forRecipient(nil, "peer") != nil || frame.forRecipient(actor, "") != peers[0] {
		t.Fatal("nil/unidentified recipient handling changed")
	}
	loot := &game.Entity{ID: "loot", Type: game.TypeLoot, LootItem: &game.Item{ID: "public-drop"}}
	if !proto.Equal(frame.forRecipient(loot, "peer"), entityToProto(loot)) {
		t.Fatal("non-player public loot changed")
	}
	// The next detached world snapshot/frame cannot reuse yesterday's cache.
	actor.Mu.Lock()
	actor.Health = 25
	actor.Equipment["mainHand"] = game.Item{ID: "new-staff"}
	actor.Mu.Unlock()
	next := (&publicFrameEncoding{}).forRecipient(actor, "peer")
	if next.Health != 25 || next.Equipment["mainHand"].Id != "new-staff" ||
		peers[0].Health != 50 || peers[0].Equipment["mainHand"].Id != "public-staff" {
		t.Fatal("frame lifetime or detached public message violated")
	}
}

func BenchmarkPublicFrameEncodingHundredRecipients(b *testing.B) {
	actor := publicEncodingActor()
	for _, cached := range []bool{false, true} {
		name := "uncached"
		if cached {
			name = "frame-cached"
		}
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for range b.N {
				frame := &publicFrameEncoding{}
				for range 100 {
					var encoded *statepb.Entity
					if cached {
						encoded = frame.forRecipient(actor, "peer")
					} else {
						encoded = entityToProtoForRecipient(actor, "peer")
					}
					if encoded.Health != 50 {
						b.Fatal("public encoding lost combat state")
					}
				}
			}
		})
	}
}
