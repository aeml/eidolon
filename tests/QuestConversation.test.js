import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { questMarkerState } from '../src/entities/QuestNPC.js';
import { ILYRA_REPLIES } from '../src/ui/QuestConversation.js';

const story = (overrides = {}) => ({ id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell That Rang Below', description: 'I need your help to save Eidolon.', lore: 'The covenant of the four spirits.', type: 'KILL', target: 'Skeleton', count: 0, maxCount: 3, rewardXP: 500, accepted: false, completed: false, ...overrides });
const daily = (overrides = {}) => ({ ...story(), id: 'daily_skeleton', category: 'daily', title: 'Daily Hunt', ...overrides });

beforeEach(() => {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div><div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div class="objectives-panel__header"></div><div id="objectives-list"></div></div>';
});

test('wizard accepts and completes only by click, waits for acknowledgement, then holds authored dialogue', () => {
    const player = { quests: [story()], position: { x: 20, z: 200 }, level: 1 };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.questKind = 'story';
    ui.onAcceptQuest = jest.fn();
    ui.onCompleteQuest = jest.fn();
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain('ARCHMAGE ILYRA');
    expect(document.body.textContent).toContain('save Eidolon');
    document.querySelector('#quest-list button').click();
    expect(ui.onAcceptQuest).toHaveBeenCalledTimes(1);
    player.quests = [story({ accepted: true, count: 3 })];
    ui.updateQuestWindow(player.quests);
    expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Reward received');
    document.querySelector('#quest-list button').click();
    expect(ui.onCompleteQuest).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#quest-list button').disabled).toBe(true);
    player.quests = [story({ accepted: true, completed: true, count: 3 }), story({ id: 'chronicle_02_seeds_first_grove', chapter: 2, title: 'Seeds of the First Grove' })];
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain(ILYRA_REPLIES[0]);
    expect(document.body.textContent).toContain('Reward received · 500 XP');
    ui.updateQuestWindow(player.quests);
    expect(document.body.textContent).toContain(ILYRA_REPLIES[0]);
    document.querySelector('#quest-list button').click();
    expect(document.body.textContent).toContain('Seeds of the First Grove');
    expect(document.querySelector('#quest-list button').textContent).toBe('Accept Quest');
    expect(ui.onAcceptQuest).toHaveBeenCalledTimes(1);
});

test('markers prioritize ready turn-ins, separate story/dailies, and disappear when none are offered', () => {
    expect(questMarkerState([daily(), story()], false)).toBe('!');
    expect(questMarkerState([daily(), story()], true)).toBe('!');
    expect(questMarkerState([daily({ accepted: true, count: 3 }), daily({ id: 'daily_other' })])).toBe('?');
    expect(questMarkerState([story({ accepted: true, count: 3 })], true)).toBe('?');
    expect(questMarkerState([story({ accepted: true, count: 2 })], true)).toBe('');
    expect(questMarkerState([daily({ completed: true }), story({ accepted: true, count: 3 })])).toBe('');
});

test('reopening a conversation requests fresh state and unlocks a lost acknowledgement', () => {
    const player = { quests: [story()], position: { x: 20, z: 215 } };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.onRequestQuests = jest.fn();
    ui.pendingQuestAction = { quest: story(), complete: false };
    ui.closeQuestWindow();
    ui.toggleQuestWindow('story');
    expect(ui.onRequestQuests).toHaveBeenCalledTimes(1);
    expect(ui.pendingQuestAction).toBeNull();
    expect(document.querySelector('#quest-list button').disabled).toBe(false);
});

test('many accepted quests remain in the Journal but only three compact cards appear in tracker', () => {
    const player = { quests: [story({ accepted: true }), ...Array.from({ length: 26 }, (_, i) => daily({ id: `daily_${i}`, accepted: true }))], position: { x: 250, z: 200 } };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.updateJournal(player.quests);
    expect(document.querySelectorAll('#objectives-list .objective-entry')).toHaveLength(3);
    expect(document.querySelector('.objectives-panel__more').textContent).toContain('Choose tracked quests');
    const button = document.querySelector('.objectives-panel__more');
    ui.updateJournal(player.quests);
    expect(document.querySelector('.objectives-panel__more')).toBe(button);
    button.click();
    expect(ui.isJournalOpen).toBe(true);
    expect(document.querySelector('#journal-list').textContent.match(/Daily Hunt/g)).toHaveLength(26);
});

test('all fifteen chapters have distinct substantial completion dialogue', () => {
    expect(new Set(ILYRA_REPLIES).size).toBe(15);
    expect(ILYRA_REPLIES.every((reply) => reply.length > 180)).toBe(true);
});
