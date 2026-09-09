import { earnedBagFreeSlots, planEarnedBagSales } from './earnedInventoryPolicy.js';

const gear = (id, changes = {}) => ({ id, type: 'ARMOR', slot: 'head', level: 3,
    rarity: { name: 'Common' }, value: 30, ...changes });
const equipment = { head: gear('worn'), ring1: gear('ring-one', { slot: 'ring' }) };

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
});
