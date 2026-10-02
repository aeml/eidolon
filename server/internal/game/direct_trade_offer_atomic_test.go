package game

import (
	"fmt"
	"reflect"
	"sync"
	"testing"
)

func escrowEditFixture(t *testing.T, items ...Item) (*World, *Entity, *Entity, *DirectTrade) {
	t.Helper()
	w := NewWorld(nil)
	a, b := directTradePlayer("edit-a", 0, 100, items...), directTradePlayer("edit-b", 1, 100)
	a.Health, a.MaxHealth = 100, 100
	b.Health, b.MaxHealth = 100, 100
	w.AddEntity(a)
	w.AddEntity(b)
	trade, err := w.StartDirectTrade(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	trade, err = w.SetDirectTradeOffer(a.ID, trade.ID, []string{items[0].ID}, 5)
	if err != nil {
		t.Fatal(err)
	}
	return w, a, b, trade
}

func tradeOwnedQuantity(w *World, p *Entity, name string) int {
	count := 0
	for _, item := range p.Inventory {
		if item.Name == name {
			count += item.Stack
		}
	}
	if trade := w.DirectTrades[w.TradeByPlayer[p.ID]]; trade != nil {
		offer := trade.OfferA
		if trade.PlayerBID == p.ID {
			offer = trade.OfferB
		}
		for _, item := range offer.Items {
			if item.Name == name {
				count += item.Stack
			}
		}
	}
	for _, e := range w.Entities {
		if e.Type == TypeLoot && e.LootItem != nil && e.LootItem.Name == name {
			count += e.LootItem.Stack
		}
	}
	return count
}

func fillTradeBagByPickup(t *testing.T, w *World, p *Entity) {
	t.Helper()
	// An ordinary pickup can fill the slot freed by an active trade offer.
	for i := range p.Inventory {
		if p.Inventory[i].ID != "" {
			continue
		}
		item := Item{ID: fmt.Sprintf("picked-%d", i), Name: fmt.Sprintf("Picked %d", i), Stack: 1, MaxStack: 1}
		loot := &Entity{ID: "loot-" + item.ID, Type: TypeLoot, X: p.X, Z: p.Z, LootItem: &item}
		w.AddEntity(loot)
		if _, ok, reason := w.PerformPickup(p.ID, loot.ID); !ok {
			t.Fatal(reason)
		}
	}
}

func TestDirectTradeOfferEditKeepsEscrowIdentityBesideMergeableStack(t *testing.T) {
	first := Item{ID: "offered-stack", Name: "Potion", Stack: 5, MaxStack: 20}
	second := first
	second.ID = "retained-stack"
	w, a, _, trade := escrowEditFixture(t, first, second)
	changed, err := w.SetDirectTradeOffer(a.ID, trade.ID, []string{first.ID}, 10)
	if err != nil {
		t.Fatalf("editing already-escrowed stack failed: %v", err)
	}
	if a.Gold != 90 || changed.OfferA.Gold != 10 || changed.OfferA.Items[0].ID != first.ID || tradeOwnedQuantity(w, a, "Potion") != 10 {
		t.Fatal("offer edit lost identity or duplicated resources")
	}
	if _, err := w.CancelDirectTrade(a.ID, trade.ID); err != nil {
		t.Fatal(err)
	}
	if a.Gold != 100 || tradeOwnedQuantity(w, a, "Potion") != 10 {
		t.Fatal("cancellation duplicated returned escrow")
	}
}

func TestDirectTradeOfferEditKeepsEscrowWhenPickupsFillBag(t *testing.T) {
	item := Item{ID: "offered-gear", Name: "Offered gear", Stack: 1, MaxStack: 1}
	w, a, _, trade := escrowEditFixture(t, item)
	fillTradeBagByPickup(t, w, a)
	before := cloneItems(a.Inventory)
	changed, err := w.SetDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 10)
	if err != nil || changed == nil {
		t.Fatalf("retained escrow incorrectly needs bag space: %v", err)
	}
	if !reflect.DeepEqual(a.Inventory, before) || a.Gold != 90 || tradeOwnedQuantity(w, a, item.Name) != 1 {
		t.Fatal("retaining escrow changed full bag or created overflow loot")
	}
}

func TestDirectTradeRejectedOfferEditPreservesFullBagGoldAndConfirmations(t *testing.T) {
	item := Item{ID: "offered-gear", Name: "Offered gear", Stack: 1, MaxStack: 1}
	w, a, b, trade := escrowEditFixture(t, item)
	fillTradeBagByPickup(t, w, a)
	if _, _, err := w.ConfirmDirectTrade(b.ID, trade.ID); err != nil {
		t.Fatal(err)
	}
	before, gold := cloneItems(a.Inventory), a.Gold
	prior := w.DirectTrades[trade.ID].copy()
	for attempt := 0; attempt < 3; attempt++ {
		if _, err := w.SetDirectTradeOffer(a.ID, trade.ID, nil, 0); err == nil {
			t.Fatal("returned escrow cannot fit; edit must be rejected")
		}
		if !reflect.DeepEqual(a.Inventory, before) || a.Gold != gold || !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) || tradeOwnedQuantity(w, a, item.Name) != 1 {
			t.Fatal("rejected edit mutated bag, gold, escrow, confirmations or world loot")
		}
	}
	if _, err := w.CancelDirectTrade(a.ID, trade.ID); err != nil {
		t.Fatal(err)
	}
	if a.Gold != 100 || tradeOwnedQuantity(w, a, item.Name) != 1 {
		t.Fatal("cancel overflow returned more than the one escrow item")
	}
	if _, err := w.CancelDirectTrade(a.ID, trade.ID); err == nil {
		t.Fatal("cancellation replay was accepted")
	}
	if tradeOwnedQuantity(w, a, item.Name) != 1 {
		t.Fatal("replayed cancellation duplicated loot")
	}
}

func TestDirectTradeOfferSwapFreesSlotBeforeReturningPreviousEscrow(t *testing.T) {
	first := Item{ID: "old-gear", Name: "Old gear", Stack: 1, MaxStack: 1}
	second := Item{ID: "new-gear", Name: "New gear", Stack: 1, MaxStack: 1}
	w, a, _, trade := escrowEditFixture(t, first, second)
	fillTradeBagByPickup(t, w, a)
	changed, err := w.SetDirectTradeOffer(a.ID, trade.ID, []string{second.ID}, 20)
	if err != nil || changed == nil {
		t.Fatalf("valid full-bag swap failed: %v", err)
	}
	if a.Gold != 80 || changed.OfferA.Items[0].ID != second.ID || tradeOwnedQuantity(w, a, first.Name) != 1 || tradeOwnedQuantity(w, a, second.Name) != 1 {
		t.Fatal("swap lost or duplicated either item")
	}
	if a.Inventory[1].ID != first.ID {
		t.Fatal("old escrow was spilled instead of using the newly freed slot")
	}
}

func TestDirectTradeRejectsAmbiguousExistingItemIDsWithoutDeletingThem(t *testing.T) {
	item := Item{ID: "same-existing-id", Name: "Existing gear", Stack: 1, MaxStack: 1}
	w := NewWorld(nil)
	a, b := directTradePlayer("ambiguous-a", 0, 100, item, item), directTradePlayer("ambiguous-b", 1, 100)
	w.AddEntity(a)
	w.AddEntity(b)
	trade, err := w.StartDirectTrade(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	before := cloneItems(a.Inventory)
	if _, err := w.SetDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 5); err == nil {
		t.Fatal("ambiguous source was accepted")
	}
	if a.Gold != 100 || !reflect.DeepEqual(a.Inventory, before) || len(w.DirectTrades[trade.ID].OfferA.Items) != 0 {
		t.Fatal("existing ambiguous data was silently deleted or exchanged")
	}
}

func TestDirectTradeOperationsPreserveActorOnlyRewardUpdates(t *testing.T) {
	w := NewWorld(nil)
	weapon := Item{ID: "travelling-weapon", Name: "Weapon", Stack: 1, MaxStack: 1}
	resident := Item{ID: "resident", Name: "Resident", Stack: 1, MaxStack: 1, Stats: map[string]int{"value": 0}}
	a, b := directTradePlayer("reward-a", 0, 100, weapon, resident), directTradePlayer("reward-b", 1, 100)
	w.AddEntity(a)
	w.AddEntity(b)
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		for i := 0; i < 500; i++ {
			a.Mu.Lock()
			a.Gold++
			a.Inventory[1].Stats["value"]++
			a.Mu.Unlock()
		}
	}()
	// Every failure must still join the finite reward writer.
	defer workers.Wait()
	for i := 0; i < 30; i++ {
		owner, recipient := a, b
		if i%2 != 0 {
			owner, recipient = b, a
		}
		trade, err := w.StartDirectTrade(owner.ID, recipient.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, gold := range []int{5, 10} {
			if _, err := w.SetDirectTradeOffer(owner.ID, trade.ID, []string{weapon.ID}, gold); err != nil {
				t.Fatal(err)
			}
		}
		if _, _, err := w.ConfirmDirectTrade(owner.ID, trade.ID); err != nil {
			t.Fatal(err)
		}
		if _, completed, err := w.ConfirmDirectTrade(recipient.ID, trade.ID); err != nil || !completed {
			t.Fatal("settlement did not complete", err)
		}
	}
	workers.Wait()
	if a.Gold+b.Gold != 700 || a.Inventory[1].Stats["value"] != 500 || tradeOwnedQuantity(w, a, weapon.Name)+tradeOwnedQuantity(w, b, weapon.Name) != 1 {
		t.Fatal("trade lost concurrent rewards, mutated unrelated data or duplicated the exchanged item")
	}
}
