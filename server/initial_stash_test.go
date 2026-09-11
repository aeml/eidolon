package main

import (
	"encoding/json"
	"reflect"
	"testing"

	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

func TestInitialPlayerStateAlwaysPublishesAuthoritativeStash(t *testing.T) {
	for _, scenario := range []struct {
		name  string
		items []game.Item
	}{
		{"new-nil-stash", nil},
		{"emptied-stash", []game.Item{}},
		{"stored-item", []game.Item{{ID: "stored-ring", Name: "Kept ring", Stack: 1, MaxStack: 1}}},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			previousWorld, previousDB, previousWork := world, db, backgroundCharacterWork
			world, db, backgroundCharacterWork = game.NewWorld(nil), nil, &lifecycle.Group{}
			defer func() {
				backgroundCharacterWork.SealWhenIdle()
				world, db, backgroundCharacterWork = previousWorld, previousDB, previousWork
			}()
			client := newLevelCommandClient()
			player := newLevelCommandPlayer(client.playerID)
			player.Stash = scenario.items
			world.AddEntity(player)
			before, _ := json.Marshal(player.Stash)
			// Both ordinary join and session resume call this real snapshot path.
			sendInitialPlayerState(client, player, "")
			count := 0
			for _, message := range drainSentMessages(client.send) {
				if message.Type != MsgStash {
					continue
				}
				count++
				var got []game.Item
				if err := json.Unmarshal(message.Payload, &got); err != nil || got == nil {
					t.Fatalf("stash must be an explicit array, including when empty: %s (%v)", message.Payload, err)
				}
				want := scenario.items
				if want == nil {
					want = []game.Item{}
				}
				if !reflect.DeepEqual(got, want) {
					t.Fatalf("stash contents changed: %#v", got)
				}
			}
			if count != 1 {
				t.Fatalf("expected one authoritative stash snapshot, got %d", count)
			}
			after, _ := json.Marshal(player.Stash)
			if string(after) != string(before) {
				t.Fatal("publishing a snapshot mutated stored state")
			}
		})
	}
}
