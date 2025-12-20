import { jest } from '@jest/globals';
import { RARITY, SLOTS, BASE_ITEMS, Item, ItemGenerator } from '../src/core/ItemSystem.js';

describe('ItemSystem Constants', () => {
    describe('RARITY', () => {
        test('COMMON has correct properties', () => {
            expect(RARITY.COMMON).toBeDefined();
            expect(RARITY.COMMON.name).toBe('Common');
            expect(RARITY.COMMON.color).toBe('#ffffff');
            expect(RARITY.COMMON.multiplier).toBe(1.0);
            expect(RARITY.COMMON.statCount).toBe(0);
        });

        test('UNCOMMON has correct properties', () => {
            expect(RARITY.UNCOMMON).toBeDefined();
            expect(RARITY.UNCOMMON.name).toBe('Uncommon');
            expect(RARITY.UNCOMMON.color).toBe('#1eff00');
            expect(RARITY.UNCOMMON.multiplier).toBe(1.5);
            expect(RARITY.UNCOMMON.statCount).toBe(1);
        });

        test('RARE has correct properties', () => {
            expect(RARITY.RARE).toBeDefined();
            expect(RARITY.RARE.name).toBe('Rare');
            expect(RARITY.RARE.color).toBe('#0070dd');
            expect(RARITY.RARE.multiplier).toBe(2.0);
            expect(RARITY.RARE.statCount).toBe(2);
        });

        test('LEGENDARY has correct properties', () => {
            expect(RARITY.LEGENDARY).toBeDefined();
            expect(RARITY.LEGENDARY.name).toBe('Legendary');
            expect(RARITY.LEGENDARY.color).toBe('#ff8000');
            expect(RARITY.LEGENDARY.multiplier).toBe(3.0);
            expect(RARITY.LEGENDARY.statCount).toBe(5);
        });

        test('EIDOLIC is defined for special items', () => {
            expect(RARITY.EIDOLIC).toBeDefined();
            expect(RARITY.EIDOLIC.name).toBe('Eidolic');
            expect(RARITY.EIDOLIC.color).toBe('#A020F0');
        });

        test('All rarities have required properties', () => {
            Object.values(RARITY).forEach(rarity => {
                expect(rarity.name).toBeDefined();
                expect(rarity.color).toBeDefined();
                expect(typeof rarity.multiplier).toBe('number');
                expect(typeof rarity.statCount).toBe('number');
            });
        });
    });

    describe('SLOTS', () => {
        test('All equipment slots are defined', () => {
            expect(SLOTS.HEAD).toBe('head');
            expect(SLOTS.CHEST).toBe('chest');
            expect(SLOTS.LEGS).toBe('legs');
            expect(SLOTS.FEET).toBe('feet');
            expect(SLOTS.MAIN_HAND).toBe('mainHand');
            expect(SLOTS.OFF_HAND).toBe('offHand');
            expect(SLOTS.GLOVES).toBe('gloves');
            expect(SLOTS.SHOULDERS).toBe('shoulders');
            expect(SLOTS.BELT).toBe('belt');
            expect(SLOTS.RING).toBe('ring');
            expect(SLOTS.NECK).toBe('neck');
            expect(SLOTS.TRINKET).toBe('trinket');
        });

        test('Material and Relic slots exist', () => {
            expect(SLOTS.MATERIAL).toBe('material');
            expect(SLOTS.RELIC).toBe('relic');
        });
    });

    describe('BASE_ITEMS', () => {
        test('BASE_ITEMS is an array with items', () => {
            expect(Array.isArray(BASE_ITEMS)).toBe(true);
            expect(BASE_ITEMS.length).toBeGreaterThan(0);
        });

        test('Each base item has required properties', () => {
            BASE_ITEMS.forEach(item => {
                expect(item.name).toBeDefined();
                expect(item.type).toBeDefined();
                expect(item.slot).toBeDefined();
            });
        });

        test('Weapons have damage as base stat', () => {
            const weapons = BASE_ITEMS.filter(item => item.slot === SLOTS.MAIN_HAND && item.type === 'WEAPON');
            expect(weapons.length).toBeGreaterThan(0);
            weapons.forEach(weapon => {
                expect(weapon.baseStat).toBe('damage');
                expect(weapon.baseValue).toBeGreaterThan(0);
            });
        });

        test('Armor has defense as base stat', () => {
            const armor = BASE_ITEMS.filter(item => item.type === 'ARMOR');
            expect(armor.length).toBeGreaterThan(0);
            armor.forEach(piece => {
                expect(piece.baseStat).toBe('defense');
                expect(piece.baseValue).toBeGreaterThan(0);
            });
        });

        test('Contains Eidolon materials', () => {
            const shard = BASE_ITEMS.find(item => item.name === 'Eidolon Shard');
            const heart = BASE_ITEMS.find(item => item.name === 'Eidolon Heart');
            
            expect(shard).toBeDefined();
            expect(heart).toBeDefined();
            expect(shard.type).toBe('MATERIAL');
            expect(heart.type).toBe('RELIC');
        });
    });

    describe('STAT_POOL tests (internal)', () => {
        // STAT_POOL is internal but we can test via item generation
        test('Rare items get bonus stats from stat pool', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND);
            const item = ItemGenerator.createItem(baseItem, RARITY.RARE, 10);
            
            // Rare items have 2 bonus stats - should have more than just base damage
            const statKeys = Object.keys(item.stats);
            expect(statKeys.length).toBeGreaterThanOrEqual(2);
        });
    });
});

describe('Item Class', () => {
    test('Item initializes with correct properties', () => {
        const item = new Item({
            name: 'Test Sword',
            type: 'WEAPON',
            slot: SLOTS.MAIN_HAND,
            rarity: RARITY.COMMON,
            stats: { damage: 10 },
            level: 5
        });

        expect(item.name).toBe('Test Sword');
        expect(item.type).toBe('WEAPON');
        expect(item.slot).toBe(SLOTS.MAIN_HAND);
        expect(item.rarity).toBe(RARITY.COMMON);
        expect(item.stats.damage).toBe(10);
        expect(item.level).toBe(5);
    });

    test('Item generates unique ID', () => {
        const item1 = new Item({ name: 'Sword 1' });
        const item2 = new Item({ name: 'Sword 2' });
        
        expect(item1.id).toBeDefined();
        expect(item2.id).toBeDefined();
        expect(item1.id).not.toBe(item2.id);
    });

    test('Item defaults to level 1', () => {
        const item = new Item({ name: 'Test Item' });
        expect(item.level).toBe(1);
    });

    test('Item stores baseName for icons', () => {
        const item = new Item({ 
            name: 'Mighty Iron Sword of the Bear',
            baseName: 'Iron Sword'
        });
        expect(item.baseName).toBe('Iron Sword');
    });

    describe('getValue static method', () => {
        test('Common item value calculation', () => {
            const item = new Item({
                name: 'Test Sword',
                rarity: RARITY.COMMON,
                level: 10
            });
            
            // Value = level * 10 * multiplier = 10 * 10 * 1 = 100
            expect(Item.getValue(item)).toBe(100);
        });

        test('Uncommon item value calculation', () => {
            const item = new Item({
                name: 'Test Sword',
                rarity: RARITY.UNCOMMON,
                level: 10
            });
            
            // Value = level * 10 * multiplier = 10 * 10 * 2 = 200
            expect(Item.getValue(item)).toBe(200);
        });

        test('Rare item value calculation', () => {
            const item = new Item({
                name: 'Test Sword',
                rarity: RARITY.RARE,
                level: 10
            });
            
            // Value = level * 10 * multiplier = 10 * 10 * 5 = 500
            expect(Item.getValue(item)).toBe(500);
        });

        test('Legendary item value calculation', () => {
            const item = new Item({
                name: 'Test Sword',
                rarity: RARITY.LEGENDARY,
                level: 10
            });
            
            // Value = level * 10 * multiplier = 10 * 10 * 20 = 2000
            expect(Item.getValue(item)).toBe(2000);
        });

        test('Eidolic item value calculation', () => {
            const item = new Item({
                name: 'Eidolon Shard',
                rarity: RARITY.EIDOLIC,
                level: 1
            });
            
            // Value = level * 10 * multiplier = 1 * 10 * 50 = 500
            expect(Item.getValue(item)).toBe(500);
        });

        test('Value scales with level', () => {
            const item1 = new Item({ name: 'Test', rarity: RARITY.COMMON, level: 1 });
            const item5 = new Item({ name: 'Test', rarity: RARITY.COMMON, level: 5 });
            const item10 = new Item({ name: 'Test', rarity: RARITY.COMMON, level: 10 });
            
            expect(Item.getValue(item1)).toBe(10);
            expect(Item.getValue(item5)).toBe(50);
            expect(Item.getValue(item10)).toBe(100);
        });

        test('Returns 0 for null item', () => {
            expect(Item.getValue(null)).toBe(0);
        });

        test('Uses server value if provided', () => {
            const item = { value: 999, level: 1, rarity: RARITY.COMMON };
            expect(Item.getValue(item)).toBe(999);
        });

        test('Stacked items multiply value', () => {
            const item = { value: 100, stack: 5 };
            expect(Item.getValue(item)).toBe(500);
        });
    });
});

describe('ItemGenerator', () => {
    describe('generateLoot', () => {
        test('Generates an item at or below specified max level', () => {
            const item = ItemGenerator.generateLoot(10);
            
            expect(item).toBeInstanceOf(Item);
            expect(item.level).toBeLessThanOrEqual(10);
            expect(item.level).toBeGreaterThanOrEqual(1);
        });

        test('Generated item has valid rarity', () => {
            const item = ItemGenerator.generateLoot(5);
            
            const validRarities = Object.values(RARITY);
            expect(validRarities).toContain(item.rarity);
        });

        test('Generated item has a name', () => {
            const item = ItemGenerator.generateLoot(5);
            
            expect(item.name).toBeDefined();
            expect(item.name.length).toBeGreaterThan(0);
        });

        test('Generated item has stats', () => {
            const item = ItemGenerator.generateLoot(10);
            
            expect(item.stats).toBeDefined();
            expect(typeof item.stats).toBe('object');
        });

        test('Generates items with levels within max level range', () => {
            const maxLevels = [1, 5, 10, 20, 50];
            
            maxLevels.forEach(maxLevel => {
                const item = ItemGenerator.generateLoot(maxLevel);
                expect(item.level).toBeLessThanOrEqual(maxLevel);
                expect(item.level).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe('generateEliteLoot', () => {
        test('Generates an item at specified level', () => {
            const item = ItemGenerator.generateEliteLoot(15);
            
            expect(item).toBeInstanceOf(Item);
            expect(item.level).toBe(15);
        });

        test('Elite loot never generates COMMON rarity', () => {
            // Run multiple times to check rarity distribution
            for (let i = 0; i < 20; i++) {
                const item = ItemGenerator.generateEliteLoot(10);
                expect(item.rarity).not.toBe(RARITY.COMMON);
            }
        });

        test('Elite loot has higher minimum rarity', () => {
            const item = ItemGenerator.generateEliteLoot(10);
            
            const eliteRarities = [RARITY.UNCOMMON, RARITY.RARE, RARITY.LEGENDARY];
            expect(eliteRarities).toContain(item.rarity);
        });
    });

    describe('createItem', () => {
        test('Creates material items correctly', () => {
            const baseItem = BASE_ITEMS.find(i => i.name === 'Eidolon Shard');
            const item = ItemGenerator.createItem(baseItem, RARITY.COMMON, 1);
            
            expect(item.name).toBe('Eidolon Shard');
            expect(item.rarity).toBe(RARITY.EIDOLIC); // Materials get upgraded to EIDOLIC
        });

        test('Creates weapon with damage stat', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
            const item = ItemGenerator.createItem(baseItem, RARITY.COMMON, 10);
            
            expect(item.stats.damage).toBeGreaterThan(0);
        });

        test('Creates armor with defense stat', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.CHEST);
            const item = ItemGenerator.createItem(baseItem, RARITY.COMMON, 10);
            
            expect(item.stats.defense).toBeGreaterThan(0);
        });

        test('Higher rarity items have higher base stats', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
            
            const commonItem = ItemGenerator.createItem(baseItem, RARITY.COMMON, 10);
            const rareItem = ItemGenerator.createItem(baseItem, RARITY.RARE, 10);
            const legendaryItem = ItemGenerator.createItem(baseItem, RARITY.LEGENDARY, 10);
            
            expect(rareItem.stats.damage).toBeGreaterThan(commonItem.stats.damage);
            expect(legendaryItem.stats.damage).toBeGreaterThan(rareItem.stats.damage);
        });

        test('Higher level items have higher stats', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
            
            const level1 = ItemGenerator.createItem(baseItem, RARITY.COMMON, 1);
            const level10 = ItemGenerator.createItem(baseItem, RARITY.COMMON, 10);
            const level20 = ItemGenerator.createItem(baseItem, RARITY.COMMON, 20);
            
            expect(level10.stats.damage).toBeGreaterThan(level1.stats.damage);
            expect(level20.stats.damage).toBeGreaterThan(level10.stats.damage);
        });

        test('Rare items get bonus stats', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
            const item = ItemGenerator.createItem(baseItem, RARITY.RARE, 10);
            
            // Rare items have 2 bonus stats
            const statKeys = Object.keys(item.stats);
            // Should have damage + at least 1-2 bonus stats
            expect(statKeys.length).toBeGreaterThanOrEqual(2);
        });

        test('Legendary items get all bonus stats', () => {
            const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
            const item = ItemGenerator.createItem(baseItem, RARITY.LEGENDARY, 10);
            
            // Legendary items get all 5 stat pool stats + base damage
            const statKeys = Object.keys(item.stats);
            expect(statKeys.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('generateLootForSlot', () => {
        test('Generates item for specific slot', () => {
            const item = ItemGenerator.generateLootForSlot(SLOTS.MAIN_HAND, 10);
            
            expect(item).toBeInstanceOf(Item);
            expect(item.slot).toBe(SLOTS.MAIN_HAND);
        });

        test('Generates head armor correctly', () => {
            const item = ItemGenerator.generateLootForSlot(SLOTS.HEAD, 5);
            
            expect(item.slot).toBe(SLOTS.HEAD);
            expect(item.stats.defense).toBeDefined();
        });

        test('Generates chest armor correctly', () => {
            const item = ItemGenerator.generateLootForSlot(SLOTS.CHEST, 5);
            
            expect(item.slot).toBe(SLOTS.CHEST);
            expect(item.stats.defense).toBeDefined();
        });

        test('Returns null for invalid slot', () => {
            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            const item = ItemGenerator.generateLootForSlot('invalid_slot', 10);
            
            expect(item).toBeNull();
            
            consoleSpy.mockRestore();
        });
    });
});

describe('Item Stat Scaling', () => {
    test('Stat budget scales with level and rarity', () => {
        const baseItem = BASE_ITEMS.find(i => i.slot === SLOTS.MAIN_HAND && i.type === 'WEAPON');
        
        // Get total stats for comparison
        const getTotalStats = (item) => {
            return Object.values(item.stats).reduce((sum, val) => sum + val, 0);
        };
        
        const commonL1 = ItemGenerator.createItem(baseItem, RARITY.COMMON, 1);
        const rareL1 = ItemGenerator.createItem(baseItem, RARITY.RARE, 1);
        const commonL10 = ItemGenerator.createItem(baseItem, RARITY.COMMON, 10);
        
        // Same level, higher rarity = more stats
        expect(getTotalStats(rareL1)).toBeGreaterThan(getTotalStats(commonL1));
        
        // Same rarity, higher level = more stats
        expect(getTotalStats(commonL10)).toBeGreaterThan(getTotalStats(commonL1));
    });
});
