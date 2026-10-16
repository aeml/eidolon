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
    expect(book.entries.map(entry => entry.id)).toEqual(['chapter:chronicle_01_bell_below', `discovery:${investigation.sites[1].id}`]);
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
});
