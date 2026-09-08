import { selectEarnedClericHeal } from './clericEarnedControls.js';

const state = { className: 'Cleric', healthRatio: .4, mana: 25, healCost: 25,
    hotbar: ['Healing Light'], unlockedSkills: ['Healing Light'], cooldowns: {} };
test('earned Cleric selects a paid unlocked heal at low health', () => {
    expect(selectEarnedClericHeal(state)).toEqual({ key: '1', skill: 'Healing Light' });
    expect(selectEarnedClericHeal({ ...state, hotbar: [null, 'Healing Light'] }).key).toBe('2');
});
test.each([{ dead: true }, { className: 'Wizard' }, { healthRatio: .65 }, { healthRatio: NaN },
    { mana: 24 }, { mana: NaN }, { healCost: NaN }, { unlockedSkills: [] }, { hotbar: [] },
    { cooldowns: { 'Healing Light': 1 } }, { hotbar: [null, null, null, null, 'Healing Light'] }])(
    'unavailable or unnecessary healing is not attempted: %j', change => {
        expect(selectEarnedClericHeal({ ...state, ...change })).toBeNull();
    });
