package game

import (
	"reflect"
	"testing"
	"time"
)

func TestBuybackUsesBagCapacityWithoutChargingOnFullBag(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("buyback-capacity", "Fighter")
	p.Gold = 1000
	p.Inventory = make([]Item, MaxInventorySize)
	for i := range p.Inventory {
		p.Inventory[i] = Item{ID: "occupied", Stack: 1}
	}
	wanted := Item{ID: "earned-blade", Name: "Earned blade", Value: 125, Stack: 1,
		Level: 80, Potency: 4, Stats: map[string]int{"damage": 50}}
	p.Buyback = []Item{wanted}
	w.AddEntity(p)
	before := cloneItems(p.Inventory)
	if _, ok := w.PerformBuyback(p.ID, wanted.ID); ok {
		t.Fatal("full bag accepted buyback beyond its visible capacity")
	}
	if p.Gold != 1000 || !reflect.DeepEqual(before, p.Inventory) || !reflect.DeepEqual(p.Buyback, []Item{wanted}) {
		t.Fatal("rejected buyback changed balance, bag or recovery item")
	}
	if summary := w.Economy.Drain(time.Now()); summary.SinkTotal != 0 {
		t.Fatal("rejected buyback was recorded as spending")
	}
	p.Inventory[3] = Item{}
	if _, ok := w.PerformBuyback(p.ID, wanted.ID); !ok {
		t.Fatal("buyback rejected an available visible slot")
	}
	if p.Gold != 875 || len(p.Inventory) != MaxInventorySize || !reflect.DeepEqual(p.Inventory[3], wanted) || len(p.Buyback) != 0 {
		t.Fatal("successful buyback did not restore complete gear into the free slot")
	}
	if _, ok := w.PerformBuyback(p.ID, wanted.ID); ok || p.Gold != 875 {
		t.Fatal("buyback replay charged twice")
	}
	if summary := w.Economy.Drain(time.Now()); summary.SinkTotal != 125 {
		t.Fatal("actual buyback spending did not settle once")
	}
}
