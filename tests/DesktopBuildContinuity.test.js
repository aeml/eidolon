import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

let ui, player;
const rune = () => document.querySelector('button[data-rune-id="charge_momentum"]');
const skill = () => document.querySelector('.skill-branch .skill-node');
const tab = name => [...document.querySelectorAll('#skill-tree-content button')].find(n => n.textContent === name);
beforeEach(() => {
    document.body.innerHTML = '<button id="outside">Outside</button><div id="skill-tree-window" style="display:flex"><div id="skill-tree-content"></div></div>';
    player = { id: 'builder', subType: 'Fighter', level: 100, skillPoints: 5, unlockedSkills: [], skillRunes: {} };
    ui = new SkillTreeUI({ getLastPlayer: () => player });
    ui.onUnlockSkill = jest.fn(); ui.onSelectRune = jest.fn();
});
afterEach(() => ui.dispose());

test('rune acknowledgement retains logical focus, reading position and authoritative selected state', () => {
    ui.skillTreeMode = 'runes'; ui.renderSkillTree('Fighter');
    rune().focus(); ui.skillTreeContent.scrollTop = 230;
    player.skillRunes.Charge = 'charge_momentum'; ui.renderSkillTree('Fighter');
    expect(document.activeElement).toBe(rune());
    expect(rune().getAttribute('aria-pressed')).toBe('true');
    expect(ui.skillTreeContent.scrollTop).toBe(230);
    expect(ui.onSelectRune).not.toHaveBeenCalled();
});

test('an unrelated skill update preserves the current action without activating it', () => {
    ui.renderSkillTree('Fighter'); skill().focus(); player.skillPoints++;
    ui.renderSkillTree('Fighter'); expect(document.activeElement).toBe(skill());
    expect(ui.onUnlockSkill).not.toHaveBeenCalled();
});

test('a learned action moves focus to the active tab rather than losing it into the game', () => {
    ui.renderSkillTree('Fighter'); skill().focus(); player.unlockedSkills = ['Whirlwind'];
    ui.renderSkillTree('Fighter'); expect(skill().disabled).toBe(true);
    expect(document.activeElement).toBe(tab('Skills'));
});

test('tab activation keeps focus on the chosen tab and starts its reading position at the top', () => {
    ui.renderSkillTree('Fighter'); ui.skillTreeContent.scrollTop = 340;
    tab('Runes').focus(); tab('Runes').click();
    expect(document.activeElement).toBe(tab('Runes')); expect(ui.skillTreeContent.scrollTop).toBe(0);
});

test('a redraw does not steal focus from another window', () => {
    ui.renderSkillTree('Fighter'); document.getElementById('outside').focus();
    ui.renderSkillTree('Fighter'); expect(document.activeElement.id).toBe('outside');
});

test.each(['redraw', 'tab', 'close', 'dispose', 'character'])('retired skill controls cannot submit after %s', reason => {
    ui.renderSkillTree('Fighter'); const old = skill();
    if (reason === 'redraw') ui.renderSkillTree('Fighter');
    if (reason === 'tab') tab('Runes').click();
    if (reason === 'close') ui.close();
    if (reason === 'dispose') ui.dispose();
    if (reason === 'character') player = { ...player, id: 'replacement' };
    old.click(); expect(ui.onUnlockSkill).not.toHaveBeenCalled();
});

test('a detached rune click cannot modify a later view, while the current rune still submits once', () => {
    ui.skillTreeMode = 'runes'; ui.renderSkillTree('Fighter'); const old = rune();
    ui.renderSkillTree('Fighter'); old.click(); expect(ui.onSelectRune).not.toHaveBeenCalled();
    rune().click(); expect(ui.onSelectRune).toHaveBeenCalledTimes(1);
    expect(ui.onSelectRune).toHaveBeenCalledWith('Charge', 'charge_momentum'); expect(player.skillRunes).toEqual({});
});

test.each(['branch', 'talent'])('retired %s choices are also guarded before their original handlers', kind => {
    ui.onSelectBranch = jest.fn(); ui.onUnlockTalent = jest.fn();
    if (kind === 'talent') ui.skillTreeMode = 'talents';
    ui.renderSkillTree('Fighter');
    const old = document.querySelector(kind === 'talent' ? '[data-talent-id]' : '[data-desktop-build-key="branch:B"]');
    ui.renderSkillTree('Fighter'); old.click();
    expect(ui.onSelectBranch).not.toHaveBeenCalled(); expect(ui.onUnlockTalent).not.toHaveBeenCalled();
});

test('changing character clears reading state and cannot restore the previous action focus', () => {
    ui.skillTreeMode = 'runes'; ui.renderSkillTree('Fighter'); rune().focus(); ui.skillTreeContent.scrollTop = 250;
    player = { ...player, id: 'replacement' }; ui.renderSkillTree('Fighter');
    expect(ui.skillTreeContent.scrollTop).toBe(0); expect(document.activeElement).toBe(tab('Runes'));
});
