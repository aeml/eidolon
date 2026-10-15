import { getCurrentChronicleQuest, getRecordedChronicleDiscoveries, getChronicleInvestigation } from '../core/ChronicleInvestigation.js';
import { CHRONICLE_RESTORATIONS, hasChronicleRestoration } from '../core/ChronicleRestoration.js';
import { getChronicleRecap } from './ChronicleRecap.js';
import { getIlyraCompletionReply } from './QuestConversation.js';
import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

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
                sections: [{ title: 'Recovered words', paragraphs: paragraphs(site.text) }]
            });
        }
    }
    for (const [realm, restoration] of Object.entries(CHRONICLE_RESTORATIONS)) {
        if (!hasChronicleRestoration(story, realm)) continue;
        entries.set(`restoration:${realm}`, {
            id: `restoration:${realm}`, kind: 'discoveries', title: `After the Vigil · ${restoration.title}`,
            context: `${realm} · Restoration account`,
            sections: [{ title: 'What changed', paragraphs: paragraphs(restoration.text) }]
        });
    }
    return { current: getCurrentChronicleQuest(story), recap: getChronicleRecap(story), entries: [...entries.values()] };
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
        for (const [key, title] of [['all', 'All memories'], ['chapters', 'Chapters'], ['discoveries', 'Discoveries']]) {
            const button = node('button', title); button.type = 'button'; button.dataset.loreFilter = key;
            ownedEvent(this, button, 'click', () => { this.category = key; this.renderLibrary(); });
            this.filters.append(button);
        }
        this.count = node('p', '', 'lore-book__count'); this.count.setAttribute('role', 'status');
        tools.append(label, this.filters, this.count);
        const library = node('div', '', 'lore-book__library');
        this.index = node('nav', '', 'lore-book__index'); this.index.setAttribute('aria-label', 'Recorded memories');
        this.article = node('article', '', 'lore-book__page');
        library.append(this.index, this.article);
        this.element.append(heading, this.overview, tools, library);
        ownedEvent(this, this.search, 'input', () => this.renderLibrary());
        ownedEvent(this, this.element, 'keydown', event => {
            if (event.key !== 'Escape' && (event.target === this.search ||
                [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key))) event.stopPropagation();
        });
    }

    update(quests, identity) {
        if (identity !== this.identity || !this.model) {
            this.identity = identity; this.search.value = ''; this.category = 'all'; this.selected = null;
            this.indexSignature = this.pageSignature = this.overviewSignature = null;
        }
        this.model = buildLoreBook(quests);
        this.renderOverview(); this.renderLibrary();
    }

    renderOverview() {
        const { current, recap } = this.model;
        const signature = JSON.stringify([current, recap]);
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
            quest.onclick = () => this.ui.setJournalView('story');
            now.append(quest);
        } else now.append(node('p', 'Visit Archmage Ilyra in Lanternhold to revisit your Chronicle and its next steps.'));
        if (this.ui.ctx.openWorldMap) {
            const map = node('button', 'Open world map', 'menu-btn'); map.type = 'button';
            map.onclick = () => this.ui.ctx.openWorldMap(); now.append(map);
        }
        const summary = node('section', '', 'lore-book__recap');
        summary.append(node('h3', 'Story so far'));
        for (const line of recap.length ? recap : ['Your story is still being written. Completed chapters and discoveries will be collected here as you make them.']) summary.append(node('p', line));
        this.overview.replaceChildren(now, summary);
    }

    renderLibrary() {
        if (!this.model) return;
        const query = this.search.value.trim().toLocaleLowerCase();
        const matches = this.model.entries.filter(entry => (this.category === 'all' || entry.kind === this.category)
            && [entry.title, entry.context, ...entry.sections.flatMap(section => section.paragraphs)].join(' ').toLocaleLowerCase().includes(query));
        if (!matches.some(entry => entry.id === this.selected)) this.selected = matches[0]?.id || null;
        for (const button of this.filters.children) button.setAttribute('aria-pressed', String(button.dataset.loreFilter === this.category));
        this.count.textContent = `${matches.length} of ${this.model.entries.length} recorded memories`;
        const signature = JSON.stringify(matches.map(entry => [entry.id, entry.title, entry.context]));
        if (signature !== this.indexSignature) {
            this.indexSignature = signature;
            this.index.replaceChildren(...matches.map(entry => {
                const button = node('button'); button.type = 'button'; button.dataset.memoryId = entry.id;
                button.append(node('span', entry.kind === 'chapters' ? 'CHAPTER' : 'DISCOVERY', 'lore-book__eyebrow'),
                    node('strong', entry.title), node('small', entry.context));
                button.onclick = () => {
                    this.selected = entry.id; this.renderLibrary();
                    const title = this.article.querySelector('h3'); title?.focus({ preventScroll: true });
                    this.article.scrollIntoView?.({ block: 'nearest' });
                };
                return button;
            }));
        }
        for (const button of this.index.children) button.setAttribute('aria-current', String(button.dataset.memoryId === this.selected));
        const entry = matches.find(entry => entry.id === this.selected);
        const pageSignature = JSON.stringify(entry || [query, this.category, this.model.entries.length]);
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
        for (const section of entry.sections) {
            this.article.append(node('h4', section.title));
            for (const paragraph of section.paragraphs) this.article.append(node('p', paragraph));
        }
    }

    dispose() { disposeOwnedEvents(this); this.element.remove(); }
}
