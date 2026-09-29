import { jest } from '@jest/globals';
import { installUIManagerFeedback } from '../src/ui/UIManagerFeedback.js';
import { installUIManagerCharacter } from '../src/ui/UIManagerCharacter.js';

class FeedbackFixture {}
installUIManagerFeedback(FeedbackFixture);
installUIManagerCharacter(FeedbackFixture);

test('level-cap sheet explains earned progression and updates spend availability', () => {
    const ui = new FeedbackFixture();
    ui.characterSheet = document.createElement('div');
    ui.characterSheet.style.display = 'block';
    ui.statsContent = document.createElement('div');
    ui.inventory = { updateEquipSlot: jest.fn() };
    const player = { level: 99, stats: {}, equipment: {}, isMultiplayer: true };
    ui.updateCharacterSheet(player);
    expect(ui.statsContent.querySelector('.resonance-panel')).toBeNull();
    player.level = 100;
    ui.updateCharacterSheet(player);
    const guidance = ui.statsContent.querySelector('.resonance-guidance').textContent;
    expect(guidance).toContain('enemy, quest and dungeon XP');
    expect(guidance).toContain('Daily quests are optional');
    expect(guidance).toContain('EP cannot buy these points');
    expect([...ui.statsContent.querySelectorAll('.resonance-btn')].every(button => button.disabled)).toBe(true);
    player.resonancePoints = 1;
    player.resonanceRanks = { power: 50 };
    ui.updateCharacterSheet(player);
    expect(ui.statsContent.querySelector('[data-resonance-trait="power"]').disabled).toBe(true);
    expect(ui.statsContent.querySelector('[data-resonance-trait="ward"]').disabled).toBe(false);
});

describe('authoritative progression reward split', () => {
    test.each([
        [{ xp: 100 }, '+100 XP'],
        [{ xp: 100, progression: { xp: 100, resonanceXP: 0 } }, '+100 XP'],
        [{ xp: 100, progression: { xp: 0, resonanceXP: 100 } }, '+100 Resonance XP'],
        [{ xp: 100, progression: { xp: 25, resonanceXP: 75 } }, '+25 XP, +75 Resonance XP']
    ])('boss and room feedback uses receipt %j', (reward, expected) => {
        const ui = new FeedbackFixture();
        ui.addGameMessage = jest.fn();
        ui.showCombatCallout = jest.fn();
        const summary = { ...reward, title: 'Reward' };
        expect(ui.formatRewardSummary(summary).currencyLine).toBe(expected);
        expect(ui.formatRewardPulse(summary)).toBe(expected.replace(', ', ' • '));
        ui.showRewardSummary(summary);
        expect(ui.addGameMessage).toHaveBeenCalledWith('Rewards', expected);
        expect(ui.showCombatCallout.mock.calls[0][0].subtitle).toContain(expected.replace(', ', ' • '));
        ui.addGameMessage.mockClear();
        ui.showRoomClearReward(summary);
        expect(ui.addGameMessage.mock.calls.some(args => args[1].includes(expected.replace(', ', ' • ')))).toBe(true);
    });
});
