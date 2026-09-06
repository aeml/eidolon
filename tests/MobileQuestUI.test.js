import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';

const story = (extra = {}) => ({ id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1,
    title: 'The Bell That Rang Below', description: 'Help Ilyra save Eidolon.', lore: 'The first covenant joined four freely given voices.',
    type: 'KILL', target: 'Skeleton', accepted: false, completed: false, count: 0, maxCount: 3, rewardXP: 500, rewardGold: 90, ...extra });

describe('phone quest reading and deliberate actions', () => {
    let ui, player;
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `<div id="quest-window" style="display:flex"><div class="window-header"><span></span></div><div id="quest-list"></div></div>
            <div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div class="objectives-panel__header"></div><div id="objectives-list"></div></div>`;
        player = { id: 'phone-reader', level: 30, position: { x: 200, z: 200 }, quests: [story()] };
        ui = new QuestUI({ isMobile: true, getLastPlayer: () => player, getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld' });
        ui.questKind = 'story'; ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn();
    });
    test('Accept is outside the scrolling story and waits for server acknowledgement', () => {
        ui.updateQuestWindow(player.quests);
        const action = document.querySelector('.phone-quest-actions button');
        expect(action?.textContent).toBe('Accept Quest');
        action.click(); expect(ui.onAcceptQuest).toHaveBeenCalledWith(player.quests[0].id);
        expect(player.quests[0].accepted).toBe(false); expect(action.disabled).toBe(true);
        player.quests[0].accepted = true; ui.updateQuestWindow(player.quests);
        expect(ui.pendingQuestAction).toBeNull(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });
    test('ready objectives still need Complete, followed by Ilyra’s acknowledged response', () => {
        player.quests[0] = story({ accepted: true, count: 3 }); ui.updateQuestWindow(player.quests);
        expect(ui.onCompleteQuest).not.toHaveBeenCalled();
        document.querySelector('.phone-quest-actions button').click();
        expect(ui.onCompleteQuest).toHaveBeenCalledTimes(1);
        expect(document.getElementById('quest-list').textContent).not.toContain('QUEST COMPLETE');
        player.quests[0].completed = true; ui.updateQuestWindow(player.quests);
        expect(document.getElementById('quest-list').textContent).toContain('QUEST COMPLETE');
        expect(document.querySelector('.phone-quest-actions button').textContent).toBe('Continue conversation');
    });
    test('progress updates retain an open lore disclosure and reading position on the same quest', () => {
        player.quests[0].accepted = true; ui.updateQuestWindow(player.quests);
        document.querySelector('#quest-list details').open = true;
        ui.questList.scrollTop = 120; player.quests[0].count = 1; ui.updateQuestWindow(player.quests);
        expect(document.querySelector('#quest-list details').open).toBe(true);
        expect(ui.questList.scrollTop).toBe(120);
    });
    test('a rejected request shows a reachable error and permits a deliberate retry', () => {
        ui.updateQuestWindow(player.quests);
        document.querySelector('.phone-quest-actions button').click();
        ui.handleQuestActionError('Move closer to Ilyra.');
        expect(document.querySelector('.phone-quest-actions [role="alert"]').textContent).toBe('Move closer to Ilyra.');
        const retry = document.querySelector('.phone-quest-actions button');
        expect(retry.disabled).toBe(false); retry.click();
        expect(ui.onAcceptQuest).toHaveBeenCalledTimes(2);
        expect(document.querySelector('[role="alert"]')).toBeNull();
        expect(player.quests[0].accepted).toBe(false);
    });
    test('daily Back changes routes without retaining the previous quest scroll', () => {
        ui.questKind = 'daily';
        player.quests = [story({ id: 'daily-1', category: 'daily' })];
        ui.updateQuestWindow(player.quests);
        document.querySelector('.quest-contract').click();
        ui.questList.scrollTop = 100;
        [...document.querySelectorAll('.phone-quest-actions button')].find(b => b.textContent === 'Back to contracts').click();
        expect(document.querySelector('.quest-contract')).not.toBeNull();
        expect(ui.questList.scrollTop).toBe(0);
        expect(document.querySelector('.phone-quest-actions').children).toHaveLength(0);
    });
    test('daily Back restores the contract list position when browsing many offers', () => {
        ui.questKind = 'daily';
        player.quests = [story({ id: 'daily-1', category: 'daily' })];
        ui.updateQuestWindow(player.quests); ui.questList.scrollTop = 240;
        document.querySelector('.quest-contract').click();
        expect(ui.questList.scrollTop).toBe(0);
        [...document.querySelectorAll('.phone-quest-actions button')].find(b => b.textContent === 'Back to contracts').click();
        expect(ui.questList.scrollTop).toBe(240);
    });
    test('progress keeps keyboard focus on the lore summary being read', () => {
        player.quests[0].accepted = true; ui.updateQuestWindow(player.quests);
        document.querySelector('#quest-list summary').focus();
        player.quests[0].count = 1; ui.updateQuestWindow(player.quests);
        expect(document.activeElement).toBe(document.querySelector('#quest-list summary'));
    });
    test('an unrelated quest update does not replace the action underneath a finger', () => {
        player.quests.push(story({ id: 'daily-1', category: 'daily', accepted: true }));
        ui.updateQuestWindow(player.quests);
        const action = document.querySelector('.phone-quest-actions button');
        action.focus();
        player.quests[1].count = 1; ui.updateQuestWindow(player.quests);
        expect(document.querySelector('.phone-quest-actions button')).toBe(action);
        expect(document.activeElement).toBe(action);
        action.click();
        expect(ui.onAcceptQuest).toHaveBeenCalledTimes(1);
        expect(action.disabled).toBe(true);
    });
    test('journal updates retain recovered lore and tracking focus', () => {
        player.quests = [story({ completed: true }), story({ id: 'chronicle_02_seed', chapter: 2, accepted: true })];
        ui.updateJournal(player.quests);
        document.querySelector('#journal-list details').open = true;
        const control = document.querySelector('[data-quest-track="chronicle_02_seed"]'); control.focus();
        ui.journalList.scrollTop = 90; player.quests[1].count = 1; ui.updateJournal(player.quests);
        expect(document.querySelector('#journal-list details').open).toBe(true);
        expect(ui.journalList.scrollTop).toBe(90);
        expect(document.activeElement.dataset.questTrack).toBe('chronicle_02_seed');
    });
    test('the compact phone tracker cycles every selected objective without changing tracking preferences', () => {
        const summary = Array.from({ length: 6 }, (_, i) => ({ id: `daily-${i}`, title: `Contract ${i}`, badge: 'Daily', progressLabel: '0/3', progressPct: 0, hint: 'Collect echoes' }));
        ui.loadTrackingPreferences(); ui.trackedQuestKeys = new Set(summary.map(q => q.id));
        for (let i = 0; i < 6; i++) {
            ui.renderObjectivesPanel(summary);
            expect(document.querySelectorAll('#objectives-list .objective-entry')).toHaveLength(1);
            expect(document.querySelector('.objective-entry__title').textContent).toBe(`Contract ${i}`);
            document.querySelector('.phone-objectives-next').click();
        }
        expect(ui.trackedQuestKeys.size).toBe(6);
        expect(document.querySelector('.objective-entry__title').textContent).toBe('Contract 0');
    });
});
