package main

import (
	"encoding/json"
	"reflect"
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
