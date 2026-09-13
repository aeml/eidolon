import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { ILYRA_REPLIES } from '../src/ui/QuestConversation.js';
import { getWitnessConversation } from '../src/ui/ChronicleWitnessConversation.js';
import { CHRONICLE_WITNESSES } from '../src/data/chronicleWitnesses.js';
import { CHRONICLE_AFTERMATH, hasCompletedDarkKing } from '../src/data/chronicleAftermath.js';

const king = (completed = true) => ({ id: 'chronicle_15_dark_king', category: 'chronicle', chapter: 27,
    title: 'The King Without a Dawn', type: 'KILL', target: 'DarkKing', count: 1, maxCount: 1,
    accepted: true, completed, rewardGold: 100, rewardXP: 0 });

function setup(quests = [king()]) {
    document.body.innerHTML = '<div id="quest-window"><div class="window-header"><span></span></div><div id="quest-list"></div></div>';
    const player = { id: 'reader', level: 100, position: { x: 20, z: 215 }, quests };
    const ui = new QuestUI({ getLastPlayer: () => player }); ui.questKind = 'story';
    ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn(); ui.updateQuestWindow(quests);
    return { ui, player };
}

test('aftermath waits for manual Dark King completion, not a filled kill counter', () => {
    expect(hasCompletedDarkKing([])).toBe(false); expect(hasCompletedDarkKing([king(false)])).toBe(false);
    expect(hasCompletedDarkKing([king()])).toBe(true);
    const { ui, player } = setup([king(false)]);
    expect(ui.questList.querySelector('.quest-aftermath')).toBeNull();
    ui.questList.querySelector('[data-quest-action="Complete Quest"]').click();
    expect(ui.onCompleteQuest).toHaveBeenCalledWith('chronicle_15_dark_king');
    player.quests = [king()]; ui.updateQuestWindow(player.quests);
    expect(ui.questList.textContent).toContain(ILYRA_REPLIES[14]);
    expect(ui.questList.querySelector('.quest-aftermath')).toBeNull();
    ui.questList.querySelector('[data-quest-action="Continue conversation"]').click();
    expect(ui.questList.querySelector('.quest-aftermath')).not.toBeNull();
    expect(ui.onCompleteQuest).toHaveBeenCalledTimes(1); expect(ui.onAcceptQuest).not.toHaveBeenCalled();
});

test('returning completed characters can read the hook without new contracts, receipts or rewards', () => {
    const quests = Object.freeze([Object.freeze(king())]); const before = JSON.stringify(quests);
    const { ui } = setup(quests);
    const section = ui.questList.querySelector('.quest-aftermath'); expect(section.open).toBe(false);
    section.open = true; for (const topic of section.querySelectorAll('details')) topic.open = true;
    expect(section.textContent).toContain(CHRONICLE_AFTERMATH.title);
    expect(section.textContent).toContain('Malachar is dead');
    expect(section.textContent).toContain('There are still four crystals');
    expect(section.querySelectorAll('[data-quest-action]')).toHaveLength(0);
    expect(ui.pendingQuestAction).toBeFalsy(); expect(ui.onCompleteQuest).not.toHaveBeenCalled(); expect(ui.onAcceptQuest).not.toHaveBeenCalled();
    expect(JSON.stringify(quests)).toBe(before);
});

test('optional catch-up quests and daily contracts retain their own actions', () => {
    const catchup = { id: 'chronicle_earth_keepers_house', category: 'chronicle', type: 'INVESTIGATE',
        legacyOptional: true, chapter: 2, title: 'The Keeper’s Abandoned House', accepted: false, completed: false, count: 0, maxCount: 1 };
    const { ui } = setup([king(), catchup]);
    expect(ui.questList.querySelector('.quest-aftermath')).not.toBeNull();
    expect(ui.questList.querySelector('[data-quest-action="Accept Quest"]')).not.toBeNull();
    ui.questKind = 'daily'; ui.updateQuestWindow([king(), { id: 'daily_skeleton', category: 'daily', accepted: false, completed: false, maxCount: 100 }]);
    expect(ui.questList.querySelector('.quest-aftermath')).toBeNull();
});

test('open aftermath topics and keyboard focus survive an unrelated quest refresh', () => {
    const { ui, player } = setup();
    ui.questList.querySelector('[data-aftermath-topic="letter"]').open = true;
    const topic = ui.questList.querySelector('[data-aftermath-topic="sender"]'); topic.open = true; topic.querySelector('summary').focus();
    player.quests = [...player.quests, { id: 'daily_skeleton', category: 'daily', count: 1, maxCount: 100 }]; ui.updateQuestWindow(player.quests);
    expect(ui.questList.querySelector('[data-aftermath-topic="letter"]').open).toBe(true);
    expect(ui.questList.querySelector('[data-aftermath-topic="sender"]').open).toBe(true);
    expect(document.activeElement.parentElement.dataset.aftermathTopic).toBe('sender');
});

test.each(['chronicle-witness-mara', 'chronicle-witness-selen'])('%s offers its linked aftermath only after the saved finale', id => {
    const original = JSON.stringify(CHRONICLE_WITNESSES);
    expect(getWitnessConversation(id, [king(false)]).topics.some(topic => topic.requiresDarkKing)).toBe(false);
    const after = getWitnessConversation(id, [king()]); expect(after.topics.filter(topic => topic.requiresDarkKing)).toHaveLength(1);
    expect(JSON.stringify(CHRONICLE_WITNESSES)).toBe(original);
    expect(getWitnessConversation(id, []).topics).toHaveLength(1);
});
