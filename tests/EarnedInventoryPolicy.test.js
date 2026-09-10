import { earnedBagFreeSlots, earnedStashFreeSlots, planEarnedBagSales, planEarnedBagStorage } from './earnedInventoryPolicy.js';

const gear = (id, changes = {}) => ({ id, type: 'ARMOR', slot: 'head', level: 3,
    rarity: { name: 'Common' }, value: 30, ...changes });
const equipment = { head: gear('worn'), ring1: gear('ring-one', { slot: 'ring' }) };

test('a second stash visit counts the one stored item, not 99 network padding entries', () => {
    const item = Object.freeze(gear('stored'));
    const padded = Object.freeze([item, ...Array(99).fill(null)]);
    expect(earnedStashFreeSlots(padded, 100)).toBe(99);
    expect(earnedStashFreeSlots([item], 100)).toBe(99);
    expect(padded[0]).toBe(item);
    expect(padded).toHaveLength(100);
});

test('empty and full stash observations respect the actual rendered capacity', () => {
    expect(earnedStashFreeSlots([], 100)).toBe(100);
    expect(earnedStashFreeSlots([null, { id: '' }], 2)).toBe(2);
    expect(earnedStashFreeSlots([gear('one'), gear('two')], 2)).toBe(0);
});

test.each([-1, 1.5, NaN, undefined])('invalid stash capacity %s cannot permit deposits', capacity => {
    expect(() => earnedStashFreeSlots([], capacity)).toThrow();
});

test('missing storage and occupancy beyond the rendered capacity fail closed', () => {
    expect(() => earnedStashFreeSlots(undefined, 100)).toThrow();
    expect(() => earnedStashFreeSlots([gear('one')], 0)).toThrow();
});

test('full bags first sell only the cheapest ordinary spare equipment required for room', () => {
    const inventory = Object.freeze([gear('uncommon', { rarity: { name: 'Uncommon' }, value: 10 }),
        gear('common-high', { value: 40 }), gear('common-low', { value: 20 }), gear('rare', { rarity: { name: 'Rare' } })]);
    expect(planEarnedBagSales({ inventory, equipment, level: 5 }, 2)).toEqual([
        { id: 'common-low', rarity: 'Common', value: 20 }, { id: 'common-high', rarity: 'Common', value: 40 }
    ]);
    expect(inventory).toHaveLength(4);
});

test('never sells protected categories, worn IDs, future gear, or an item for an empty equipment slot', () => {
    const inventory = [gear('chronicle-item-seed'), gear('gem', { type: 'GEM' }), gear('material', { type: 'MATERIAL' }),
        gear('relic', { type: 'RELIC' }), gear('rare', { rarity: 'Rare' }), gear('legendary', { rarity: 'Legendary' }),
        gear('future', { level: 10 }), gear('empty-slot', { slot: 'feet' }), gear('ring', { slot: 'ring' }), gear('worn')];
    expect(planEarnedBagSales({ inventory, equipment, level: 5 }, 5)).toEqual([]);
});

test('counts empty slots and does not sell when the bag already has room', () => {
    const inventory = [null, {}, undefined, gear('spare')];
    expect(earnedBagFreeSlots(inventory)).toBe(3);
    expect(planEarnedBagSales({ inventory, equipment, level: 5 }, 3)).toEqual([]);
});

test('sale quotes match minimum value and stack rules without granting anything', () => {
    expect(planEarnedBagSales({ inventory: [gear('zero', { value: 0 }), gear('stack', { stack: 2 })], equipment, level: 5 }, 2))
        .toEqual([{ id: 'zero', rarity: 'Common', value: 1 }, { id: 'stack', rarity: 'Common', value: 60 }]);
});

test.each([-1, 1.5, 3, NaN])('rejects an invalid bag-space target %p', target => {
    expect(() => planEarnedBagSales({ inventory: [null, null], equipment, level: 5 }, target)).toThrow();
    expect(() => planEarnedBagStorage({ inventory: [null, null], equipment }, target)).toThrow();
});

test('a shortage of saleable gear is covered by preserving the remaining rare upgrade in storage', () => {
    const rare = gear('rare', { rarity: 'Rare', name: 'Rare helm' });
    const inventory = Object.freeze([gear('spare-one'), gear('spare-two'), rare]);
    const sales = planEarnedBagSales({ inventory, equipment, level: 5 }, 3);
    expect(sales).toHaveLength(2);
    const afterSales = inventory.map(item => sales.some(sale => sale.id === item.id) ? null : item);
    expect(planEarnedBagStorage({ inventory: afterSales, equipment }, 3)).toEqual([{ id: 'rare', name: 'Rare helm' }]);
    expect(inventory[2]).toBe(rare);
    expect(afterSales[2]).toBe(rare);
});

test('storage never moves quest fragments, crafting items, worn IDs or gear for empty equipment slots', () => {
    const inventory = [gear('chronicle-item-seed'), gear('gem', { type: 'GEM' }), gear('material', { type: 'MATERIAL' }),
        gear('relic', { type: 'RELIC' }), gear('quest', { type: 'QUEST' }), gear('empty-slot', { slot: 'feet' }),
        gear('ring', { slot: 'ring' }), gear('worn'), gear('stacked', { stack: 2 }), gear('stackable', { maxStack: 10 })];
    expect(planEarnedBagStorage({ inventory, equipment }, 8)).toEqual([]);
});

test('storage preserves future-level upgrades and chooses only the needed number without mutation', () => {
    const inventory = Object.freeze([null, gear('future', { level: 100 }), gear('valuable', { rarity: 'Legendary' })]);
    expect(planEarnedBagStorage({ inventory, equipment }, 2)).toEqual([{ id: 'future', name: undefined }]);
    expect(planEarnedBagStorage({ inventory, equipment }, 1)).toEqual([]);
    expect(inventory[1].level).toBe(100);
});
