import fs from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import { getAbilityEconomyBonus, getAbilityManaCost, getAbilityCooldown } from '../src/core/AbilityEconomy.js';

const catalog = JSON.parse(fs.readFileSync('server/internal/game/testdata/talent_economy.json', 'utf8'));
test.each(Object.entries(catalog))('%s prediction metadata matches the shared server contract', (className, expected) => {
    for (let n = 1; n <= 40; n++) {
        let bonus = expected.generic[n] || {};
        if (n <= 26 && n % 2 === 0) bonus = { skill: expected.skills[n / 2 - 1], cdr: 0.03,
            manaReduction: expected.techniqueManaOverrides?.[n] ?? expected.techniqueMana };
        const actual = CONSTANTS.PASSIVE_TALENTS[className][n - 1].abilityEconomy || {};
        expect({ skill: actual.skill || '', cdr: actual.cdr || 0, manaReduction: actual.manaReduction || 0 })
            .toEqual({ skill: bonus.skill || '', cdr: bonus.cdr || 0, manaReduction: bonus.manaReduction || 0 });
    }
});

test('discounts compose with equipment rounding and never affect an unrelated skill or class', () => {
    const player = { subType: 'Wizard', stats: { manaCostReduction: 0.1, cooldownReduction: 0.2 },
        talentRanks: { WIZ_04: 5, CLR_27: 5 } };
    expect(getAbilityManaCost(player, 'Flame Whip', 35)).toBe(27); // floor(35*.9)=31; floor(31*.9)=27
    expect(getAbilityManaCost(player, 'Teleport', 40)).toBe(36);
    expect(getAbilityManaCost(player, 'Free spell', 0)).toBe(0);
    expect(getAbilityCooldown(player, 'Flame Whip', 10)).toBeCloseTo(6.8);
    expect(getAbilityCooldown(player, 'Teleport', 12)).toBeCloseTo(9.6);
});

test('specific and general skill cooldown reductions add before composing with global CDR', () => {
    const player = { subType: 'Wizard', stats: { cooldownReduction: 0.2 }, talentRanks: { WIZ_20: 5, WIZ_30: 5 } };
    expect(getAbilityEconomyBonus(player, 'Teleport').cdr).toBeCloseTo(0.4);
    expect(getAbilityCooldown(player, 'Teleport', 12)).toBeCloseTo(5.76);
    expect(getAbilityCooldown(player, 'Teleport', 0)).toBe(0);
});
