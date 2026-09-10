import { canonicalEarnedItem, earnedGearScore, planEarnedEquipmentUpgrade } from './earnedEquipmentUpgrades.js';

const gear = (id, stats, rest = {}) => ({ id, stats, slot: 'mainHand', type: 'WEAPON', level: 1, ...rest });
const plan = (bag, worn, className = 'Wizard') => planEarnedEquipmentUpgrade({
    inventory: bag, equipment: worn, level: 30, className });

test('canonicalization reconciles only empty wire defaults, preserving values, gems and unknown metadata', () => {
    const item = Object.freeze(gear('same', { damage: 1 }));
    expect(canonicalEarnedItem({ ...item, value: 0 })).toEqual(canonicalEarnedItem({ ...item, gems: [] }));
    const special = { ...item, value: 500, gems: [{ stats: { damage: 3 } }], uniqueEffect: 'retained', extra: 'retained' };
    expect(canonicalEarnedItem(special)).toEqual(special);
    expect(canonicalEarnedItem({ ...special, value: 499 })).not.toEqual(canonicalEarnedItem(special));
    expect(canonicalEarnedItem({ ...special, gems: [] })).not.toEqual(canonicalEarnedItem(special));
    expect(item).not.toHaveProperty('value');
});

test('actual stats beat a misleading level or rarity label without modifying observations', () => {
    const worn = Object.freeze({ mainHand: Object.freeze(gear('old', { damage: 1 })) });
    const bag = Object.freeze([Object.freeze(gear('upgrade', { damage: 4 })),
        gear('expensive', { damage: 1 }, { level: 30, rarity: 'Legendary' })]);
    expect(plan(bag, worn)).toMatchObject({ id: 'upgrade', slot: 'mainHand', previousId: 'old', gain: 12 });
    expect(worn.mainHand.id).toBe('old');
    expect(bag[0].id).toBe('upgrade');
});

test.each([['Fighter', 'strength'], ['Rogue', 'dexterity'], ['Wizard', 'intelligence'], ['Cleric', 'wisdom']])(
    '%s favors its primary stat while retaining health and mana utility', (className, primary) => {
        expect(earnedGearScore(gear('main', { [primary]: 8 }), className)).toBe(8);
        expect(earnedGearScore(gear('health', { vitality: 4 }), className)).toBe(4);
        expect(earnedGearScore(gear('mana', { intelligence: 4 }), className)).toBeGreaterThan(0);
    });

test('paired accessories choose the weaker actual slot, not always the first', () => {
    expect(plan([gear('new', { intelligence: 4 }, { slot: 'ring', type: 'ACCESSORY' })], {
        ring1: gear('strong', { intelligence: 8 }, { slot: 'ring' }),
        ring2: gear('weak', { intelligence: 1 }, { slot: 'ring' })
    })).toMatchObject({ slot: 'ring2', previousId: 'weak' });
});

test('socketed gem stats are included and a tie never churns equipped items', () => {
    const current = gear('socketed', { damage: 1 }, { gems: [{ stats: { damage: 3 } }] });
    expect(plan([gear('tie', { damage: 4 })], { mainHand: current })).toBeNull();
    expect(plan([gear('better', { damage: 5 })], { mainHand: current })?.gain).toBe(4);
});

test.each([
    { level: 31 }, { type: 'QUEST' }, { type: 'GEM' }, { type: 'MATERIAL' },
    { id: 'chronicle-item-fragment' }, { slot: 'unsupported' }, { stack: 2 }, { maxStack: 20 },
    { stats: { damage: NaN } }, { stats: { unmodeled: 100 } }, { stats: null },
    { setId: 'special' }, { uniqueEffect: 'special' }, { gems: [{}] }, { gems: {} }
])('cannot upgrade with ineligible or unmodeled data: %j', fields => {
    expect(plan([gear('new', { damage: 100 }, fields)], { mainHand: gear('old', { damage: 1 }) })).toBeNull();
});

test('never strips special effects or reuses an already worn identity', () => {
    expect(plan([gear('new', { damage: 100 })], {
        mainHand: gear('old', { damage: 1 }, { uniqueEffect: 'needed' }) })).toBeNull();
    expect(plan([gear('old', { damage: 100 })], { mainHand: gear('old', { damage: 1 }) })).toBeNull();
});

test('empty slot filling stays separate and unsupported builds fail closed', () => {
    expect(plan([gear('new', { damage: 100 })], {})).toBeNull();
    expect(() => plan([], {}, 'Unknown')).toThrow('No earned equipment build');
});
