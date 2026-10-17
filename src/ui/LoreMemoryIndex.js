import { CHRONICLE_WITNESSES } from '../data/chronicleWitnesses.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';

// Names identify references, never unlock biographies. Every displayed word
// below comes from an already earned memory supplied by the personal book.
const people = ['Ilyra', 'Mara', 'Dain', 'Maelin', 'Orun', 'Neris', 'Pyralis', 'Zephyrion', 'Malachar']
    .map(name => ({ id: name.toLowerCase(), aliases: [name] }));
for (const witness of CHRONICLE_WITNESSES) {
    const known = people.find(person => person.aliases.includes(witness.name.split(' ')[0]));
    if (known) known.aliases.push(witness.name);
    else people.push({ id: witness.id, aliases: [witness.name] });
}
const places = [...Object.values(WORLD_REGIONS).map(region => ({ id: region.id, name: region.name })),
    { id: 'dark', name: 'Dark Realm' }];
const words = text => String(text).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const material = entry => [entry.title, ...entry.sections.flatMap(section => [section.title, ...section.paragraphs])].join(' ');

function indexEntry(kind, id, title, memories, excerpt = entry => entry.sections.flatMap(section => section.paragraphs)[0]) {
    return { id: `${kind}:${id}`, kind, title,
        context: `Remembered in ${memories.length} earned ${memories.length === 1 ? 'account' : 'accounts'}`,
        sections: memories.map(entry => ({ title: entry.title, memoryId: entry.id,
            paragraphs: [excerpt(entry)].filter(Boolean) })) };
}

export function buildLoreMemoryIndex(memories) {
    const earned = memories.filter(entry => entry.kind === 'chapters' || entry.kind === 'discoveries');
    // Reuse tokenization only within this projection. A later authoritative
    // update or another character always gets fresh personal evidence.
    const tokensByText = new Map();
    const tokensFor = text => {
        if (!tokensByText.has(text)) tokensByText.set(text, words(text));
        return tokensByText.get(text);
    };
    const mentions = (text, name) => {
        const tokens = tokensFor(text), wanted = tokensFor(name);
        return tokens.some((_, start) => wanted.every((word, offset) => tokens[start + offset] === word));
    };
    const textByEntry = new Map(earned.map(entry => [entry, material(entry)]));
    const entries = [];
    for (const person of people) {
        const references = earned.filter(entry => person.aliases.some(name => mentions(textByEntry.get(entry), name)));
        if (!references.length) continue;
        // Keep one stable entry per person; a surname appears only after an
        // earned account actually uses it. Never infer an unrecorded identity.
        const title = person.aliases.filter(name => references.some(entry => mentions(textByEntry.get(entry), name)))
            .sort((a, b) => b.length - a.length)[0];
        entries.push(indexEntry('people', person.id, title, references, entry => {
            const related = entry.sections.find(section => person.aliases.some(name => mentions(section.title, name)
                || section.paragraphs.some(paragraph => mentions(paragraph, name))));
            return related?.paragraphs.find(paragraph => person.aliases.some(name => mentions(paragraph, name)))
                || related?.paragraphs[0] || entry.sections.flatMap(section => section.paragraphs)[0];
        }));
    }
    for (const place of places) {
        const references = earned.filter(entry => entry.realm === place.id || mentions(textByEntry.get(entry), place.name));
        if (references.length) entries.push(indexEntry('places', place.id, place.name, references));
    }
    return entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
