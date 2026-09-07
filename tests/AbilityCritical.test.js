import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import { getCriticalChance, rollOfflineCriticalDamage } from '../src/core/AbilityCritical.js';

afterEach(() => jest.restoreAllMocks());

const catalog = JSON.parse(readFileSync('server/internal/game/testdata/talent_critical.json', 'utf8'));
const economy = JSON.parse(readFileSync('server/internal/game/testdata/talent_economy.json', 'utf8'));
test.each(Object.entries(catalog))('%s critical metadata matches the server-validated 40-talent contract', (className, expected) => {
    for (let number = 1; number <= 40; number++) {
        let chance = expected.generic[number] || 0;
        let skill = '';
        if (number <= 26 && number % 2 === 0) {
            chance = expected.technique;
            if (chance) skill = economy[className].skills[number / 2 - 1];
        }
        const actual = CONSTANTS.PASSIVE_TALENTS[className][number - 1].criticalChance || {};
        expect({ chance: actual.chance || 0, skill: actual.skill || '' }).toEqual({ chance, skill });
    }
});

test.each([
    ['baseline', 'Rogue', 'Backstab', {}, .12, .12],
    ['one Technique', 'Rogue', 'Backstab', { ROG_04: 1 }, .12, .14],
    ['five Technique', 'Rogue', 'Backstab', { ROG_04: 5 }, .12, .22],
    ['unrelated Technique', 'Rogue', 'Backstab', { ROG_02: 5 }, .12, .12],
    ['no Technique on basics', 'Rogue', '', { ROG_04: 5 }, .12, .12],
    ['generic basics', 'Rogue', '', { ROG_32: 5, ROG_39: 5 }, .12, .37],
    ['stacked skill', 'Rogue', 'Backstab', { ROG_04: 5, ROG_32: 5, ROG_39: 5 }, .12, .47],
    ['Fighter', 'Fighter', 'Whirlwind', { FTR_39: 5 }, .12, .22],
    ['Wizard', 'Wizard', 'Fireball', { WIZ_39: 5 }, .12, .22],
    ['cross-class', 'Cleric', 'Radiant Strike', { WIZ_39: 5 }, .12, .12],
    ['invalid ranks', 'Rogue', 'Backstab', { ROG_04: -1, ROG_99: 5 }, .12, .12],
    ['capped legacy duplicate', 'Rogue', 'Backstab', { ROG_4: 99, ROG_04: 2 }, .12, .22],
    ['capped chance', 'Rogue', 'Backstab', { ROG_04: 5 }, .95, 1],
    ['negative equipment', 'Rogue', 'Backstab', { ROG_04: 5 }, -1, .1],
    ['nonfinite equipment', 'Rogue', 'Backstab', { ROG_04: 5 }, NaN, .1]
])('%s critical chance matches server rank/identity policy', (_, subType, skill, talentRanks, equipment, expected) => {
    const source = { subType, talentRanks: Object.freeze(talentRanks), stats: { critChanceBonus: equipment } };
    expect(getCriticalChance(source, skill)).toBeCloseTo(expected, 10);
});

test('all Rogue Technique and generic critical descriptions match their numeric bonus', () => {
    for (const [className, talents] of Object.entries(CONSTANTS.PASSIVE_TALENTS)) {
        for (const talent of talents) {
            const bonus = talent.criticalChance;
            if (!bonus) continue;
            expect(talent.desc).toContain(`+${bonus.chance * 100}%`);
            expect(talent.desc).toMatch(/crit(?:ical)? chance/);
            if (bonus.skill) {
                expect(className).toBe('Rogue');
                expect(talent.desc).toContain(bonus.skill);
                expect(talent.desc).not.toContain('range/AoE');
                expect(talent.abilityEconomy).toEqual({ skill: bonus.skill, cdr: .03 });
            }
        }
    }
    expect(CONSTANTS.PASSIVE_TALENTS.Rogue.filter(talent => talent.criticalChance)).toHaveLength(15);
    expect(CONSTANTS.PASSIVE_TALENTS.Rogue[31].criticalChance.chance).toBe(.03);
    expect(CONSTANTS.PASSIVE_TALENTS.Rogue[38].criticalChance.chance).toBe(.02);
});

test('guaranteed and rolled critical damage share one multiplier', () => {
    jest.spyOn(Math, 'random').mockReturnValue(.5);
    const source = { meshType: 'Rogue', stats: { critChanceBonus: 1 }, talentRanks: { ROG_04: 5 } };
    expect(rollOfflineCriticalDamage(source, 100, 'Backstab', true)).toEqual({ amount: 200, critical: true });
    expect(rollOfflineCriticalDamage(source, 0, 'Backstab', true)).toEqual({ amount: 0, critical: false });
});

test.each([{ isMultiplayer: true }, { isRemote: true }, { gameEngine: { isMultiplayer: true } }])('does not predict authoritative damage for %p', flags => {
    const random = jest.spyOn(Math, 'random');
    expect(rollOfflineCriticalDamage({ ...flags, stats: { critChanceBonus: 1 } }, 100, 'Fireball', true))
        .toEqual({ amount: 100, critical: false });
    expect(random).not.toHaveBeenCalled();
});
