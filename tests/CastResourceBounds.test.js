import { castResourceBounds, restedCastResourceBounds, sanctuaryRecoveryBounds } from './castResourceBounds.js';

test('full mana still proves exact payment', () => {
    expect(castResourceBounds({ mana: 100, maxMana: 100, manaRegen: 1.09 }, 30, 150))
        .toEqual({ minimum: 70, maximum: 70 });
});
test('a depleted bar permits only bounded intervening regen', () => {
    expect(castResourceBounds({ mana: 80, maxMana: 200, manaRegen: 1.09 }, 21, 150))
        .toEqual({ minimum: 59, maximum: 61 });
});
test('a capacity increase from training is not mistaken for mana spent', () => {
    const bounds = castResourceBounds({ mana: 1670, maxMana: 1750, manaRegen: 1.09 }, 21, 250);
    expect(bounds).toEqual({ minimum: 1649, maximum: 1651 });
    expect(1670 - 30).toBeLessThan(bounds.minimum);
    expect(1670).toBeGreaterThan(bounds.maximum);
});
test('zero regen never permits a payment discrepancy', () => {
    expect(castResourceBounds({ mana: 80, maxMana: 100, manaRegen: 0 }, 21, 5000))
        .toEqual({ minimum: 59, maximum: 59 });
});
test.each([NaN, Infinity, -1])('invalid elapsed %s is rejected', elapsed => {
    expect(() => castResourceBounds({ mana: 80, maxMana: 100, manaRegen: 1 }, 21, elapsed)).toThrow();
});
test('insufficient mana cannot produce passing bounds', () => {
    expect(() => castResourceBounds({ mana: 20, maxMana: 100, manaRegen: 1 }, 21, 1)).toThrow();
});

const sanctuary = { mana: 80, maxMana: 110, bank: 5, zone: 'lanternhold' };
test('sanctuary cast bounds use exact earned seconds and ten percent recovery', () => {
    expect(restedCastResourceBounds(sanctuary, { ...sanctuary, bank: 5.25 }, 30))
        .toEqual({ minimum: 50, maximum: 53 });
});
test('rested full mana proves exact cost even across recovery ticks', () => {
    expect(restedCastResourceBounds({ ...sanctuary, mana: 110 }, { ...sanctuary, bank: 6.2 }, 21))
        .toEqual({ minimum: 89, maximum: 89 });
});
test('sanctuary bounds cannot explain a free cast or overcharge', () => {
    const bounds = restedCastResourceBounds(sanctuary, { ...sanctuary, bank: 5.25 }, 21);
    expect(80).toBeGreaterThan(bounds.maximum);
    expect(50).toBeLessThan(bounds.minimum);
});
test.each([{ bank: 4 }, { bank: 7200 }, { bank: NaN }, { maxMana: 120 }, { zone: '' }, { zone: 'different' }])(
    'rejects a noncomparable sanctuary interval %j', change => {
        expect(() => restedCastResourceBounds(sanctuary, { ...sanctuary, ...change }, 30)).toThrow();
    });

test('continuous town recovery has only sub-point observation uncertainty', () => {
    expect(sanctuaryRecoveryBounds(70, 110, 1.25)).toEqual({ minimum: 83, maximum: 84 });
});
test('one disconnect can discard one whole point across the split interval', () => {
    expect(sanctuaryRecoveryBounds(70, 110, 1.25, 1)).toEqual({ minimum: 82, maximum: 84 });
});
test('no earned time cannot heal and legitimate recovery caps at maximum', () => {
    expect(sanctuaryRecoveryBounds(70, 110, 0, 1)).toEqual({ minimum: 70, maximum: 70 });
    expect(sanctuaryRecoveryBounds(70, 110, 10, 1)).toEqual({ minimum: 110, maximum: 110 });
});
test.each([-1, NaN, Infinity])('invalid recovery time %s fails closed', elapsed => {
    expect(() => sanctuaryRecoveryBounds(70, 110, elapsed)).toThrow();
});
