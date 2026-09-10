// Navigation only: callers must still acquire the real NPC hover and click it.
export async function approachTownGuide({ project, read, move, settle }) {
    for (let step = 0; step < 4; step++) {
        await settle();
        const point = await project();
        if (point?.visible) return point;
        const player = await read();
        const dx = -player.x, dz = 240 - player.z;
        const distance = Math.hypot(dx, dz);
        if (!Number.isFinite(distance)) throw new Error('Invalid town guide approach position');
        if (distance <= 1) break; // No invalid zero-length input if its model is unavailable.
        const scale = Math.min(1, 16 / distance);
        await move(dx * scale, dz * scale, { moveOnly: true, allowJumpFallback: false });
    }
    await settle();
    return project();
}
