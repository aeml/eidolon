package game

import (
	"fmt"
	"testing"
	"time"
)

// These probes exercise production generators and transactions. Their logs are
// a baseline, not approval of the economy or a claim of earned gameplay. Random
// samples deliberately do not assert exact frequency or usefulness to a build.
func TestLootEconomyAuditGeneratedItems(t *testing.T) {
	const samples = 10000
	for _, level := range []int{5, 30, 60, 100} {
		for _, source := range []struct {
			name string
			make func(int) *Item
		}{{"ordinary_pool", GenerateLoot}, {"elite_pool", GenerateEliteLoot}, {"gamble_main_hand", func(level int) *Item {
			return GenerateLootForSlot("mainHand", level)
		}}} {
			t.Run(fmt.Sprintf("%s/level=%d", source.name, level), func(t *testing.T) {
				equipment, materials, value, equipValue, equipmentLevel := 0, 0, 0, 0, 0
				rarities := map[ItemRarity]int{}
				slots := map[string]int{}
				for i := 0; i < samples; i++ {
					item := source.make(level)
					if item == nil || item.ID == "" || item.Stack != 1 || item.Value <= 0 {
						t.Fatalf("invalid generated item: %+v", item)
					}
					value += item.Value
					if item.Type == ItemMaterial || item.Type == ItemRelic {
						materials++
						continue
					}
					if item.StatScaleVersion != ItemStatScaleVersion || len(item.Stats) == 0 {
						t.Fatalf("equipment not using current stat scale: %+v", item)
					}
					equipment++
					equipValue += item.Value
					equipmentLevel += item.Level
					rarities[item.Rarity]++
					slots[item.Slot]++
				}
				if equipment == 0 || equipment+materials != samples {
					t.Fatal("unaccounted loot or empty equipment sample")
				}
				t.Logf("LOOT source=%s target=%d samples=%d equipment=%d materials=%d mean_vendor_value=%.2f mean_equipment_value=%.2f mean_equipment_level=%.2f equipment_rarities=%v equipment_slots=%v",
					source.name, level, samples, equipment, materials, float64(value)/samples,
					float64(equipValue)/float64(equipment), float64(equipmentLevel)/float64(equipment), rarities, slots)
			})
		}
	}
}

func TestLootEconomyAuditMaterialSources(t *testing.T) {
	const samples = 10000
	for _, elite := range []bool{false, true} {
		shards, hearts := 0, 0
		for i := 0; i < samples; i++ {
			for _, item := range GenerateShardLoot(elite) {
				switch {
				case isForgeShardItem(*item):
					shards += item.Stack
				case isForgeHeartItem(*item):
					hearts += item.Stack
				default:
					t.Fatalf("unclassified dedicated material: %+v", item)
				}
			}
		}
		t.Logf("DEDICATED_MATERIAL_ROLL elite=%t samples=%d shards=%d hearts=%d shards_per_roll=%.4f hearts_per_roll=%.4f", elite, samples, shards, hearts, float64(shards)/samples, float64(hearts)/samples)
	}
	baseShards, baseHearts, equipment := 0, 0, 0
	for _, base := range BaseItems {
		switch base.Name {
		case "Eidolon Shard":
			baseShards++
		case "Eidolon Heart":
			baseHearts++
		default:
			if base.Type != ItemMaterial && base.Type != ItemRelic {
				equipment++
			}
		}
	}
	// Pool membership is exact; weighting by death-path drop frequency belongs
	// in the source-linked baseline, not a second copied combat implementation.
	t.Logf("GENERAL_POOL entries=%d equipment=%d shard_entries=%d heart_entries=%d", len(BaseItems), equipment, baseShards, baseHearts)
	hearts := 0
	for i := 0; i < samples; i++ {
		for _, item := range GenerateBossHearts() {
			if !isForgeHeartItem(*item) || item.Stack != 1 || item.MaxStack != 1000 {
				t.Fatalf("invalid boss heart: %+v", item)
			}
			hearts += item.Stack
		}
	}
	t.Logf("DIRECT_BOSS_HEARTS samples=%d hearts=%d mean=%.4f", samples, hearts, float64(hearts)/samples)
}

func TestLootEconomyAuditForgeAffordability(t *testing.T) {
	heart := *GenerateBossHearts()[0]
	for potency := 0; potency <= 20; potency++ {
		w := newTestWorld()
		player := newTestPlayer("audit-forge", "Fighter")
		player.Equipment = map[string]Item{"mainHand": {
			ID: "audit-weapon", Level: 100, Potency: potency,
			Stats: map[string]int{"damage": 1000}, Value: 1000,
		}}
		player.Inventory = make([]Item, MaxInventorySize)
		// Each stack is filled through the actual pickup storage helper, using
		// individually generated-sized units. No oversized artificial stack.
		for i := 0; i < MaxInventorySize*heart.MaxStack; i++ {
			unit := heart
			unit.ID = fmt.Sprintf("audit-heart-%d", i)
			if remaining := player.AddItemToInventory(unit); remaining != 0 {
				t.Fatalf("normal heart storage rejected unit %d", i)
			}
		}
		before := auditForgeMaterialCount(player, isForgeHeartItem)
		if player.AddItemToInventory(heart) != 1 {
			t.Fatal("full ordinary heart inventory unexpectedly exceeded capacity")
		}
		w.AddEntity(player)
		_, ok, message := w.PerformForgePotency(player.ID, "mainHand")
		after := auditForgeMaterialCount(player, isForgeHeartItem)
		if !ok && (after != before || player.Equipment["mainHand"].Potency != potency) {
			t.Fatal("rejected potency operation mutated inventory or equipment")
		}
		if ok && (after >= before || player.Equipment["mainHand"].Potency != potency+1) {
			t.Fatal("successful potency operation did not consume hearts and advance")
		}
		t.Logf("POTENCY from=%d ordinary_bag_capacity=%d allowed=%t hearts_consumed=%d message=%q", potency, before, ok, before-after, message)
	}
}

func auditForgeMaterialCount(player *Entity, matches func(Item) bool) int {
	total := 0
	for _, item := range player.Inventory {
		if matches(item) {
			total += forgeInventoryStackCount(item)
		}
	}
	return total
}

func TestLootEconomyAuditForgeUpgradePaths(t *testing.T) {
	for _, batch := range []bool{false, true} {
		w := newTestWorld()
		player := newTestPlayer("audit-forge-level", "Wizard")
		player.Level = 100
		base := BaseItems[2] // Same ordinary level-one staff for both paths.
		item := createItem(base, RarityCommon, 1, 0, 1)
		initialDamage := item.Stats["damage"]
		player.Equipment = map[string]Item{"mainHand": *item}
		player.Inventory = []Item{{ID: "audit-shards", Name: "Eidolon Shard", Stack: 1000, MaxStack: 1000}}
		w.AddEntity(player)
		for player.Equipment["mainHand"].Level < 100 {
			amount := 1
			if batch {
				amount = 99
			}
			if _, ok, message := w.PerformForgeUpgrade(player.ID, "mainHand", amount); !ok {
				t.Fatalf("ordinary upgrade failed: %s", message)
			}
		}
		final := player.Equipment["mainHand"]
		t.Logf("UPGRADE_PATH batch=%t level=%d shards_consumed=%d damage_before=%d damage_after=%d value=%d", batch, final.Level, 1000-auditForgeMaterialCount(player, isForgeShardItem), initialDamage, final.Stats["damage"], final.Value)
	}
}

func TestLootEconomyAuditGambleAndSaleReceipts(t *testing.T) {
	const purchases = 1000
	for _, level := range []int{5, 30, 60, 100} {
		w := newTestWorld()
		player := newTestPlayer("audit-gamble", "Fighter")
		player.Level = level
		player.Gold = 100000000
		player.Inventory = make([]Item, MaxInventorySize)
		w.AddEntity(player)
		initialGold, spent, received := player.Gold, 0, 0
		for i := 0; i < purchases; i++ {
			before := player.Gold
			if _, ok := w.PerformBuyGamble(player.ID, "mainHand"); !ok {
				t.Fatal("funded empty-bag gamble rejected")
			}
			spent += before - player.Gold
			item := player.Inventory[0]
			before = player.Gold
			if _, ok := w.PerformSell(player.ID, item.ID); !ok {
				t.Fatal("ordinary generated equipment sale rejected")
			}
			if player.Gold-before != item.Value*item.Stack {
				t.Fatal("sale receipt disagrees with item value")
			}
			received += player.Gold - before
		}
		summary := w.Economy.Drain(time.Now())
		if summary.Sinks["gambling"] != spent || summary.Sources["vendor_sales"] != received || player.Gold-initialGold != received-spent {
			t.Fatalf("transaction accounting mismatch: %+v", summary)
		}
		t.Logf("GAMBLE_RESELL level=%d purchases=%d spent=%d received=%d net_sink=%d sampled_return=%.4f", level, purchases, spent, received, spent-received, float64(received)/float64(spent))
	}
}
