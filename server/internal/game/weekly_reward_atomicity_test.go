package game

import (
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestWeeklyRaidRewardWalletAndCounterLimitsAreAtomic(t *testing.T) {
	for _, scenario := range []string{"room exact wallet", "full exact wallet", "room wallet overflow", "full wallet overflow", "negative wallet", "xp overflow", "rank overflow", "points overflow"} {
		t.Run(scenario, func(t *testing.T) {
			w := newTestWorld()
			player := newTestPlayer("weekly-limits", "Wizard")
			player.Level, player.Gold = MaxPlayerLevel, 123
			player.Inventory = make([]Item, MaxInventorySize)
			if scenario == "full exact wallet" || scenario == "full wallet overflow" {
				for index := range player.Inventory {
					player.Inventory[index] = Item{ID: fmt.Sprintf("existing-%d", index), Name: "Earned blade", Type: ItemWeapon,
						Stack: 1, MaxStack: 1, Potency: 4, Stats: map[string]int{"damage": 23}}
				}
			}
			wantGold, accepted := 15_000, false
			switch scenario {
			case "room exact wallet":
				player.Gold, accepted = math.MaxInt-15_000, true
			case "full exact wallet":
				player.Gold, wantGold, accepted = math.MaxInt-20_000, 20_000, true
			case "room wallet overflow":
				player.Gold = math.MaxInt - 14_999
			case "full wallet overflow":
				player.Gold = math.MaxInt - 19_999
			case "negative wallet":
				player.Gold = -1
			case "xp overflow":
				player.ResonanceXP = math.MaxInt - 999_999
			case "rank overflow":
				player.ResonanceXP, player.ResonanceLevel = ResonanceXPPerLevel-1, math.MaxInt
			case "points overflow":
				player.ResonanceXP, player.ResonancePoints = ResonanceXPPerLevel-1, math.MaxInt
			}
			inventory := cloneItems(player.Inventory)
			gold, xp, rank, points := player.Gold, player.ResonanceXP, player.ResonanceLevel, player.ResonancePoints
			w.AddEntity(player)
			week := "2026-W40"
			receipt, granted := w.GrantWeeklyRaidRewardForWeek(player.ID, week)
			if granted != accepted {
				t.Fatal("wrong weekly admission", receipt, granted)
			}
			if !accepted {
				if player.Gold != gold || player.ResonanceXP != xp || player.ResonanceLevel != rank || player.ResonancePoints != points || player.WeeklyRaidRewardReceipts[week] || !reflect.DeepEqual(player.Inventory, inventory) || w.Economy.Drain(time.Now()).Sources["weekly_raid"] != 0 {
					t.Fatal("rejected weekly payout left a partial grant or burned its receipt")
				}
				return
			}
			if player.Gold != math.MaxInt || receipt.Gold != wantGold || !player.WeeklyRaidRewardReceipts[week] || receipt.ItemGranted != (wantGold == 15_000) {
				t.Fatal("exact-limit reward lost existing compensation/item rules", receipt)
			}
			if _, again := w.GrantWeeklyRaidRewardForWeek(player.ID, week); again || player.Gold != math.MaxInt {
				t.Fatal("exact-limit receipt replay granted twice")
			}
		})
	}
}
