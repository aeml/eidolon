import { earnedBagFreeSlots, earnedStashFreeSlots, planEarnedBagSales, planEarnedBagStorage,
    expectedEarnedStashDeposit } from './earnedInventoryPolicy.js';

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

const obsoleteRare = changes => gear('old-rare', { rarity: 'Rare', level: 30,
    stats: { intelligence: 9, defense: 2 }, ...changes });
const veteran = { className: 'Wizard', level: 100,
    equipment: { head: gear('worn-rare', { rarity: 'Rare', level: 72, stats: { intelligence: 22, defense: 8 } }) } };

test('sells only the needed obsolete unmodified Rare after cheaper ordinary spare gear', () => {
    const inventory = [obsoleteRare({ value: 1 }), gear('common'),
        gear('uncommon', { rarity: 'Uncommon' }), obsoleteRare({ id: 'keep-spare', value: 100 })];
    expect(planEarnedBagSales({ ...veteran, inventory }, 3).map(sale => sale.id))
        .toEqual(['common', 'uncommon', 'old-rare']);
    expect(inventory).toHaveLength(4);
});

test.each([
    { potency: 1 }, { sockets: 1 }, { gems: [{ stats: { intelligence: 1 } }] },
    { setId: 'set' }, { uniqueEffect: 'special' }, { rarity: 'Legendary' },
    { level: 70 }, { stats: { intelligence: 100 } }, { stats: { unknownEffect: 1 } },
    { level: 101 }, { id: 'chronicle-item-gear' }
])('retains invested, valuable, recent or unmodelled rare equipment: %j', changes => {
    expect(planEarnedBagSales({ ...veteran, inventory: [obsoleteRare(changes)] }, 1)).toEqual([]);
});

test('both paired equipment slots must beat an obsolete Rare before selling it', () => {
    const ring = obsoleteRare({ slot: 'ring' });
    const equipment = { ring1: { ...veteran.equipment.head, slot: 'ring' },
        ring2: gear('weak-ring', { slot: 'ring', level: 70, stats: { intelligence: 1 } }) };
    expect(planEarnedBagSales({ ...veteran, inventory: [ring], equipment }, 1)).toEqual([]);
    equipment.ring2 = { ...equipment.ring1, id: 'strong-second' };
    expect(planEarnedBagSales({ ...veteran, inventory: [ring], equipment }, 1)).toHaveLength(1);
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

test('storage never moves quest fragments, malformed stacks, worn IDs or gear for empty equipment slots', () => {
    const inventory = [gear('chronicle-item-seed'), gear('gem', { type: 'GEM' }), gear('material', { type: 'MATERIAL' }),
        gear('relic', { type: 'RELIC' }), gear('quest', { type: 'QUEST' }), gear('empty-slot', { slot: 'feet' }),
        gear('ring', { slot: 'ring' }), gear('worn'), gear('stacked', { stack: 2 }), gear('stackable', { maxStack: 10 })];
    expect(planEarnedBagStorage({ inventory, equipment }, 8)).toEqual([]);
});

test('gem-heavy bags bank intact valuables after spare gear instead of discarding them', () => {
    const gem = Object.freeze({ id: 'gem-one', name: 'Chipped Diamond', type: 'GEM', stack: 2, maxStack: 99 });
    const material = Object.freeze({ id: 'shard', name: 'Eidolon Shard', type: 'MATERIAL', stack: 57, maxStack: 1000 });
    const quest = { ...material, id: 'chronicle-item-seed' };
    const inventory = Object.freeze([gem, material, quest, gear('spare', { name: 'Spare helm' })]);
    expect(planEarnedBagStorage({ inventory, equipment }, 3)).toEqual([
        { id: 'spare', name: 'Spare helm' }, { id: gem.id, name: gem.name }, { id: material.id, name: material.name }
    ]);
    expect(planEarnedBagSales({ inventory: [gem, material, quest], equipment, level: 80 }, 3)).toEqual([]);
    expect(gem.stack).toBe(2);
    expect(material.stack).toBe(57);
});

test('stack deposits preserve destination identity and exact overflow without mutating observations', () => {
    const existing = Object.freeze({ id: 'old', name: 'Shard', type: 'MATERIAL', stack: 8, maxStack: 10,
        icon: '', stats: { wisdom: 0 } });
    const item = Object.freeze({ id: 'new', name: 'Shard', type: 'MATERIAL', stack: 5, maxStack: 10, icon: 'shard' });
    expect(expectedEarnedStashDeposit([existing, null], item)).toEqual([
        { ...existing, stack: 10, icon: 'shard' }, { ...item, stack: 3 }
    ]);
    expect(existing.stack).toBe(8);
    expect(item.stack).toBe(5);
});

test('a nearly full stash consolidates carried gems before allocating slots to spare gear', () => {
    const gem = Object.freeze({ id: 'carried-gem', name: 'Flawed Ruby', type: 'GEM', stack: 3, maxStack: 99 });
    const shard = Object.freeze({ id: 'carried-shard', name: 'Eidolon Shard', type: 'MATERIAL', stack: 23, maxStack: 1000 });
    const stash = Object.freeze([{ ...gem, id: 'banked-gem', stack: 7 },
        { ...shard, id: 'banked-shard', stack: 70 }, ...Array.from({ length: 97 }, (_, i) => gear(`banked-${i}`))]);
    const inventory = Object.freeze([gear('rare-spare', { rarity: 'Rare' }), gem, shard]);
    const planned = planEarnedBagStorage({ inventory, equipment, stash }, 2);
    expect(planned).toEqual([{ id: gem.id, name: gem.name }, { id: shard.id, name: shard.name }]);
    const after = planned.reduce((state, deposit) => expectedEarnedStashDeposit(state,
        inventory.find(item => item.id === deposit.id)), stash);
    expect(earnedStashFreeSlots(after, 100)).toBe(1);
    expect(after[0]).toMatchObject({ id: 'banked-gem', stack: 10 });
    expect(after[1]).toMatchObject({ id: 'banked-shard', stack: 93 });
    expect(stash[0].stack).toBe(7);
    expect(inventory[0].id).toBe('rare-spare');
});

test('multiple carried stacks cannot reserve the same available bank space twice', () => {
    const gem = { id: 'gem-a', name: 'Ruby', type: 'GEM', stack: 3, maxStack: 10 };
    const stash = [{ ...gem, id: 'banked', stack: 7 }];
    const inventory = [gear('spare'), gem, { ...gem, id: 'gem-b' }];
    expect(planEarnedBagStorage({ inventory, equipment, stash }, 2)).toEqual([
        { id: 'gem-a', name: 'Ruby' }, { id: 'spare', name: undefined }
    ]);
});

test('complete merges, legacy capacity refresh and first deposits preserve every unit', () => {
    const item = { id: 'new', name: 'Gem', type: 'GEM', stack: 2, maxStack: 99 };
    expect(expectedEarnedStashDeposit([], item)).toEqual([item]);
    expect(expectedEarnedStashDeposit([{ ...item, id: 'old', stack: 9, maxStack: 10 }], item))
        .toEqual([{ ...item, id: 'old', stack: 11, maxStack: 99 }]);
    expect(() => expectedEarnedStashDeposit([], { ...item, stack: 0 })).toThrow('Invalid deposit quantity');
});

test('storage preserves future-level upgrades and chooses only the needed number without mutation', () => {
    const inventory = Object.freeze([null, gear('future', { level: 100 }), gear('valuable', { rarity: 'Legendary' })]);
    expect(planEarnedBagStorage({ inventory, equipment }, 2)).toEqual([{ id: 'future', name: undefined }]);
    expect(planEarnedBagStorage({ inventory, equipment }, 1)).toEqual([]);
    expect(inventory[1].level).toBe(100);
});
