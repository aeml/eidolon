// Search/travel can be interrupted by ordinary combat too. Recover only an
// observed death; do not hide navigation errors while the character is alive.
export async function findHuntTargetWithRecovery({ findTarget, isDead, recover }) {
    if (await isDead()) {
        await recover();
        return null;
    }
    try {
        return await findTarget();
    } catch (error) {
        if (!await isDead()) throw error;
        await recover();
        return null;
    }
}
