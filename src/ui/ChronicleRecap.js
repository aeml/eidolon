import { CHRONICLE_RESTORATIONS, hasChronicleRestoration } from '../core/ChronicleRestoration.js';
import { PORTAL_DIRECTIONS } from '../data/worldLocations.js';
import { darkRealmChapters } from '../data/chronicleCatalog.js';

const ROADS = [
    ['earth', 'chronicle_03_roots_remember', 'Verdant Bastion', 'Rootheart'],
    ['water', 'chronicle_05_drowned_name', 'Abyssal Well', 'Tidestar'],
    ['fire', 'chronicle_07_crown_of_embers', 'Molten Core', 'Ember Crown'],
    ['air', 'chronicle_09_sky_answers', 'Tempest Spire', 'Skyglass']
];

// Only personally completed receipts reveal these summaries. Ready objectives,
// level, party access and legacy optional chapters cannot imply another milestone.
export function getChronicleRecap(quests) {
    const records = Array.isArray(quests) ? quests.filter(Boolean) : [];
    const complete = id => records.some(q => q?.id === id && q.completed === true);
    const lines = [];
    if (complete('chronicle_01_bell_below')) lines.push('Ilyra traced the dissonant echoes beneath Lanternhold. The four Eidolons shelter mortal lands through their crystals; the failing covenant needs your help.');
    for (const [realm, id, dungeon, crystal] of ROADS) {
        if (hasChronicleRestoration(records, realm)) {
            lines.push(`${crystal} restored: you defended Maelin’s Vigil and reported the repair to Ilyra. Read “After the Vigil · ${CHRONICLE_RESTORATIONS[realm].title}” below for what changed.`);
        } else if (complete(id)) {
            lines.push(`${dungeon} cleared: you uncovered the road to ${crystal}’s separate raid sanctum. Opening the road did not repair the crystal; its Vigil still awaits.`);
        }
    }
    if (ROADS.every(([realm]) => hasChronicleRestoration(records, realm))) {
        lines.push(`The four repaired crystals can resonate together. At level 100, enter the shared Dark Realm expedition through the Fourfold Portal. ${PORTAL_DIRECTIONS}`);
    }
    const expedition = darkRealmChapters.findLast(chapter => complete(chapter.id));
    if (expedition) lines.push(`Last recovered expedition account · ${expedition.title}: ${expedition.summary}`);
    if (complete('chronicle_14_resonance_gate')) lines.push('The Umbral Nexus yielded the Fifth Note, and you claimed it with Ilyra. The Dungeon Guide in Lanternhold can prepare your private court raid; the Fourfold Portal is the shared expedition entrance, not the throne room.');
    if (complete('chronicle_15_dark_king')) lines.push('Malachar has fallen, and you personally completed the finale with Ilyra. Return to her to reread A Letter Without a Throne. The end of his reign is not the end of Eidolon’s story.');
    return lines;
}

export function appendChronicleRecap(parent, quests, previous) {
    const lines = getChronicleRecap(quests);
    if (!lines.length) return;
    const recap = previous || document.createElement('details');
    if (!previous) {
        recap.className = 'quest-chronicle-recap';
        const heading = document.createElement('summary');
        heading.textContent = 'Your journey so far';
        recap.append(heading, document.createElement('div'));
    }
    const body = recap.lastElementChild;
    const paragraphs = [...body.children];
    if (paragraphs.length !== lines.length || lines.some((line, i) => paragraphs[i]?.textContent !== line)) {
        body.replaceChildren(...lines.map(line => {
            const paragraph = document.createElement('p');
            paragraph.textContent = line;
            return paragraph;
        }));
    }
    parent.append(recap);
}
