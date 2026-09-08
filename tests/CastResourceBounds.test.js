import { castResourceBounds } from './castResourceBounds.js';

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
