package game

import (
	"fmt"
	"math/rand"
	"strings"
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
	ItemGem       ItemType = "GEM"
)

// Gem types and qualities
type GemType string

const (
	GemRuby     GemType = "Ruby"     // +Strength, +% Fire Damage
	GemSapphire GemType = "Sapphire" // +Intelligence, +% Mana Regen
	GemEmerald  GemType = "Emerald"  // +Dexterity, +% Crit Chance
	GemTopaz    GemType = "Topaz"    // +Wisdom, +% Healing Done
	GemDiamond  GemType = "Diamond"  // +Vitality, +% All Resist
	GemOnyx     GemType = "Onyx"     // +Flat Damage, +% Lifesteal
	GemOpal     GemType = "Opal"     // +Move Speed, +% CDR
)

// SocketedGem represents a gem that has been socketed into equipment
type SocketedGem struct {
	Type    GemType        `json:"type" bson:"type"`
	Quality GemQuality     `json:"quality" bson:"quality"`
	Stats   map[string]int `json:"stats" bson:"stats"`
}

type GemQuality string

const (
	GemChipped  GemQuality = "Chipped"  // 10 stat value
	GemFlawed   GemQuality = "Flawed"   // 25 stat value
	GemNormal   GemQuality = "Normal"   // 50 stat value
	GemFlawless GemQuality = "Flawless" // 100 stat value
	GemPerfect  GemQuality = "Perfect"  // 200 stat value
	GemRadiant  GemQuality = "Radiant"  // 400 stat value
)

// GetNextGemQuality returns the next tier quality, or empty string if already max
func GetNextGemQuality(quality GemQuality) GemQuality {
	switch quality {
	case GemChipped:
		return GemFlawed
	case GemFlawed:
		return GemNormal
	case GemNormal:
		return GemFlawless
	case GemFlawless:
		return GemPerfect
	case GemPerfect:
		return GemRadiant
	default:
		return "" // Radiant is max quality
	}
}

// GemStats returns the stat bonuses for a gem
func GemStats(gemType GemType, quality GemQuality) map[string]int {
	baseValue := 10
	switch quality {
	case GemFlawed:
		baseValue = 25
	case GemNormal:
		baseValue = 50
	case GemFlawless:
		baseValue = 100
	case GemPerfect:
		baseValue = 200
	case GemRadiant:
		baseValue = 400
	}

	stats := make(map[string]int)
	switch gemType {
	case GemRuby:
		stats["strength"] = baseValue
		stats["fireDamage"] = baseValue / 10 // % fire damage
	case GemSapphire:
		stats["intelligence"] = baseValue
		stats["manaRegen"] = baseValue / 10 // % mana regen
	case GemEmerald:
		stats["dexterity"] = baseValue
		stats["critChance"] = baseValue / 20 // % crit chance
	case GemTopaz:
		stats["wisdom"] = baseValue
		stats["healingDone"] = baseValue / 10 // % healing done
	case GemDiamond:
		stats["vitality"] = baseValue
		stats["allResist"] = baseValue / 10 // % all resist
	case GemOnyx:
		stats["damage"] = baseValue
		stats["lifesteal"] = baseValue / 20 // % lifesteal
	case GemOpal:
		stats["moveSpeed"] = baseValue / 10 // % move speed
		stats["cdr"] = baseValue / 20       // % cooldown reduction
	}
	return stats
}

// GenerateGem creates a gem item
func GenerateGem(gemType GemType, quality GemQuality) *Item {
	name := fmt.Sprintf("%s %s", quality, gemType)
	stats := GemStats(gemType, quality)
	icon := fmt.Sprintf("assets/icons/gems/%s_%s.svg", strings.ToLower(string(quality)), strings.ToLower(string(gemType)))

	value := 100
	switch quality {
	case GemFlawed:
		value = 250
	case GemNormal:
		value = 500
	case GemFlawless:
		value = 1000
	case GemPerfect:
		value = 2500
	case GemRadiant:
		value = 5000
	}

	return &Item{
		ID:          fmt.Sprintf("gem-%d-%d", rand.Int63(), rand.Int63()),
		Name:        name,
		Type:        ItemGem,
		Rarity:      RarityRare,
		Slot:        "gem",
		Level:       1,
		Stats:       stats,
		Value:       value,
		Icon:        icon,
		Description: fmt.Sprintf("A %s %s that can be socketed into equipment.", quality, gemType),
		Stack:       1,
		MaxStack:    99,
		GemType:     gemType,
		GemQuality:  quality,
	}
}

// GenerateRandomGem creates a random gem based on dungeon difficulty
func GenerateRandomGem(isHeroic, isMythic bool) *Item {
	gemTypes := []GemType{GemRuby, GemSapphire, GemEmerald, GemTopaz, GemDiamond, GemOnyx, GemOpal}
	gemType := gemTypes[rand.Intn(len(gemTypes))]

	var quality GemQuality
	roll := rand.Float64()

	if isMythic {
		// Mythic: 40% Perfect, 40% Radiant, 20% Flawless
		if roll < 0.40 {
			quality = GemRadiant
		} else if roll < 0.80 {
			quality = GemPerfect
		} else {
			quality = GemFlawless
		}
	} else if isHeroic {
		// Heroic: 50% Flawless, 30% Normal, 20% Perfect
		if roll < 0.50 {
			quality = GemFlawless
		} else if roll < 0.80 {
			quality = GemNormal
		} else {
			quality = GemPerfect
		}
	} else {
		// Normal: 40% Chipped, 35% Flawed, 20% Normal, 5% Flawless
		if roll < 0.40 {
			quality = GemChipped
		} else if roll < 0.75 {
			quality = GemFlawed
		} else if roll < 0.95 {
			quality = GemNormal
		} else {
			quality = GemFlawless
		}
	}

	return GenerateGem(gemType, quality)
}

// GenerateRandomGemByLevel creates a random gem based on enemy level
// Higher level enemies drop better quality gems, elites get a quality bonus
func GenerateRandomGemByLevel(level int, isElite bool) *Item {
	gemTypes := []GemType{GemRuby, GemSapphire, GemEmerald, GemTopaz, GemDiamond, GemOnyx, GemOpal}
	gemType := gemTypes[rand.Intn(len(gemTypes))]

	var quality GemQuality
	roll := rand.Float64()

	// Elites shift the roll to favor better gems
	if isElite {
		roll = roll * 0.6 // Compress roll range to favor higher qualities
	}

	if level >= 80 {
		// Level 80+: Mostly Flawless/Perfect
		if roll < 0.10 {
			quality = GemRadiant
		} else if roll < 0.40 {
			quality = GemPerfect
		} else if roll < 0.75 {
			quality = GemFlawless
		} else {
			quality = GemNormal
		}
	} else if level >= 60 {
		// Level 60-79: Mostly Normal/Flawless
		if roll < 0.05 {
			quality = GemPerfect
		} else if roll < 0.30 {
			quality = GemFlawless
		} else if roll < 0.70 {
			quality = GemNormal
		} else {
			quality = GemFlawed
		}
	} else if level >= 40 {
		// Level 40-59: Mostly Flawed/Normal
		if roll < 0.05 {
			quality = GemFlawless
		} else if roll < 0.30 {
			quality = GemNormal
		} else if roll < 0.70 {
			quality = GemFlawed
		} else {
			quality = GemChipped
		}
	} else {
		// Level 20-39: Mostly Chipped/Flawed
		if roll < 0.05 {
			quality = GemNormal
		} else if roll < 0.30 {
			quality = GemFlawed
		} else {
			quality = GemChipped
		}
	}

	return GenerateGem(gemType, quality)
}

type Item struct {
	ID           string         `json:"id" bson:"id"`
	Name         string         `json:"name" bson:"name"`
	Type         ItemType       `json:"type" bson:"type"`
	Rarity       ItemRarity     `json:"rarity" bson:"rarity"`
	Slot         string         `json:"slot" bson:"slot"` // head, chest, legs, feet, mainHand, offHand
	Level        int            `json:"level" bson:"level"`
	Stats        map[string]int `json:"stats,omitempty" bson:"stats"`
	Value        int            `json:"value" bson:"value"`
	Icon         string         `json:"icon,omitempty" bson:"icon"`
	Description  string         `json:"description,omitempty" bson:"description"`
	Stack        int            `json:"stack,omitempty" bson:"stack"`
	MaxStack     int            `json:"maxStack,omitempty" bson:"maxStack"`
	Potency      int            `json:"potency,omitempty" bson:"potency"`
	Sockets      int            `json:"sockets,omitempty" bson:"sockets"`
	Gems         []SocketedGem  `json:"gems,omitempty" bson:"gems"`                 // Socketed gems
	SetID        string         `json:"setId,omitempty" bson:"setId"`               // Set identifier
	UniqueEffect string         `json:"uniqueEffect,omitempty" bson:"uniqueEffect"` // Unique proc effect
	GemType      GemType        `json:"gemType,omitempty" bson:"gemType"`           // For gem items: type of gem
	GemQuality   GemQuality     `json:"gemQuality,omitempty" bson:"gemQuality"`     // For gem items: quality of gem
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
	{"Eidolon Shard", ItemMaterial, "material", "", 0, ""},
	{"Eidolon Heart", ItemRelic, "relic", "", 0, ""},
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

func generateLootFromPool(targetLevel int, pool []BaseItem) *Item {
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
	baseItem := pool[rand.Intn(len(pool))]

	return createItem(baseItem, rarity, multiplier, statCount, level)
}

func GenerateLoot(targetLevel int) *Item {
	return generateLootFromPool(targetLevel, BaseItems)
}

// GenerateEquipmentLoot uses the normal enemy-drop rarity and level rules but
// excludes materials, relics, and gems. It exists for flows that explicitly
// promise an equippable item rather than merely a loot entity.
func GenerateEquipmentLoot(targetLevel int) *Item {
	equipment := make([]BaseItem, 0, len(BaseItems))
	for _, baseItem := range BaseItems {
		if baseItem.Type != ItemMaterial && baseItem.Type != ItemRelic && baseItem.Type != ItemGem {
			equipment = append(equipment, baseItem)
		}
	}
	return generateLootFromPool(targetLevel, equipment)
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
		baseShard := BaseItem{Name: "Eidolon Shard", Type: ItemMaterial, Slot: "material"}
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
		baseHeart := BaseItem{Name: "Eidolon Heart", Type: ItemRelic, Slot: "relic"}
		item := createItem(baseHeart, RarityEidolic, 1.0, 0, 1)
		item.MaxStack = 1000
		item.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
		items = append(items, item)
	}

	return items
}

func GenerateBossHearts() []*Item {
	count := rand.Intn(3) + 1 // 1 to 3
	var items []*Item
	for i := 0; i < count; i++ {
		baseHeart := BaseItem{Name: "Eidolon Heart", Type: ItemRelic, Slot: "relic"}
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
		if baseItem.Name == "Eidolon Shard" {
			desc = "What remains after purpose is broken."
			rarity = RarityEidolic
			icon = "assets/items/eidolon_shard/eidolon_shard.png"
		} else if baseItem.Name == "Eidolon Heart" {
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

// ============================================================================
// SET ITEMS
// ============================================================================

// SetDefinition defines a set and its bonuses
type SetDefinition struct {
	ID          string
	Name        string
	Class       string // Fighter, Rogue, Wizard, Cleric, or "" for all
	Slots       []string
	Bonus2      map[string]int // 2-piece bonus
	Bonus4      map[string]int // 4-piece bonus
	Bonus6      map[string]int // 6-piece bonus (if applicable)
	Description string
}

// SetDefinitions contains all set item definitions
var SetDefinitions = map[string]SetDefinition{
	// Fighter Sets
	"warlord_fury": {
		ID:          "warlord_fury",
		Name:        "Warlord's Fury",
		Class:       "Fighter",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"armor": 15},
		Bonus4:      map[string]int{"chargeReset": 1},          // Special: charge CD reset on kill
		Bonus6:      map[string]int{"ironFortressDamage": 100}, // Double damage during Iron Fortress
		Description: "The armor of ancient warlords who knew no defeat.",
	},
	"bulwark_ages": {
		ID:          "bulwark_ages",
		Name:        "Bulwark of Ages",
		Class:       "Fighter",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"maxHealth": 20},
		Bonus4:      map[string]int{"damageReflect": 5}, // 5% damage reflect on block
		Bonus6:      map[string]int{"bossTaunt": 1},     // Guardian Roar taunts bosses
		Description: "Forged in an age when titans walked the earth.",
	},
	// Rogue Sets
	"shadow_embrace": {
		ID:          "shadow_embrace",
		Name:        "Shadow's Embrace",
		Class:       "Rogue",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"critChance": 15},
		Bonus4:      map[string]int{"backstabAnyAngle": 1},    // Backstab from any angle
		Bonus6:      map[string]int{"phantomVolleyDouble": 1}, // Phantom Volley fires 6x
		Description: "Worn by assassins who became one with darkness.",
	},
	"venom_lord": {
		ID:          "venom_lord",
		Name:        "Venom Lord",
		Class:       "Rogue",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"poisonDamage": 20},
		Bonus4:      map[string]int{"poisonSpread": 1},       // Poison spreads to nearby
		Bonus6:      map[string]int{"deathSpiralConsume": 1}, // Death Spiral consumes DoTs for burst
		Description: "The regalia of those who mastered venom.",
	},
	// Wizard Sets
	"inferno_heart": {
		ID:          "inferno_heart",
		Name:        "Inferno's Heart",
		Class:       "Wizard",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"fireDamage": 15},
		Bonus4:      map[string]int{"fireballPierce": 1}, // Fireball pierces
		Bonus6:      map[string]int{"meteorReset": 1},    // Fire kill resets Meteor CD
		Description: "Contains the fury of a dying star.",
	},
	"temporal_weave": {
		ID:          "temporal_weave",
		Name:        "Temporal Weave",
		Class:       "Wizard",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"cdr": 15},
		Bonus4:      map[string]int{"teleportCharges": 2}, // Teleport has 2 charges
		Bonus6:      map[string]int{"timeWarpZone": 1},    // Time Warp affects entire zone
		Description: "Threads of time woven into fabric.",
	},
	// Cleric Sets
	"divine_light": {
		ID:          "divine_light",
		Name:        "Divine Light",
		Class:       "Cleric",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"healingDone": 15},
		Bonus4:      map[string]int{"spiritGuardiansHeal": 1},   // Spirit Guardians heals allies
		Bonus6:      map[string]int{"divineInterventionCD": 60}, // Divine Intervention 60s CD
		Description: "Blessed by celestial beings of pure light.",
	},
	"crusader_zeal": {
		ID:          "crusader_zeal",
		Name:        "Crusader's Zeal",
		Class:       "Cleric",
		Slots:       []string{"head", "chest", "legs", "feet", "gloves", "shoulders"},
		Bonus2:      map[string]int{"holyDamage": 15},
		Bonus4:      map[string]int{"radiantStrikeLifesteal": 100}, // Radiant Strike heals for damage
		Bonus6:      map[string]int{"permanentSeraph": 1},          // Avenging Seraph permanent in combat
		Description: "The armor of holy warriors who smite evil.",
	},
}

// GenerateSetItem creates a set item for the given set and slot
func GenerateSetItem(setID string, slot string, level int) *Item {
	setDef, ok := SetDefinitions[setID]
	if !ok {
		return nil
	}

	// Find appropriate base item for the slot
	var baseItem BaseItem
	found := false
	for _, bi := range BaseItems {
		if bi.Slot == slot {
			baseItem = bi
			found = true
			break
		}
	}
	if !found {
		return nil
	}

	// Create item with Legendary stats
	item := createItem(baseItem, RarityLegendary, 20.0, 5, level)
	item.SetID = setID
	item.Name = fmt.Sprintf("%s %s", setDef.Name, baseItem.Name)
	item.Description = setDef.Description

	return item
}

// CalculateSetBonuses calculates active set bonuses from equipped items
func CalculateSetBonuses(equipment map[string]Item) map[string]map[string]int {
	// Count pieces per set
	setCounts := make(map[string]int)
	for _, item := range equipment {
		if item.SetID != "" {
			setCounts[item.SetID]++
		}
	}

	// Calculate bonuses
	bonuses := make(map[string]map[string]int)
	for setID, count := range setCounts {
		setDef, ok := SetDefinitions[setID]
		if !ok {
			continue
		}

		setBonus := make(map[string]int)
		if count >= 2 {
			for k, v := range setDef.Bonus2 {
				setBonus[k] = v
			}
		}
		if count >= 4 {
			for k, v := range setDef.Bonus4 {
				setBonus[k] = v
			}
		}
		if count >= 6 {
			for k, v := range setDef.Bonus6 {
				setBonus[k] = v
			}
		}

		if len(setBonus) > 0 {
			bonuses[setID] = setBonus
		}
	}

	return bonuses
}

// ============================================================================
// UNIQUE ITEM EFFECTS
// ============================================================================

// UniqueEffect defines a unique item proc effect
type UniqueEffect struct {
	ID          string
	Name        string
	Description string
	TriggerType string  // "onKill", "onHit", "onDamage", "always"
	Chance      float64 // Proc chance (1.0 = 100%)
}

// UniqueEffects contains all unique effect definitions
var UniqueEffects = map[string]UniqueEffect{
	"vampiric": {
		ID:          "vampiric",
		Name:        "Vampiric",
		Description: "On kill, restore 5% HP",
		TriggerType: "onKill",
		Chance:      1.0,
	},
	"efficient": {
		ID:          "efficient",
		Name:        "Efficient",
		Description: "Skills cost 10% less mana",
		TriggerType: "always",
		Chance:      1.0,
	},
	"lucky": {
		ID:          "lucky",
		Name:        "Lucky",
		Description: "10% chance to deal double damage",
		TriggerType: "onHit",
		Chance:      0.10,
	},
	"explosive": {
		ID:          "explosive",
		Name:        "Explosive",
		Description: "Enemies killed explode for 50% damage to nearby",
		TriggerType: "onKill",
		Chance:      1.0,
	},
	"swift": {
		ID:          "swift",
		Name:        "Swift",
		Description: "+20% move speed for 3s after using a skill",
		TriggerType: "onSkill",
		Chance:      1.0,
	},
	"thorns": {
		ID:          "thorns",
		Name:        "Thorns",
		Description: "Reflect 10% of damage taken",
		TriggerType: "onDamage",
		Chance:      1.0,
	},
	"berserker": {
		ID:          "berserker",
		Name:        "Berserker",
		Description: "Below 30% HP, +30% damage",
		TriggerType: "always",
		Chance:      1.0,
	},
	"guardian": {
		ID:          "guardian",
		Name:        "Guardian",
		Description: "Above 80% HP, +20% armor",
		TriggerType: "always",
		Chance:      1.0,
	},
	"executioner": {
		ID:          "executioner",
		Name:        "Executioner",
		Description: "+25% damage to enemies below 25% HP",
		TriggerType: "onHit",
		Chance:      1.0,
	},
	"regenerative": {
		ID:          "regenerative",
		Name:        "Regenerative",
		Description: "+1% HP regen per second",
		TriggerType: "always",
		Chance:      1.0,
	},
}

// AddUniqueEffect adds a random unique effect to an item
func AddUniqueEffect(item *Item) {
	effects := []string{"vampiric", "efficient", "lucky", "explosive", "swift", "thorns", "berserker", "guardian", "executioner", "regenerative"}
	item.UniqueEffect = effects[rand.Intn(len(effects))]
}

// GenerateLootWithUniqueEffect generates loot with a chance for unique effect
func GenerateLootWithUniqueEffect(targetLevel int, uniqueChance float64) *Item {
	item := GenerateLoot(targetLevel)
	if item != nil && rand.Float64() < uniqueChance {
		AddUniqueEffect(item)
	}
	return item
}

func GenerateGuaranteedUniqueEquipment(targetLevel int) *Item {
	for attempts := 0; attempts < 12; attempts++ {
		item := GenerateLootWithUniqueEffect(targetLevel, 1.0)
		if item == nil {
			continue
		}
		if item.Type == ItemMaterial || item.Type == ItemRelic || item.Type == ItemGem {
			continue
		}
		return item
	}
	return nil
}
