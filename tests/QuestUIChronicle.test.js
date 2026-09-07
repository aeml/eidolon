import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';

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

test('optional earlier lore does not replace the current chapter and tracks independently', () => {
    buildDom();
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 70, position: { x: 200, z: 200 } }) });
    const optional = chronicleQuest({ id: 'chronicle_earth_keepers_house', title: 'An earlier diary', legacyOptional: true, chapter: 2 });
    const current = chronicleQuest({ id: 'chronicle_07_crown_of_embers', title: 'The Crown of Embers', chapter: 13 });
    ui.updateJournal([optional, current]);
    expect(ui.buildObjectiveSummary([optional, current])[0].id).toBe(current.id);
    expect(ui.questTrackingKey(optional)).toBe(optional.id);
    expect(ui.questTrackingKey(current)).toBe('story');
    expect(document.querySelector('.chronicle-journal').textContent).toContain('Chapter 13: The Crown of Embers');
    expect(document.querySelector('.chronicle-journal').textContent).toContain('Optional earlier investigations');
    ui.setQuestTracked(optional, false);
    expect(ui.getTrackedObjectives().map(quest => quest.id)).toContain(current.id);
    expect(ui.getTrackedObjectives().map(quest => quest.id)).not.toContain(optional.id);
});

test('the journal reveals only recorded evidence and preserves an open page across quest updates', () => {
    buildDom();
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 30 }) });
    const chapter = chronicleInvestigations[1];
    const quest = chronicleQuest({ id: chapter.id, type: 'INVESTIGATE', title: chapter.title,
        lore: chapter.summary, description: chapter.acceptance, chapter: 4, investigationMask: 5 });
    ui.updateJournal([quest]);
    const journal = document.querySelector('#journal-list');
    expect(journal.querySelectorAll('details[data-discovery-id]')).toHaveLength(2);
    expect(journal.textContent).toContain(chapter.sites[0].text);
    expect(journal.textContent).not.toContain(chapter.sites[1].text);
    expect(journal.textContent).not.toContain(chapter.summary);
    const record = journal.querySelector('details[data-discovery-id]');
    record.open = true;
    record.querySelector('summary').focus();
    journal.scrollTop = 123;
    ui.updateJournal([quest]);
    const restored = journal.querySelector(`details[data-discovery-id="${record.dataset.discoveryId}"]`);
    expect(restored.open).toBe(true);
    expect(document.activeElement).toBe(restored.querySelector('summary'));
    expect(journal.scrollTop).toBe(123);
});

test('an acknowledged inspection opens its recorded journal page, never undiscovered text', () => {
    buildDom();
    const chapter = chronicleInvestigations[0];
    const quest = chronicleQuest({ id: chapter.id, type: 'INVESTIGATE', investigationMask: 1 });
    const ui = new QuestUI({ getLastPlayer: () => ({ quests: [quest], level: 30 }) });
    const receipt = { questId: quest.id, siteId: chapter.sites[0].id };
    expect(ui.openChronicleDiscovery({ ...receipt, siteId: 'unseen' })).toBe(false);
    expect(ui.isJournalOpen).toBe(false);
    expect(ui.openChronicleDiscovery(receipt)).toBe(true);
    expect(ui.isJournalOpen).toBe(true);
    const record = document.querySelector('details[data-discovery-id]');
    expect(record.open).toBe(true);
    expect(document.activeElement).toBe(record.querySelector('summary'));
    expect(record.textContent).toContain(chapter.sites[0].text.replaceAll('\n\n', ''));
});

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
        expect(journal.textContent).toContain('1 of 23');
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
