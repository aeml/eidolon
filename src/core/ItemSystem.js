export const RARITY = {
    COMMON: { name: 'Common', color: '#ffffff', multiplier: 1.0, statCount: 0 },
    UNCOMMON: { name: 'Uncommon', color: '#1eff00', multiplier: 1.5, statCount: 1 },
    RARE: { name: 'Rare', color: '#0070dd', multiplier: 2.0, statCount: 2 },
    LEGENDARY: { name: 'Legendary', color: '#ff8000', multiplier: 3.0, statCount: 5 },
    EIDOLIC: { name: 'Eidolic', color: '#A020F0', multiplier: 1.0, statCount: 0 } // Purple
};

// ============================================================================
// GEM TYPES AND QUALITIES
// ============================================================================
export const GEM_TYPES = {
    RUBY: { name: 'Ruby', color: '#FF0000', primaryStat: 'strength', secondaryStat: 'fireDamage' },
    SAPPHIRE: { name: 'Sapphire', color: '#0000FF', primaryStat: 'intelligence', secondaryStat: 'manaRegen' },
    EMERALD: { name: 'Emerald', color: '#00FF00', primaryStat: 'dexterity', secondaryStat: 'critChance' },
    TOPAZ: { name: 'Topaz', color: '#FFD700', primaryStat: 'wisdom', secondaryStat: 'healingDone' },
    DIAMOND: { name: 'Diamond', color: '#E0E0E0', primaryStat: 'vitality', secondaryStat: 'allResist' },
    ONYX: { name: 'Onyx', color: '#1C1C1C', primaryStat: 'damage', secondaryStat: 'lifesteal' },
    OPAL: { name: 'Opal', color: '#A8C8F8', primaryStat: 'moveSpeed', secondaryStat: 'cdr' }
};

export const GEM_QUALITIES = {
    CHIPPED: { name: 'Chipped', value: 10, color: '#8b6b4c' },
    FLAWED: { name: 'Flawed', value: 25, color: '#9aa4b2' },
    NORMAL: { name: 'Normal', value: 50, color: '#d9e1e8' },
    FLAWLESS: { name: 'Flawless', value: 100, color: '#ffd54f' },
    PERFECT: { name: 'Perfect', value: 200, color: '#7ee7ff' },
    RADIANT: { name: 'Radiant', value: 400, color: '#ff8cff' }
};

for (const key of Object.keys(GEM_TYPES)) {
    const entry = GEM_TYPES[key];
    GEM_TYPES[entry.name] = entry;
}

for (const key of Object.keys(GEM_QUALITIES)) {
    const entry = GEM_QUALITIES[key];
    GEM_QUALITIES[entry.name] = entry;
}

// Calculate gem stats based on type and quality
export function getGemStats(gemType, quality) {
    const typeInfo = GEM_TYPES[gemType] || GEM_TYPES.RUBY;
    const qualityInfo = GEM_QUALITIES[quality] || GEM_QUALITIES.CHIPPED;
    const baseValue = qualityInfo.value;
    
    const stats = {};
    stats[typeInfo.primaryStat] = baseValue;
    
    // Secondary stat is usually a percentage (divided by 10 or 20)
    if (typeInfo.secondaryStat === 'critChance' || typeInfo.secondaryStat === 'lifesteal' || typeInfo.secondaryStat === 'cdr') {
        stats[typeInfo.secondaryStat] = Math.floor(baseValue / 20);
    } else {
        stats[typeInfo.secondaryStat] = Math.floor(baseValue / 10);
    }
    
    return stats;
}

// ============================================================================
// SET ITEM DEFINITIONS
// ============================================================================
export const SET_DEFINITIONS = {
    // Fighter Sets
    warlord_fury: {
        id: 'warlord_fury',
        name: "Warlord's Fury",
        class: 'Fighter',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { armor: 15 },
        bonus4: { chargeReset: 1 },           // Special: charge CD reset on kill
        bonus6: { ironFortressDamage: 100 },  // Double damage during Iron Fortress
        description: "The armor of ancient warlords who knew no defeat."
    },
    bulwark_ages: {
        id: 'bulwark_ages',
        name: "Bulwark of Ages",
        class: 'Fighter',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { maxHealth: 20 },
        bonus4: { damageReflect: 5 },  // 5% damage reflect on block
        bonus6: { bossTaunt: 1 },      // Guardian Roar taunts bosses
        description: "Forged in an age when titans walked the earth."
    },
    // Rogue Sets
    shadow_embrace: {
        id: 'shadow_embrace',
        name: "Shadow's Embrace",
        class: 'Rogue',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { critChance: 15 },
        bonus4: { backstabAnyAngle: 1 },     // Backstab from any angle
        bonus6: { phantomVolleyDouble: 1 },  // Phantom Volley fires 6x
        description: "Worn by assassins who became one with darkness."
    },
    venom_lord: {
        id: 'venom_lord',
        name: "Venom Lord",
        class: 'Rogue',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { poisonDamage: 20 },
        bonus4: { poisonSpread: 1 },        // Poison spreads to nearby
        bonus6: { deathSpiralConsume: 1 },  // Death Spiral consumes DoTs for burst
        description: "The regalia of those who mastered venom."
    },
    // Wizard Sets
    inferno_heart: {
        id: 'inferno_heart',
        name: "Inferno's Heart",
        class: 'Wizard',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { fireDamage: 15 },
        bonus4: { fireballPierce: 1 },  // Fireball pierces
        bonus6: { meteorReset: 1 },     // Fire kill resets Meteor CD
        description: "Contains the fury of a dying star."
    },
    temporal_weave: {
        id: 'temporal_weave',
        name: "Temporal Weave",
        class: 'Wizard',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { cdr: 15 },
        bonus4: { teleportCharges: 2 },  // Teleport has 2 charges
        bonus6: { timeWarpZone: 1 },     // Time Warp affects entire zone
        description: "Threads of time woven into fabric."
    },
    // Cleric Sets
    divine_light: {
        id: 'divine_light',
        name: "Divine Light",
        class: 'Cleric',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { healingDone: 15 },
        bonus4: { spiritGuardiansHeal: 1 },    // Spirit Guardians heals allies
        bonus6: { divineInterventionCD: 60 },  // Divine Intervention 60s CD
        description: "Blessed by celestial beings of pure light."
    },
    crusader_zeal: {
        id: 'crusader_zeal',
        name: "Crusader's Zeal",
        class: 'Cleric',
        slots: ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders'],
        bonus2: { holyDamage: 15 },
        bonus4: { radiantStrikeLifesteal: 100 },  // Radiant Strike heals for damage
        bonus6: { permanentSeraph: 1 },            // Avenging Seraph permanent in combat
        description: "The armor of holy warriors who smite evil."
    }
};

// Calculate active set bonuses from equipped items
export function calculateSetBonuses(equipment) {
    // Count pieces per set
    const setCounts = {};
    for (const slot in equipment) {
        const item = equipment[slot];
        if (item && item.setId) {
            setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
        }
    }
    
    // Calculate bonuses
    const bonuses = {};
    for (const setId in setCounts) {
        const count = setCounts[setId];
        const setDef = SET_DEFINITIONS[setId];
        if (!setDef) continue;
        
        const setBonus = { count, setName: setDef.name, stats: {}, specials: {} };
        
        if (count >= 2) {
            for (const k in setDef.bonus2) {
                if (typeof setDef.bonus2[k] === 'number' && setDef.bonus2[k] <= 100) {
                    setBonus.stats[k] = setDef.bonus2[k];
                } else {
                    setBonus.specials[k] = setDef.bonus2[k];
                }
            }
        }
        if (count >= 4) {
            for (const k in setDef.bonus4) {
                if (typeof setDef.bonus4[k] === 'number' && k.match(/^(armor|maxHealth|critChance|poisonDamage|fireDamage|cdr|healingDone|holyDamage)$/)) {
                    setBonus.stats[k] = (setBonus.stats[k] || 0) + setDef.bonus4[k];
                } else {
                    setBonus.specials[k] = setDef.bonus4[k];
                }
            }
        }
        if (count >= 6) {
            for (const k in setDef.bonus6) {
                if (typeof setDef.bonus6[k] === 'number' && k.match(/^(armor|maxHealth|critChance|poisonDamage|fireDamage|cdr|healingDone|holyDamage)$/)) {
                    setBonus.stats[k] = (setBonus.stats[k] || 0) + setDef.bonus6[k];
                } else {
                    setBonus.specials[k] = setDef.bonus6[k];
                }
            }
        }
        
        bonuses[setId] = setBonus;
    }
    
    return bonuses;
}

// ============================================================================
// UNIQUE ITEM EFFECTS
// ============================================================================
export const UNIQUE_EFFECTS = {
    vampiric: {
        id: 'vampiric',
        name: 'Vampiric',
        description: 'On kill, restore 5% HP',
        triggerType: 'onKill',
        chance: 1.0,
        color: '#8B0000'
    },
    efficient: {
        id: 'efficient',
        name: 'Efficient',
        description: 'Skills cost 10% less mana',
        triggerType: 'always',
        chance: 1.0,
        color: '#4169E1'
    },
    lucky: {
        id: 'lucky',
        name: 'Lucky',
        description: '10% chance to deal double damage',
        triggerType: 'onHit',
        chance: 0.10,
        color: '#FFD700'
    },
    explosive: {
        id: 'explosive',
        name: 'Explosive',
        description: 'Enemies killed explode for 50% damage to nearby',
        triggerType: 'onKill',
        chance: 1.0,
        color: '#FF4500'
    },
    swift: {
        id: 'swift',
        name: 'Swift',
        description: '+20% move speed for 3s after using a skill',
        triggerType: 'onSkill',
        chance: 1.0,
        color: '#00CED1'
    },
    thorns: {
        id: 'thorns',
        name: 'Thorns',
        description: 'Reflect 10% of damage taken',
        triggerType: 'onDamage',
        chance: 1.0,
        color: '#9932CC'
    },
    berserker: {
        id: 'berserker',
        name: 'Berserker',
        description: 'Below 30% HP, +30% damage',
        triggerType: 'always',
        chance: 1.0,
        color: '#DC143C'
    },
    guardian: {
        id: 'guardian',
        name: 'Guardian',
        description: 'Above 80% HP, +20% armor',
        triggerType: 'always',
        chance: 1.0,
        color: '#4682B4'
    },
    executioner: {
        id: 'executioner',
        name: 'Executioner',
        description: '+25% damage to enemies below 25% HP',
        triggerType: 'onHit',
        chance: 1.0,
        color: '#800000'
    },
    regenerative: {
        id: 'regenerative',
        name: 'Regenerative',
        description: '+1% HP regen per second',
        triggerType: 'always',
        chance: 1.0,
        color: '#32CD32'
    }
};

// Get all unique effects from equipped items
export function getEquippedUniqueEffects(equipment) {
    const effects = [];
    for (const slot in equipment) {
        const item = equipment[slot];
        if (item && item.uniqueEffect) {
            const effectDef = UNIQUE_EFFECTS[item.uniqueEffect];
            if (effectDef) {
                effects.push({ ...effectDef, sourceItem: item.name });
            }
        }
    }
    return effects;
}

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
    { name: 'Eidolon Shard', type: 'MATERIAL', slot: SLOTS.MATERIAL, baseStat: '', baseValue: 0 },
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

            if (baseItem.name === "Eidolon Shard") {
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
