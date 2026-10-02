package game

import (
	"math"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestVendorRejectsOverflowAndAmbiguousCustodyWithoutMutation(t *testing.T) {
	for _, tc := range []struct {
		name    string
		buyback bool
		gold    int
		items   []Item
		other   []Item
	}{
		{name: "sale product wraps negative", gold: 10, items: []Item{{ID: "wanted", Value: math.MaxInt/2 + 1, Stack: 2}}},
		{name: "sale product wraps positive", gold: 0, items: []Item{{ID: "wanted", Value: math.MaxInt, Stack: 3}}},
		{name: "sale wallet overflows", gold: math.MaxInt, items: []Item{{ID: "wanted", Value: 1, Stack: 1}}},
		{name: "sale invalid wallet", gold: -1, items: []Item{{ID: "wanted", Value: 1, Stack: 1}}},
		{name: "sale duplicate bag IDs", gold: 10, items: []Item{{ID: "wanted", Value: 1}, {ID: "wanted", Value: 2}}},
		{name: "sale already in buyback", gold: 10, items: []Item{{ID: "wanted", Value: 1}}, other: []Item{{ID: "wanted", Value: 2}}},
		{name: "buyback product wraps negative", buyback: true, gold: 10, items: []Item{{ID: "wanted", Value: math.MaxInt/2 + 1, Stack: 2}}},
		{name: "buyback product wraps positive", buyback: true, gold: math.MaxInt, items: []Item{{ID: "wanted", Value: math.MaxInt, Stack: 3}}},
		{name: "buyback invalid wallet", buyback: true, gold: -1, items: []Item{{ID: "wanted", Value: 1}}},
		{name: "buyback duplicate recovery IDs", buyback: true, gold: 10, items: []Item{{ID: "wanted", Value: 1}, {ID: "wanted", Value: 2}}},
		{name: "buyback already in bag", buyback: true, gold: 10, items: []Item{{ID: "wanted", Value: 1}}, other: []Item{{ID: "wanted", Value: 2}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := &Entity{ID: "vendor-player", Type: TypePlayer, Gold: tc.gold, Inventory: cloneItems(tc.items), Buyback: cloneItems(tc.other)}
			if tc.buyback {
				p.Inventory, p.Buyback = cloneItems(tc.other), cloneItems(tc.items)
			}
			w.AddEntity(p)
			beforeGold, beforeBag, beforeBuyback := p.Gold, cloneItems(p.Inventory), cloneItems(p.Buyback)
			var ok bool
			if tc.buyback {
				_, ok = w.PerformBuyback(p.ID, "wanted")
			} else {
				_, ok = w.PerformSell(p.ID, "wanted")
			}
			if ok || p.Gold != beforeGold || !reflect.DeepEqual(p.Inventory, beforeBag) || !reflect.DeepEqual(p.Buyback, beforeBuyback) {
				t.Fatal("invalid vendor operation changed Gold or item custody")
			}
			if report := w.Economy.Drain(time.Now()); report.SourceTotal != 0 || report.SinkTotal != 0 {
				t.Fatal("rejected operation changed the economy ledger")
			}
		})
	}
}

func TestVendorPreservesLegacyPricesExactBoundaryAndReplay(t *testing.T) {
	for _, tc := range []struct {
		name         string
		value, stack int
		gold, price  int
	}{
		{name: "legacy nonpositive defaults", value: -3, stack: 0, gold: 10, price: 1},
		{name: "exact wallet limit", value: 3, stack: 2, gold: math.MaxInt - 6, price: 6},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			item := Item{ID: "earned", Value: tc.value, Stack: tc.stack, Rarity: RarityLegendary, Stats: map[string]int{"strength": 3}}
			p := &Entity{ID: "vendor-player", Type: TypePlayer, Gold: tc.gold, Inventory: []Item{item}}
			w.AddEntity(p)
			if _, ok := w.PerformSell(p.ID, item.ID); !ok || p.Gold != tc.gold+tc.price || len(p.Buyback) != 1 {
				t.Fatal("valid sale did not settle exactly")
			}
			if _, ok := w.PerformSell(p.ID, item.ID); ok {
				t.Fatal("sold item paid twice")
			}
			if _, ok := w.PerformBuyback(p.ID, item.ID); !ok || p.Gold != tc.gold || len(p.Buyback) != 0 || !reflect.DeepEqual(item, p.Inventory[0]) {
				t.Fatal("buyback failed to restore the original item and Gold")
			}
			if _, ok := w.PerformBuyback(p.ID, item.ID); ok {
				t.Fatal("buyback replay succeeded")
			}
			if report := w.Economy.Drain(time.Now()); report.SourceTotal != tc.price || report.SinkTotal != tc.price {
				t.Fatal("vendor ledger did not record each successful side once")
			}
		})
	}
}

func TestVendorRoundTripsSerializeWithActorOnlyRewards(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := &Entity{ID: "vendor-player", Type: TypePlayer, Gold: 1000,
		Inventory: []Item{{ID: "earned", Name: "Earned blade", Value: 25, Stack: 1, Rarity: RarityLegendary, Stats: map[string]int{"strength": 3}}}}
	w.AddEntity(p)
	start := make(chan struct{})
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		<-start
		for i := 0; i < 500; i++ {
			p.Mu.Lock()
			p.Gold++
			p.Mu.Unlock()
		}
	}()
	close(start)
	for i := 0; i < 100; i++ {
		if _, ok := w.PerformSell(p.ID, "earned"); !ok {
			t.Error("sale rejected a valid owned item")
			break
		}
		if _, ok := w.PerformBuyback(p.ID, "earned"); !ok {
			t.Error("buyback rejected a valid recovery item")
			break
		}
	}
	workers.Wait()
	if p.Gold != 1500 || len(p.Buyback) != 0 || len(p.Inventory) != 1 || p.Inventory[0].ID != "earned" {
		t.Fatal("vendor round trips lost rewards or changed item custody")
	}
	if report := w.Economy.Drain(time.Now()); report.SourceTotal != 2500 || report.SinkTotal != 2500 {
		t.Fatal("successful round trips were not counted exactly")
	}
}
