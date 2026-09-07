package game

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestRoutineEquipmentBudgetRetainsMaterialsAndBossRewards(t *testing.T) {
	gear := &Item{ID: "gear", Type: ItemWeapon}
	second := &Item{ID: "second", Type: ItemGloves}
	shard := &Item{ID: "shard", Type: ItemMaterial}
	heart := &Item{ID: "heart", Type: ItemRelic}
	gem := &Item{ID: "gem", Type: ItemGem}
	items := []*Item{shard, gear, heart, second, gem}
	for _, tc := range []struct {
		name            string
		elite, boss, qa bool
		roll            float64
		gearCount       int
	}{
		{"ordinary_retained", false, false, false, 0.5999, 1},
		{"ordinary_suppressed", false, false, false, 0.6, 0},
		{"elite_one_equipment", true, false, false, 0.99, 1},
		{"normal_boss_unchanged", false, true, false, 0.99, 2},
		{"elite_boss_unchanged", true, true, false, 0.99, 2},
		{"qa_guarantee", false, false, true, 0.99, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := limitRoutineEquipmentLoot(items, tc.elite, tc.boss, tc.qa, tc.roll)
			found := map[string]bool{}
			for _, item := range got {
				found[item.ID] = true
			}
			if !found[shard.ID] || !found[heart.ID] || !found[gem.ID] {
				t.Fatal("equipment tuning removed a material or gem")
			}
			count := 0
			for _, item := range got {
				if item == gear || item == second {
					count++
				}
			}
			if count != tc.gearCount {
				t.Fatalf("equipment count = %d, want %d", count, tc.gearCount)
			}
			if tc.gearCount == 1 && !found[gear.ID] {
				t.Fatal("must retain the first equipment roll, not reroll its quality")
			}
			if len(items) != 5 || items[3] != second {
				t.Fatal("must not mutate the generated input slice")
			}
		})
	}
}

func TestRoutineEquipmentRetentionExactRollSweep(t *testing.T) {
	gear := &Item{ID: "gear", Type: ItemArmor}
	kept := 0
	for i := 0; i < 10000; i++ {
		kept += len(limitRoutineEquipmentLoot([]*Item{gear}, false, false, false, float64(i)/10000))
	}
	if kept != 6000 {
		t.Fatalf("retained %d/10000 ordinary equipment rolls, want 6000", kept)
	}
}

func TestRoutineEliteBudgetExhaustiveCurrentPool(t *testing.T) {
	pool := make([]*Item, len(BaseItems))
	materials := 0
	for i, base := range BaseItems {
		pool[i] = &Item{ID: fmt.Sprintf("pool-%d", i), Type: base.Type}
		if base.Type == ItemMaterial || base.Type == ItemRelic || base.Type == ItemGem {
			materials++
		}
	}
	beforeMaterials, afterMaterials := map[string]int{}, map[string]int{}
	beforeGear, afterGear, outcomes := 0, 0, 0
	for _, first := range pool {
		for _, second := range pool {
			for _, third := range pool {
				input := []*Item{first, second, third}
				outcomes++
				for _, item := range input {
					if item.Type == ItemMaterial || item.Type == ItemRelic || item.Type == ItemGem {
						beforeMaterials[item.ID]++
					} else {
						beforeGear++
					}
				}
				gearThisOutcome := 0
				for _, item := range limitRoutineEquipmentLoot(input, true, false, false, 0.99) {
					if item.Type == ItemMaterial || item.Type == ItemRelic || item.Type == ItemGem {
						afterMaterials[item.ID]++
					} else {
						gearThisOutcome++
					}
				}
				if gearThisOutcome > 1 {
					t.Fatal("elite outcome exceeds the one-equipment budget")
				}
				afterGear += gearThisOutcome
			}
		}
	}
	if afterGear != outcomes-materials*materials*materials {
		t.Fatalf("lost an elite's first equipment result: %d", afterGear)
	}
	for id, count := range beforeMaterials {
		if afterMaterials[id] != count {
			t.Fatalf("material %s changed from %d to %d", id, count, afterMaterials[id])
		}
	}
	t.Logf("EXACT_POOL outcomes=%d equipment_before=%.8f equipment_after=%.8f material_counts_unchanged=%v",
		outcomes, float64(beforeGear)/float64(outcomes), float64(afterGear)/float64(outcomes), beforeMaterials)
}

// Each genuine asynchronous publication ends with a guaranteed personal
// guardian fragment. Twenty independent collectors needing one fragment each
// provide a world-visible completion barrier without sleeps as proof of work.
// The existing local QA flag guarantees each first equipment roll, not the
// additional elite rolls whose excess this production regression reproduces.
func TestRoutineEliteDeathPipelinePublishesAtMostOneEquipmentEach(t *testing.T) {
	w := newTestWorld()
	const deaths = 20
	for i := 0; i < deaths; i++ {
		p := newCollectionBalancePlayer(t)
		p.ID = fmt.Sprintf("routine-collector-%d", i)
		p.Quests[0].Count = 7
		p.Inventory[0] = Item{ID: "chronicle-item-owned", Name: p.Quests[0].Target, Type: ItemRelic, Stack: 7, MaxStack: 8}
		p.QAGuaranteedLoot = true
		w.AddEntity(p)
		enemy := &Entity{ID: fmt.Sprintf("elite-routine-%d", i), Type: TypeEnemy, SubType: "InfernoTitan", Level: 1, Health: 1, MaxHealth: 1, State: "IDLE"}
		w.AddEntity(enemy)
		w.handleDeath(enemy, p, nil)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		w.Mu.RLock()
		fragments, equipment := 0, 0
		for _, entity := range w.Entities {
			if entity.Type != TypeLoot || entity.LootItem == nil {
				continue
			}
			if strings.HasPrefix(entity.LootOwnerID, "routine-collector-") && IsChronicleQuestItem(*entity.LootItem) {
				fragments++
			}
			switch entity.LootItem.Type {
			case ItemWeapon, ItemArmor, ItemAccessory, ItemNeck, ItemGloves:
				equipment++
			}
		}
		w.Mu.RUnlock()
		if fragments == deaths {
			if equipment != deaths {
				t.Fatalf("%d completed elite deaths published %d equipment, want exactly one guaranteed piece each", deaths, equipment)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("only %d/%d death publications finished", fragments, deaths)
		}
		time.Sleep(time.Millisecond)
	}
}

func TestRoutineEliteLootKeepsPartyRulesAndPersonalFragments(t *testing.T) {
	w := newTestWorld()
	players := []*Entity{newCollectionBalancePlayer(t), newCollectionBalancePlayer(t)}
	for i, player := range players {
		player.ID = fmt.Sprintf("routine-party-%d", i)
		player.Quests[0].Count = 7
		player.Inventory[0] = Item{ID: "chronicle-item-owned", Name: player.Quests[0].Target, Type: ItemRelic, Stack: 7, MaxStack: 8}
		w.AddEntity(player)
	}
	leader, member := players[0], players[1]
	party := w.CreateParty(leader.ID)
	if err := w.JoinParty(party.ID, member.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := w.SetPartyLootRule(leader.ID, "master", member.ID); err != nil {
		t.Fatal(err)
	}
	leader.QAGuaranteedLoot = true
	enemy := &Entity{ID: "elite-routine-party", Type: TypeEnemy, SubType: "InfernoTitan", Level: 1, Health: 1, MaxHealth: 1, State: "IDLE"}
	w.AddEntity(enemy)
	w.handleDeath(enemy, leader, nil)
	var gearID, itemID, leaderFragment string
	deadline := time.Now().Add(5 * time.Second)
	for {
		w.Mu.RLock()
		fragments, gearCount := 0, 0
		for _, entity := range w.Entities {
			if entity.Type != TypeLoot || entity.LootItem == nil {
				continue
			}
			if strings.HasPrefix(entity.LootOwnerID, "routine-party-") && IsChronicleQuestItem(*entity.LootItem) {
				fragments++
				if entity.LootOwnerID == leader.ID {
					leaderFragment = entity.ID
				}
			}
			switch entity.LootItem.Type {
			case ItemWeapon, ItemArmor, ItemAccessory, ItemNeck, ItemGloves:
				gearCount++
				gearID, itemID = entity.ID, entity.LootItem.ID
				if entity.LootPartyID != party.ID || entity.LootOwnerID != "" {
					t.Error("equipment lost its existing party ownership")
				}
			}
		}
		w.Mu.RUnlock()
		if fragments == 2 {
			if gearCount != 1 {
				t.Fatalf("party elite published %d equipment, want one", gearCount)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("party loot publication did not finish")
		}
		time.Sleep(time.Millisecond)
	}
	if _, ok, reason := w.PerformPickup(leader.ID, gearID); ok || reason != "master_looter_only" {
		t.Fatalf("leader bypassed master loot: %t %s", ok, reason)
	}
	member.Mu.Lock()
	for i := 1; i < len(member.Inventory); i++ {
		member.Inventory[i] = Item{ID: fmt.Sprintf("keep-%d", i), Type: ItemArmor, Stack: 1, MaxStack: 1}
	}
	member.Mu.Unlock()
	if _, ok, reason := w.PerformPickup(member.ID, gearID); ok || reason != "inventory_full" {
		t.Fatalf("full master bag: %t %s", ok, reason)
	}
	if w.GetEntity(gearID) == nil {
		t.Fatal("full bag destroyed the retained gear")
	}
	member.Mu.Lock()
	member.Inventory[len(member.Inventory)-1] = Item{}
	member.Mu.Unlock()
	if _, ok, reason := w.PerformPickup(member.ID, gearID); !ok || reason != "" {
		t.Fatalf("master pickup failed: %t %s", ok, reason)
	}
	if member.Inventory[len(member.Inventory)-1].ID != itemID {
		t.Fatal("pickup replaced the retained equipment roll")
	}
	if _, ok, _ := w.PerformPickup(member.ID, gearID); ok {
		t.Fatal("duplicate gear pickup succeeded")
	}
	if _, ok, reason := w.PerformPickup(leader.ID, leaderFragment); !ok || reason != "" {
		t.Fatalf("master loot stole personal quest credit: %t %s", ok, reason)
	}
	if leader.Quests[0].Count != 8 || leader.Quests[0].Completed || member.Quests[0].Count != 7 {
		t.Fatal("gear/fragment pickup changed unrelated or manual quest progress")
	}
}
