import { selectFighterDungeonSkill, shouldUseHuntPrimary } from './dungeonCombatControls.js';

const fighter = {
    classAbility: 'Charge', isCharging: false, dead: false, distance: 8, attackRange: 8.5,
    mana: 100, hotbar: ['Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar'], cooldowns: {}
};

describe('full dungeon ordinary defensive controls', () => {
    test('full runs use available defenses before their damage skills', () => {
        expect(selectFighterDungeonSkill(fighter, true)).toEqual({ skill: 'Iron Fortress', key: '3' });
        expect(selectFighterDungeonSkill({ ...fighter, cooldowns: { 'Iron Fortress': 30 } }, true))
            .toEqual({ skill: 'Guardian Roar', key: '4' });
        expect(selectFighterDungeonSkill({ ...fighter, cooldowns: { 'Iron Fortress': 30, 'Guardian Roar': 10 } }, true))
            .toEqual({ skill: 'Whirlwind', key: '1' });
    });
    test('existing short route keeps its damage-skill selection', () => {
        expect(selectFighterDungeonSkill(fighter)).toEqual({ skill: 'Whirlwind', key: '1' });
    });
    test.each([{ isCharging: true }, { dead: true }, { classAbility: 'Fireball' }, { distance: 9 }, { mana: 0 }, { mana: undefined }])(
        'does not attempt an unavailable cast: %j', override => {
            expect(selectFighterDungeonSkill({ ...fighter, ...override }, true)).toBeNull();
        }
    );
    test('honors actual hotbar placement, mana and cooldowns', () => {
        expect(selectFighterDungeonSkill({ ...fighter, mana: 25, hotbar: ['Shield Slam'] }, true))
            .toEqual({ skill: 'Shield Slam', key: '1' });
        expect(selectFighterDungeonSkill({ ...fighter, mana: 20, manaCostReduction: 0.5 }, true))
            .toEqual({ skill: 'Iron Fortress', key: '3' });
        expect(selectFighterDungeonSkill({ ...fighter, hotbar: [] }, true)).toBeNull();
    });
});

test('earned melee controls honor resolved talent/equipment costs', () => {
    expect(selectFighterDungeonSkill({ ...fighter, mana: 24, hotbar: ['Whirlwind'],
        skillCosts: { Whirlwind: 24 } }, true)).toEqual({ skill: 'Whirlwind', key: '1' });
    expect(selectFighterDungeonSkill({ ...fighter, mana: 23, hotbar: ['Whirlwind'],
        skillCosts: { Whirlwind: 24 } }, true)).toBeNull();
});
const primary = { ability: 'Charge', cooldown: 0, dead: false, distance: 10, attackRange: 4, castRange: 18 };
test.each([[4, false], [6, false], [6.1, true], [18, true], [19, false]])(
    'Charge at distance %s preserves contact basic attacks and respects range', (distance, expected) => {
        expect(shouldUseHuntPrimary({ ...primary, distance })).toBe(expected);
    }
);
test('ranged primaries retain close-range casts; cooldown/death/unknown targets cannot cast', () => {
    expect(shouldUseHuntPrimary({ ...primary, ability: 'Fireball', distance: 2 })).toBe(true);
    for (const override of [{ cooldown: 1 }, { dead: true }, { distance: undefined }]) {
        expect(shouldUseHuntPrimary({ ...primary, ...override })).toBe(false);
    }
});

test.each([[14.5, false], [18, false], [21, true], [29, false]])(
    'party Charge reserve avoids short post-telegraph gaps at %s units', (distance, expected) => {
        expect(shouldUseHuntPrimary({ ...primary, distance, castRange: 28 }, { minimumChargeDistance: 18 })).toBe(expected);
    }
);
test('party Charge reserve does not suppress ranged casts or alter default hunt decisions', () => {
    expect(shouldUseHuntPrimary({ ...primary, ability: 'Fireball', distance: 2 }, { minimumChargeDistance: 18 })).toBe(true);
    expect(shouldUseHuntPrimary(primary)).toBe(true);
});
