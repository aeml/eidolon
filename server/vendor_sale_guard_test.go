package main

import (
	"encoding/json"
	"reflect"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestVendorSaleDispatchRejectsEmptyMissingAndProtectedItems(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Gold = 100
	player.Inventory = []game.Item{{}, {ID: "sellable", Name: "Iron Sword", Value: 7, Stack: 1},
		{ID: "chronicle-item-protected", Name: "Story fragment", Value: 50, Stack: 1}}
	world.AddEntity(player)
	sell := func(id string) {
		payload, _ := json.Marshal(SellPayload{ItemID: id})
		client.handleMessage(Message{Type: MsgSell, Payload: payload})
		drainSentMessages(client.send)
	}
	for _, id := range []string{"", "absent", "chronicle-item-protected"} {
		before := world.GetEntityCopy(player.ID)
		sell(id)
		if player.Gold != before.Gold || !reflect.DeepEqual(player.Inventory, before.Inventory) {
			t.Fatalf("invalid sale %q changed Gold or inventory", id)
		}
	}
	sell("sellable")
	sell("sellable")
	if player.Gold != 107 {
		t.Fatal("ordinary sale did not pay exactly once")
	}
	if summary := world.Economy.Drain(time.Now()); summary.SourceTotal != 7 {
		t.Fatal("economy ledger counted a rejected sale", summary.SourceTotal)
	}
}

func TestVendorDispatchRepliesSerializeWithActorRewards(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Gold = 1000
	player.Inventory = []game.Item{{ID: "earned", Name: "Earned blade", Value: 25, Stack: 1,
		Rarity: game.RarityLegendary, Stats: map[string]int{"strength": 3}}}
	world.AddEntity(player)
	start := make(chan struct{})
	var worker sync.WaitGroup
	worker.Add(1)
	go func() {
		defer worker.Done()
		<-start
		for i := 0; i < 500; i++ {
			player.Mu.Lock()
			player.Gold++
			for _, items := range [][]game.Item{player.Inventory, player.Buyback} {
				for _, item := range items {
					if item.ID == "earned" {
						item.Stats["reward-observations"]++
					}
				}
			}
			player.Mu.Unlock()
		}
	}()
	close(start)
	// Stay below the ordinary ten-per-second allowance for each message kind;
	// the world-level test separately covers one hundred custody round trips.
	for i := 0; i < 8; i++ {
		for _, kind := range []string{MsgSell, MsgBuyback} {
			payload, _ := json.Marshal(SellPayload{ItemID: "earned"})
			client.handleMessage(Message{Type: kind, Payload: payload})
			messages := drainSentMessages(client.send)
			if len(messages) != 2 || messages[0].Type != MsgInventory || messages[1].Type != MsgBuybackList {
				t.Error("vendor operation did not acknowledge both custody views")
				continue
			}
			var bag, buyback []game.Item
			if err := json.Unmarshal(messages[0].Payload, &bag); err != nil {
				t.Error(err)
			}
			if err := json.Unmarshal(messages[1].Payload, &buyback); err != nil {
				t.Error(err)
			}
			if kind == MsgSell && (len(bag) != 1 || bag[0].ID != "" || len(buyback) != 1 || buyback[0].ID != "earned") {
				t.Error("sale reply did not show the item exclusively in buyback")
			}
			if kind == MsgBuyback && (len(bag) != 1 || bag[0].ID != "earned" || len(buyback) != 0) {
				t.Error("buyback reply did not show the item exclusively in the bag")
			}
		}
	}
	worker.Wait()
	if player.Gold != 1500 || len(player.Buyback) != 0 || player.Inventory[0].Stats["reward-observations"] != 500 {
		t.Fatal("vendor dispatch lost a concurrent reward or item metadata update")
	}
}
