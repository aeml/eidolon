package game

import (
	"fmt"
	"reflect"
	"testing"
)

func TestStashTransferPreservesItemAndRejectsReplay(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("storage-player", "Wizard")
	w.AddEntity(p)
	item := Item{ID: "kept-id", Name: "Kept staff", Stack: 1, MaxStack: 1, Stats: map[string]int{"intelligence": 7}, Sockets: 1, Gems: []SocketedGem{{}}}
	p.Inventory = []Item{item, {}}
	p.Stash = nil
	if _, ok := w.PerformStashDeposit(p.ID, item.ID); !ok || p.Inventory[0].ID != "" || len(p.Stash) != 1 || !reflect.DeepEqual(p.Stash[0], item) {
		t.Fatal("deposit changed or lost item")
	}
	if _, ok := w.PerformStashDeposit(p.ID, item.ID); ok {
		t.Fatal("replayed deposit accepted")
	}
	if _, ok := w.PerformStashWithdraw(p.ID, item.ID); !ok || len(p.Stash) != 0 || !reflect.DeepEqual(p.Inventory[0], item) {
		t.Fatal("withdraw changed or lost item")
	}
	if _, ok := w.PerformStashWithdraw(p.ID, item.ID); ok {
		t.Fatal("replayed withdrawal accepted")
	}
}

func TestStashFullDestinationPreservesSource(t *testing.T) {
	for _, withdraw := range []bool{false, true} {
		t.Run(fmt.Sprint(withdraw), func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("full-storage", "Wizard")
			w.AddEntity(p)
			source := Item{ID: "source", Name: "Source", Stack: 3, MaxStack: 10}
			full := func(n int) []Item {
				items := make([]Item, n)
				for i := range items {
					items[i] = Item{ID: fmt.Sprint(i), Name: fmt.Sprint(i), Stack: 1, MaxStack: 1}
				}
				return items
			}
			var ok bool
			if withdraw {
				p.Inventory = full(MaxInventorySize)
				p.Stash = []Item{source}
				_, ok = w.PerformStashWithdraw(p.ID, source.ID)
			} else {
				p.Inventory = []Item{source}
				p.Stash = full(MaxStashSize)
				_, ok = w.PerformStashDeposit(p.ID, source.ID)
			}
			if ok {
				t.Fatal("full destination accepted transfer")
			}
			if withdraw && !reflect.DeepEqual(p.Stash[0], source) || !withdraw && !reflect.DeepEqual(p.Inventory[0], source) {
				t.Fatal("full destination changed source")
			}
		})
	}
}

func TestStashPartialMergeConservesQuantity(t *testing.T) {
	for _, withdraw := range []bool{false, true} {
		t.Run(fmt.Sprint(withdraw), func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("partial-storage", "Wizard")
			w.AddEntity(p)
			source := Item{ID: "source", Name: "Shard", Stack: 5, MaxStack: 10}
			dest := Item{ID: "destination", Name: "Shard", Stack: 8, MaxStack: 10}
			if withdraw {
				p.Inventory = []Item{dest}
				p.Stash = []Item{source}
				if _, ok := w.PerformStashWithdraw(p.ID, source.ID); !ok {
					t.Fatal("partial withdraw failed")
				}
			} else {
				p.Inventory = []Item{source}
				p.Stash = make([]Item, MaxStashSize)
				for i := range p.Stash {
					p.Stash[i] = Item{ID: fmt.Sprint(i), Name: "Other", Stack: 1, MaxStack: 1}
				}
				p.Stash[0] = dest
				if _, ok := w.PerformStashDeposit(p.ID, source.ID); !ok {
					t.Fatal("partial deposit failed")
				}
			}
			from, to := p.Inventory[0], p.Stash[0]
			if withdraw {
				from, to = to, from
			}
			if from.ID != "source" || from.Stack != 3 || to.ID != "destination" || to.Stack != 10 {
				t.Fatalf("lost quantity or identity: %+v %+v", from, to)
			}
		})
	}
}

func TestStashRejectsChronicleDepositButAllowsLegacyRecovery(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("quest-storage", "Wizard")
	w.AddEntity(p)
	relic := Item{ID: "chronicle-item-seed", Name: "Verdant Memory Seed", Stack: 4, MaxStack: 1000}
	p.Inventory = []Item{relic}
	if _, ok := w.PerformStashDeposit(p.ID, relic.ID); ok || !reflect.DeepEqual(p.Inventory[0], relic) || len(p.Stash) != 0 {
		t.Fatal("quest deposit bypassed protection")
	}
	p.Inventory = []Item{{}}
	p.Stash = []Item{relic}
	if _, ok := w.PerformStashWithdraw(p.ID, relic.ID); !ok || !reflect.DeepEqual(p.Inventory[0], relic) {
		t.Fatal("legacy quest item could not be recovered")
	}
}
