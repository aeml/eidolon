export const RARITY = {
    COMMON: { name: 'Common', color: '#ffffff', multiplier: 1.0, statCount: 0 },
    UNCOMMON: { name: 'Uncommon', color: '#1eff00', multiplier: 1.5, statCount: 1 },
    RARE: { name: 'Rare', color: '#0070dd', multiplier: 2.0, statCount: 2 },
    LEGENDARY: { name: 'Legendary', color: '#ff8000', multiplier: 3.0, statCount: 5 },
    EIDOLIC: { name: 'Eidolic', color: '#A020F0', multiplier: 1.0, statCount: 0 } // Purple
};

export const SLOTS = {
    HEAD: 'head',
    CHEST: 'chest',
    LEGS: 'legs',
    FEET: 'feet',
    SHOULDERS: 'shoulders',
    BELT: 'belt',
    RING: 'ring',
    TRINKET: 'trinket',
    MAIN_HAND: 'mainHand',
    OFF_HAND: 'offHand',
    NECK: 'neck',
    GLOVES: 'gloves',
    MATERIAL: 'material',
    RELIC: 'relic'
};

export const BASE_ITEMS = [
    // Weapons
    { name: 'Iron Sword', type: 'WEAPON', slot: SLOTS.MAIN_HAND, baseStat: 'damage', baseValue: 10, scaling: 'strength' },
    { name: 'Steel Dagger', type: 'WEAPON', slot: SLOTS.MAIN_HAND, baseStat: 'damage', baseValue: 8, scaling: 'dexterity' },
    { name: 'Wooden Staff', type: 'WEAPON', slot: SLOTS.MAIN_HAND, baseStat: 'damage', baseValue: 12, scaling: 'intelligence' },
    { name: 'Cleric Mace', type: 'WEAPON', slot: SLOTS.MAIN_HAND, baseStat: 'damage', baseValue: 11, scaling: 'wisdom' },
    
    // Offhands
    { name: 'Wooden Shield', type: 'ARMOR', slot: SLOTS.OFF_HAND, baseStat: 'defense', baseValue: 5 },
    { name: 'Spell Tome', type: 'ARMOR', slot: SLOTS.OFF_HAND, baseStat: 'defense', baseValue: 2 },
    
    // Armor - Head
    { name: 'Leather Cap', type: 'ARMOR', slot: SLOTS.HEAD, baseStat: 'defense', baseValue: 2 },
    { name: 'Iron Helm', type: 'ARMOR', slot: SLOTS.HEAD, baseStat: 'defense', baseValue: 4 },
    { name: 'Silk Hood', type: 'ARMOR', slot: SLOTS.HEAD, baseStat: 'defense', baseValue: 1 },

    // Armor - Chest
    { name: 'Leather Tunic', type: 'ARMOR', slot: SLOTS.CHEST, baseStat: 'defense', baseValue: 5 },
    { name: 'Plate Mail', type: 'ARMOR', slot: SLOTS.CHEST, baseStat: 'defense', baseValue: 10 },
    { name: 'Robes', type: 'ARMOR', slot: SLOTS.CHEST, baseStat: 'defense', baseValue: 3 },

    // Armor - Legs
    { name: 'Leather Pants', type: 'ARMOR', slot: SLOTS.LEGS, baseStat: 'defense', baseValue: 3 },
    { name: 'Plate Greaves', type: 'ARMOR', slot: SLOTS.LEGS, baseStat: 'defense', baseValue: 6 },
    { name: 'Silk Skirt', type: 'ARMOR', slot: SLOTS.LEGS, baseStat: 'defense', baseValue: 2 },

    // Armor - Feet
    { name: 'Leather Boots', type: 'ARMOR', slot: SLOTS.FEET, baseStat: 'defense', baseValue: 2 },
    { name: 'Iron Boots', type: 'ARMOR', slot: SLOTS.FEET, baseStat: 'defense', baseValue: 4 },
    { name: 'Sandals', type: 'ARMOR', slot: SLOTS.FEET, baseStat: 'defense', baseValue: 1 },

    // Armor - Gloves
    { name: 'Leather Gloves', type: 'GLOVES', slot: SLOTS.GLOVES, baseStat: 'defense', baseValue: 2 },
    { name: 'Iron Gauntlets', type: 'GLOVES', slot: SLOTS.GLOVES, baseStat: 'defense', baseValue: 4 },
    { name: 'Silk Gloves', type: 'GLOVES', slot: SLOTS.GLOVES, baseStat: 'defense', baseValue: 1 },

    // Armor - Shoulders
    { name: 'Reinforced Spaulders', type: 'ARMOR', slot: SLOTS.SHOULDERS, baseStat: 'defense', baseValue: 4 },
    { name: 'Steel Pauldrons', type: 'ARMOR', slot: SLOTS.SHOULDERS, baseStat: 'defense', baseValue: 7 },
    { name: 'Velvet Mantle', type: 'ARMOR', slot: SLOTS.SHOULDERS, baseStat: 'defense', baseValue: 2 },

    // Armor - Belt
    { name: 'Studded Belt', type: 'ARMOR', slot: SLOTS.BELT, baseStat: 'defense', baseValue: 3 },
    { name: 'Plated Girdle', type: 'ARMOR', slot: SLOTS.BELT, baseStat: 'defense', baseValue: 5 },
    { name: 'Silk Sash', type: 'ARMOR', slot: SLOTS.BELT, baseStat: 'defense', baseValue: 1 },

    // Accessories - Ring
    { name: 'Gold Ring', type: 'ACCESSORY', slot: SLOTS.RING, baseStat: 'vitality', baseValue: 5 },
    { name: 'Silver Ring', type: 'ACCESSORY', slot: SLOTS.RING, baseStat: 'wisdom', baseValue: 5 },
    { name: 'Ruby Ring', type: 'ACCESSORY', slot: SLOTS.RING, baseStat: 'strength', baseValue: 5 },

    // Accessories - Neck
    { name: 'Pendant', type: 'NECK', slot: SLOTS.NECK, baseStat: 'vitality', baseValue: 5 },
    { name: 'Choker', type: 'NECK', slot: SLOTS.NECK, baseStat: 'dexterity', baseValue: 5 },
    { name: 'Necklace', type: 'NECK', slot: SLOTS.NECK, baseStat: 'intelligence', baseValue: 5 },

    // Accessories - Trinket
    { name: 'Amulet of Power', type: 'ACCESSORY', slot: SLOTS.TRINKET, baseStat: 'strength', baseValue: 10 },
    { name: 'Talisman of Speed', type: 'ACCESSORY', slot: SLOTS.TRINKET, baseStat: 'dexterity', baseValue: 10 },
    { name: 'Orb of Mana', type: 'ACCESSORY', slot: SLOTS.TRINKET, baseStat: 'intelligence', baseValue: 10 },

    // Materials & Relics
    { name: 'Shard', type: 'MATERIAL', slot: SLOTS.MATERIAL, baseStat: '', baseValue: 0 },
    { name: 'Eidolon Heart', type: 'RELIC', slot: SLOTS.RELIC, baseStat: '', baseValue: 0 }
];

const STAT_POOL = ['strength', 'dexterity', 'intelligence', 'wisdom', 'vitality'];

const STAT_NAMES = {
    strength: { prefix: 'Strong', suffix: 'of the Bear' },
    dexterity: { prefix: 'Agile', suffix: 'of the Tiger' },
    intelligence: { prefix: 'Brilliant', suffix: 'of the Owl' },
    wisdom: { prefix: 'Wise', suffix: 'of the Eagle' },
    vitality: { prefix: 'Hearty', suffix: 'of the Whale' }
};

export class Item {
    constructor(config) {
        this.id = crypto.randomUUID();
        this.name = config.name;
        this.baseName = config.baseName || config.name; // Store base name for icons
        this.type = config.type;
        this.slot = config.slot;
        this.rarity = config.rarity;
        this.stats = config.stats || {};
        this.level = config.level || 1;
    }

    static getValue(item) {
        if (!item) return 0;
        // If the server sent a value, use it as base
        if (item.value) {
            let val = item.value;
            if (item.stack && item.stack > 1) {
                val *= item.stack;
            }
            return val;
        }

        let multiplier = 1;
        if (item.rarity.name === 'Uncommon') multiplier = 2;
        if (item.rarity.name === 'Rare') multiplier = 5;
        if (item.rarity.name === 'Legendary') multiplier = 20;
        if (item.rarity.name === 'Eidolic') multiplier = 50;
        
        let val = Math.floor(item.level * 10 * multiplier);
        if (item.stack && item.stack > 1) {
            val *= item.stack;
        }
        return val;
    }
}

export class ItemGenerator {
    static generateLoot(maxLevel) {
        // 1. Roll for Rarity (Legendary 1%, Rare 29%, Uncommon 30%, Common 40%)
        const roll = Math.random();
        let rarity = RARITY.COMMON;
        if (roll < 0.01) rarity = RARITY.LEGENDARY;
        else if (roll < 0.30) rarity = RARITY.RARE;
        else if (roll < 0.60) rarity = RARITY.UNCOMMON;

        // 2. Determine Item Level (Random 1 to maxLevel)
        const level = Math.floor(Math.random() * maxLevel) + 1;

        // 3. Pick Base Item
        const baseItem = BASE_ITEMS[Math.floor(Math.random() * BASE_ITEMS.length)];
        
        return this.createItem(baseItem, rarity, level);
    }

    static generateEliteLoot(level) {
        // Rarity: 50% Uncommon, 40% Rare, 10% Legendary
        const roll = Math.random();
        let rarity = RARITY.UNCOMMON;
        if (roll < 0.10) rarity = RARITY.LEGENDARY;
        else if (roll < 0.50) rarity = RARITY.RARE;
        
        const baseItem = BASE_ITEMS[Math.floor(Math.random() * BASE_ITEMS.length)];
        return this.createItem(baseItem, rarity, level);
    }

    static createItem(baseItem, rarity, level) {
        // Special handling for Materials/Relics
        if (baseItem.type === 'MATERIAL' || baseItem.type === 'RELIC') {
            let desc = "";
            let icon = "";
            let finalRarity = rarity;

            if (baseItem.name === "Shard") {
                desc = "What remains after purpose is broken.";
                finalRarity = RARITY.EIDOLIC;
                icon = "assets/items/eidolon_shard/eidolon_shard.png";
            } else if (baseItem.name === "Eidolon Heart") {
                desc = "Power that chose to endure.";
                finalRarity = RARITY.EIDOLIC;
                icon = "assets/items/eidolon_heart/eidolon_heart.png";
            }

            const item = new Item({
                name: baseItem.name,
                type: baseItem.type,
                rarity: finalRarity,
                slot: baseItem.slot,
                level: 1,
                stats: {},
                value: 10,
                description: desc,
                stack: 1,
                maxStack: 1000,
                icon: icon
            });
            return item;
        }

        // 4. Calculate Base Stats (Damage/Defense)
        const stats = {};
        
        // Base Stat scales with level and rarity multiplier
        const baseVal = Math.floor(baseItem.baseValue * (1 + level * 0.15) * rarity.multiplier);
        stats[baseItem.baseStat] = baseVal;

        // 5. Calculate Bonus Stats
        let name = baseItem.name;
        
        if (rarity.statCount > 0) {
            // Calculate Total Stat Budget
            // Roll between 2 and 4 per level, multiplied by rarity
            const rollPerLevel = 2 + Math.random() * 2; 
            const totalBudget = Math.floor(rollPerLevel * level * rarity.multiplier);
            
            // Select Stats
            let selectedStats = [];
            if (rarity === RARITY.LEGENDARY) {
                selectedStats = [...STAT_POOL]; // All stats
            } else {
                // Pick random unique stats
                const pool = [...STAT_POOL];
                for (let i = 0; i < rarity.statCount; i++) {
                    const idx = Math.floor(Math.random() * pool.length);
                    selectedStats.push(pool.splice(idx, 1)[0]);
                }
            }

            // Distribute Budget
            // Primary Stat gets 50% of budget
            const primaryStat = selectedStats[0]; // First one picked is primary
            const primaryBudget = Math.floor(totalBudget * 0.5);
            
            stats[primaryStat] = (stats[primaryStat] || 0) + primaryBudget;
            let remainingBudget = totalBudget - primaryBudget;

            // Remaining Stats share the other 50%
            if (selectedStats.length > 1) {
                if (selectedStats.length > 2) {
                    // Legendary: Boost Secondary (25% of total)
                    const secondaryStat = selectedStats[1];
                    const secondaryBudget = Math.floor(remainingBudget * 0.5);
                    stats[secondaryStat] = (stats[secondaryStat] || 0) + secondaryBudget;
                    remainingBudget -= secondaryBudget;

                    const perStatBudget = Math.floor(remainingBudget / (selectedStats.length - 2));
                    for (let i = 2; i < selectedStats.length; i++) {
                        const stat = selectedStats[i];
                        stats[stat] = (stats[stat] || 0) + Math.max(1, perStatBudget);
                    }
                } else {
                    // Rare: Secondary gets the rest (50/50 split)
                    const stat = selectedStats[1];
                    stats[stat] = (stats[stat] || 0) + remainingBudget;
                }
            } else {
                // If only 1 stat (Uncommon), it gets the rest too (so 100%)
                stats[primaryStat] += remainingBudget;
            }

            // 6. Generate Name based on Stats
            // Prefix from Primary Stat
            if (STAT_NAMES[primaryStat]) {
                name = `${STAT_NAMES[primaryStat].prefix} ${name}`;
            }

            // Suffix from Secondary Stat (if exists)
            if (selectedStats.length > 1) {
                const secondaryStat = selectedStats[1];
                if (STAT_NAMES[secondaryStat]) {
                    name = `${name} ${STAT_NAMES[secondaryStat].suffix}`;
                }
            } else if (rarity === RARITY.LEGENDARY) {
                 name = `${name} of Legends`;
            }
        }

        return new Item({
            name: name,
            baseName: baseItem.name, // Pass original base name
            type: baseItem.type,
            slot: baseItem.slot,
            rarity: rarity,
            stats: stats,
            level: level
        });
    }

    static generateLootForSlot(slot, level) {
        // 1. Roll for Rarity (Same as generateLoot)
        const roll = Math.random();
        let rarity = RARITY.COMMON;
        if (roll < 0.01) rarity = RARITY.LEGENDARY;
        else if (roll < 0.30) rarity = RARITY.RARE;
        else if (roll < 0.60) rarity = RARITY.UNCOMMON;

        // 2. Filter Base Items by Slot
        const possibleItems = BASE_ITEMS.filter(item => item.slot === slot);
        if (possibleItems.length === 0) {
            console.error(`No base items found for slot: ${slot}`);
            return null;
        }
        const baseItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
        
        return this.createItem(baseItem, rarity, level);
    }
}
