import { buildLoreMemoryIndex } from '../src/ui/LoreMemoryIndex.js';
import { buildLoreBook, LoreBook } from '../src/ui/LoreBook.js';
import { getChronicleInvestigation } from '../src/core/ChronicleInvestigation.js';
import { QuestUI } from '../src/ui/QuestUI.js';

const memory = (id, text, extra = {}) => ({ id, kind: 'chapters', title: id,
    sections: [{ title: 'The account', paragraphs: [text] }], ...extra });

test('a new reader gets no people or places from unearned future text or count-only discoveries', () => {
    const investigation = getChronicleInvestigation('chronicle_earth_keepers_house');
    const book = buildLoreBook([
        { id: 'chronicle_future', chapter: 15, lore: 'Malachar rules the Dark Realm.', accepted: false },
        { id: investigation.id, accepted: true, completed: false, count: 99, maxCount: 3, lore: 'Mara Fen waits in Lanternhold.' }
    ]);
    expect(book.entries).toEqual([]);
    expect(buildLoreMemoryIndex([])).toEqual([]);
});

test('people and places link only to earned accounts and match whole names', () => {
    const source = [memory('first', 'Mara left Lanternhold.'), memory('second', 'A marathon crosses a plain; Dains is a different word.')];
    const entries = buildLoreMemoryIndex(source);
    expect(entries.map(entry => entry.id)).toEqual(['people:mara', 'places:town']);
    for (const entry of entries) expect(entry.sections.map(section => section.memoryId)).toEqual(['first']);
    expect(JSON.stringify(entries)).not.toContain('Malachar');
    expect(JSON.stringify(entries)).not.toContain('Dark Realm');
});

test('sparse saved discovery masks cannot manufacture unread people, places or accounts', () => {
    const chapter = getChronicleInvestigation('chronicle_earth_keepers_house');
    const scar = getChronicleInvestigation('chronicle_earth_returning_scar');
    const quests = [{ id: chapter.id, accepted: true, count: 1, investigationMask: 1 },
        { id: scar.id, accepted: true, count: 2, investigationMask: 1 }];
    const book = buildLoreBook(quests);
    expect(book.entries.some(entry => entry.id === 'people:mara')).toBe(true);
    expect(book.entries.some(entry => entry.id === 'places:earth')).toBe(true);
    const recorded = new Set([chapter.sites[0], scar.sites[0]].map(site => `discovery:${site.id}`));
    for (const entry of book.entries.filter(entry => ['people', 'places'].includes(entry.kind)))
        expect(entry.sections.every(section => recorded.has(section.memoryId))).toBe(true);
    expect(JSON.stringify(book.entries)).not.toContain(scar.sites[1].text);
});

test('a surname is learned from an earned account and short/full names share one stable person entry', () => {
    const first = memory('short', 'Mara kept the door open.');
    const initial = buildLoreMemoryIndex([first]);
    expect(initial[0].title).toBe('Mara'); expect(JSON.stringify(initial)).not.toContain('Fen');
    const expanded = buildLoreMemoryIndex([first, memory('full', 'Mara Fen wrote the recovered letter.')]);
    expect(expanded.filter(entry => entry.kind === 'people')).toHaveLength(1);
    expect(expanded[0]).toMatchObject({ id: initial[0].id, title: 'Mara Fen' });
    expect(expanded[0].sections.map(section => section.memoryId)).toEqual(['short', 'full']);
});

test('a person page quotes the relevant earned paragraph instead of inventing a biography', () => {
    const source = memory('letter', 'The first paragraph concerns the weather.');
    source.sections[0].paragraphs.push('Dain held the ferry for the last passenger.');
    const entry = buildLoreMemoryIndex([source])[0];
    expect(entry.title).toBe('Dain');
    expect(entry.sections[0].paragraphs).toEqual(['Dain held the ferry for the last passenger.']);
});

test('recorded location metadata supplies its place without revealing other realms', () => {
    const entries = buildLoreMemoryIndex([memory('bank', 'The recovered ferry account.', { kind: 'discoveries', realm: 'water' })]);
    expect(entries.map(entry => entry.id)).toEqual(['places:water']);
    expect(entries[0].title).toBe('Water Realm');
    expect(entries[0].sections[0].paragraphs).toEqual(['The recovered ferry account.']);
});

test('indexes never recursively treat an index as personal evidence and do not mutate frozen records', () => {
    const source = Object.freeze([Object.freeze({ id: 'earned', kind: 'chapters', title: 'A promise',
        sections: Object.freeze([Object.freeze({ title: 'The account', paragraphs: Object.freeze(['Ilyra remembers Lanternhold.']) })]) }),
    Object.freeze({ id: 'unearned-index', kind: 'people', title: 'Malachar', sections: [] })]);
    const before = JSON.stringify(source), entries = buildLoreMemoryIndex(source);
    expect(entries.map(entry => entry.id)).toEqual(['people:ilyra', 'places:town']);
    expect(JSON.stringify(source)).toBe(before);
});

describe('reading a referenced memory', () => {
    let book;
    const quests = [{ id: 'chronicle_open_door', title: 'The open door', completed: true,
        lore: 'Mara kept the door open in Lanternhold.' }];
    beforeEach(() => {
        book = new LoreBook({ getTrackedObjectives: () => [], ctx: {}, getQuestTitle: quest => quest.title,
            getQuestObjective: quest => quest.objectiveText });
        document.body.append(book.element); book.update(quests, 'reader');
        book.search.value = 'Mara'; book.search.dispatchEvent(new Event('input'));
        book.filters.querySelector('[data-lore-filter="people"]').click(); book.index.scrollTop = 37;
        [...book.article.querySelectorAll('button')].find(button => button.textContent === 'Read The open door').click();
    });
    afterEach(() => { book.dispose(); document.body.replaceChildren(); });

    test('the reading heading keeps keyboard focus when newly earned context updates its return link', () => {
        book.article.querySelector('h3').focus();
        book.update([...quests, { id: 'chronicle_letter', title: 'The recovered letter', completed: true, lore: 'Mara Fen signed the letter.' }], 'reader');
        expect(document.activeElement).toBe(book.article.querySelector('h3'));
        expect(book.article.querySelector('h3').textContent).toBe('The open door');
        expect(book.article.textContent).toContain('Return to Mara Fen');
        expect(book.selected).toBe('chapter:chronicle_open_door');
    });

    test('read and return preserve category, search, selected person, index scroll and keyboard focus through refresh', () => {
        expect(book.selected).toBe('chapter:chronicle_open_door'); expect(book.search.value).toBe('');
        expect(document.activeElement).toBe(book.article.querySelector('h3'));
        book.update(quests, 'reader');
        [...book.article.querySelectorAll('button')].find(button => button.textContent === 'Return to Mara').click();
        expect(book.selected).toBe('people:mara'); expect(book.category).toBe('people');
        expect(book.search.value).toBe('Mara'); expect(book.index.scrollTop).toBe(37);
        expect(document.activeElement).toBe(book.article.querySelector('h3'));
        expect(quests[0].completed).toBe(true);
    });

    test('switching characters removes the previous reader and return context', () => {
        book.update([], 'other-reader');
        expect(book.readingReturn).toBeNull(); expect(book.search.value).toBe(''); expect(book.selected).toBeNull();
        expect(book.article.textContent).not.toContain('Mara'); expect(book.model.entries).toEqual([]);
    });

    test('corrected personal progress cannot retain a return link to a removed memory', () => {
        book.update([], 'reader');
        expect(book.readingReturn).toBeNull(); expect(book.selected).toBeNull();
        expect(book.article.textContent).not.toContain('Mara');
    });
});

test.each([true, false])('a learned personal name preserves the reader heading focus without taking outside focus: reading=%s', reading => {
    document.body.innerHTML = '<button id="outside">Other menu</button><div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div id="objectives-list"></div></div>';
    const quests = [{ id: 'chronicle_open_door', title: 'The open door', completed: true, lore: 'Mara kept the door open in Lanternhold.' }];
    const player = { id: 'heading-reader', quests };
    const ui = new QuestUI({ getLastPlayer: () => player });
    try {
        ui.updateJournal(quests); ui.setJournalView('lore');
        const book = ui.loreBook;
        book.filters.querySelector('[data-lore-filter="people"]').click();
        book.search.value = 'Mara'; book.search.dispatchEvent(new Event('input'));
        const outside = document.getElementById('outside');
        (reading ? book.article.querySelector('h3') : outside).focus();
        const updated = [...quests, { id: 'chronicle_letter', title: 'The recovered letter', completed: true, lore: 'Mara Fen signed the letter.' }];
        const receipts = JSON.stringify(updated);
        ui.updateJournal(updated);
        expect(book.article.querySelector('h3').textContent).toBe('Mara Fen');
        expect(document.activeElement).toBe(reading ? book.article.querySelector('h3') : outside);
        expect(book.selected).toBe('people:mara'); expect(book.search.value).toBe('Mara');
        expect(JSON.stringify(updated)).toBe(receipts);
    } finally { ui.dispose(); document.body.replaceChildren(); }
});

test.each(['reference', 'return'])('%s action remains focused when personal evidence rebuilds the page', mode => {
    document.body.innerHTML = '<div id="quest-journal"><div id="journal-list"></div></div><div id="objectives-panel"><div id="objectives-list"></div></div>';
    const quests = [{ id: 'chronicle_door', title: 'The open door', completed: true, lore: 'Mara kept the door open.' }];
    const player = { id: 'reader', quests }, ui = new QuestUI({ getLastPlayer: () => player });
    try {
        ui.updateJournal(quests); ui.setJournalView('lore');
        const book = ui.loreBook;
        book.filters.querySelector('[data-lore-filter="people"]').click();
        book.index.querySelector('[data-memory-id="people:mara"]').click();
        const read = [...book.article.querySelectorAll('button')].find(button => button.textContent === 'Read The open door');
        if (mode === 'return') read.click();
        const action = mode === 'reference' ? read : [...book.article.querySelectorAll('button')].find(button => button.textContent === 'Return to Mara');
        action.focus();
        player.quests = [...quests, { id: 'chronicle_letter', title: 'The recovered letter', completed: true, lore: 'Mara Fen signed the letter.' }];
        ui.updateJournal(player.quests);
        const expected = mode === 'reference' ? 'Read The open door' : 'Return to Mara Fen';
        const replacement = [...book.article.querySelectorAll('button')].find(button => button.textContent === expected);
        expect(replacement).toBeDefined(); expect(document.activeElement).toBe(replacement);
        expect(replacement).toBe(action); expect(action.isConnected).toBe(true);
    } finally { ui.dispose(); document.body.replaceChildren(); }
});
