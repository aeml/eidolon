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
			if !w.GrantWeeklyRaidReward(player.ID) {
				t.Fatal("weekly reward rejected")
			}
			wantGold := 50_000
			if fullBag {
				wantGold += 10_000
			}
			if got := player.Gold - 123; got != wantGold {
				t.Fatalf("gold gained=%d want=%d", got, wantGold)
			}
			if got := w.Economy.Drain(time.Now()).Sources["weekly_raid"]; got != wantGold {
				t.Fatalf("weekly source records %d gold, but player received %d", got, wantGold)
			}
			if player.ResonanceLevel != 1 || player.ResonanceXP != 0 {
				t.Fatal("resonance reward changed")
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
