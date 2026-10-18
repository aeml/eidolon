import { jest } from '@jest/globals';
import { buildLoreBook } from '../src/ui/LoreBook.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { getChronicleInvestigation } from '../src/core/ChronicleInvestigation.js';

const investigation = getChronicleInvestigation('chronicle_earth_returning_scar');
const records = () => [
    { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell Below', completed: true, description: 'The missing note', lore: 'Lanternhold remembers the bell.' },
    { id: investigation.id, category: 'chronicle', chapter: 2, title: investigation.title, accepted: true,
        type: 'INVESTIGATE', count: 1, maxCount: investigation.sites.length, investigationMask: 2, lore: 'UNFINISHED ACCOUNT', objectiveText: 'Read the altered roots.' },
    { id: 'chronicle_15_dark_king', category: 'chronicle', chapter: 15, title: 'UNSEEN THRONE', lore: 'UNSEEN ENDING', count: 0, maxCount: 1 }
];

test('the book includes personally completed chapters and exact sparse discovery identities only', () => {
    const quests = records(), before = JSON.stringify(quests), book = buildLoreBook(quests);
    expect(book.entries.filter(entry => ['chapters', 'discoveries'].includes(entry.kind)).map(entry => entry.id))
        .toEqual(['chapter:chronicle_01_bell_below', `discovery:${investigation.sites[1].id}`]);
    const text = JSON.stringify(book.entries);
    expect(text).toContain(investigation.sites[1].text);
    expect(text).not.toContain('UNFINISHED ACCOUNT'); expect(text).not.toContain('UNSEEN ENDING');
    expect(text).not.toContain(investigation.sites[0].text);
    expect(book.current.id).toBe(investigation.id);
    expect(JSON.stringify(quests)).toBe(before);
});

test.each([undefined, -1, 1.5, 0x100000000])('missing or invalid discovery mask %s cannot reveal inferred records', mask => {
    const quests = records(); quests[1].investigationMask = mask; quests[1].count = quests[1].maxCount;
    expect(buildLoreBook(quests).entries.filter(entry => entry.kind === 'discoveries')).toEqual([]);
});

test('secondary tasks require personal acceptance and claimed completion alone proves the finale', () => {
    const final = { id: 'chronicle_15_dark_king', category: 'chronicle', accepted: true, count: 1, maxCount: 1 };
    const patrol = { id: 'daily_patrol', title: 'Road patrol', accepted: true, count: 2, maxCount: 3 };
    const optional = { id: 'chronicle_optional', legacyOptional: true, accepted: true, title: 'An old promise' };
    const quests = [final, patrol, optional, { id: 'future', title: 'UNSEEN CONTRACT', accepted: false },
        { id: 'claimed', accepted: true, completed: true }];
    const before = JSON.stringify(quests), book = buildLoreBook(quests);
    expect(book.finaleCompleted).toBe(false); expect(book.current.id).toBe(final.id);
    expect(book.activeTasks.map(task => task.id)).toEqual([patrol.id, optional.id]);
    expect(JSON.stringify(quests)).toBe(before);
    expect(buildLoreBook([{ ...final, completed: true }]).finaleCompleted).toBe(true);
});

describe('journal lore reading', () => {
    let player, ui;
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div id="objectives-list"></div></div>';
        player = { id: 'reader', quests: records() };
        ui = new QuestUI({ getLastPlayer: () => player, openWorldMap: jest.fn() });
        ui.onCompleteQuest = jest.fn(); ui.onAcceptQuest = jest.fn();
        ui.updateJournal(player.quests); ui.setJournalView('lore');
    });
    afterEach(() => { ui.dispose(); document.body.replaceChildren(); });

    test('lore progress keeps the book and current actions continuously attached', () => {
        const book = ui.loreBook;
        const current = book.overview.querySelector('[data-lore-action="current"]');
        const map = book.overview.querySelector('[data-lore-action="map"]');
        const observer = new MutationObserver(() => {});
        observer.observe(ui.journalList, { childList: true, subtree: true });
        player.quests = player.quests.map(q => q.id === investigation.id ? { ...q, count: 2 } : q);
        ui.updateJournal(player.quests);
        const removed = observer.takeRecords().flatMap(record => [...record.removedNodes]); observer.disconnect();
        expect(removed.some(node => node === book.element || node.contains?.(book.element))).toBe(false);
        expect(removed.some(node => node === current || node.contains?.(current))).toBe(false);
        expect(book.overview.querySelector('[data-lore-action="current"]')).toBe(current);
        expect(book.overview.querySelector('[data-lore-action="map"]')).toBe(map);
        expect(book.overview.textContent).toContain(`2 / ${investigation.sites.length}`);
        current.click(); expect(ui.journalView).toBe('story');
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('earning another memory retains the existing navigation button and pressed target', () => {
        const book = ui.loreBook, button = book.index.querySelector('button'), id = button.dataset.memoryId;
        button.focus();
        player.quests.push({ id: 'chronicle_02_second_note', category: 'chronicle', chapter: 2,
            title: 'The second note', accepted: true, completed: true, lore: 'Another promise remembered.' });
        ui.updateJournal(player.quests);
        expect(book.index.querySelector(`[data-memory-id="${id}"]`)).toBe(button);
        expect(document.activeElement).toBe(button);
        button.click(); expect(book.selected).toBe(id);
        expect(book.index.children).toHaveLength(3);
    });

    test('side-task progress retains its action while removal retires captured callbacks', () => {
        player.quests.push({ id: 'daily_patrol', title: 'Road patrol', accepted: true, count: 1, maxCount: 3 });
        ui.updateJournal(player.quests);
        const book = ui.loreBook, button = book.overview.querySelector('[data-lore-action="task:daily_patrol"]');
        player.quests = player.quests.map(q => q.id === 'daily_patrol' ? { ...q, count: 2 } : q);
        ui.updateJournal(player.quests);
        expect(book.overview.querySelector('[data-lore-action="task:daily_patrol"]')).toBe(button);
        expect(button.textContent).toContain('2 / 3');
        const callback = button.onclick;
        player.quests = player.quests.filter(q => q.id !== 'daily_patrol'); ui.updateJournal(player.quests);
        const open = jest.spyOn(ui, 'openTrackedObjective');
        callback.call(button, new MouseEvent('click')); expect(open).not.toHaveBeenCalled();
    });

    test('changing reader or disposing retires captured lore navigation callbacks', () => {
        const book = ui.loreBook, button = book.overview.querySelector('[data-lore-action="current"]');
        const callback = button.onclick;
        player = { id: 'another-reader', quests: records() }; ui.updateJournal(player.quests); ui.setJournalView('lore');
        callback.call(button, new MouseEvent('click')); expect(ui.journalView).toBe('lore');
        const current = book.overview.querySelector('[data-lore-action="current"]'), pending = current.onclick;
        const navigation = jest.spyOn(ui, 'setJournalView'); ui.dispose();
        pending.call(current, new MouseEvent('click')); expect(navigation).not.toHaveBeenCalled();
    });

    test('a changed current chapter retires its old action instead of redirecting an unfinished press', () => {
        const book = ui.loreBook, previous = book.overview.querySelector('[data-lore-action="current"]');
        const pending = previous.onclick;
        player.quests = player.quests.map(q => q.id === investigation.id ? { ...q, completed: true } : q);
        player.quests.push({ id: 'chronicle_02_second_note', category: 'chronicle', chapter: 3,
            title: 'The next accepted chapter', accepted: true, count: 0, maxCount: 1 });
        ui.updateJournal(player.quests); ui.setJournalView('lore');
        const current = book.overview.querySelector('[data-lore-action="current"]');
        expect(current).not.toBe(previous); expect(current.dataset.loreTarget).toBe('chronicle_02_second_note');
        pending.call(previous, new MouseEvent('click')); expect(ui.journalView).toBe('lore');
        current.click(); expect(ui.journalView).toBe('story');
    });

    test('enriching an earned person keeps its existing Read action and return path', () => {
        const book = ui.loreBook;
        book.filters.querySelector('[data-lore-filter="people"]').click();
        book.index.querySelector('[data-memory-id="people:ilyra"]').click();
        const read = book.article.querySelector('[data-lore-action="memory:chapter:chronicle_01_bell_below"]');
        read.focus();
        player.quests.push({ id: 'chronicle_02_second_note', category: 'chronicle', chapter: 2,
            title: 'Another Ilyra account', accepted: true, completed: true, lore: 'Ilyra remembers another promise.' });
        ui.updateJournal(player.quests);
        expect(book.article.querySelector('[data-lore-action="memory:chapter:chronicle_01_bell_below"]')).toBe(read);
        expect(document.activeElement).toBe(read);
        read.click(); expect(book.selected).toBe('chapter:chronicle_01_bell_below');
        book.article.querySelector('[data-lore-action="return:people:ilyra"]').click();
        expect(book.selected).toBe('people:ilyra'); expect(book.category).toBe('people');
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test.each(['lore', 'story'])('quest map action in %s preserves focus through progress and never accepts, claims or toggles tracking', view => {
        ui.dispose(); const showQuestOnMap = jest.fn();
        ui = new QuestUI({ getLastPlayer: () => player, showQuestOnMap });
        ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn();
        ui.updateJournal(player.quests); ui.setJournalView(view);
        const findAction = () => [...ui.journalList.querySelectorAll('[data-quest-map]')]
            .find(button => view === 'lore' ? ui.loreBook.element.contains(button) : !ui.loreBook.element.contains(button));
        const action = findAction(); expect(action.textContent).toBe('Show quest on map'); action.focus();
        player.quests = player.quests.map(q => q.id === investigation.id ? { ...q, count: 2 } : q);
        ui.updateJournal(player.quests); expect(document.activeElement).toBe(findAction());
        const receipts = JSON.stringify(player.quests), tracked = ui.getTrackedObjectives().map(q => q.id);
        findAction().click(); expect(showQuestOnMap).toHaveBeenCalledWith(investigation.id);
        expect(ui.getTrackedObjectives().map(q => q.id)).toEqual(tracked); expect(JSON.stringify(player.quests)).toBe(receipts);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('lore has its own view; current task links to quests and map without claiming or accepting', () => {
        expect(ui.loreBook.element.hidden).toBe(false);
        expect(document.querySelector('.chronicle-journal').hidden).toBe(true);
        expect(ui.loreBook.element.textContent).toContain('What I’m doing now');
        expect(ui.loreBook.element.textContent).toContain('Story so far');
        const actions = [...ui.loreBook.overview.querySelectorAll('button')];
        actions.find(button => button.textContent === 'Open world map').click();
        expect(ui.ctx.openWorldMap).toHaveBeenCalledTimes(1);
        actions.find(button => button.textContent === 'Open current quest').click();
        expect(ui.journalView).toBe('story'); expect(ui.loreBook.element.hidden).toBe(true);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('search finds words inside earned records and distinguishes no matches from an empty book', () => {
        const book = ui.loreBook;
        book.search.value = 'Lanternhold remembers'; book.search.dispatchEvent(new Event('input'));
        expect(book.index.children).toHaveLength(1);
        expect(book.article.textContent).toContain('Lanternhold remembers the bell.');
        book.search.value = 'unseen ending'; book.search.dispatchEvent(new Event('input'));
        expect(book.index.children).toHaveLength(0); expect(book.article.textContent).toContain('No matching memories');
        player.quests = []; ui.updateJournal([]);
        expect(book.article.textContent).toContain('The first page awaits');
    });

    test('reading selection and search focus survive progress refreshes', () => {
        const book = ui.loreBook;
        book.filters.querySelector('[data-lore-filter="discoveries"]').click();
        const article = book.article.firstElementChild, selected = book.selected;
        book.search.focus();
        player.quests[1].count++; ui.updateJournal(player.quests);
        expect(document.activeElement).toBe(book.search);
        expect(book.article.firstElementChild).toBe(article); expect(book.selected).toBe(selected);
        expect(book.category).toBe('discoveries');
    });

    test('changing characters clears filters, selection and old memories', () => {
        const book = ui.loreBook;
        book.search.value = 'Lanternhold'; book.search.dispatchEvent(new Event('input'));
        player = { id: 'new-reader', quests: [] }; ui.updateJournal(player.quests); ui.setJournalView('lore');
        expect(book.search.value).toBe(''); expect(book.category).toBe('all'); expect(book.selected).toBeNull();
        expect(book.element.textContent).not.toContain('Lanternhold remembers the bell.');
    });

    test('closing/reopening preserves reading; new owned records appear without losing the selected memory', () => {
        const book = ui.loreBook;
        book.filters.querySelector('[data-lore-filter="discoveries"]').click();
        const selected = book.selected;
        ui.closeJournal(); ui.toggleJournal();
        expect(ui.journalView).toBe('lore'); expect(book.selected).toBe(selected);
        player.quests[1].investigationMask = 3; ui.updateJournal(player.quests);
        expect(book.index.children).toHaveLength(2); expect(book.selected).toBe(selected);
    });

    test('a tracked quest opens its actual journal section without accepting, claiming or toggling its tracking', () => {
        player.quests.push({ id: 'daily_hunt', title: 'Road patrol', accepted: true, count: 2, maxCount: 3 });
        ui.updateJournal(player.quests); ui.setJournalView('lore');
        const before = JSON.stringify(player.quests);
        const button = document.querySelector('button.objective-entry[aria-label*="Road patrol"]');
        expect(button).not.toBeNull(); button.click();
        expect(ui.journalView).toBe('contracts');
        expect(document.activeElement.dataset.questTrack).toBe('daily_hunt');
        expect(JSON.stringify(player.quests)).toBe(before);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('typing in search stays out of game shortcuts while Escape can close the journal', () => {
        const observed = jest.fn(); document.addEventListener('keydown', observed);
        try {
            for (const key of ['j', ' ', 'Enter']) ui.loreBook.search.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            expect(observed).not.toHaveBeenCalled();
            ui.loreBook.search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(observed).toHaveBeenCalledTimes(1);
        } finally { document.removeEventListener('keydown', observed); }
    });

    test('leaving a lore session restores the frame and a new session gets one navigation row', () => {
        const frame = ui.questJournal;
        expect(frame.classList.contains('is-lore-book')).toBe(true);
        ui.dispose();
        expect(frame.classList.contains('is-lore-book')).toBe(false);
        const next = new QuestUI({ getLastPlayer: () => player });
        try {
            next.updateJournal(player.quests);
            expect(frame.querySelectorAll('.quest-journal-navigation')).toHaveLength(1);
            expect(next.journalView).toBe('all');
            expect(frame.classList.contains('is-lore-book')).toBe(false);
        } finally { next.dispose(); }
    });

    test('accepted side tasks update and retain keyboard focus, then link to the correct journal without progression changes', () => {
        player.quests.push({ id: 'daily_patrol', title: 'Road patrol', accepted: true, count: 2, maxCount: 3 });
        ui.updateJournal(player.quests);
        const before = JSON.stringify(player.quests);
        const action = ui.loreBook.overview.querySelector('[data-lore-action="task:daily_patrol"]');
        expect(action.textContent).toContain('2 / 3'); action.focus();
        player.quests.at(-1).count = 3; ui.updateJournal(player.quests);
        expect(document.activeElement.dataset.loreAction).toBe('task:daily_patrol');
        expect(document.activeElement.textContent).toContain('Ready to turn in');
        document.activeElement.click(); expect(ui.journalView).toBe('contracts');
        expect(document.activeElement.dataset.questTrack).toBe('daily_patrol');
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
        expect(JSON.parse(before).slice(0, -1)).toEqual(player.quests.slice(0, -1));
        expect(player.quests.at(-1).completed).toBeUndefined();
    });

    test('personally claimed finale gets a completed Chronicle view and bounded access to other accepted tasks', () => {
        player.quests = [{ id: 'chronicle_15_dark_king', category: 'chronicle', completed: true, accepted: true, title: 'A Letter Without a Throne' },
            ...Array.from({ length: 4 }, (_, i) => ({ id: `daily_${i}`, accepted: true, title: `Patrol ${i}`, count: 0, maxCount: 2 }))];
        ui.updateJournal(player.quests);
        const text = ui.loreBook.overview.textContent;
        expect(text).toContain('Your Chronicle is complete'); expect(text).not.toContain('its next steps');
        expect(ui.loreBook.overview.querySelectorAll('.lore-book__task')).toHaveLength(3);
        const all = ui.loreBook.overview.querySelector('[data-lore-action="all"]'); all.click();
        expect(ui.journalView).toBe('all');
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('current-task overview puts personally tracked contracts first without changing tracking or quest receipts', () => {
        player.quests.push(...Array.from({ length: 5 }, (_, i) => ({ id: `daily_${i}`, accepted: true, title: `Patrol ${i}`, count: 0, maxCount: 2 })));
        ui.updateJournal(player.quests);
        const patrol = player.quests.at(-1), before = JSON.stringify(player.quests);
        for (const task of player.quests.slice(-5)) ui.setQuestTracked(task, task.id === patrol.id);
        const preferences = [...ui.trackedQuestKeys];
        ui.updateJournal(player.quests);
        expect(ui.loreBook.overview.querySelector('.lore-book__task').dataset.loreAction).toBe(`task:${patrol.id}`);
        expect([...ui.trackedQuestKeys]).toEqual(preferences); expect(JSON.stringify(player.quests)).toBe(before);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });

    test('a newly earned memory retains keyboard focus on the existing recorded-memory navigation button', () => {
        const book = ui.loreBook, old = book.index.querySelector('button'), id = old.dataset.memoryId;
        const replace = book.index.replaceChildren.bind(book.index);
        // jsdom has no layout; simulate a clamped reading offset and require
        // restoration while the same navigation target stays attached.
        const mutation = jest.spyOn(book.index, 'replaceChildren').mockImplementation((...nodes) => {
            replace(...nodes); book.index.scrollTop = 0;
        });
        const clear = ui.clearElement.bind(ui);
        const detach = jest.spyOn(ui, 'clearElement').mockImplementation((element, retained) => {
            clear(element, retained);
            if (element === ui.journalList) book.index.scrollTop = 0;
        });
        old.focus(); book.index.scrollTop = 123;
        player.quests.push({ id: 'chronicle_02_second_note', category: 'chronicle', chapter: 2,
            title: 'The second note', accepted: true, completed: true, lore: 'Another promise remembered.' });
        const before = JSON.stringify(player.quests); ui.updateJournal(player.quests);
        expect(document.activeElement.dataset.memoryId).toBe(id); expect(document.activeElement).toBe(old);
        expect(book.index.scrollTop).toBe(123); mutation.mockRestore(); detach.mockRestore();
        expect(book.index.children).toHaveLength(3);
        expect(JSON.stringify(player.quests)).toBe(before);
        expect(ui.onAcceptQuest).not.toHaveBeenCalled(); expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    });
});
