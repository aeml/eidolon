import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import { getRogueAbilityDamageMultiplier, resolveRogueAbilityDamage, ROGUE_DAMAGE_PROFILES } from '../src/skills/rogueAbilityDamage.js';

const contract = JSON.parse(readFileSync('server/internal/game/testdata/rogue_damage.json', 'utf8'));
const source = (talentRanks = {}, other = {}) => ({ meshType: 'Rogue', talentRanks,
    stats: { damage: 101, dexterity: 11 }, ...other });

test('all six damaging Masteries match the authoritative contract and preserved IDs', () => {
    expect(Object.keys(ROGUE_DAMAGE_PROFILES)).toEqual(contract.map(p => p.skill));
    for (const { skill, id, base, dexterity, weapon } of contract) {
        expect(ROGUE_DAMAGE_PROFILES[skill]).toEqual({ base, dexterity, weapon });
        expect(CONSTANTS.PASSIVE_TALENTS.Rogue.find(t => t.id === id).abilityDamage).toEqual({ skill, damage: .04 });
    }
});

test.each(contract)('$skill rank zero through five composes with generic skill training once', ({ skill, id }) => {
    for (let rank = 0; rank <= 5; rank++) {
        expect(getRogueAbilityDamageMultiplier(source({ [id]: rank, ROG_38: 5 }), skill)).toBeCloseTo(1.1 + .04 * rank, 8);
    }
});

test('legacy aliases are clamped, not doubled or changed in saved ranks', () => {
    const ranks = { ROG_01: 2, ROG_1: 99, ROG_38: 5 };
    expect(getRogueAbilityDamageMultiplier(source(ranks), 'Piercing Throw')).toBeCloseTo(1.3);
    expect(ranks).toEqual({ ROG_01: 2, ROG_1: 99, ROG_38: 5 });
    for (const rank of [-1, Infinity, NaN, 'invalid']) {
        expect(getRogueAbilityDamageMultiplier(source({ ROG_01: rank }), 'Piercing Throw')).toBe(1);
    }
    expect(getRogueAbilityDamageMultiplier(source({ ROG_01: 2.9 }), 'Piercing Throw')).toBe(1.08);
});

test('unrelated Masteries, wounds, utility skills and other classes do not get this bonus', () => {
    expect(getRogueAbilityDamageMultiplier(source({ ROG_03: 5, ROG_13: 5 }), 'Piercing Throw')).toBe(1);
    for (const skill of ['Poison Coating', 'Serrated Edges', 'Shadow Lunge', 'Tripwire', 'Smoke Bomb', 'unknown']) {
        expect(getRogueAbilityDamageMultiplier(source({ ROG_38: 5 }), skill)).toBe(1);
    }
    expect(getRogueAbilityDamageMultiplier(source({ ROG_01: 5 }, { meshType: 'Wizard' }), 'Piercing Throw')).toBe(1);
});

test.each([{ isRemote: true }, { isMultiplayer: true }, { gameEngine: { isMultiplayer: true } }])(
    'authoritative actors never receive an extra client training multiplier: %p', flags => {
        expect(getRogueAbilityDamageMultiplier(source({ ROG_01: 5, ROG_38: 5 }, flags), 'Piercing Throw')).toBe(1);
    });

test('integer Dexterity terms and weapon scaling truncate at the server boundaries', () => {
    expect(resolveRogueAbilityDamage(source(), 'Piercing Throw')).toBe(31);
    expect(resolveRogueAbilityDamage(source({ ROG_01: 5 }), 'Piercing Throw')).toBe(37);
    expect(resolveRogueAbilityDamage(source({ ROG_03: 5 }), 'Backstab')).toBe(181);
});
