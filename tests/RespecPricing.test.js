import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

const prices = JSON.parse(readFileSync('server/internal/game/testdata/respec_prices.json', 'utf8'));
const labels = { talents: 'Reset Talents', skills: 'Reset Skills', both: 'Reset Both' };
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label);
afterEach(() => {
    document.getElementById('btn-close-respec-menu')?.click();
    document.body.innerHTML = '';
});

test.each(prices)('level $level shows actual authoritative respec prices', entry => {
    const sendRespec = jest.fn();
    const ui = new SkillTreeUI({ getLastPlayer: () => ({ level: entry.level, gold: 20000 }), sendRespec });
    ui.showRespecMenu();
    for (const [type, label] of Object.entries(labels)) {
        expect(button(label).parentElement.textContent).toContain(`Cost: ${entry[type].toLocaleString()} gold`);
    }
    expect(sendRespec).not.toHaveBeenCalled();
});

test.each(Object.entries(labels))('%s requires the real cost before offering the reset', (type, label) => {
    const player = { level: 20, gold: type === 'both' ? 2999 : 1999 };
    const sendRespec = jest.fn();
    const ui = new SkillTreeUI({ getLastPlayer: () => player, sendRespec });
    ui.showRespecMenu();
    expect(button(label).disabled).toBe(true);
    button(label).click();
    expect(sendRespec).not.toHaveBeenCalled();
    player.gold += 1;
    ui.showRespecMenu();
    expect(button(label).disabled).toBe(false);
    button(label).click();
    expect(sendRespec).toHaveBeenCalledTimes(1);
    expect(sendRespec).toHaveBeenCalledWith(type);
    expect(document.getElementById('respec-menu')).toBeNull();
});
