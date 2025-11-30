package game

import (
	"fmt"
	"math/rand"
)

type ItemRarity string

const (
	RarityCommon    ItemRarity = "Common"
	RarityUncommon  ItemRarity = "Uncommon"
	RarityRare      ItemRarity = "Rare"
	RarityLegendary ItemRarity = "Legendary"
)

type ItemType string

const (
	ItemWeapon ItemType = "WEAPON"
	ItemArmor  ItemType = "ARMOR"
)

type Item struct {
	ID          string         `json:"id" bson:"id"`
	Name        string         `json:"name" bson:"name"`
	Type        ItemType       `json:"type" bson:"type"`
	Rarity      ItemRarity     `json:"rarity" bson:"rarity"`
	Slot        string         `json:"slot" bson:"slot"` // head, chest, legs, feet, mainHand, offHand
	Level       int            `json:"level" bson:"level"`
	Stats       map[string]int `json:"stats,omitempty" bson:"stats"`
	Value       int            `json:"value" bson:"value"`
	Icon        string         `json:"icon,omitempty" bson:"icon"`
	Description string         `json:"description,omitempty" bson:"description"`
}

// Base Item Definitions (Matching Client)
type BaseItem struct {
	Name      string
	Type      ItemType
	Slot      string
	BaseStat  string
	BaseValue int
	Scaling   string
}

var BaseItems = []BaseItem{
	// Weapons
	{"Iron Sword", ItemWeapon, "mainHand", "damage", 10, "strength"},
	{"Steel Dagger", ItemWeapon, "mainHand", "damage", 8, "dexterity"},
	{"Wooden Staff", ItemWeapon, "mainHand", "damage", 12, "intelligence"},
	{"Cleric Mace", ItemWeapon, "mainHand", "damage", 11, "wisdom"},

	// Offhands
	{"Wooden Shield", ItemArmor, "offHand", "defense", 5, ""},
	{"Spell Tome", ItemArmor, "offHand", "defense", 2, ""},

	// Armor - Head
	{"Leather Cap", ItemArmor, "head", "defense", 2, ""},
	{"Iron Helm", ItemArmor, "head", "defense", 4, ""},
	{"Silk Hood", ItemArmor, "head", "defense", 1, ""},

	// Armor - Chest
	{"Leather Tunic", ItemArmor, "chest", "defense", 5, ""},
	{"Plate Mail", ItemArmor, "chest", "defense", 10, ""},
	{"Robes", ItemArmor, "chest", "defense", 3, ""},

	// Armor - Legs
	{"Leather Pants", ItemArmor, "legs", "defense", 3, ""},
	{"Plate Greaves", ItemArmor, "legs", "defense", 6, ""},
	{"Silk Skirt", ItemArmor, "legs", "defense", 2, ""},

	// Armor - Feet
	{"Leather Boots", ItemArmor, "feet", "defense", 2, ""},
	{"Iron Boots", ItemArmor, "feet", "defense", 4, ""},
	{"Sandals", ItemArmor, "feet", "defense", 1, ""},
}

var StatPool = []string{"strength", "dexterity", "intelligence", "wisdom", "vitality"}

var StatNames = map[string]struct {
	Prefix string
	Suffix string
}{
	"strength":     {"Strong", "of the Bear"},
	"dexterity":    {"Agile", "of the Tiger"},
	"intelligence": {"Brilliant", "of the Owl"},
	"wisdom":       {"Wise", "of the Eagle"},
	"vitality":     {"Hearty", "of the Whale"},
}

func GenerateLoot(maxLevel int) *Item {
	// 1. Roll for Rarity (Legendary 1%, Rare 29%, Uncommon 30%, Common 40%)
	roll := rand.Float64()
	rarity := RarityCommon
	multiplier := 1.0
	statCount := 0

	if roll < 0.01 {
		rarity = RarityLegendary
		multiplier = 3.0
		statCount = 5
	} else if roll < 0.30 {
		rarity = RarityRare
		multiplier = 2.0
		statCount = 2
	} else if roll < 0.60 {
		rarity = RarityUncommon
		multiplier = 1.5
		statCount = 1
	}

	// 2. Determine Item Level (Random 1 to maxLevel)
	level := rand.Intn(maxLevel) + 1

	// 3. Pick Base Item
	baseItem := BaseItems[rand.Intn(len(BaseItems))]

	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateEliteLoot(level int) *Item {
	// Rarity: 50% Uncommon, 40% Rare, 10% Legendary
	roll := rand.Float64()
	rarity := RarityUncommon
	multiplier := 1.5
	statCount := 1

	if roll < 0.10 {
		rarity = RarityLegendary
		multiplier = 3.0
		statCount = 5
	} else if roll < 0.50 {
		rarity = RarityRare
		multiplier = 2.0
		statCount = 2
	}

	baseItem := BaseItems[rand.Intn(len(BaseItems))]
	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateLootForSlot(slot string, level int) *Item {
	// Filter BaseItems by slot
	var candidates []BaseItem
	for _, item := range BaseItems {
		if item.Slot == slot {
			candidates = append(candidates, item)
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	// Pick random base item
	baseItem := candidates[rand.Intn(len(candidates))]

	// Roll for Rarity (Same logic as GenerateLoot)
	roll := rand.Float64()
	rarity := RarityCommon
	multiplier := 1.0
	statCount := 0

	if roll < 0.05 { // Slightly better odds for gamble?
		rarity = RarityLegendary
		multiplier = 3.0
		statCount = 5
	} else if roll < 0.35 {
		rarity = RarityRare
		multiplier = 2.0
		statCount = 2
	} else if roll < 0.65 {
		rarity = RarityUncommon
		multiplier = 1.5
		statCount = 1
	}

	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func createItem(baseItem BaseItem, rarity ItemRarity, multiplier float64, statCount int, level int) *Item {
	// 4. Calculate Base Stats (Damage/Defense)
	// Base Stat scales with level and rarity multiplier
	baseVal := int(float64(baseItem.BaseValue) * (1.0 + float64(level)*0.15) * multiplier)

	itemStats := make(map[string]int)
	itemStats[baseItem.BaseStat] = baseVal

	// 5. Calculate Bonus Stats
	name := baseItem.Name

	if statCount > 0 {
		// Calculate Total Stat Budget
		rollPerLevel := 2.0 + rand.Float64()*2.0
		totalBudget := int(rollPerLevel * float64(level) * multiplier)

		// Select Stats
		var selectedStats []string
		if rarity == RarityLegendary {
			selectedStats = make([]string, len(StatPool))
			copy(selectedStats, StatPool)
		} else {
			// Pick random unique stats
			pool := make([]string, len(StatPool))
			copy(pool, StatPool)
			for i := 0; i < statCount; i++ {
				idx := rand.Intn(len(pool))
				selectedStats = append(selectedStats, pool[idx])
				// Remove from pool
				pool[idx] = pool[len(pool)-1]
				pool = pool[:len(pool)-1]
			}
		}

		// Distribute Budget
		if len(selectedStats) > 0 {
			primaryStat := selectedStats[0]
			primaryBudget := int(float64(totalBudget) * 0.5)

			itemStats[primaryStat] += primaryBudget

			if len(selectedStats) > 1 {
				remainingBudget := totalBudget - primaryBudget
				perStatBudget := remainingBudget / (len(selectedStats) - 1)
				if perStatBudget < 1 {
					perStatBudget = 1
				}

				for i := 1; i < len(selectedStats); i++ {
					stat := selectedStats[i]
					itemStats[stat] += perStatBudget
				}
			} else {
				itemStats[primaryStat] += (totalBudget - primaryBudget)
			}

			// 6. Generate Name
			if naming, ok := StatNames[primaryStat]; ok {
				name = fmt.Sprintf("%s %s", naming.Prefix, name)
			}

			if len(selectedStats) > 1 {
				secondaryStat := selectedStats[1]
				if naming, ok := StatNames[secondaryStat]; ok {
					name = fmt.Sprintf("%s %s", name, naming.Suffix)
				}
			} else if rarity == RarityLegendary {
				name = fmt.Sprintf("%s of Legends", name)
			}
		}
	}

	return &Item{
		ID:     fmt.Sprintf("item-%d", rand.Int63()),
		Name:   name,
		Type:   baseItem.Type,
		Rarity: rarity,
		Slot:   baseItem.Slot,
		Level:  level,
		Stats:  itemStats,
		Value:  level * 10 * int(multiplier),
	}
}
