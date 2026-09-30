package game

import (
	"math"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
)

func TestGuildBankFailedCreditLeavesPartialStackAndMetadataUntouched(t *testing.T) {
	world := NewWorld(nil)
	inventory := make([]Item, MaxInventorySize)
	for index := range inventory {
		inventory[index] = Item{ID: "occupied", Name: "Occupied", Stack: 1, MaxStack: 1}
	}
	inventory[0] = Item{ID: "old-shard", Name: "Shard", Stack: 8, MaxStack: 10}
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Inventory: inventory})
	before := world.GetEntityCopy("player-a").Inventory
	if err := world.CreditPlayerItem("player-a", Item{ID: "incoming-shard", Name: "Shard", Stack: 5, MaxStack: 10, Icon: "shard-icon"}); err == nil {
		t.Fatal("partially fitting credit must fail as a whole")
	}
	if after := world.GetEntityCopy("player-a").Inventory; !reflect.DeepEqual(before, after) {
		t.Fatalf("failed guild withdrawal partially granted inventory: before=%+v after=%+v", before[0], after[0])
	}
}

func TestGuildBankGoldCreditRejectsOverflowWithoutChangingWallet(t *testing.T) {
	world := NewWorld(nil)
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Gold: math.MaxInt})
	if err := world.CreditPlayerGold("player-a", 1); err == nil {
		t.Fatal("overflowing credit succeeded")
	}
	if gold := world.GetEntityCopy("player-a").Gold; gold != math.MaxInt {
		t.Fatalf("rejected credit changed wallet: %d", gold)
	}
}

func TestGuildBankCreditAcceptsExactStackFitAndLegacySingleItem(t *testing.T) {
	world := NewWorld(nil)
	inventory := make([]Item, MaxInventorySize)
	for index := range inventory {
		inventory[index] = Item{ID: "occupied", Name: "Occupied", Stack: 1}
	}
	inventory[0] = Item{ID: "old-shard", Name: "Shard", Stack: 8, MaxStack: 10}
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Inventory: inventory})
	if err := world.CreditPlayerItem("player-a", Item{ID: "shard", Name: "Shard", Stack: 2, MaxStack: 10}); err != nil {
		t.Fatal(err)
	}
	if stack := world.GetEntityCopy("player-a").Inventory[0].Stack; stack != 10 {
		t.Fatalf("exact stack fit = %d", stack)
	}
	world.AddEntity(&Entity{ID: "legacy", Type: TypePlayer, Inventory: []Item{{}}})
	if err := world.CreditPlayerItem("legacy", Item{ID: "old-blade", Name: "Legacy Blade"}); err != nil {
		t.Fatal(err)
	}
	bag := world.GetEntityCopy("legacy").Inventory
	if len(bag) != MaxInventorySize || bag[0].ID != "old-blade" || bag[0].Stack != 1 {
		t.Fatalf("legacy single item disappeared: %+v", bag)
	}
}

func TestGuildBankChronicleItemsStayWithTheirOwner(t *testing.T) {
	world := NewWorld(nil)
	item := Item{ID: "chronicle-item-memory", Name: "Verdant Memory Seed", Stack: 1}
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Inventory: []Item{item}})
	if _, err := world.DebitPlayerItem("player-a", item.ID); err == nil {
		t.Fatal("personal story item entered shared bank")
	}
	if actual := world.GetEntityCopy("player-a").Inventory[0]; !reflect.DeepEqual(item, actual) {
		t.Fatal("rejected quest deposit removed its item")
	}
}

func TestGuildBankCreditCannotUseHiddenBagSlots(t *testing.T) {
	world := NewWorld(nil)
	inventory := make([]Item, MaxInventorySize+1)
	for index := 0; index < MaxInventorySize; index++ {
		inventory[index] = Item{ID: "occupied", Stack: 1}
	}
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Inventory: inventory})
	if err := world.CreditPlayerItem("player-a", Item{ID: "withdrawn", Stack: 1}); err == nil {
		t.Fatal("guild item delivered outside visible bag")
	}
	if after := world.GetEntityCopy("player-a").Inventory; !reflect.DeepEqual(inventory, after) {
		t.Fatal("failed hidden-slot delivery mutated inventory")
	}
}

func TestGuildBankPlayerEscrowRoundTrip(t *testing.T) {
	world := NewWorld(nil)
	player := &Entity{ID: "player-a", Type: TypePlayer, Gold: 250, Inventory: make([]Item, MaxInventorySize)}
	player.Inventory[0] = Item{ID: "blade", Name: "Blade", Stack: 1}
	world.AddEntity(player)

	if err := world.DebitPlayerGold(player.ID, 100); err != nil {
		t.Fatal(err)
	}
	if err := world.CreditPlayerGold(player.ID, 100); err != nil {
		t.Fatal(err)
	}
	item, err := world.DebitPlayerItem(player.ID, "blade")
	if err != nil {
		t.Fatal(err)
	}
	if err := world.CreditPlayerItem(player.ID, item); err != nil {
		t.Fatal(err)
	}
	snapshot := world.GetEntityCopy(player.ID)
	if snapshot.Gold != 250 || snapshot.Inventory[0].ID != "blade" {
		t.Fatalf("escrow round trip changed player state: gold=%d inventory=%+v", snapshot.Gold, snapshot.Inventory)
	}
}

func TestGuildBankEscrowRejectsNegativeAndConcurrentOverdraw(t *testing.T) {
	world := NewWorld(nil)
	player := &Entity{ID: "bank-race", Type: TypePlayer, Gold: 100}
	world.AddEntity(player)
	if err := world.DebitPlayerGold(player.ID, -1); err == nil {
		t.Fatal("negative guild-bank debit was accepted")
	}
	var successes atomic.Int64
	var wait sync.WaitGroup
	for index := 0; index < 50; index++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			if world.DebitPlayerGold(player.ID, 10) == nil {
				successes.Add(1)
			}
		}()
	}
	wait.Wait()
	if successes.Load() != 10 || world.GetEntityCopy(player.ID).Gold != 0 {
		t.Fatalf("concurrent escrow successes=%d gold=%d", successes.Load(), world.GetEntityCopy(player.ID).Gold)
	}
}

func TestGuildBankItemCreditRejectsFullInventory(t *testing.T) {
	world := NewWorld(nil)
	inventory := make([]Item, MaxInventorySize)
	for index := range inventory {
		inventory[index] = Item{ID: "occupied", Stack: 1, MaxStack: 1}
	}
	world.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, Inventory: inventory})
	if err := world.CreditPlayerItem("player-a", Item{ID: "extra", Stack: 1, MaxStack: 1}); err == nil {
		t.Fatal("expected full inventory error")
	}
}
