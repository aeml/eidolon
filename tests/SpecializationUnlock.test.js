import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

function setup(level = 9) {
    document.body.innerHTML = '<div id="skill-tree-window" style="display:none"><div id="skill-tree-content"></div></div>';
    const player = { id: 'leveling-player', level, subType: 'Fighter', selectedBranch: '' };
    const ui = new SkillTreeUI({ getLastPlayer: () => player });
    return { ui, player };
}

test('level 9 has no notice; level 10 gets one stable actionable notice until specialization chosen', () => {
    const { ui, player } = setup();
    ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).toBeNull();
    player.level = 10;
    ui.updateSpecializationNotice(player);
    const notice = document.querySelector('.specialization-unlock-notice');
    expect(notice.textContent).toContain('Level 10 unlocked specializations');
    for (let i = 0; i < 10; i++) ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).toBe(notice);
    ui.skillTreeMode = 'talents';
    notice.querySelector('button').click();
    expect(ui.isOpen).toBe(true);
    expect(ui.skillTreeMode).toBe('skills');
    expect(document.querySelectorAll('[data-desktop-build-key^="branch:"]')).toHaveLength(3);
    expect(document.activeElement.dataset.desktopBuildKey).toBe('branch:A');
    player.selectedBranch = 'B';
    ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).toBeNull();
    ui.dispose();
});

test('returning unspecialized characters get guidance and retired sessions remove it', () => {
    const { ui, player } = setup(55);
    ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).not.toBeNull();
    ui.dispose();
    expect(document.querySelector('.specialization-unlock-notice')).toBeNull();
    ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).toBeNull();
});

test('existing specialized characters have no unnecessary notice', () => {
    const { ui, player } = setup(10);
    player.selectedBranch = 'A';
    ui.updateSpecializationNotice(player);
    expect(document.querySelector('.specialization-unlock-notice')).toBeNull();
    ui.dispose();
});


test('retired specialization reminder cannot reopen a new session window', () => {
    const { ui, player } = setup(10);
    ui.updateSpecializationNotice(player);
    const oldButton = document.querySelector('.specialization-unlock-notice button');
    ui.dispose();
    ui.toggle = jest.fn();
    oldButton.click();
    expect(ui.toggle).not.toHaveBeenCalled();
});
