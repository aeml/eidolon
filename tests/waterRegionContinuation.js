// Decide from the actual restored quest, never an assumed or synthetic count.
// Completed work is retained; accepted work still needs its manual turn-in.
export function waterChapterContinuation(quest, region = 'Water') {
    if (!quest || !Number.isInteger(quest.count) || !Number.isInteger(quest.maxCount) ||
        quest.maxCount < 1 || quest.count < 0 || quest.count > quest.maxCount ||
        typeof quest.accepted !== 'boolean' || typeof quest.completed !== 'boolean' ||
        (!quest.accepted && (quest.completed || quest.count !== 0)) ||
        (quest.completed && quest.count !== quest.maxCount)) {
        throw new Error(`Missing or inconsistent saved ${region} chapter`);
    }
    return quest.completed ? 'completed' : quest.accepted ? 'accepted' : 'offered';
}
