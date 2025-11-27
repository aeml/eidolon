export const RARITY = {
    COMMON: { name: 'Common', color: '#ffffff', multiplier: 1.0, statCount: 0 },
    UNCOMMON: { name: 'Uncommon', color: '#1eff00', multiplier: 1.5, statCount: 1 },
    RARE: { name: 'Rare', color: '#0070dd', multiplier: 2.0, statCount: 2 },
    LEGENDARY: { name: 'Legendary', color: '#ff8000', multiplier: 3.0, statCount: 5 }
};

export const SLOTS = {
    HEAD: 'head',
    CHEST: 'chest',
    LEGS: 'legs',
    FEET: 'feet',
    MAIN_HAND: 'mainHand',
    OFF_HAND: 'offHand'
};

const BASE_ITEMS = [
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
    { name: 'Sandals', type: 'ARMOR', slot: SLOTS.FEET, baseStat: 'defense', baseValue: 1 }
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
        this.type = config.type;
        this.slot = config.slot;
        this.rarity = config.rarity;
        this.stats = config.stats || {};
        this.level = config.level || 1;
    }

    static getValue(item) {
        if (!item) return 0;
        let multiplier = 1;
        if (item.rarity.name === 'Uncommon') multiplier = 2;
        if (item.rarity.name === 'Rare') multiplier = 5;
        if (item.rarity.name === 'Legendary') multiplier = 20;
        return Math.floor(item.level * 10 * multiplier);
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

            // Remaining Stats share the other 50%
            if (selectedStats.length > 1) {
                const remainingBudget = totalBudget - primaryBudget;
                const perStatBudget = Math.floor(remainingBudget / (selectedStats.length - 1));
                
                for (let i = 1; i < selectedStats.length; i++) {
                    const stat = selectedStats[i];
                    stats[stat] = (stats[stat] || 0) + Math.max(1, perStatBudget);
                }
            } else {
                // If only 1 stat (Uncommon), it gets the rest too (so 100%)
                stats[primaryStat] += (totalBudget - primaryBudget);
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
