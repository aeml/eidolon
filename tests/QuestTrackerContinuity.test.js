import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';

let ui, player, summary;
beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="quest-window"><div id="quest-list"></div></div>'
        + '<div id="quest-journal"><div id="journal-list"></div></div>'
        + '<div id="objectives-panel"><div class="objectives-panel__header"></div><div id="objectives-list"></div></div>';
    player = { id: 'tracker-reader', level: 30, quests: ['daily-a', 'daily-b'].map(id => ({ id, accepted: true })) };
    summary = player.quests.map((quest, index) => ({ id: quest.id, badge: 'Daily', title: `Contract ${index}`,
        count: 0, progressLabel: '0 / 3', progressPct: 0, hint: 'Return to the quest giver' }));
});
afterEach(() => ui?.dispose());
function render(mobile = false) {
    ui = new QuestUI({ isMobile: mobile, getLastPlayer: () => player });
    ui.lastJournalQuests = player.quests;
    ui.openTrackedObjective = jest.fn(); ui.toggleJournal = jest.fn();
    ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn();
    ui.renderObjectivesPanel(summary);
    return document.querySelector('.objective-entry');
}

test.each([false, true])('progress retains mounted objective and navigation controls (phone %s)', mobile => {
    const target = render(mobile), next = document.querySelector('.phone-objectives-next');
    const more = document.querySelector('.objectives-panel__more');
    const observer = new MutationObserver(() => {});
    observer.observe(ui.objectivesPanel, { childList: true, subtree: true });
    try {
        target.focus(); ui.objectivesList.scrollTop = 40;
        summary[1] = { ...summary[1], count: 1, progressLabel: '1 / 3', progressPct: 33 };
        ui.renderObjectivesPanel(summary);
        expect(document.querySelector('.objective-entry')).toBe(target);
        if (next) expect(document.querySelector('.phone-objectives-next')).toBe(next);
        if (more) expect(document.querySelector('.objectives-panel__more')).toBe(more);
        expect(document.activeElement).toBe(target); expect(ui.objectivesList.scrollTop).toBe(40);
        const controls = [target, next, more].filter(Boolean);
        expect(observer.takeRecords().flatMap(record => [...record.removedNodes])
            .filter(node => controls.some(control => node === control || node.contains(control)))).toEqual([]);
        target.click(); expect(ui.openTrackedObjective).toHaveBeenCalledTimes(1);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    } finally { observer.disconnect(); }
});

test.each([false, true])('an unchanged quest button opens its latest progress snapshot (phone %s)', mobile => {
    const target = render(mobile);
    summary[0] = { ...summary[0], count: 2, progressLabel: '2 / 3', progressPct: 66 };
    ui.renderObjectivesPanel(summary); target.click();
    expect(ui.openTrackedObjective).toHaveBeenCalledWith(summary[0]);
    expect(target.querySelector('.objective-entry__status').textContent).toBe('2 / 3');
    expect(target.querySelector('.objective-entry__progress-fill').style.width).toBe('66%');
});

test('the phone Next control survives updates and resolves the current tracked roster', () => {
    render(true); const next = document.querySelector('.phone-objectives-next'); next.focus();
    summary[0] = { ...summary[0], count: 1, progressLabel: '1 / 3' }; ui.renderObjectivesPanel(summary);
    expect(document.querySelector('.phone-objectives-next')).toBe(next); expect(document.activeElement).toBe(next);
    next.click(); expect(ui.phoneObjectiveKey).toBe('daily-b');
    expect(document.querySelector('.objective-entry__title').textContent).toBe('Contract 1');
    const selected = ui.phoneObjectiveKey;
    ui.trackedQuestKeys = new Set(['daily-b']); ui.renderObjectivesPanel(summary); next.click();
    expect(ui.phoneObjectiveKey).toBe(selected);
});

test.each(['untrack', 'remove', 'character', 'dispose', 'replacement', 'empty'])('%s retires the old objective action', reason => {
    const target = render(); let replacement;
    if (reason === 'untrack') { ui.trackedQuestKeys = new Set(['daily-b']); ui.renderObjectivesPanel(summary); }
    if (reason === 'remove') ui.renderObjectivesPanel(summary.slice(1));
    if (reason === 'character') player = { ...player, id: 'different-reader' };
    if (reason === 'dispose') ui.dispose();
    if (reason === 'replacement') replacement = new QuestUI({ getLastPlayer: () => player });
    if (reason === 'empty') ui.renderObjectivesPanel([]);
    target.click(); expect(ui.openTrackedObjective).not.toHaveBeenCalled();
    replacement?.dispose();
});

test('a new story chapter retires the old card even though both use the Story tracking preference', () => {
    summary = [{ ...summary[0], id: 'chronicle-first', badge: 'Story · Earth' }];
    player.quests = [{ id: 'chronicle-first' }]; const target = render(true);
    summary = [{ ...summary[0], id: 'chronicle-next', title: 'Next chapter' }];
    ui.renderObjectivesPanel(summary); target.click();
    expect(ui.openTrackedObjective).not.toHaveBeenCalled();
    expect(document.querySelector('.objective-entry')).not.toBe(target);
    expect(document.querySelector('.objective-entry__title').textContent).toBe('Next chapter');
});

test('removing a different tracked quest does not detach the remaining focused card', () => {
    render(); const target = document.querySelectorAll('.objective-entry')[1]; target.focus();
    const observer = new MutationObserver(() => {}); observer.observe(ui.objectivesList, { childList: true });
    try {
        ui.trackedQuestKeys = new Set(['daily-b']); ui.renderObjectivesPanel(summary);
        expect(document.querySelector('.objective-entry')).toBe(target); expect(document.activeElement).toBe(target);
        expect(observer.takeRecords().flatMap(record => [...record.removedNodes])).not.toContain(target);
    } finally { observer.disconnect(); }
});
