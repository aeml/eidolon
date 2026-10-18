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

test('selecting a reward keeps the same radio and confirmation controls through fresh journal snapshots', () => {
    const { ui, player } = setup();
    ui.updateJournal(player.quests);
    const input = document.querySelector('#journal-list [data-reward-item="item-2"]');
    const confirm = document.querySelector('#journal-list [data-reward-claim]');
    input.click(); confirm.focus();
    ui.updateJournal(JSON.parse(JSON.stringify(player.quests)));
    expect(document.querySelector('#journal-list [data-reward-claim]')).toBe(confirm);
    expect(document.querySelector('#journal-list [data-reward-item="item-2"]')).toBe(input);
    expect(document.activeElement).toBe(confirm);
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
    confirm.click();
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(1);
    expect(ui.onClaimQuestItem).toHaveBeenCalledWith('chronicle_earned', 'item-2');
});

test('unrelated quest progress keeps selected conversation reward controls mounted', () => {
    const { ui, player } = setup();
    player.quests.push({ id: 'daily-hunt', title: 'Daily hunt', accepted: true, count: 0, maxCount: 5, type: 'KILL' });
    ui.updateQuestWindow(player.quests);
    const input = document.querySelector('#quest-list [data-reward-item="item-1"]');
    const confirm = document.querySelector('#quest-list [data-reward-claim]');
    input.click(); confirm.focus();
    player.quests[1].count = 1;
    ui.updateQuestWindow(player.quests);
    expect(document.querySelector('#quest-list [data-reward-claim]')).toBe(confirm);
    expect(document.querySelector('#quest-list [data-reward-item="item-1"]')).toBe(input);
    expect(input.checked).toBe(true);
    expect(document.activeElement).toBe(confirm);
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
});

test('claiming and a rejected save update existing controls without rerolling or sending twice', () => {
    const { ui, player, choices } = setup();
    ui.updateJournal(player.quests);
    const input = document.querySelector('#journal-list [data-reward-item="item-4"]');
    input.click();
    const confirm = document.querySelector('#journal-list [data-reward-claim]');
    confirm.click();
    expect(document.querySelector('#journal-list [data-reward-claim]')).toBe(confirm);
    expect(confirm.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    confirm.click();
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(1);
    ui.handleQuestActionError('Make one free bag slot. Your choices are retained.');
    expect(document.querySelector('#journal-list [data-reward-claim]')).toBe(confirm);
    expect(document.querySelector('#journal-list [data-reward-item="item-4"]')).toBe(input);
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
    expect(player.quests[0].rewardChoices).toEqual(choices);
    expect(document.querySelector('#journal-list [role="alert"]').textContent).toContain('free bag slot');
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(1);
    confirm.click();
    expect(ui.onClaimQuestItem).toHaveBeenCalledTimes(2);
});

test('reward selection synchronizes existing Journal and conversation controls without claiming', () => {
    const { ui, player } = setup();
    ui.updateJournal(player.quests);
    ui.updateQuestWindow(player.quests);
    const journal = document.querySelector('#journal-list [data-reward-item="item-3"]');
    const conversation = document.querySelector('#quest-list [data-reward-item="item-3"]');
    journal.click();
    expect(conversation.checked).toBe(true);
    expect(document.querySelector('#quest-list [data-reward-claim]').textContent).toBe('Claim Reward 3');
    conversation.click();
    expect(journal.checked).toBe(true);
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
});

test('a reward claimed elsewhere retires its old controls before they can send a stale claim', () => {
    const { ui, player } = setup();
    ui.updateJournal(player.quests);
    const input = document.querySelector('#journal-list [data-reward-item="item-2"]');
    input.click();
    const confirm = document.querySelector('#journal-list [data-reward-claim]');
    expect(confirm.disabled).toBe(false);
    player.quests[0].claimedRewardId = 'item-2';
    player.quests[0].rewardChoices = [];
    ui.updateJournal(player.quests);
    confirm.click();
    expect(ui.onClaimQuestItem).not.toHaveBeenCalled();
    expect(document.querySelector('.quest-reward-choices')).toBeNull();
});
