// Ordinary target selection may move, attack or wait for replicated credit.
// Snapshot progress after it finishes, and never start a watchdog for a credit
// beyond the objective's cap. This does not complete or award the quest.
export async function selectUnfinishedObjectiveTarget(readCount, selectTarget, requiredCount) {
    if (!Number.isInteger(requiredCount) || requiredCount <= 0) throw new Error('Invalid objective requirement');
    const read = async () => {
        const count = await readCount();
        if (!Number.isInteger(count) || count < 0) throw new Error('Invalid objective credit');
        return count;
    };
    if (await read() >= requiredCount) return null;
    const target = await selectTarget();
    const before = await read();
    return before >= requiredCount ? null : { target, before };
}
