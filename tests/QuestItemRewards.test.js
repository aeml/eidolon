import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { formatQuestRewards } from '../src/ui/questRewards.js';

function setup() {
    document.body.innerHTML = '<div id="quest-window"><div id="quest-list"></div></div><div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div id="objectives-list"></div></div>';
    const choices = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, name: `Reward ${i}`, level: 12, rarity: ['Uncommon', 'Rare', 'Legendary'][i % 3], slot: 'chest', stats: { defense: i + 10 } }));
    const player = { id: 'reward-player', level: 10, quests: [{ id: 'chronicle_earned', category: 'chronicle', title: 'Earned chapter', completed: true, accepted: true, rewardChoiceLevel: 12, rewardChoices: choices }] };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.onClaimQuestItem = jest.fn();
    return { ui, player, choices };
}

test('six saved options require explicit selection and one confirmation; claiming waits for receipt', () => {
    const { ui, player } = setup();
    ui.updateQuestWindow(player.quests);
    const radios = document.querySelectorAll('#quest-list input[type="radio"]');
    expect(radios).toHaveLength(6);
    expect(document.querySelector('.quest-reward-choices__confirm').disabled).toBe(true);
    radios[2].click();
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
    expect(document.querySelector('.quest-reward-choices__confirm').textContent).toBe('Claim Reward 2');
    document.querySelector('.quest-reward-choices__confirm').click();
    expect(ui.onClaimQuestItem).toHaveBeenCalledWith('chronicle_earned', 'item-2');
    expect(document.querySelector('.quest-reward-choices__confirm').disabled).toBe(true);
    ui.claimQuestItem('chronicle_earned', 'item-3');
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(1);
    player.quests[0].claimedRewardId = 'item-2';
    player.quests[0].rewardChoices = [];
    ui.updateQuestWindow(player.quests);
    ui.updateJournal(player.quests);
    expect(document.querySelector('.quest-reward-choices')).toBeNull();
    expect(ui.pendingRewardClaim).toBeNull();
});

test('full bag/save error keeps the exact choices and allows retry from the Journal', () => {
    const { ui, player, choices } = setup();
    ui.updateJournal(player.quests);
    const radios = document.querySelectorAll('#journal-list input[type="radio"]');
    radios[4].click();
    document.querySelector('#journal-list .quest-reward-choices__confirm').click();
    ui.handleQuestActionError('Make one free bag slot. Your choices are retained.');
    expect(document.querySelector('#journal-list [role="alert"]').textContent).toContain('free bag slot');
    expect(player.quests[0].rewardChoices).toEqual(choices);
    expect(document.querySelector('#journal-list input:checked').value).toBe('item-4');
    document.querySelector('#journal-list .quest-reward-choices__confirm').click();
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(2);
    expect(ui.onClaimQuestItem).toHaveBeenLastCalledWith('chronicle_earned', 'item-4');
});

test('reopened Journal recovers pending choices without automatically claiming; text is safe', () => {
    const { ui, player } = setup();
    player.quests[0].rewardChoices[0].name = '<img src=x onerror=alert(1)>';
    ui.pendingRewardClaim = { questId: 'chronicle_earned', itemId: 'item-0' };
    ui.onRequestQuests = jest.fn();
    ui.toggleJournal();
    expect(ui.pendingRewardClaim).toBeNull();
    expect(ui.onRequestQuests).toHaveBeenCalledTimes(1);
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
    expect(document.querySelectorAll('#journal-list input[type="radio"]')).toHaveLength(6);
    expect(document.querySelector('#journal-list img')).toBeNull();
    expect(document.querySelector('#journal-list').textContent).toContain('<img src=x');
});

test('quest offer advertises the authored reward level without inventing retroactive awards', () => {
    expect(formatQuestRewards({ rewardXP: 20, rewardChoiceLevel: 12 }, { level: 50 })).toContain('Choose 1 of 6 items · level 12 · green or better');
    expect(formatQuestRewards({ rewardXP: 20, rewardChoiceLevel: 12, legacyOptional: true }, {})).not.toContain('items');
    expect(formatQuestRewards({ rewardXP: 20 }, {})).toBe('20 XP');
});


test('reward keyboard focus survives journal updates and retired choices cannot send commands', () => {
    const { ui, player } = setup();
    ui.updateJournal(player.quests);
    const input = document.querySelector('#journal-list input[type="radio"]');
    input.click(); input.focus();
    ui.updateJournal(player.quests);
    expect(document.activeElement.dataset.rewardItem).toBe('item-0');
    const oldConfirm = document.querySelector('#journal-list .quest-reward-choices__confirm');
    ui.dispose();
    oldConfirm.click();
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
    expect(document.querySelector('.quest-reward-choices')).toBeNull();
});
