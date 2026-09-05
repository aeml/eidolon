import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="quest-window"></div><div id="quest-list"></div>
        <div id="quest-journal"></div><div id="journal-list"></div>
        <div id="objectives-panel"></div><div id="objectives-list"></div>
        <button id="btn-close-quest"></button><button id="btn-close-journal"></button>
    `;
}

function chronicleQuest(overrides = {}) {
    return {
        id: 'chronicle_02_seeds_first_grove', type: 'COLLECT', target: 'Verdant Memory Seed',
        count: 2, maxCount: 4, rewardXP: 8000, accepted: true, completed: false,
        title: 'Seeds of the First Grove', description: 'The Rootheart is forgetting every forest it sustained.',
        lore: 'A Verdant Memory Seed is a moment made solid.', category: 'chronicle', chapter: 2,
        objectiveText: 'Recover 4 Verdant Memory Seeds from Earth-realm creatures.',
        ...overrides
    };
}

describe('QuestUI Fourfold Chronicle', () => {
    beforeEach(buildDom);

    test('keeps Ilyra’s story out of the daily quest giver window', () => {
        const ui = new QuestUI({ getLastPlayer: jest.fn() });
        ui.updateQuestWindow([
            chronicleQuest(),
            { id: 'daily_skeleton', type: 'KILL', target: 'Skeleton', count: 0, maxCount: 100, rewardXP: 50000, accepted: false, completed: false }
        ]);

        expect(document.getElementById('quest-list').textContent).toContain('Kill Skeletons');
        expect(document.getElementById('quest-list').textContent).not.toContain('Seeds of the First Grove');
    });

    test('renders current chapter story, objective, lore, and recovered lore archive', () => {
        const ui = new QuestUI({
            getLastPlayer: () => ({ level: 20, position: { x: 200, z: 200 } }),
            getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld'
        });
        ui.updateJournal([
            chronicleQuest({
                id: 'chronicle_01_bell_below', chapter: 1, title: 'The Bell That Rang Below',
                completed: true, count: 3, maxCount: 3, lore: 'The four spirits dreamed matter into covenant.'
            }),
            chronicleQuest()
        ]);

        const journal = document.getElementById('journal-list');
        expect(journal.textContent).toContain('The Fourfold Chronicle');
        expect(journal.textContent).toContain('1 of 15');
        expect(journal.textContent).toContain('Chapter 2: Seeds of the First Grove');
        expect(journal.textContent).toContain('The Rootheart is forgetting every forest');
        expect(journal.textContent).toContain('Recover 4 Verdant Memory Seeds');
        expect(journal.textContent).toContain('A Verdant Memory Seed is a moment made solid.');
        expect(journal.textContent).toContain('Recovered Lore (1)');
    });

    test('puts the Chronicle before repeatable objectives with its authored title', () => {
        const ui = new QuestUI({
            getLastPlayer: () => ({ level: 40, position: { x: 200, z: 200 } }),
            getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld'
        });
        const summary = ui.buildObjectiveSummary([
            { id: 'daily_skeleton', type: 'KILL', target: 'Skeleton', count: 1, maxCount: 100, accepted: true, completed: false },
            chronicleQuest()
        ]);

        expect(summary[0]).toEqual(expect.objectContaining({
            id: 'chronicle_02_seeds_first_grove', title: 'Seeds of the First Grove', badge: 'Story 2'
        }));
        expect(summary[0].hint).toContain('Recover 4 Verdant Memory Seeds');
    });

    test('keeps the story primary in town while retaining explicit respawn recovery', () => {
        let recovery = null;
        const ui = new QuestUI({
            getLastPlayer: () => ({ level: 5, position: { x: 0, z: 200 } }),
            getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld',
            getOnboardingRecoveryContext: () => recovery
        });
        expect(ui.buildObjectiveSummary([chronicleQuest()])[0].id).toBe('chronicle_02_seeds_first_grove');
        recovery = { reason: 'town_return' };
        expect(ui.buildObjectiveSummary([chronicleQuest()])[0].id).toBe('chronicle_02_seeds_first_grove');
        recovery = { reason: 'respawn' };
        const summary = ui.buildObjectiveSummary([chronicleQuest()]);
        expect(summary[0].id).toBe('starter-town-recovery-respawn');
        expect(summary[1].id).toBe('chronicle_02_seeds_first_grove');
    });
});
