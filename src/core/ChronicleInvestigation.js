import { chronicleInvestigations } from '../data/chronicleInvestigations.generated.js';
import { chronicleHunts } from '../data/chronicleHunts.generated.js';

const chaptersById = new Map(chronicleInvestigations.map(chapter => [chapter.id, chapter]));
export const CHRONICLE_CHAPTER_COUNT = 15 + chronicleInvestigations.length + chronicleHunts.length;

export function getCurrentChronicleQuest(quests) {
    return (quests || []).filter(quest => (quest?.category === 'chronicle' || quest?.id?.startsWith('chronicle_')) && !quest.completed && !quest.legacyOptional)
        .sort((left, right) => (left.chapter || 0) - (right.chapter || 0))[0] || null;
}

export function getChronicleInvestigation(questId) {
    return chaptersById.get(questId) || null;
}

// Counts are not discovery identities. A reconnect can contain a sparse set
// (for example, the root and stone but not the new growth); never reveal the
// first N entries simply because the server says N discoveries are recorded.
export function getRecordedChronicleDiscoveries(quest) {
    const chapter = getChronicleInvestigation(quest?.id);
    const mask = quest?.investigationMask;
    if (!chapter || (!quest.accepted && !quest.completed) || !Number.isInteger(mask) || mask < 0 || mask > 0xffffffff) return [];
    return chapter.sites.filter((site, index) => (mask & (1 << index)) !== 0);
}
