export const RARITY = {
    COMMON: { name: 'Common', color: '#ffffff', multiplier: 1.0, statCount: 0 },
    UNCOMMON: { name: 'Uncommon', color: '#1eff00', multiplier: 1.2, statCount: 1 },
    RARE: { name: 'Rare', color: '#0070dd', multiplier: 1.5, statCount: 2 },
    LEGENDARY: { name: 'Legendary', color: '#ff8000', multiplier: 2.0, statCount: 3 }
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

const PREFIXES = [
    { name: 'Strong', stat: 'strength', min: 1, max: 3 },
    { name: 'Agile', stat: 'dexterity', min: 1, max: 3 },
    { name: 'Brilliant', stat: 'intelligence', min: 1, max: 3 },
    { name: 'Wise', stat: 'wisdom', min: 1, max: 3 },
    { name: 'Hearty', stat: 'vitality', min: 1, max: 3 },
    { name: 'Sharp', stat: 'damage', min: 2, max: 5 },
    { name: 'Sturdy', stat: 'defense', min: 2, max: 5 }
];

const SUFFIXES = [
    { name: 'of the Bear', stat: 'vitality', min: 2, max: 4 },
    { name: 'of the Tiger', stat: 'strength', min: 2, max: 4 },
    { name: 'of the Owl', stat: 'wisdom', min: 2, max: 4 },
    { name: 'of the Eagle', stat: 'dexterity', min: 2, max: 4 },
    { name: 'of the Fox', stat: 'intelligence', min: 2, max: 4 },
    { name: 'of Destruction', stat: 'damage', min: 3, max: 6 },
    { name: 'of Protection', stat: 'defense', min: 3, max: 6 }
];

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
        // 4. Calculate Base Stats
        const stats = {};
        
        // Base Stat (Damage or Defense) scales with level and rarity
        const baseVal = Math.floor(baseItem.baseValue * (1 + level * 0.1) * rarity.multiplier);
        stats[baseItem.baseStat] = baseVal;

        // 5. Add Random Stats based on Rarity (Stat Count)
        const availableStats = [...STAT_POOL];
        for (let i = 0; i < rarity.statCount; i++) {
            if (availableStats.length === 0) break;
            const statIndex = Math.floor(Math.random() * availableStats.length);
            const statName = availableStats.splice(statIndex, 1)[0];
            
            // Stat value: 1-3 base + level scaling
            const statVal = Math.floor((1 + Math.random() * 2 + (level * 0.5)) * rarity.multiplier);
            stats[statName] = (stats[statName] || 0) + Math.max(1, statVal);
        }

        // 6. Add Affixes (Prefix/Suffix)
        let prefix = null;
        let suffix = null;
        let name = baseItem.name;

        let allowPrefix = false;
        let allowSuffix = false;

        if (rarity === RARITY.LEGENDARY) {
            allowPrefix = true;
            allowSuffix = true;
        } else if (rarity === RARITY.RARE) {
            if (Math.random() > 0.5) allowPrefix = true;
            else allowSuffix = true;
            // Chance for both
            if (Math.random() > 0.7) { allowPrefix = true; allowSuffix = true; }
        } else if (rarity === RARITY.UNCOMMON) {
            if (Math.random() > 0.5) allowPrefix = true;
            else allowSuffix = true;
        } else {
            // Common
            if (Math.random() > 0.8) allowPrefix = true;
        }

        if (allowPrefix) {
            const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
            name = `${p.name} ${name}`;
            stats[p.stat] = (stats[p.stat] || 0) + Math.floor(p.min + Math.random() * (p.max - p.min));
        }

        if (allowSuffix) {
            const s = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
            name = `${name} ${s.name}`;
            stats[s.stat] = (stats[s.stat] || 0) + Math.floor(s.min + Math.random() * (s.max - s.min));
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
