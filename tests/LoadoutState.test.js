import { jest } from '@jest/globals';
import { applyLoadoutState } from '../src/core/LoadoutState.js';

test.each(['applied', 'restored'])('%s state synchronizes build before skill choices and keeps depleted resources', mode => {
    const engine = { player: { selectedBranch: 'B', health: 4, mana: 1 }, uiManager: { assignSkillToSlot: jest.fn() }, abilityController: { inputBuffer: [{}] } };
    const result = { [mode]: true, hotbar: ['', 'Whirlwind', '', ''], build: { branch: 'A', talentRanks: { FTR_01: 1 }, skillRunes: {} }, unlockedSkills: ['Charge', 'Whirlwind'], talentPoints: 5, gold: 100 };
    expect(applyLoadoutState(engine, result)).toBe(true);
    expect(engine.player).toMatchObject({ selectedBranch: 'A', health: 4, mana: 1, gold: 100, customHotbar: true, hotbar: [null, 'Whirlwind', null, null] });
    expect(engine.abilityController.inputBuffer).toEqual([]);
    expect(engine.uiManager.assignSkillToSlot).toHaveBeenCalledTimes(4);
    engine.player.talentRanks.FTR_01 = 9;
    expect(result.build.talentRanks.FTR_01).toBe(1);
});

test('list/save acknowledgements do not overwrite a manually arranged current bar', () => {
    const engine = { player: { hotbar: ['Charge'] } };
    expect(applyLoadoutState(engine, { success: true, hotbar: [] })).toBe(false);
    expect(engine.player.hotbar).toEqual(['Charge']);
});

test('intentional empty restored bars remain explicit, including a pending-save applied state', () => {
    const engine = { player: {} };
    applyLoadoutState(engine, { applied: true, success: false, hotbar: ['', '', '', ''] });
    expect(engine.player.hotbar).toEqual([null, null, null, null]);
    expect(engine.player.customHotbar).toBe(true);
});
