import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';
import { CONSTANTS } from '../src/core/Constants.js';

describe('phone build reading and deliberate actions', () => {
    let ui, player;
    const button = name => [...document.querySelectorAll('button')].find(b => b.textContent === name);
    beforeEach(() => {
        document.body.innerHTML = '<div id="skill-tree-window" style="display:flex"><div class="skill-tree-header"><button id="btn-close-skills">Close</button></div><div id="skill-tree-content"></div></div>';
        player = { id: 'phone-builder', subType: 'Fighter', level: 100, selectedBranch: 'A', skillPoints: 5,
            unlockedSkills: ['Charge', 'Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar'], talentRanks: {}, skillRunes: {} };
        ui = new SkillTreeUI({ isMobile: true, getLastPlayer: () => player });
        ui.onSelectBranch = jest.fn(); ui.onUnlockTalent = jest.fn(); ui.onResetTalents = jest.fn(); ui.onSelectRune = jest.fn();
        ui.renderSkillTree('Fighter');
    });
    test('tabs stay outside the scroller and branch descriptions do not spend points', () => {
        expect(document.querySelector('.phone-build-tabs')).not.toBeNull();
        expect(ui.skillTreeContent.contains(document.querySelector('.phone-build-tabs'))).toBe(false);
        expect(ui.skillTreeContent.textContent).toContain('automatically');
        document.querySelector('[data-branch="B"] p').click();
        expect(ui.onSelectBranch).not.toHaveBeenCalled();
        document.querySelector('[data-build-action="branch:B"]').click();
        expect(ui.onSelectBranch).toHaveBeenCalledWith('B', expect.any(String));
        expect(player.selectedBranch).toBe('A');
        expect(document.querySelector('[data-build-action="branch:B"]').disabled).toBe(true);
    });
    test('reading position and focused control survive unrelated updates and tab returns', () => {
        const choose = document.querySelector('[data-build-action="branch:B"]');
        choose.focus(); ui.skillTreeContent.scrollTop = 240;
        ui.renderSkillTree('Fighter');
        expect(ui.skillTreeContent.scrollTop).toBe(240);
        expect(document.activeElement.dataset.buildAction).toBe('branch:B');
        button('Talents').click(); ui.skillTreeContent.scrollTop = 90;
        button('Skills').click(); expect(ui.skillTreeContent.scrollTop).toBe(240);
        button('Talents').click(); expect(ui.skillTreeContent.scrollTop).toBe(90);
    });
    test('ranking is explicit, single-flight and never mutates shared talent ranks', () => {
        button('Talents').click();
        const rank = document.querySelector('[data-build-action^="talent:"]');
        const id = rank.dataset.buildAction.slice(7);
        rank.closest('article').querySelector('p').click(); expect(ui.onUnlockTalent).not.toHaveBeenCalled();
        rank.click(); rank.click();
        expect(ui.onUnlockTalent).toHaveBeenCalledTimes(1); expect(player.talentRanks).toEqual({});
        const requestId = ui.onUnlockTalent.mock.calls[0][1];
        ui.handleBuildActionResult({ requestId: 'unrelated', ok: false, message: 'Other error' });
        expect(ui.mobile.pending).not.toBeNull();
        ui.handleBuildActionResult({ requestId, ok: false, message: 'No talent points available.' });
        expect(document.querySelector('.phone-build-feedback').textContent).toBe('No talent points available.');
        document.querySelector(`[data-build-action="talent:${id}"]`).click();
        expect(ui.onUnlockTalent).toHaveBeenCalledTimes(2);
    });
    test('success requires both the matching receipt and authoritative state', () => {
        document.querySelector('[data-build-action="branch:B"]').click();
        const requestId = ui.onSelectBranch.mock.calls[0][1];
        player.selectedBranch = 'B'; ui.renderSkillTree('Fighter');
        expect(ui.mobile.pending).not.toBeNull();
        ui.handleBuildActionResult({ requestId, ok: true });
        expect(ui.mobile.pending).toBeNull();
        expect(document.querySelector('.phone-build-feedback').textContent).toContain('Confirmed');
    });
    test('reset requires confirmation and leaves ranks intact until authoritative update', () => {
        player.talentRanks[CONSTANTS.PASSIVE_TALENTS.Fighter[0].id] = 1;
        button('Talents').click(); button('Reset talents').click();
        expect(ui.onResetTalents).not.toHaveBeenCalled(); button('Cancel reset').click();
        button('Reset talents').click(); button('Confirm reset').click();
        expect(ui.onResetTalents).toHaveBeenCalledWith(expect.any(String));
        expect(Object.values(player.talentRanks)).toEqual([1]);
    });
    test('rune cards have explicit equip actions and retain the old rune until confirmation', () => {
        button('Runes').click();
        const equip = document.querySelector('button[data-build-action^="rune:"]');
        equip.closest('article').querySelector('p').click(); expect(ui.onSelectRune).not.toHaveBeenCalled();
        equip.click(); expect(ui.onSelectRune).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(String));
        expect(player.skillRunes).toEqual({});
    });
    test('reconnect waits for an authoritative build and never replays a lost action', () => {
        document.querySelector('[data-build-action="branch:B"]').click();
        ui.handleBuildConnectionState('reconnecting'); ui.handleBuildConnectionState('connected');
        expect(document.querySelector('[data-build-action="branch:B"]').disabled).toBe(true);
        player.selectedBranch = 'B'; ui.handleBuildSnapshot();
        expect(ui.mobile.pending).toBeNull();
        expect(ui.onSelectBranch).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.phone-build-feedback').textContent).toContain('restored after reconnect');
    });
    test('recreating the UI replaces old navigation rather than duplicating listeners and tabs', () => {
        const replacement = new SkillTreeUI({ isMobile: true, getLastPlayer: () => player });
        replacement.renderSkillTree('Fighter');
        expect(document.querySelectorAll('.phone-build-tabs')).toHaveLength(1);
        expect(document.querySelectorAll('.phone-build-feedback')).toHaveLength(1);
    });
    test('changing character does not carry another character’s pending action', () => {
        document.querySelector('[data-build-action="branch:B"]').click();
        player = { ...player, id: 'another-builder' }; ui.renderSkillTree('Fighter');
        expect(ui.mobile.pending).toBeNull();
        expect(document.querySelector('[data-build-action="branch:B"]').disabled).toBe(false);
    });
    test.each(['Fighter', 'Rogue', 'Wizard', 'Cleric'])('%s has readable sections and respects locked build choices', classType => {
        player = { ...player, id: classType, subType: classType, level: 1, unlockedSkills: [], talentRanks: {}, skillRunes: {} };
        for (const mode of ['skills', 'talents', 'runes', 'combos']) {
            ui.skillTreeMode = mode; ui.renderSkillTree(classType);
            expect(ui.skillTreeContent.querySelector('h2')).not.toBeNull();
            expect(ui.skillTreeContent.textContent).not.toContain('undefined');
            if (mode === 'skills') expect(ui.skillTreeContent.querySelectorAll('[data-branch]')).toHaveLength(3);
            if (mode === 'talents' || mode === 'runes') {
                const actions = [...ui.skillTreeContent.querySelectorAll('button[data-build-action]')];
                expect(actions.length).toBeGreaterThan(0);
                expect(actions.every(action => action.disabled)).toBe(true);
            }
        }
    });
});
