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
	RarityEidolic   ItemRarity = "Eidolic"
)

type ItemType string

const (
	ItemWeapon    ItemType = "WEAPON"
	ItemArmor     ItemType = "ARMOR"
	ItemAccessory ItemType = "ACCESSORY"
	ItemNeck      ItemType = "NECK"
	ItemGloves    ItemType = "GLOVES"
	ItemMaterial  ItemType = "MATERIAL"
	ItemRelic     ItemType = "RELIC"
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
	Stack       int            `json:"stack,omitempty" bson:"stack"`
	MaxStack    int            `json:"maxStack,omitempty" bson:"maxStack"`
	Potency     int            `json:"potency,omitempty" bson:"potency"`
	Sockets     int            `json:"sockets,omitempty" bson:"sockets"`
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

	// Armor - Gloves
	{"Leather Gloves", ItemGloves, "gloves", "defense", 2, ""},
	{"Iron Gauntlets", ItemGloves, "gloves", "defense", 4, ""},
	{"Silk Gloves", ItemGloves, "gloves", "defense", 1, ""},

	// Armor - Shoulders
	{"Reinforced Spaulders", ItemArmor, "shoulders", "defense", 4, ""},
	{"Steel Pauldrons", ItemArmor, "shoulders", "defense", 7, ""},
	{"Velvet Mantle", ItemArmor, "shoulders", "defense", 2, ""},

	// Armor - Belt
	{"Studded Belt", ItemArmor, "belt", "defense", 3, ""},
	{"Plated Girdle", ItemArmor, "belt", "defense", 5, ""},
	{"Silk Sash", ItemArmor, "belt", "defense", 1, ""},

	// Accessories - Ring
	{"Gold Ring", ItemAccessory, "ring", "vitality", 5, ""},
	{"Silver Ring", ItemAccessory, "ring", "wisdom", 5, ""},
	{"Ruby Ring", ItemAccessory, "ring", "strength", 5, ""},

	// Accessories - Neck
	{"Pendant", ItemNeck, "neck", "vitality", 5, ""},
	{"Choker", ItemNeck, "neck", "dexterity", 5, ""},
	{"Necklace", ItemNeck, "neck", "intelligence", 5, ""},

	// Accessories - Trinket
	{"Amulet of Power", ItemAccessory, "trinket", "strength", 10, ""},
	{"Talisman of Speed", ItemAccessory, "trinket", "dexterity", 10, ""},
	{"Orb of Mana", ItemAccessory, "trinket", "intelligence", 10, ""},

	// Materials & Relics
	{"Shard", ItemMaterial, "material", "", 0, ""},
	{"Heart", ItemRelic, "relic", "", 0, ""},
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

func GenerateLoot(targetLevel int) *Item {
	// 1. Roll for Rarity (Legendary 1%, Rare 29%, Uncommon 30%, Common 40%)
	roll := rand.Float64()
	rarity := RarityCommon
	multiplier := 1.0
	statCount := 0

	if roll < 0.01 {
		rarity = RarityLegendary
		multiplier = 20.0
		statCount = 5
	} else if roll < 0.30 {
		rarity = RarityRare
		multiplier = 5.0
		statCount = 2
	} else if roll < 0.60 {
		rarity = RarityUncommon
		multiplier = 2.0
		statCount = 1
	}

	// 2. Determine Item Level (Target Level +/- variance, but mostly close to target)
	// Let's say Level - 3 to Level
	minLevel := targetLevel - 3
	if minLevel < 1 {
		minLevel = 1
	}
	level := rand.Intn(targetLevel-minLevel+1) + minLevel

	// 3. Pick Base Item
	baseItem := BaseItems[rand.Intn(len(BaseItems))]

	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateEliteLoot(level int) *Item {
	// Rarity: 50% Uncommon, 40% Rare, 10% Legendary
	roll := rand.Float64()
	rarity := RarityUncommon
	multiplier := 2.0
	statCount := 1

	if roll < 0.10 {
		rarity = RarityLegendary
		multiplier = 20.0
		statCount = 5
	} else if roll < 0.50 {
		rarity = RarityRare
		multiplier = 5.0
		statCount = 2
	}

	baseItem := BaseItems[rand.Intn(len(BaseItems))]
	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateLootForSlot(slot string, level int) *Item {
	// Normalize slot for accessories
	if slot == "ring1" || slot == "ring2" {
		slot = "ring"
	}
	if slot == "trinket1" || slot == "trinket2" {
		slot = "trinket"
	}

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
		multiplier = 20.0
		statCount = 5
	} else if roll < 0.35 {
		rarity = RarityRare
		multiplier = 5.0
		statCount = 2
	} else if roll < 0.65 {
		rarity = RarityUncommon
		multiplier = 2.0
		statCount = 1
	}

	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateShardLoot(isElite bool) []*Item {
	var items []*Item

	// Shard Logic
	// Normal: 10% chance for 1 shard
	// Elite: 50% chance for 1-3 shards

	shardCount := 0
	if isElite {
		if rand.Float64() < 0.50 {
			shardCount = rand.Intn(3) + 1 // 1 to 3
		}
	} else {
		if rand.Float64() < 0.10 {
			shardCount = 1
		}
	}

	if shardCount > 0 {
		baseShard := BaseItem{Name: "Shard", Type: ItemMaterial, Slot: "material"}
		for i := 0; i < shardCount; i++ {
			item := createItem(baseShard, RarityEidolic, 1.0, 0, 1)
			item.MaxStack = 1000
			item.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
			items = append(items, item)
		}
	}

	// Heart Logic
	// "Heart... Rarity: Rare" (but Eidolic type)
	// Let's give it a small chance.
	// Elite: 5%? Normal: 0.5%?
	heartChance := 0.005
	if isElite {
		heartChance = 0.05
	}

	if rand.Float64() < heartChance {
		baseHeart := BaseItem{Name: "Heart", Type: ItemRelic, Slot: "relic"}
		item := createItem(baseHeart, RarityEidolic, 1.0, 0, 1)
		item.MaxStack = 1000
		item.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
		items = append(items, item)
	}

	return items
}

func createItem(baseItem BaseItem, rarity ItemRarity, multiplier float64, statCount int, level int) *Item {
	// Special handling for Materials/Relics
	if baseItem.Type == ItemMaterial || baseItem.Type == ItemRelic {
		desc := ""
		icon := ""
		if baseItem.Name == "Shard" {
			desc = "What remains after purpose is broken."
			rarity = RarityEidolic
			icon = "assets/items/eidolon_shard/eidolon_shard.png"
		} else if baseItem.Name == "Heart" {
			desc = "Power that chose to endure."
			rarity = RarityEidolic
			icon = "assets/items/eidolon_heart/eidolon_heart.png"
		}

		return &Item{
			ID:          fmt.Sprintf("item-%d-%d", rand.Int63(), rand.Int63()),
			Name:        baseItem.Name,
			Type:        baseItem.Type,
			Rarity:      rarity,
			Slot:        baseItem.Slot,
			Level:       1, // Materials don't really have level?
			Stats:       make(map[string]int),
			Value:       10, // Base value
			Description: desc,
			Stack:       1,
			MaxStack:    1000,
			Icon:        icon,
		}
	}

	// 4. Calculate Base Stats (Damage/Defense)
	// Base Stat scales with level and rarity multiplier
	baseVal := int(float64(baseItem.BaseValue) * (1.0 + float64(level)*0.15) * multiplier)

	itemStats := make(map[string]int)
	itemStats[baseItem.BaseStat] = baseVal

	// 5. Calculate Bonus Stats
	name := baseItem.Name

	if statCount > 0 {
		// Calculate Total Stat Budget
		// Strict level scaling to ensure higher level items have higher stat pools
		// Fixed scalar per level (e.g. 3.0) * multiplier
		totalBudget := int(3.0 * float64(level) * multiplier)

		// Select Stats
		var selectedStats []string
		if rarity == RarityLegendary {
			// Shuffle StatPool to ensure random primary stat
			shuffled := make([]string, len(StatPool))
			copy(shuffled, StatPool)
			rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
			selectedStats = shuffled
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
			remainingBudget := totalBudget - primaryBudget

			if len(selectedStats) > 1 {
				// If we have more than 2 stats (Legendary has 5), give secondary stat a boost
				// Primary: 50%, Secondary: 25%, Others: Share 25%
				if len(selectedStats) > 2 {
					secondaryStat := selectedStats[1]
					secondaryBudget := int(float64(remainingBudget) * 0.5)
					itemStats[secondaryStat] += secondaryBudget
					remainingBudget -= secondaryBudget

					perStatBudget := remainingBudget / (len(selectedStats) - 2)
					if perStatBudget < 1 {
						perStatBudget = 1
					}

					for i := 2; i < len(selectedStats); i++ {
						stat := selectedStats[i]
						itemStats[stat] += perStatBudget
					}
				} else {
					// Rare (2 stats) - Secondary gets the rest (50/50 split)
					stat := selectedStats[1]
					itemStats[stat] += remainingBudget
				}
			} else {
				itemStats[primaryStat] += remainingBudget
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
		ID:       fmt.Sprintf("item-%d", rand.Int63()),
		Name:     name,
		Type:     baseItem.Type,
		Rarity:   rarity,
		Slot:     baseItem.Slot,
		Level:    level,
		Stats:    itemStats,
		Value:    int(float64(level*10) * multiplier),
		Stack:    1,
		MaxStack: 1,
	}
}
