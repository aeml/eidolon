import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';
import { CONSTANTS } from '../src/core/Constants.js';

let ui, player;
beforeEach(() => {
    document.body.innerHTML = '<div id="skill-tree-window"><button id="btn-close-skills">Close</button><div id="skill-tree-content"></div></div>';
    player = { level: 100, skillPoints: 20, selectedBranch: 'A', unlockedSkills: [], skillRunes: {} };
    ui = new SkillTreeUI({ isMobile: false, getLastPlayer: () => player });
    ui.onUnlockSkill = jest.fn(); ui.onSelectRune = jest.fn();
});
afterEach(() => ui.dispose());

test.each(['Fighter', 'Rogue', 'Wizard', 'Cleric'])('%s skill choices expose native keyboard actions without changing the build', classType => {
    ui.renderSkillTree(classType);
    const cards = [...document.querySelectorAll('.skill-branch .skill-node')];
    expect(cards).toHaveLength(12);
    for (const card of cards) {
        expect(card.tagName).toBe('BUTTON'); expect(card.type).toBe('button'); expect(card.disabled).toBe(false);
    }
    cards[0].click();
    expect(ui.onUnlockSkill).toHaveBeenCalledWith(CONSTANTS.SKILL_TREES[classType].BranchA.Tier2.name);
    expect(player.unlockedSkills).toEqual([]);
});

test.each(['level', 'points', 'learned'])('unavailable skill action remains disabled: %s', reason => {
    if (reason === 'level') player.level = 1;
    if (reason === 'points') player.skillPoints = 0;
    if (reason === 'learned') player.unlockedSkills = [CONSTANTS.SKILL_TREES.Fighter.BranchA.Tier2.name];
    ui.renderSkillTree('Fighter');
    const card = document.querySelector('.skill-branch .skill-node');
    expect(card.tagName).toBe('BUTTON'); expect(card.disabled).toBe(true);
    card.click(); expect(ui.onUnlockSkill).not.toHaveBeenCalled();
});

test.each(['Fighter', 'Rogue', 'Wizard', 'Cleric'])('%s rune buttons report authoritative selection and retain level/skill gates', classType => {
    ui.skillTreeMode = 'runes'; ui.renderSkillTree(classType);
    const rune = CONSTANTS.SKILL_RUNES[classType].find(row => row.skill === CONSTANTS.SKILL_TREES[classType].Tier1.name);
    let button = document.querySelector(`[data-rune-id="${rune.id}"]`);
    expect(button?.tagName).toBe('BUTTON'); expect(button.type).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false'); button.click();
    expect(ui.onSelectRune).toHaveBeenLastCalledWith(rune.skill, rune.id); expect(player.skillRunes).toEqual({});
    player.skillRunes[rune.skill] = rune.id; ui.renderSkillTree(classType);
    button = document.querySelector(`[data-rune-id="${rune.id}"]`);
    expect(button.getAttribute('aria-pressed')).toBe('true'); button.click();
    expect(ui.onSelectRune).toHaveBeenLastCalledWith(rune.skill, ''); expect(player.skillRunes[rune.skill]).toBe(rune.id);
    player.level = 1; ui.renderSkillTree(classType);
    button = document.querySelector(`[data-rune-id="${rune.id}"]`);
    expect(button.disabled).toBe(true); ui.onSelectRune.mockClear(); button.click();
    expect(ui.onSelectRune).not.toHaveBeenCalled();
    player.level = 100; ui.renderSkillTree(classType);
    const lockedRune = CONSTANTS.SKILL_RUNES[classType].find(row => row.skill !== rune.skill);
    const locked = document.querySelector(`[data-rune-id="${lockedRune.id}"]`);
    expect(locked.disabled).toBe(true); locked.click(); expect(ui.onSelectRune).not.toHaveBeenCalled();
});
