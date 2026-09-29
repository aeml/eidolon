package game

import (
	"reflect"
	"testing"
)

func TestForgeGemCombineRejectsFullBagAndInsufficientUnits(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("gem-full-bag", "Wizard")
	p.Inventory = make([]Item, MaxInventorySize)
	for i := range p.Inventory {
		p.Inventory[i] = Item{ID: "occupied", Name: "Occupied", Stack: 1}
	}
	gem := GenerateGem(GemRuby, GemChipped)
	gem.Stack = 4
	p.Inventory[0] = *gem
	w.AddEntity(p)
	before := cloneItems(p.Inventory)
	if _, ok, _ := w.PerformForgeCombineGems(p.ID, [3]int{0, 0, 0}); ok || !reflect.DeepEqual(before, p.Inventory) {
		t.Fatal("full output bag consumed gems or exceeded bag capacity")
	}
	p.Inventory[1] = Item{}
	p.Inventory[0].Stack = 2
	before = cloneItems(p.Inventory)
	if _, ok, _ := w.PerformForgeCombineGems(p.ID, [3]int{0, 0, 0}); ok || !reflect.DeepEqual(before, p.Inventory) {
		t.Fatal("insufficient units were consumed")
	}
	p.Inventory[0].Stack = 4
	if _, ok, message := w.PerformForgeCombineGems(p.ID, [3]int{0, 0, 0}); !ok {
		t.Fatal(message)
	}
	if p.Inventory[0].Stack != 1 || p.Inventory[1].GemQuality != GemFlawed || len(p.Inventory) != MaxInventorySize {
		t.Fatal("successful combine did not preserve the remaining stack and use the free slot")
	}
}

func TestForgeGemStackConsumption(t *testing.T) {
	for _, mode := range []string{"insert", "combine-separate", "combine-one-stack"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("gem-stack", "Wizard")
			p.Equipment = map[string]Item{"mainHand": {ID: "staff", Level: 30, Sockets: 1}}
			p.Inventory = nil
			for i := 0; i < 3; i++ {
				gem := GenerateGem(GemRuby, GemChipped)
				gem.Stack = 4
				p.Inventory = append(p.Inventory, *gem)
			}
			w.AddEntity(p)
			var ok bool
			if mode == "insert" {
				_, ok, _ = w.PerformForgeInsertGem(p.ID, "mainHand", 0, 0)
			} else {
				indices := [3]int{0, 1, 2}
				if mode == "combine-one-stack" {
					indices = [3]int{0, 0, 0}
				}
				_, ok, _ = w.PerformForgeCombineGems(p.ID, indices)
			}
			if !ok {
				t.Fatal("available gem units could not be used")
			}
			chipped, flawed := 0, 0
			for _, item := range p.Inventory {
				if item.GemQuality == GemChipped {
					chipped += item.Stack
				}
				if item.GemQuality == GemFlawed {
					flawed += item.Stack
				}
			}
			if mode == "insert" && chipped != 11 || mode != "insert" && (chipped != 9 || flawed != 1) {
				t.Fatalf("wrong unit consumption: chipped=%d flawed=%d", chipped, flawed)
			}
		})
	}
}

func TestForgeGemChangesRefreshCombatStatsImmediately(t *testing.T) {
	for _, remove := range []bool{false, true} {
		t.Run(map[bool]string{false: "insert", true: "remove"}[remove], func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			player := newTestPlayer("gem-stat-refresh", "Wizard")
			gem := GenerateGem(GemRuby, GemFlawed)
			item := Item{ID: "staff", Level: 30, Sockets: 1, Stats: map[string]int{"damage": 30}}
			player.Equipment = map[string]Item{"mainHand": item}
			player.RecalculateStats()
			withoutGem := player.FireDamageBonus
			player.Inventory = []Item{*gem}
			if remove {
				item.Gems = []SocketedGem{{Type: gem.GemType, Quality: gem.GemQuality, Stats: gem.Stats}}
				player.Equipment["mainHand"] = item
				player.RecalculateStats()
				if player.FireDamageBonus <= withoutGem {
					t.Fatal("fixture gem has no effective bonus")
				}
			}
			w.AddEntity(player)
			var ok bool
			if remove {
				_, ok, _ = w.PerformForgeRemoveGem(player.ID, "mainHand", 0)
			} else {
				_, ok, _ = w.PerformForgeInsertGem(player.ID, "mainHand", 0, 0)
			}
			if !ok {
				t.Fatal("ordinary gem operation rejected")
			}
			if remove && player.FireDamageBonus != withoutGem || !remove && player.FireDamageBonus <= withoutGem {
				t.Fatal("gem action left stale combat stats until another recalculation")
			}
		})
	}
}

func TestConcurrentForgeQuotePurchasesSettleOnce(t *testing.T) {
	for _, potency := range []bool{false, true} {
		w := newTestWorld()
		t.Cleanup(w.StopBackground)
		player := newTestPlayer("quoted-forge", "Wizard")
		player.Level = 100
		player.Equipment = map[string]Item{"mainHand": {ID: "staff", Level: 30, Stats: map[string]int{"damage": 30}}}
		player.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 100}, {ID: "hearts", Name: "Eidolon Heart", Stack: 100}}
		w.AddEntity(player)
		quote := &ForgeQuote{ItemID: "staff", Level: 30}
		results := make(chan bool, 16)
		for i := 0; i < cap(results); i++ {
			go func() {
				var ok bool
				if potency {
					_, ok, _ = w.PerformForgePotency(player.ID, "mainHand", quote)
				} else {
					_, ok, _ = w.PerformForgeUpgrade(player.ID, "mainHand", 1, quote)
				}
				results <- ok
			}()
		}
		accepted := 0
		for i := 0; i < cap(results); i++ {
			if <-results {
				accepted++
			}
		}
		item := player.Equipment["mainHand"]
		if accepted != 1 || player.EquipmentRevision != 1 {
			t.Fatalf("potency=%t: accepted %d requests, revision=%d", potency, accepted, player.EquipmentRevision)
		}
		if potency {
			if item.Potency != 1 || item.Level != 30 || player.Inventory[0].Stack != 100 || player.Inventory[1].Stack != 99 {
				t.Fatal("potency did not settle exactly one quoted rank and Heart")
			}
		} else if item.Level != 31 || item.Potency != 0 || player.Inventory[0].Stack != 99 || player.Inventory[1].Stack != 100 {
			t.Fatal("level did not settle exactly one quoted level and Shard")
		}
	}
}
