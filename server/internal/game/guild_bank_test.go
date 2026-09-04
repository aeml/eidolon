package game

import (
	"sync"
	"sync/atomic"
	"testing"
)

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
