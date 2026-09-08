package game

import (
	"fmt"
	"testing"
	"time"
)

func TestWeeklyRaidEconomyIncludesFullBagCompensation(t *testing.T) {
	for _, fullBag := range []bool{false, true} {
		t.Run(fmt.Sprintf("fullBag=%t", fullBag), func(t *testing.T) {
			w := newTestWorld()
			player := newTestPlayer("weekly-economy", "Wizard")
			player.Level, player.Gold = MaxPlayerLevel, 123
			player.Inventory = make([]Item, MaxInventorySize)
			if fullBag {
				for i := range player.Inventory {
					player.Inventory[i] = Item{ID: fmt.Sprintf("existing-%d", i), Name: "Existing sword",
						Type: ItemWeapon, Stack: 1, MaxStack: 1}
				}
			}
			w.AddEntity(player)
			receipt, granted := w.GrantWeeklyRaidRewardWithReceipt(player.ID)
			if !granted {
				t.Fatal("weekly reward rejected")
			}
			wantGold := 15_000
			if fullBag {
				wantGold += 5_000
			}
			if got := player.Gold - 123; got != wantGold {
				t.Fatalf("gold gained=%d want=%d", got, wantGold)
			}
			if got := w.Economy.Drain(time.Now()).Sources["weekly_raid"]; got != wantGold {
				t.Fatalf("weekly source records %d gold, but player received %d", got, wantGold)
			}
			if player.ResonanceLevel != 0 || player.ResonanceXP != 1_000_000 || player.ResonancePoints != 0 {
				t.Fatal("weekly reward does not match the candidate Resonance budget")
			}
			if receipt.Gold != wantGold || receipt.ResonanceXP != 1_000_000 || receipt.ItemGranted == fullBag {
				t.Fatalf("incorrect grant receipt: %+v", receipt)
			}
			if fullBag {
				for i, item := range player.Inventory {
					if item.ID != fmt.Sprintf("existing-%d", i) {
						t.Fatal("full-bag compensation overwrote existing equipment")
					}
				}
			} else if player.Inventory[0].ID == "" {
				t.Fatal("equipment reward missing")
			}
		})
	}
}

func TestWeeklyRaidRejectedRewardDoesNotRecordIncome(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("weekly-underlevel", "Wizard")
	w.AddEntity(player)
	for _, id := range []string{player.ID, "absent"} {
		if w.GrantWeeklyRaidReward(id) {
			t.Fatalf("invalid recipient %s received reward", id)
		}
	}
	if player.Gold != 0 || w.Economy.Drain(time.Now()).Sources["weekly_raid"] != 0 {
		t.Fatal("rejected reward paid or recorded income")
	}
}
