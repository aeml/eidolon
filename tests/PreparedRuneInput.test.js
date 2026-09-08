import { jest } from '@jest/globals';
import { selectPreparedRune } from './e2e/prepared-rune-input.js';

afterEach(() => { delete window.game; });
const rune = { skill: 'Fireball', id: 'fireball_empowered', name: 'Empowered' };

test.each(['fireball_empowered', undefined, 'fireball_explosive'])('observes existing rune %s before deciding to click', async selected => {
    window.game = { player: { skillRunes: Object.freeze({ Fireball: selected }) } };
    const click = jest.fn(), tab = jest.fn();
    const name = jest.fn(() => ({ click }));
    const parent = jest.fn(() => ({ getByText: name }));
    const skills = { getByRole: jest.fn(() => ({ click: tab })),
        getByText: jest.fn(() => ({ locator: parent })) };
    expect(await selectPreparedRune({ evaluate: (fn, arg) => fn(arg) }, skills, rune))
        .toBe(selected !== rune.id);
    expect(click).toHaveBeenCalledTimes(selected === rune.id ? 0 : 1);
    expect(tab).toHaveBeenCalledTimes(selected === rune.id ? 0 : 1);
    if (selected !== rune.id) {
        expect(skills.getByText).toHaveBeenCalledWith('Fireball', { exact: true });
        expect(name).toHaveBeenCalledWith('Empowered', { exact: true });
    }
    expect(window.game.player.skillRunes.Fireball).toBe(selected);
});
