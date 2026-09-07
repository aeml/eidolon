package game

import (
	"fmt"
	"math"
	"strings"
	"testing"
)

func TestChronicleCollectionAllRealmsUseCurrentBudget(t *testing.T) {
	checked := 0
	for _, q := range chronicleQuestCatalog() {
		if q.Type != "COLLECT" {
			continue
		}
		checked++
		if q.MaxCount != 8 || q.CollectionVersion != 2 || !strings.HasPrefix(q.ObjectiveText, "Recover 8 ") ||
			!strings.Contains(q.ObjectiveText, "future repair") {
			t.Fatalf("realm collection disagrees with rules or repair order: %+v", q)
		}
	}
	if checked != 4 {
		t.Fatalf("covered %d elemental collections", checked)
	}
}

func TestChronicleCollectionGuaranteedDropWaitsForRealBagSpace(t *testing.T) {
	w := newTestWorld()
	player := newCollectionBalancePlayer(t)
	for i := range player.Inventory {
		player.Inventory[i] = Item{ID: fmt.Sprintf("keep-%d", i), Type: ItemWeapon, Stack: 1, MaxStack: 1}
	}
	player.Quests[0].DropMisses = 4
	item := ChronicleDropForKill(player, "Skeleton", .99)
	if item == nil {
		t.Fatal("missing guaranteed fragment")
	}
	w.AddEntity(player)
	loot := &Entity{ID: "guaranteed-fragment", Type: TypeLoot, LootItem: item, LootOwnerID: player.ID}
	w.AddEntity(loot)
	if _, ok, reason := w.PerformPickup(player.ID, loot.ID); ok || reason != "inventory_full" {
		t.Fatalf("full bag pickup: %t %s", ok, reason)
	}
	if player.Quests[0].Count != 0 || w.GetEntity(loot.ID) == nil {
		t.Fatal("full bag lost loot or awarded false credit")
	}
	player.Inventory[0] = Item{}
	if _, ok, reason := w.PerformPickup(player.ID, loot.ID); !ok || reason != "" {
		t.Fatalf("freed bag pickup: %t %s", ok, reason)
	}
	if player.Quests[0].Count != 1 || player.Inventory[0].Name != item.Name || w.GetEntity(loot.ID) != nil {
		t.Fatal("pickup did not produce exactly one saved fragment")
	}
	if _, ok, _ := w.PerformPickup(player.ID, loot.ID); ok || player.Quests[0].Count != 1 {
		t.Fatal("duplicate pickup advanced collection")
	}
}

func newCollectionBalancePlayer(t *testing.T) *Entity {
	t.Helper()
	for _, quest := range chronicleQuestCatalog() {
		if quest.Type == "COLLECT" {
			quest.Accepted = true
			return &Entity{ID: "collector", Type: TypePlayer, Health: 100, Level: 10,
				Inventory: make([]Item, MaxInventorySize), Quests: []Quest{quest}}
		}
	}
	t.Fatal("missing collection chapter")
	return nil
}

func TestChronicleCollectionNewBudgetAndBoundedBadLuck(t *testing.T) {
	player := newCollectionBalancePlayer(t)
	if q := player.Quests[0]; q.MaxCount != 8 || q.CollectionVersion != 2 || !strings.Contains(q.ObjectiveText, "Recover 8 ") {
		t.Fatalf("new collection budget/copy mismatch: %+v", q)
	}
	for cycle := 0; cycle < 8; cycle++ {
		for miss := 0; miss < 4; miss++ {
			if item := ChronicleDropForKill(player, "Skeleton", .99); item != nil {
				t.Fatal("early bad-luck guarantee")
			}
			if player.Quests[0].DropMisses != miss+1 {
				t.Fatal("eligible miss not retained")
			}
		}
		item := ChronicleDropForKill(player, "Skeleton", .99)
		if item == nil || item.Stack != 1 || item.MaxStack < 8 || player.Quests[0].DropMisses != 0 {
			t.Fatalf("fifth eligible kill did not yield one stackable fragment: %+v", item)
		}
		player.Quests[0].Count++
	}
	if ChronicleDropForKill(player, "Skeleton", 0) != nil {
		t.Fatal("completed objective generated surplus fragment")
	}
}

func TestChronicleCollectionDropThresholdAndGuardian(t *testing.T) {
	for _, check := range []struct {
		subtype string
		roll    float64
		want    bool
	}{
		{"Skeleton", .349999, true}, {"Skeleton", .35, false}, {"Skeleton", .65, false},
		{"InfernoTitan", .99, true}, {"Siren", 0, false},
	} {
		player := newCollectionBalancePlayer(t)
		if got := ChronicleDropForKill(player, check.subtype, check.roll) != nil; got != check.want {
			t.Errorf("%s roll=%f drop=%t want=%t", check.subtype, check.roll, got, check.want)
		}
	}
}

func TestChronicleCollectionIgnoresInvalidAndIneligibleRolls(t *testing.T) {
	for _, roll := range []float64{-1, 1, math.NaN(), math.Inf(1)} {
		player := newCollectionBalancePlayer(t)
		player.Quests[0].DropMisses = 4
		if ChronicleDropForKill(player, "Skeleton", roll) != nil || player.Quests[0].DropMisses != 4 {
			t.Fatalf("invalid roll mutated collection: %v", roll)
		}
	}
	player := newCollectionBalancePlayer(t)
	player.Quests[0].DropMisses = 4
	if ChronicleDropForKill(player, "Siren", .99) != nil || player.Quests[0].DropMisses != 4 {
		t.Fatal("wrong realm consumed pity")
	}
	player.Quests[0].Accepted = false
	if ChronicleDropForKill(player, "Skeleton", .99) != nil || player.Quests[0].DropMisses != 4 {
		t.Fatal("unaccepted quest consumed pity")
	}
}

func TestChronicleCollectionMigrationHonorsAcceptedContract(t *testing.T) {
	definition := newCollectionBalancePlayer(t).Quests[0]
	legacy := definition
	legacy.MaxCount, legacy.Count, legacy.CollectionVersion = 4, 3, 0
	legacy.ObjectiveText = "Old four-fragment instructions"
	for _, complete := range []bool{false, true} {
		legacy.Completed = complete
		repaired := copyQuestDefinition(legacy, definition)
		if repaired.MaxCount != 4 || repaired.Count != 3 || repaired.CollectionVersion != 1 ||
			!repaired.Accepted || repaired.Completed != complete || !strings.Contains(repaired.ObjectiveText, "Recover 4 ") {
			t.Fatalf("migration rewrote an accepted contract: %+v", repaired)
		}
		if copyQuestDefinition(repaired, definition) != repaired {
			t.Fatal("migration is not idempotent")
		}
	}
	legacy.Completed, legacy.Accepted = false, false
	if repaired := copyQuestDefinition(legacy, definition); repaired.MaxCount != 8 || repaired.CollectionVersion != 2 {
		t.Fatal("unaccepted offer did not receive current rules")
	}
	player := newCollectionBalancePlayer(t)
	player.Quests[0].MaxCount, player.Quests[0].CollectionVersion = 4, 1
	if ChronicleDropForKill(player, "Skeleton", .64) == nil {
		t.Fatal("legacy accepted drop rate was reduced")
	}
}

func TestChronicleCollectionMigrationRetainsNewBadLuckState(t *testing.T) {
	definition := newCollectionBalancePlayer(t).Quests[0]
	progress := definition
	progress.Count, progress.DropMisses = 2, 4
	repaired := copyQuestDefinition(progress, definition)
	if repaired.Count != 2 || repaired.DropMisses != 4 || repaired.CollectionVersion != 2 {
		t.Fatal("refresh lost current collection progress")
	}
	player := newCollectionBalancePlayer(t)
	player.Quests[0] = repaired
	if ChronicleDropForKill(player, "Skeleton", .99) == nil {
		t.Fatal("restored bad-luck guarantee was lost")
	}
}
