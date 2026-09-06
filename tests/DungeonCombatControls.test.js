import { selectFighterDungeonSkill } from './dungeonCombatControls.js';

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
