import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { CHRONICLE_RESTORATIONS } from '../src/core/ChronicleRestoration.js';

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

test.each(Object.entries(CHRONICLE_RESTORATIONS))('%s restoration lore unlocks only after turn-in and retains the open page', (realm, lore) => {
    buildDom();
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 70 }) });
    const receipt = chronicleQuest({ id: lore.questId, count: 1, maxCount: 1, completed: false });
    ui.updateJournal([receipt]);
    expect(document.querySelector(`[data-discovery-id="restoration-${realm}"]`)).toBeNull();
    receipt.completed = true;
    ui.updateJournal([receipt]);
    const page = document.querySelector(`[data-discovery-id="restoration-${realm}"]`);
    expect(page.textContent).toContain(lore.title);
    expect(page.textContent).toContain(lore.text.split('\n\n')[0]);
    page.open = true;
    ui.updateJournal([{ ...receipt }]);
    expect(document.querySelector(`[data-discovery-id="restoration-${realm}"]`)).toBe(page);
    expect(page.open).toBe(true);
    expect(document.querySelectorAll('[data-discovery-id^="restoration-"]')).toHaveLength(1);
    ui.updateJournal([chronicleQuest()]);
    expect(document.querySelector('[data-discovery-id^="restoration-"]')).toBeNull();
});

test('optional earlier lore does not replace the current chapter and tracks independently', () => {
    buildDom();
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 70, position: { x: 200, z: 200 } }) });
    const optional = chronicleQuest({ id: 'chronicle_earth_keepers_house', type: 'INVESTIGATE', title: 'An earlier diary', legacyOptional: true, chapter: 2 });
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
    expect(restored).toBe(record);
    expect(restored.open).toBe(true);
    expect(document.activeElement).toBe(restored.querySelector('summary'));
    expect(journal.scrollTop).toBe(123);
});

test('retains earned record nodes when evidence changes, but never reuses revoked or another session records', () => {
    buildDom();
    const ui = new QuestUI({ getLastPlayer: () => ({ level: 30 }) });
    const chapter = chronicleInvestigations[1];
    const quest = chronicleQuest({ id: chapter.id, type: 'INVESTIGATE', investigationMask: 1 });
    const find = index => document.querySelector(`details[data-discovery-id="${chapter.sites[index].id}"]`);
    ui.updateJournal([quest]);
    const first = find(0), heading = first.querySelector('summary');
    ui.updateJournal([{ ...quest, investigationMask: 3, count: 2 }]);
    expect(find(0)).toBe(first);
    expect(find(0).querySelector('summary')).toBe(heading);
    const second = find(1);
    expect(second).not.toBeNull();
    ui.updateJournal([{ ...quest, investigationMask: 2 }]);
    expect(find(0)).toBeNull();
    expect(first.isConnected).toBe(false);
    expect(find(1)).toBe(second);
    ui.updateJournal([{ ...quest, investigationMask: 3 }]);
    expect(find(0)).not.toBe(first);
    expect(find(1)).toBe(second);
    ui.updateJournal([]);
    expect(document.querySelector('details[data-discovery-id]')).toBeNull();
    ui.updateJournal([{ ...quest, investigationMask: 3 }]);
    expect(find(1)).not.toBe(second);
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

test('restores expanded field records before a browser clamps the saved reading offset', () => {
    buildDom();
    const chapter = chronicleInvestigations[1];
    const quest = chronicleQuest({ id: chapter.id, type: 'INVESTIGATE', investigationMask: 5 });
    const ui = new QuestUI({ getLastPlayer: () => ({ quests: [quest], level: 30 }) });
    ui.updateJournal([quest]);
    const journal = document.querySelector('#journal-list');
    const laterRecord = `details[data-discovery-id="${chapter.sites[2].id}"]`;
    journal.querySelector(laterRecord).open = true;
    let offset = 500;
    // jsdom has no layout. Model the browser's smaller scroll range while the
    // rebuilt diary is collapsed; reopening it cannot undo an earlier clamp.
    Object.defineProperty(journal, 'scrollTop', { configurable: true,
        get: () => offset,
        set: value => { offset = Math.min(value, journal.querySelector(laterRecord).open ? 600 : 100); }
    });
    ui.updateJournal([quest]);
    expect(journal.querySelector(laterRecord).open).toBe(true);
    expect(journal.scrollTop).toBe(500);
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
        expect(journal.textContent).toContain('1 of 31');
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

    test.each(['recall', 'respawn'].flatMap(reason => [false, true].map(isMobile => [reason, isMobile])))(
        'ready story turn-in outranks stale %s guidance (mobile=%s)', (reason, isMobile) => {
            const quest = chronicleQuest({ count: 4 });
            const ui = new QuestUI({
                isMobile, getLastPlayer: () => ({ level: 8, position: { x: 0, z: 200 }, quests: [quest] }),
                getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld',
                getOnboardingRecoveryContext: () => ({ reason })
            });
            const before = JSON.stringify(quest);
            expect(ui.buildObjectiveSummary([quest])[0].id).toBe(quest.id);
            ui.updateJournal([quest]);
            const guidance = document.querySelector('.objective-entry');
            expect(guidance.textContent).toContain('Speak to Archmage Ilyra');
            expect(guidance.textContent).toContain('click Complete Quest');
            expect(guidance.textContent).not.toContain('Re-orient');
            expect(guidance.textContent).not.toContain('Respawned');
            expect(JSON.stringify(quest)).toBe(before);
        });

    test('ready daily turn-ins also replace generic town recovery', () => {
        const ui = new QuestUI({
            getLastPlayer: () => ({ level: 8, position: { x: 0, z: 200 } }),
            getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld',
            getOnboardingRecoveryContext: () => ({ reason: 'recall' })
        });
        const quest = { id: 'daily_skeleton', target: 'Skeleton', accepted: true, count: 4, maxCount: 4 };
        const summary = ui.buildObjectiveSummary([quest]);
        expect(summary[0].id).toBe(quest.id);
        expect(summary[0].hint).toContain('Speak to the Quest Giver');
    });

    test.each([{ accepted: false }, { completed: true }, { count: 3 }, { maxCount: 0 }])(
        'non-claimable quest %p does not dismiss explicit recovery', override => {
            const ui = new QuestUI({
                getLastPlayer: () => ({ level: 8, position: { x: 0, z: 200 } }),
                getCurrentInstanceId: () => '', getCurrentInstanceType: () => 'overworld',
                getOnboardingRecoveryContext: () => ({ reason: 'recall' })
            });
            const daily = { id: 'daily_skeleton', accepted: true, count: 4, maxCount: 4, ...override };
            expect(ui.buildTownRecoveryObjective([chronicleQuest(), daily]).id).toBe('starter-town-recovery-recall');
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
