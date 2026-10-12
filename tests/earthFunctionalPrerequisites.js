import { chronicleHunts } from '../src/data/chronicleHunts.generated.js';
import { chronicleExpeditions } from '../src/data/chronicleExpeditions.generated.js';

const additions = [...chronicleHunts.filter(q => q.id.startsWith('chronicle_earth_')).map(q => ({...q, type: 'KILL'})),
    ...chronicleExpeditions.filter(q => q.id.startsWith('chronicle_earth_') && q.type === 'INVESTIGATE')];
const before = new Map(additions.map(q => [q.beforeQuestId,q]));

export function earthPrerequisitesBefore(nextChapter) {
    const result = [], seen = new Set();
    function visit(id) {
        const q = before.get(id);
        if (!q) return;
        if (seen.has(q.id)) throw new Error(`Cyclic Earth prerequisite: ${q.id}`);
        seen.add(q.id); visit(q.id); result.push(q);
    }
    visit(nextChapter);
    return result;
}

// Orchestration only: every callback must earn its objective and turn it in.
export async function earnEarthPrerequisitesBefore(nextChapter, earnChapter) {
    for (const chapter of earthPrerequisitesBefore(nextChapter)) await earnChapter(chapter);
}
