import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';

describe('journal sections and contract readability', () => {
    let ui, player;
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `<div id="quest-journal"><div id="journal-list"></div></div>
            <div id="objectives-panel"><div id="objectives-list"></div></div>`;
        player = { id: 'reader', quests: [
            { id: 'chronicle_01', category: 'chronicle', chapter: 1, title: 'First promise', accepted: true, count: 1, maxCount: 3 },
            { id: 'daily_active', target: 'Skeleton', accepted: true, count: 1, maxCount: 5 },
            { id: 'daily_ready', target: 'Imp', accepted: true, count: 5, maxCount: 5 },
            { id: 'daily_offer', target: 'Imp', count: 0, maxCount: 5 },
            { id: 'daily_done', target: 'Imp', accepted: true, completed: true, count: 5, maxCount: 5 }
        ] };
        ui = new QuestUI({ getLastPlayer: () => player });
        ui.onCompleteQuest = jest.fn();
        ui.updateJournal(player.quests);
    });

    test('navigation filters sections without changing quest or tracking state', () => {
        const before = JSON.stringify(player.quests);
        const tracked = ui.getTrackedObjectives().map(q => q.id);
        ui.setJournalView('contracts');
        expect(document.querySelector('.chronicle-journal').hidden).toBe(true);
        expect([...document.querySelectorAll('.quest-journal-entry')].every(node => !node.hidden)).toBe(true);
        expect(document.querySelector('[data-journal-view="contracts"]').textContent).toBe('Contracts (2)');
        ui.setJournalView('story');
        expect(document.querySelector('.chronicle-journal').hidden).toBe(false);
        expect(document.querySelector('.quest-repeatable-ladder').hidden).toBe(true);
        expect([...document.querySelectorAll('.quest-journal-entry')].every(node => node.hidden)).toBe(true);
        expect(ui.getTrackedObjectives().map(q => q.id)).toEqual(tracked);
        expect(JSON.stringify(player.quests)).toBe(before);
        expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('ready contracts lead the list, not unaccepted or already claimed quests', () => {
        expect([...document.querySelectorAll('.quest-journal-entry')].map(node => node.dataset.questId))
            .toEqual(['daily_ready', 'daily_active']);
        const ready = document.querySelector('.is-ready');
        expect(ready.textContent).toContain('Ready to turn in');
        expect(ready.textContent).toContain('Return to the daily quest giver');
        expect(ready.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('5');
        expect(document.querySelector('[data-quest-id="daily_active"]').textContent).toContain('Defeat 5 Skeletons.');
        expect(player.quests.map(q => q.id)).toEqual(['chronicle_01', 'daily_active', 'daily_ready', 'daily_offer', 'daily_done']);
    });

    test('navigation is retained across updates and resets between characters', () => {
        const button = document.querySelector('[data-journal-view="contracts"]');
        button.click(); button.focus();
        player.quests[2].completed = true;
        ui.updateJournal(player.quests);
        expect(document.activeElement).toBe(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.textContent).toBe('Contracts (1)');
        expect(document.querySelector('.chronicle-journal').hidden).toBe(true);
        player.id = 'another-character'; ui.updateJournal(player.quests);
        expect(document.querySelector('[data-journal-view="all"]').getAttribute('aria-pressed')).toBe('true');
    });

    test('empty sections explain where to find quests; missing counts never yield NaN', () => {
        player.quests = [{ id: 'daily_empty', accepted: true }];
        ui.updateJournal(player.quests);
        expect(document.querySelector('.quest-journal-entry__fill').style.width).toBe('0%');
        expect(document.querySelector('.quest-journal-entry__count').textContent).toBe('0 / 0');
        ui.setJournalView('story');
        expect(document.querySelector('.quest-journal-empty').textContent).toContain('Archmage Ilyra');
        ui.updateJournal([]); ui.setJournalView('contracts');
        expect(document.querySelector('.quest-journal-empty').textContent).toContain('daily quest giver');
    });

    test('progress updates retain tracker scroll position', () => {
        const list = document.getElementById('objectives-list');
        list.scrollTop = 90;
        player.quests[1].count = 2; ui.updateJournal(player.quests);
        expect(list.scrollTop).toBe(90);
    });
});
