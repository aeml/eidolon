import { selectEarnedDungeonSupport } from './earnedDungeonSupport.js';

const build = (className = 'Rogue') => {
    const skill = className === 'Rogue' ? 'Poison Coating' : 'Guardian Embrace';
    return { className, healthRatio: .75, targetValid: true, distance: 8, attackRange: 16,
        mana: 100, skillCosts: { [skill]: 40 }, hotbar: [null, skill], unlockedSkills: [skill],
        cooldowns: {}, sinceCastMs: 1000 };
};
test.each(['Rogue', 'Cleric'])('%s selects a paid unlocked support skill without changing state', className => {
    const state = build(className), before = JSON.stringify(state);
    expect(selectEarnedDungeonSupport(state)).toEqual({ key: '2', skill: state.hotbar[1] });
    expect(JSON.stringify(state)).toBe(before);
    expect(selectEarnedDungeonSupport({ ...state, mana: 40 })).not.toBeNull();
});
test.each(['Rogue', 'Cleric'])('%s does not refresh an active effect', className => {
    const effect = className === 'Rogue' ? 'poisonCoating' : 'guardianEmbrace';
    expect(selectEarnedDungeonSupport({ ...build(className), [`${effect}Active`]: true })).toBeNull();
    expect(selectEarnedDungeonSupport({ ...build(className), [`${effect}Timer`]: .1 })).toBeNull();
});
test('healthy Clerics conserve mana, while Rogues can prepare poison for an in-range target', () => {
    expect(selectEarnedDungeonSupport({ ...build('Cleric'), healthRatio: .85 })).toBeNull();
    expect(selectEarnedDungeonSupport({ ...build(), healthRatio: 1 })).not.toBeNull();
});
test.each([
    { dead: true }, { targetValid: false }, { className: 'Wizard' }, { className: 'Fighter' },
    { className: 'Unknown' }, { healthRatio: 0 }, { healthRatio: NaN }, { distance: 17 },
    { distance: NaN }, { distance: -1 }, { attackRange: 0 }, { attackRange: NaN },
    { sinceCastMs: 549 }, { sinceCastMs: NaN }, { mana: 39 }, { mana: NaN },
    { skillCosts: {} }, { skillCosts: { 'Poison Coating': NaN } },
    { skillCosts: { 'Poison Coating': -1 } }, { unlockedSkills: [] }, { hotbar: [] },
    { hotbar: [null, null, null, null, 'Poison Coating'] },
    { cooldowns: { 'Poison Coating': 1 } }, { cooldowns: { 'Poison Coating': NaN } }
])('unsupported or unavailable state rejects the input: %j', change => {
    expect(selectEarnedDungeonSupport({ ...build(), ...change })).toBeNull();
});
test('missing state never invents an available cast', () => {
    expect(selectEarnedDungeonSupport(null)).toBeNull();
});
