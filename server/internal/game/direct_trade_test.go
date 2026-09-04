package game

import (
	"sync"
	"testing"
)

func directTradePlayer(id string, x float64, gold int, items ...Item) *Entity {
	inventory := make([]Item, MaxInventorySize)
	copy(inventory, items)
	return &Entity{ID: id, Name: id, Type: TypePlayer, X: x, Gold: gold, Inventory: inventory}
}

func TestDirectTradeEscrowsAndCommitsAtomically(t *testing.T) {
	w := NewWorld(nil)
	sword := Item{ID: "sword", Name: "Sword", Type: ItemWeapon, Stack: 1, MaxStack: 1}
	alice := directTradePlayer("alice", 0, 50, sword)
	bob := directTradePlayer("bob", 2, 100)
	w.AddEntity(alice)
	w.AddEntity(bob)

	trade, err := w.StartDirectTrade(alice.ID, bob.ID)
	if err != nil {
		t.Fatal(err)
	}
	trade, err = w.SetDirectTradeOffer(alice.ID, trade.ID, []string{sword.ID}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if alice.Inventory[0].ID != "" || alice.Gold != 40 || len(trade.OfferA.Items) != 1 {
		t.Fatalf("offer was not escrowed: alice=%+v trade=%+v", alice, trade)
	}
	if _, err := w.SetDirectTradeOffer(bob.ID, trade.ID, nil, 25); err != nil {
		t.Fatal(err)
	}
	if _, complete, err := w.ConfirmDirectTrade(alice.ID, trade.ID); err != nil || complete {
		t.Fatalf("first confirmation mismatch: complete=%v err=%v", complete, err)
	}
	completed, complete, err := w.ConfirmDirectTrade(bob.ID, trade.ID)
	if err != nil || !complete || completed.ID != trade.ID {
		t.Fatalf("second confirmation failed: complete=%v err=%v", complete, err)
	}
	if alice.Gold != 65 || bob.Gold != 85 || bob.Inventory[0].ID != sword.ID {
		t.Fatalf("trade settlement mismatch: aliceGold=%d bobGold=%d bobItem=%+v", alice.Gold, bob.Gold, bob.Inventory[0])
	}
	if w.DirectTrades[trade.ID] != nil || w.TradeByPlayer[alice.ID] != "" || w.TradeByPlayer[bob.ID] != "" {
		t.Fatal("completed trade retained live registry entries")
	}
}

func TestDirectTradeOfferChangeResetsConfirmationsAndSupportsEditingEscrow(t *testing.T) {
	w := NewWorld(nil)
	item := Item{ID: "item", Name: "Item", Stack: 1, MaxStack: 1}
	alice := directTradePlayer("alice", 0, 20, item)
	bob := directTradePlayer("bob", 1, 20)
	w.AddEntity(alice)
	w.AddEntity(bob)
	trade, _ := w.StartDirectTrade(alice.ID, bob.ID)
	trade, _ = w.SetDirectTradeOffer(alice.ID, trade.ID, []string{item.ID}, 5)
	if _, _, err := w.ConfirmDirectTrade(bob.ID, trade.ID); err != nil {
		t.Fatal(err)
	}
	trade, err := w.SetDirectTradeOffer(alice.ID, trade.ID, []string{item.ID}, 10)
	if err != nil {
		t.Fatalf("editing an escrowed offer failed: %v", err)
	}
	if trade.ConfirmedA || trade.ConfirmedB || alice.Gold != 10 || alice.Inventory[0].ID != "" {
		t.Fatalf("edited offer did not reset atomically: %+v", trade)
	}
}

func TestDirectTradeRejectsGoldOnlyAndReturnsEscrowOnCancel(t *testing.T) {
	w := NewWorld(nil)
	alice := directTradePlayer("alice", 0, 100)
	bob := directTradePlayer("bob", 1, 100)
	w.AddEntity(alice)
	w.AddEntity(bob)
	trade, _ := w.StartDirectTrade(alice.ID, bob.ID)
	if _, err := w.SetDirectTradeOffer(alice.ID, trade.ID, nil, 20); err != nil {
		t.Fatal(err)
	}
	_, _, _ = w.ConfirmDirectTrade(alice.ID, trade.ID)
	trade, complete, err := w.ConfirmDirectTrade(bob.ID, trade.ID)
	if err == nil || complete || trade.ConfirmedA || trade.ConfirmedB {
		t.Fatalf("gold-only finality was not rejected: trade=%+v complete=%v err=%v", trade, complete, err)
	}
	if _, err := w.CancelDirectTrade(alice.ID, trade.ID); err != nil {
		t.Fatal(err)
	}
	if alice.Gold != 100 {
		t.Fatalf("cancel did not return gold escrow: %d", alice.Gold)
	}
}

func TestDirectTradeRejectsNegativeAndDuplicateOfferItems(t *testing.T) {
	w := NewWorld(nil)
	item := Item{ID: "one", Name: "One", Stack: 1, MaxStack: 1}
	alice := directTradePlayer("alice-invalid", 0, 100, item)
	bob := directTradePlayer("bob-invalid", 1, 100)
	w.AddEntity(alice)
	w.AddEntity(bob)
	trade, err := w.StartDirectTrade(alice.ID, bob.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.SetDirectTradeOffer(alice.ID, trade.ID, nil, -1); err == nil {
		t.Fatal("negative trade gold was accepted")
	}
	if _, err := w.SetDirectTradeOffer(alice.ID, trade.ID, []string{item.ID, item.ID}, 0); err == nil {
		t.Fatal("duplicate item IDs were accepted into escrow")
	}
	if alice.Gold != 100 || alice.Inventory[0].ID != item.ID {
		t.Fatalf("rejected offer mutated escrow source: gold=%d inventory=%+v", alice.Gold, alice.Inventory)
	}
}

func TestDirectTradeConcurrentConfirmSettlesOnce(t *testing.T) {
	w := NewWorld(nil)
	item := Item{ID: "item", Name: "Item", Stack: 1, MaxStack: 1}
	alice := directTradePlayer("alice", 0, 0, item)
	bob := directTradePlayer("bob", 1, 0)
	w.AddEntity(alice)
	w.AddEntity(bob)
	trade, _ := w.StartDirectTrade(alice.ID, bob.ID)
	_, _ = w.SetDirectTradeOffer(alice.ID, trade.ID, []string{item.ID}, 0)

	var wait sync.WaitGroup
	wait.Add(2)
	results := make(chan bool, 2)
	for _, playerID := range []string{alice.ID, bob.ID} {
		go func(id string) {
			defer wait.Done()
			_, completed, _ := w.ConfirmDirectTrade(id, trade.ID)
			results <- completed
		}(playerID)
	}
	wait.Wait()
	close(results)
	completedCount := 0
	for completed := range results {
		if completed {
			completedCount++
		}
	}
	if completedCount != 1 || bob.Inventory[0].ID != item.ID {
		t.Fatalf("concurrent confirmation settled %d times, item=%+v", completedCount, bob.Inventory[0])
	}
}

func TestDirectTradeRequiresNearbyAvailablePlayers(t *testing.T) {
	w := NewWorld(nil)
	alice := directTradePlayer("alice", 0, 0)
	bob := directTradePlayer("bob", 20, 0)
	w.AddEntity(alice)
	w.AddEntity(bob)
	if _, err := w.StartDirectTrade(alice.ID, bob.ID); err == nil {
		t.Fatal("distant direct trade was accepted")
	}
	bob.X = 1
	bob.InstanceID = "dungeon-other"
	if _, err := w.StartDirectTrade(alice.ID, bob.ID); err == nil {
		t.Fatal("cross-instance direct trade was accepted")
	}
}
