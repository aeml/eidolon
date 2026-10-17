import { getCurrentChronicleQuest, getRecordedChronicleDiscoveries, getChronicleInvestigation } from '../core/ChronicleInvestigation.js';
import { CHRONICLE_RESTORATIONS, hasChronicleRestoration } from '../core/ChronicleRestoration.js';
import { getChronicleRecap } from './ChronicleRecap.js';
import { getIlyraCompletionReply } from './QuestConversation.js';
import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { buildLoreMemoryIndex } from './LoreMemoryIndex.js';

const storyQuest = quest => quest && (quest.category === 'chronicle' || quest.id?.startsWith('chronicle_'));
const paragraphs = text => String(text || '').split(/\n\s*\n/).filter(Boolean);

// Read-only projections of personal receipts. Counts, party access and static
// content availability must never manufacture discoveries or completed chapters.
export function buildLoreBook(quests = []) {
    const story = (quests || []).filter(storyQuest).slice().sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
    const entries = new Map();
    for (const quest of story) {
        if (quest.completed === true) {
            entries.set(`chapter:${quest.id}`, {
                id: `chapter:${quest.id}`, kind: 'chapters', title: quest.title || 'Recorded chapter',
                context: `Chapter ${quest.chapter || '—'} · ${quest.legacyOptional ? 'Optional account' : 'Completed'}`,
                realm: getChronicleInvestigation(quest.id)?.realm,
                sections: [
                    { title: 'The account', paragraphs: paragraphs(quest.lore || quest.description) },
                    { title: 'Ilyra’s words', paragraphs: paragraphs(getIlyraCompletionReply(quest)) }
                ].filter(section => section.paragraphs.length)
            });
        }
        for (const site of getRecordedChronicleDiscoveries(quest)) {
            entries.set(`discovery:${site.id}`, {
                id: `discovery:${site.id}`, kind: 'discoveries', title: site.title,
                context: `${quest.title || 'Field record'} · ${getChronicleInvestigation(quest.id)?.realm || 'Eidolon'}`,
                realm: getChronicleInvestigation(quest.id)?.realm,
                sections: [{ title: 'Recovered words', paragraphs: paragraphs(site.text) }]
            });
        }
    }
    for (const [realm, restoration] of Object.entries(CHRONICLE_RESTORATIONS)) {
        if (!hasChronicleRestoration(story, realm)) continue;
        entries.set(`restoration:${realm}`, {
            id: `restoration:${realm}`, kind: 'discoveries', title: `After the Vigil · ${restoration.title}`,
            context: `${realm} · Restoration account`, realm,
            sections: [{ title: 'What changed', paragraphs: paragraphs(restoration.text) }]
        });
    }
    const current = getCurrentChronicleQuest(story);
    const memories = [...entries.values()];
    return { current, recap: getChronicleRecap(story), entries: [...memories, ...buildLoreMemoryIndex(memories)],
        finaleCompleted: story.some(quest => quest.id === 'chronicle_15_dark_king' && quest.completed === true),
        activeTasks: (quests || []).filter(quest => quest?.id && quest.accepted === true && !quest.completed && quest.id !== current?.id) };
}

function node(tag, text = '', className = '') {
    const result = document.createElement(tag); result.textContent = text; result.className = className; return result;
}

export class LoreBook {
    constructor(ui) {
        this.ui = ui;
        this.element = node('section', '', 'lore-book');
        this.element.dataset.journalSection = 'lore';
        this.element.setAttribute('aria-label', 'Lore book');
        const heading = node('header', '', 'lore-book__heading');
        heading.append(node('p', 'THE FOURFOLD CHRONICLE', 'lore-book__eyebrow'), node('h2', 'Your book of memories'),
            node('p', 'Remember the people, promises and discoveries that brought you here.'));
        this.overview = node('div', '', 'lore-book__overview');
        const tools = node('div', '', 'lore-book__tools');
        const label = node('label', 'Search your memories');
        this.search = document.createElement('input');
        this.search.type = 'search'; this.search.maxLength = 120;
        this.search.placeholder = 'A person, place or remembered phrase…';
        label.append(this.search);
        this.filters = node('div', '', 'lore-book__filters');
        this.filters.setAttribute('role', 'group'); this.filters.setAttribute('aria-label', 'Memory categories');
        for (const [key, title] of [['all', 'All memories'], ['chapters', 'Chapters'], ['discoveries', 'Discoveries'], ['people', 'People'], ['places', 'Places']]) {
            const button = node('button', title); button.type = 'button'; button.dataset.loreFilter = key;
            ownedEvent(this, button, 'click', () => { this.readingReturn = null; this.category = key; this.renderLibrary(); });
            this.filters.append(button);
        }
        this.count = node('p', '', 'lore-book__count'); this.count.setAttribute('role', 'status');
        tools.append(label, this.filters, this.count);
        const library = node('div', '', 'lore-book__library');
        this.index = node('nav', '', 'lore-book__index'); this.index.setAttribute('aria-label', 'Recorded memories');
        this.article = node('article', '', 'lore-book__page');
        library.append(this.index, this.article);
        this.element.append(heading, this.overview, tools, library);
        ownedEvent(this, this.search, 'input', () => { this.readingReturn = null; this.renderLibrary(); });
        ownedEvent(this, this.element, 'keydown', event => {
            if (event.key !== 'Escape' && (event.target === this.search ||
                [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key))) event.stopPropagation();
        });
    }

    update(quests, identity) {
        const sameReader = identity === this.identity && Boolean(this.model);
        if (!sameReader) {
            this.identity = identity; this.search.value = ''; this.category = 'all'; this.selected = null; this.readingReturn = null;
            this.indexSignature = this.pageSignature = this.overviewSignature = null;
        }
        this.model = buildLoreBook(quests);
        this.renderOverview(); this.renderLibrary({ preserveIndexScroll: sameReader });
    }

    renderOverview() {
        const { current, recap, activeTasks, finaleCompleted } = this.model;
        const tracked = new Set(this.ui.getTrackedObjectives().map(objective => objective.id));
        const tasks = activeTasks.slice().sort((a, b) => Number(tracked.has(b.id)) - Number(tracked.has(a.id)));
        const signature = JSON.stringify([current, recap, tasks, finaleCompleted]);
        if (signature === this.overviewSignature) return;
        this.overviewSignature = signature;
        const now = node('section', '', 'lore-book__current');
        now.append(node('h3', 'What I’m doing now'));
        if (current) {
            const ready = current.accepted && current.maxCount > 0 && current.count >= current.maxCount;
            now.append(node('p', this.ui.getQuestTitle(current), 'lore-book__current-title'),
                node('p', current.accepted ? this.ui.getQuestObjective(current) : 'Speak to Archmage Ilyra in Lanternhold to accept this chapter.'),
                node('p', !current.accepted ? 'Not yet accepted' : ready ? 'Ready to turn in · Return to Ilyra' : `${current.count || 0} / ${current.maxCount || 0} · In progress`, 'lore-book__status'));
            const quest = node('button', 'Open current quest', 'menu-btn'); quest.type = 'button';
            quest.dataset.loreAction = 'current';
            quest.onclick = () => this.ui.setJournalView('story');
            now.append(quest);
        } else if (finaleCompleted) {
            now.append(node('p', 'Your Chronicle is complete', 'lore-book__current-title'),
                node('p', 'You claimed the finale with Ilyra. Revisit your earned memories, finish optional accounts or continue your contracts.'));
        } else now.append(node('p', 'Visit Archmage Ilyra in Lanternhold to revisit your Chronicle and its next steps.'));
        if (tasks.length) {
            now.append(node('h4', 'Other accepted tasks'));
            for (const task of tasks.slice(0, 3)) {
                const action = node('button', '', 'menu-btn lore-book__task'); action.type = 'button';
                action.dataset.loreAction = `task:${task.id}`;
                const ready = task.maxCount > 0 && task.count >= task.maxCount;
                action.append(node('strong', this.ui.getQuestTitle(task)), node('span', this.ui.getQuestObjective(task)),
                    node('small', ready ? 'Ready to turn in' : `${task.count || 0} / ${task.maxCount || 0} · In progress`));
                action.onclick = () => this.ui.openTrackedObjective(task); now.append(action);
            }
        }
        if (tasks.length > 3 || (!current && finaleCompleted)) {
            const journal = node('button', 'Review all quests', 'menu-btn'); journal.type = 'button';
            journal.dataset.loreAction = 'all'; journal.onclick = () => this.ui.setJournalView('all'); now.append(journal);
        }
        if (this.ui.ctx.openWorldMap) {
            const map = node('button', 'Open world map', 'menu-btn'); map.type = 'button';
            map.dataset.loreAction = 'map';
            map.onclick = () => this.ui.ctx.openWorldMap(); now.append(map);
        }
        const summary = node('section', '', 'lore-book__recap');
        summary.append(node('h3', 'Story so far'));
        for (const line of recap.length ? recap : ['Your story is still being written. Completed chapters and discoveries will be collected here as you make them.']) summary.append(node('p', line));
        this.overview.replaceChildren(now, summary);
    }

    renderLibrary({ preserveIndexScroll = false } = {}) {
        if (!this.model) return;
        if (this.readingReturn && !this.model.entries.some(entry => entry.id === this.readingReturn.selected)) this.readingReturn = null;
        const query = this.search.value.trim().toLocaleLowerCase();
        const matches = this.model.entries.filter(entry => (this.category === 'all' ? ['chapters', 'discoveries'].includes(entry.kind) : entry.kind === this.category)
            && [entry.title, entry.context, ...entry.sections.flatMap(section => section.paragraphs)].join(' ').toLocaleLowerCase().includes(query));
        if (!matches.some(entry => entry.id === this.selected)) this.selected = matches[0]?.id || null;
        for (const button of this.filters.children) button.setAttribute('aria-pressed', String(button.dataset.loreFilter === this.category));
        const indexed = ['people', 'places'].includes(this.category);
        const total = this.model.entries.filter(entry => indexed ? entry.kind === this.category : ['chapters', 'discoveries'].includes(entry.kind)).length;
        this.count.textContent = `${matches.length} of ${total} ${indexed ? `remembered ${this.category}` : 'recorded memories'}`;
        const signature = JSON.stringify(matches.map(entry => [entry.id, entry.title, entry.context]));
        if (signature !== this.indexSignature) {
            this.indexSignature = signature;
            const scroll = preserveIndexScroll ? this.index.scrollTop : 0;
            this.index.replaceChildren(...matches.map(entry => {
                const button = node('button'); button.type = 'button'; button.dataset.memoryId = entry.id;
                button.append(node('span', { chapters: 'CHAPTER', discoveries: 'DISCOVERY', people: 'PERSON', places: 'PLACE' }[entry.kind], 'lore-book__eyebrow'),
                    node('strong', entry.title), node('small', entry.context));
                button.onclick = () => {
                    this.readingReturn = null; this.selected = entry.id; this.renderLibrary();
                    const title = this.article.querySelector('h3'); title?.focus({ preventScroll: true });
                    this.article.scrollIntoView?.({ block: 'nearest' });
                };
                return button;
            }));
            this.index.scrollTop = scroll;
        }
        for (const button of this.index.children) button.setAttribute('aria-current', String(button.dataset.memoryId === this.selected));
        const entry = matches.find(entry => entry.id === this.selected);
        const returnEntry = this.readingReturn && this.model.entries.find(memory => memory.id === this.readingReturn.selected);
        const pageSignature = JSON.stringify([entry || [query, this.category, this.model.entries.length], this.readingReturn, returnEntry?.title]);
        if (pageSignature === this.pageSignature) return;
        this.pageSignature = pageSignature;
        const title = node('h3', entry?.title || (this.model.entries.length ? 'No matching memories' : 'The first page awaits'));
        title.tabIndex = -1;
        this.article.replaceChildren(title);
        if (!entry) {
            this.article.append(node('p', this.model.entries.length
                ? 'Try another name or phrase, or choose All memories.'
                : 'Complete a chapter or record a discovery to add it to your book. Unvisited places and future outcomes stay unrevealed.'));
            return;
        }
        this.article.append(node('p', entry.context, 'lore-book__status'));
        if (returnEntry) {
            const back = node('button', `Return to ${returnEntry.title}`, 'menu-btn'); back.type = 'button';
            back.dataset.loreAction = `return:${returnEntry.id}`;
            back.onclick = () => {
                const saved = this.readingReturn; this.readingReturn = null;
                this.search.value = saved.query; this.category = saved.category; this.selected = saved.selected;
                this.renderLibrary(); this.index.scrollTop = saved.scroll;
                this.article.querySelector('h3')?.focus({ preventScroll: true });
            };
            this.article.append(back);
        }
        for (const section of entry.sections) {
            this.article.append(node('h4', section.title));
            for (const paragraph of section.paragraphs) this.article.append(node('p', paragraph));
            if (section.memoryId && this.model.entries.some(memory => memory.id === section.memoryId)) {
                const read = node('button', `Read ${section.title}`, 'menu-btn'); read.type = 'button';
                read.dataset.loreAction = `memory:${section.memoryId}`;
                read.onclick = () => {
                    this.readingReturn = { selected: this.selected, query: this.search.value, category: this.category, scroll: this.index.scrollTop };
                    this.search.value = ''; this.category = 'all'; this.selected = section.memoryId;
                    this.renderLibrary(); this.article.querySelector('h3')?.focus({ preventScroll: true });
                    this.article.scrollIntoView?.({ block: 'nearest' });
                };
                this.article.append(read);
            }
        }
    }

    dispose() { disposeOwnedEvents(this); this.element.remove(); }
}
