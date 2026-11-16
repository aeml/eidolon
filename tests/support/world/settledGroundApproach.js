// Prepared spell-placement QA: movement progress is not arrival. Read the
// waypoint only after pending movement/camera tracking settle, within the same
// original 45-second approach budget and two-unit tolerance.
export async function approachSettledGround({ destinationZ, read, settle, move, now = Date.now }) {
    if (!Number.isFinite(destinationZ)) throw new Error('Ground waypoint must be finite');
    const deadline = now() + 45_000;
    while (now() < deadline) {
        await settle(deadline);
        const state = await read();
        if (!Number.isFinite(state?.z)) throw new Error('Ground position must be finite');
        if (now() >= deadline) break;
        if (!state.settled) continue;
        const deltaZ = destinationZ - state.z;
        if (Math.abs(deltaZ) < 2) return state;
        await move(0, Math.max(-12, Math.min(12, deltaZ)));
    }
    throw new Error('Ground waypoint was not reached and settled within 45 seconds');
}
