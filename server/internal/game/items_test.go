package game

import (
	"reflect"
	"testing"
)

func TestFlatItemStatSquishUsesTwentyFiveToOneScale(t *testing.T) {
	if got := SquishFlatItemStat("strength", 500); got != 20 {
		t.Fatalf("expected 500 strength to squish to 20, got %d", got)
	}
	if got := SquishFlatItemStat("defense", 12); got != 1 {
		t.Fatalf("expected a positive low roll to remain useful at 1, got %d", got)
	}
	if got := SquishFlatItemStat("critChance", 15); got != 15 {
		t.Fatalf("expected percentage stats to remain unchanged, got %d", got)
	}
}

func TestNormalizeLegacyItemStatScaleRunsExactlyOnce(t *testing.T) {
	item := Item{
		Stats: map[string]int{
			"strength":   500,
			"damage":     24,
			"critChance": 15,
		},
		Gems: []SocketedGem{{
			Type: GemRuby,
			Stats: map[string]int{
				"strength":   400,
				"fireDamage": 40,
			},
		}},
	}

	NormalizeItemStatScale(&item)
	expectedStats := map[string]int{"strength": 20, "damage": 1, "critChance": 15}
	expectedGemStats := map[string]int{"strength": 16, "fireDamage": 40}
	if !reflect.DeepEqual(item.Stats, expectedStats) {
		t.Fatalf("unexpected migrated item stats: %#v", item.Stats)
	}
	if !reflect.DeepEqual(item.Gems[0].Stats, expectedGemStats) {
		t.Fatalf("unexpected migrated gem stats: %#v", item.Gems[0].Stats)
	}
	if item.StatScaleVersion != ItemStatScaleVersion {
		t.Fatalf("expected scale version %d, got %d", ItemStatScaleVersion, item.StatScaleVersion)
	}

	firstPass := map[string]int{}
	for stat, value := range item.Stats {
		firstPass[stat] = value
	}
	NormalizeItemStatScale(&item)
	if !reflect.DeepEqual(item.Stats, firstPass) {
		t.Fatalf("current-scale item was squished twice: %#v", item.Stats)
	}
}

func TestGeneratedEquipmentAcrossEverySlotUsesCurrentStatScale(t *testing.T) {
	slots := []string{
		"head", "chest", "legs", "feet", "gloves", "shoulders",
		"belt", "ring", "neck", "trinket", "mainHand", "offHand",
	}
	for _, slot := range slots {
		item := GenerateLootForSlot(slot, 100)
		if item == nil {
			t.Fatalf("expected generated item for %s", slot)
		}
		if item.StatScaleVersion != ItemStatScaleVersion {
			t.Fatalf("slot %s used stat scale version %d", slot, item.StatScaleVersion)
		}
		for stat, value := range item.Stats {
			if _, squishable := squishableFlatItemStats[stat]; squishable && value < 1 {
				t.Fatalf("slot %s produced non-positive %s=%d", slot, stat, value)
			}
		}
	}
}

func TestGenerateLoot(t *testing.T) {
	// Test basic loot generation
	for i := 0; i < 10; i++ {
		item := GenerateLoot(10)
		if item == nil {
			t.Fatal("GenerateLoot returned nil")
		}

		// Verify item has required fields
		if item.ID == "" {
			t.Error("Item has empty ID")
		}
		if item.Name == "" {
			t.Error("Item has empty Name")
		}
		if item.Level < 1 || item.Level > 10 {
			t.Errorf("Item level out of range: %d", item.Level)
		}
		if item.Slot == "" {
			t.Error("Item has empty Slot")
		}
	}
}

func TestGenerateEquipmentLootAlwaysReturnsEquipment(t *testing.T) {
	for i := 0; i < 100; i++ {
		item := GenerateEquipmentLoot(10)
		if item == nil {
			t.Fatal("GenerateEquipmentLoot returned nil")
		}
		if item.Type == ItemMaterial || item.Type == ItemRelic || item.Type == ItemGem {
			t.Fatalf("GenerateEquipmentLoot returned non-equipment type %s", item.Type)
		}
	}
}

func TestGenerateLootRarity(t *testing.T) {
	// Run many times to check rarity distribution
	rarities := make(map[ItemRarity]int)
	iterations := 1000

	for i := 0; i < iterations; i++ {
		item := GenerateLoot(10)
		rarities[item.Rarity]++
	}

	// Check that common is most frequent (should be ~40%)
	if rarities[RarityCommon] < iterations*30/100 {
		t.Errorf("Common rarity too rare: %d/%d", rarities[RarityCommon], iterations)
	}

	// Check that legendary is rare (should be ~1%)
	if rarities[RarityLegendary] > iterations*5/100 {
		t.Errorf("Legendary rarity too common: %d/%d", rarities[RarityLegendary], iterations)
	}
}

func TestGenerateEliteLoot(t *testing.T) {
	for i := 0; i < 20; i++ {
		item := GenerateEliteLoot(15)
		if item == nil {
			t.Fatal("GenerateEliteLoot returned nil")
		}

		// Elite loot should never be Common
		if item.Rarity == RarityCommon {
			t.Error("Elite loot generated Common rarity item")
		}

		// Level should be 15 for equipment, but materials/relics have level 1
		if item.Type != ItemMaterial && item.Type != ItemRelic {
			if item.Level != 15 {
				t.Errorf("Expected level 15, got %d for non-material item", item.Level)
			}
		}
	}
}

func TestGenerateEliteLootRarity(t *testing.T) {
	// Elite loot should never be Common. Because elite generation can still pick
	// base materials/relics (which are upgraded to Eidolic in createItem),
	// we validate broad distribution characteristics instead of brittle exact ratios.
	rarities := make(map[ItemRarity]int)
	iterations := 500

	for i := 0; i < iterations; i++ {
		item := GenerateEliteLoot(10)
		rarities[item.Rarity]++
	}

	// No Common items
	if rarities[RarityCommon] > 0 {
		t.Errorf("Elite loot produced %d Common items", rarities[RarityCommon])
	}

	// Should still produce a healthy amount of non-Uncommon outcomes
	// (Rare + Legendary + Eidolic). This guards against regressions where
	// elite rolls collapse to almost all Uncommon.
	nonUncommon := rarities[RarityRare] + rarities[RarityLegendary] + rarities[RarityEidolic]
	if nonUncommon < iterations*25/100 {
		t.Errorf("Elite loot distribution unexpected: too few high-tier drops (%d/%d)", nonUncommon, iterations)
	}
}

func TestGenerateLootForSlot(t *testing.T) {
	slots := []string{
		"head", "chest", "legs", "feet", "gloves", "shoulders",
		"belt", "ring", "neck", "trinket", "mainHand", "offHand",
	}

	for _, slot := range slots {
		item := GenerateLootForSlot(slot, 10)
		if item == nil {
			t.Errorf("GenerateLootForSlot returned nil for slot: %s", slot)
			continue
		}

		if item.Slot != slot {
			t.Errorf("Expected slot %s, got %s", slot, item.Slot)
		}
	}
}

func TestGenerateLootForSlotInvalid(t *testing.T) {
	item := GenerateLootForSlot("invalid_slot", 10)
	if item != nil {
		t.Error("Expected nil for invalid slot")
	}
}

func TestGenerateShardLoot(t *testing.T) {
	// Test normal (non-elite) shard generation
	shardCount := 0
	iterations := 100

	for i := 0; i < iterations; i++ {
		items := GenerateShardLoot(false)
		shardCount += len(items)
	}

	// Normal: 10% chance for 1 shard
	// Expected: ~10 shards out of 100 iterations
	if shardCount == 0 {
		t.Log("No shards generated in 100 normal runs (statistically possible but unlikely)")
	}
}

func TestGenerateShardLootElite(t *testing.T) {
	// Test elite shard generation
	shardCount := 0
	heartCount := 0
	iterations := 100

	for i := 0; i < iterations; i++ {
		items := GenerateShardLoot(true)
		for _, item := range items {
			if item.Name == "Eidolon Shard" {
				shardCount++
			} else if item.Name == "Eidolon Heart" {
				heartCount++
			}
		}
	}

	// Elite: 50% chance for 1-3 shards
	// Expected: ~75-150 shards out of 100 iterations
	if shardCount < 20 {
		t.Errorf("Elite shard generation too low: %d shards in %d runs", shardCount, iterations)
	}

	// Hearts should be rare
	if heartCount > 20 {
		t.Errorf("Too many hearts generated: %d in %d runs", heartCount, iterations)
	}
}

func TestGenerateBossHearts(t *testing.T) {
	for i := 0; i < 10; i++ {
		items := GenerateBossHearts()

		// Should generate 1-3 hearts
		if len(items) < 1 || len(items) > 3 {
			t.Errorf("Expected 1-3 hearts, got %d", len(items))
		}

		for _, item := range items {
			if item.Name != "Eidolon Heart" {
				t.Errorf("Expected Eidolon Heart, got %s", item.Name)
			}
			if item.Rarity != RarityEidolic {
				t.Errorf("Expected Eidolic rarity, got %v", item.Rarity)
			}
		}
	}
}

func TestGenerateGuaranteedUniqueEquipmentReturnsEquippableItemWithUniqueEffect(t *testing.T) {
	for i := 0; i < 10; i++ {
		item := GenerateGuaranteedUniqueEquipment(100)
		if item == nil {
			t.Fatal("GenerateGuaranteedUniqueEquipment returned nil")
		}
		if item.UniqueEffect == "" {
			t.Fatalf("expected unique effect on item %+v", item)
		}
		if item.Type == ItemMaterial || item.Type == ItemRelic || item.Type == ItemGem {
			t.Fatalf("expected equippable item type, got %s", item.Type)
		}
	}
}

func TestCreateItemMaterial(t *testing.T) {
	shard := BaseItem{Name: "Eidolon Shard", Type: ItemMaterial, Slot: "material"}
	item := createItem(shard, RarityCommon, 1.0, 0, 1)

	if item.Name != "Eidolon Shard" {
		t.Errorf("Expected Eidolon Shard, got %s", item.Name)
	}
	if item.Rarity != RarityEidolic {
		t.Error("Materials should be upgraded to Eidolic rarity")
	}
	if item.MaxStack != 1000 {
		t.Errorf("Expected MaxStack 1000, got %d", item.MaxStack)
	}
}

func TestCreateItemRelic(t *testing.T) {
	heart := BaseItem{Name: "Eidolon Heart", Type: ItemRelic, Slot: "relic"}
	item := createItem(heart, RarityCommon, 1.0, 0, 1)

	if item.Name != "Eidolon Heart" {
		t.Errorf("Expected Eidolon Heart, got %s", item.Name)
	}
	if item.Rarity != RarityEidolic {
		t.Error("Relics should be upgraded to Eidolic rarity")
	}
}

func TestCreateItemWeapon(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	item := createItem(sword, RarityCommon, 1.0, 0, 10)

	if item.Slot != "mainHand" {
		t.Errorf("Expected mainHand slot, got %s", item.Slot)
	}
	if item.Stats["damage"] <= 0 {
		t.Error("Weapon should have damage stat")
	}
	if item.Level != 10 {
		t.Errorf("Expected level 10, got %d", item.Level)
	}
}

func TestCreateItemStatScaling(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	level1 := createItem(sword, RarityCommon, 1.0, 0, 1)
	level50 := createItem(sword, RarityCommon, 1.0, 0, 50)
	level100 := createItem(sword, RarityCommon, 1.0, 0, 100)

	// The compressed integer scale intentionally groups nearby low levels, but
	// progression remains monotonic across meaningful gear tiers.
	if level50.Stats["damage"] <= level1.Stats["damage"] {
		t.Errorf("Level 50 (%d) should have more damage than level 1 (%d)",
			level50.Stats["damage"], level1.Stats["damage"])
	}
	if level100.Stats["damage"] <= level50.Stats["damage"] {
		t.Errorf("Level 100 (%d) should have more damage than level 50 (%d)",
			level100.Stats["damage"], level50.Stats["damage"])
	}
}

func TestCreateItemRarityScaling(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	common := createItem(sword, RarityCommon, 1.0, 0, 10)
	rare := createItem(sword, RarityRare, 5.0, 2, 10)
	legendary := createItem(sword, RarityLegendary, 20.0, 5, 10)

	// Higher rarity should have higher stats
	if rare.Stats["damage"] <= common.Stats["damage"] {
		t.Errorf("Rare (%d) should have more damage than Common (%d)",
			rare.Stats["damage"], common.Stats["damage"])
	}
	if legendary.Stats["damage"] <= rare.Stats["damage"] {
		t.Errorf("Legendary (%d) should have more damage than Rare (%d)",
			legendary.Stats["damage"], rare.Stats["damage"])
	}
}

func TestCreateItemBonusStats(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	// Rare items should get 2 bonus stats
	rare := createItem(sword, RarityRare, 5.0, 2, 10)
	if len(rare.Stats) < 2 {
		t.Errorf("Rare item should have at least 2 stats, got %d", len(rare.Stats))
	}

	// Legendary items should get all 5 bonus stats
	legendary := createItem(sword, RarityLegendary, 20.0, 5, 10)
	if len(legendary.Stats) < 5 {
		t.Errorf("Legendary item should have at least 5 stats, got %d", len(legendary.Stats))
	}
}

func TestCreateItemValue(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	item := createItem(sword, RarityCommon, 1.0, 0, 10)

	// Value should be level * 10 * multiplier = 10 * 10 * 1 = 100
	expectedValue := 10 * 10 * 1
	if item.Value != expectedValue {
		t.Errorf("Expected value %d, got %d", expectedValue, item.Value)
	}
}

func TestCreateItemValueRare(t *testing.T) {
	sword := BaseItem{
		Name:      "Iron Sword",
		Type:      ItemWeapon,
		Slot:      "mainHand",
		BaseStat:  "damage",
		BaseValue: 10,
	}

	item := createItem(sword, RarityRare, 5.0, 2, 10)

	// Value should be level * 10 * multiplier = 10 * 10 * 5 = 500
	expectedValue := 10 * 10 * 5
	if item.Value != expectedValue {
		t.Errorf("Expected value %d, got %d", expectedValue, item.Value)
	}
}

func TestItemStatsPool(t *testing.T) {
	// Verify StatPool has the expected stats
	expectedStats := []string{"strength", "dexterity", "intelligence", "wisdom", "vitality"}

	if len(StatPool) != len(expectedStats) {
		t.Errorf("Expected %d stats in pool, got %d", len(expectedStats), len(StatPool))
	}

	for _, stat := range expectedStats {
		found := false
		for _, s := range StatPool {
			if s == stat {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected stat %s not found in StatPool", stat)
		}
	}
}

func TestStatNames(t *testing.T) {
	// Verify each stat has prefix and suffix
	for _, stat := range StatPool {
		naming, ok := StatNames[stat]
		if !ok {
			t.Errorf("No naming entry for stat: %s", stat)
			continue
		}
		if naming.Prefix == "" {
			t.Errorf("Empty prefix for stat: %s", stat)
		}
		if naming.Suffix == "" {
			t.Errorf("Empty suffix for stat: %s", stat)
		}
	}
}

func TestBaseItemsExist(t *testing.T) {
	if len(BaseItems) == 0 {
		t.Fatal("BaseItems is empty")
	}

	// Check for weapons
	hasWeapon := false
	hasArmor := false
	hasMaterial := false

	for _, item := range BaseItems {
		if item.Type == ItemWeapon {
			hasWeapon = true
		}
		if item.Type == ItemArmor {
			hasArmor = true
		}
		if item.Type == ItemMaterial {
			hasMaterial = true
		}
	}

	if !hasWeapon {
		t.Error("No weapons in BaseItems")
	}
	if !hasArmor {
		t.Error("No armor in BaseItems")
	}
	if !hasMaterial {
		t.Error("No materials in BaseItems")
	}
}
