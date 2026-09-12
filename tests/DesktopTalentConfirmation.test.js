import { jest } from '@jest/globals';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

let ui, player;
const talent = () => [...document.querySelectorAll('.skill-node-title')]
    .find(node => node.textContent === 'Charge - Mastery').closest('.skill-node');
const reset = () => [...document.querySelectorAll('button')].find(node => node.textContent === 'Reset Talents');
beforeEach(() => {
    document.body.innerHTML = '<div id="skill-tree-window" style="display:flex"><button id="btn-close-skills">Close</button><div id="skill-tree-content"></div></div>';
    player = { id: 'desktop-builder', subType: 'Fighter', level: 30, selectedBranch: 'A', talentRanks: {} };
    ui = new SkillTreeUI({ isMobile: false, getLastPlayer: () => player });
    ui.onUnlockTalent = jest.fn(); ui.onResetTalents = jest.fn();
    ui.skillTreeMode = 'talents'; ui.renderSkillTree('Fighter');
});

test('ordinary desktop clicks send one identified request without inventing ranks', () => {
    const originalNode = talent(); originalNode.click(); originalNode.click();
    expect(player.talentRanks).toEqual({});
    expect(ui.onUnlockTalent).toHaveBeenCalledTimes(1);
    expect(ui.onUnlockTalent).toHaveBeenCalledWith('FTR_01', expect.any(String));
    expect(talent().getAttribute('aria-disabled')).toBe('true');
    expect(ui.skillTreeContent.textContent).toContain('Waiting for the server');
});

test.each(['receipt-first', 'state-first'])('confirmation requires matching receipt and actual ranks: %s', order => {
    talent().click();
    const requestId = ui.onUnlockTalent.mock.calls[0][1];
    if (order === 'receipt-first') ui.handleBuildActionResult({ requestId, ok: true });
    else { player.talentRanks.FTR_01 = 1; ui.renderSkillTree('Fighter'); }
    expect(talent().getAttribute('aria-disabled')).toBe('true');
    if (order === 'receipt-first') { player.talentRanks.FTR_01 = 1; ui.renderSkillTree('Fighter'); }
    else ui.handleBuildActionResult({ requestId, ok: true });
    expect(talent().getAttribute('aria-disabled')).toBe('false');
    expect(ui.skillTreeContent.textContent).toContain('Confirmed');
});

test('a rejected reset preserves the actual build and makes no automatic retry', () => {
    player.talentRanks = { FTR_01: 5 }; ui.renderSkillTree('Fighter'); reset().click();
    expect(player.talentRanks).toEqual({ FTR_01: 5 });
    const requestId = ui.onResetTalents.mock.calls[0][0];
    expect(requestId).toEqual(expect.any(String));
    ui.handleBuildActionResult({ requestId: 'unrelated', ok: false, message: 'Other failure' });
    expect(reset().disabled).toBe(true);
    ui.handleBuildActionResult({ requestId, ok: false, message: 'Not enough gold' });
    expect(ui.skillTreeContent.textContent).toContain('Not enough gold');
    expect(player.talentRanks).toEqual({ FTR_01: 5 });
    expect(ui.onResetTalents).toHaveBeenCalledTimes(1);
});

test('an accepted reset waits for the empty authoritative build', () => {
    player.talentRanks = { FTR_01: 5 }; ui.renderSkillTree('Fighter'); reset().click();
    const requestId = ui.onResetTalents.mock.calls[0][0];
    ui.handleBuildActionResult({ requestId, ok: true });
    expect(player.talentRanks).toEqual({ FTR_01: 5 });
    expect(talent().getAttribute('aria-disabled')).toBe('true');
    player.talentRanks = {}; ui.renderSkillTree('Fighter');
    expect(ui.skillTreeContent.textContent).toContain('Confirmed: Talent reset.');
    expect(talent().getAttribute('aria-disabled')).toBe('false');
    expect(reset().disabled).toBe(true);
});

test('an unconfirmed reconnect does not retry or invent a successful purchase', () => {
    talent().click(); ui.handleBuildConnectionState('disconnected');
    ui.handleBuildSnapshot();
    expect(talent().getAttribute('aria-disabled')).toBe('true');
    ui.handleBuildConnectionState('connected'); ui.handleBuildSnapshot();
    expect(player.talentRanks).toEqual({});
    expect(ui.skillTreeContent.textContent).toContain('previous change was not confirmed');
    expect(ui.skillTreeContent.textContent).not.toContain('Confirmed:');
    expect(talent().getAttribute('aria-disabled')).toBe('false');
    expect(ui.onUnlockTalent).toHaveBeenCalledTimes(1);
});

test('reconnect waits for a real snapshot before making controls available', () => {
    talent().click(); ui.handleBuildConnectionState('disconnected');
    ui.handleBuildConnectionState('connected');
    expect(talent().getAttribute('aria-disabled')).toBe('true');
    player.talentRanks.FTR_01 = 1;
    ui.handleBuildSnapshot();
    expect(talent().getAttribute('aria-disabled')).toBe('false');
    expect(ui.skillTreeContent.textContent).toContain('restored after reconnect');
    expect(ui.onUnlockTalent).toHaveBeenCalledTimes(1);
});

test('character changes discard the prior character request and its late receipt', () => {
    talent().click(); const requestId = ui.onUnlockTalent.mock.calls[0][1];
    player = { ...player, id: 'second-character', talentRanks: {} }; ui.renderSkillTree('Fighter');
    ui.handleBuildActionResult({ requestId, ok: false, message: 'Old failure' });
    expect(talent().getAttribute('aria-disabled')).toBe('false');
    expect(ui.skillTreeContent.textContent).not.toContain('Old failure');
});

test('a new-character reconnect snapshot cannot confirm the previous character purchase', () => {
    talent().click(); ui.handleBuildConnectionState('disconnected');
    ui.handleBuildConnectionState('connected');
    player = { ...player, id: 'other-builder', talentRanks: { FTR_01: 1 } };
    ui.handleBuildSnapshot();
    expect(ui.skillTreeContent.textContent).not.toContain('Confirmed');
    expect(talent().getAttribute('aria-disabled')).toBe('false');
});

test('keyboard activation is deliberate and a failed send does not alter ranks', () => {
    ui.onUnlockTalent.mockImplementation(() => { throw new Error('socket unavailable'); });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    talent().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(player.talentRanks).toEqual({});
    expect(ui.onUnlockTalent).toHaveBeenCalledTimes(1);
    expect(ui.skillTreeContent.textContent).toContain('Could not send');
    expect(talent().getAttribute('aria-disabled')).toBe('false');
});
