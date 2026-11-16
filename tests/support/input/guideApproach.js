// Navigation only: callers must still acquire the real NPC hover and click it.
export async function approachStoryWizard({ read, move, settle }) {
    for (let step = 0; step <= 12; step++) {
        // A ground input receipt proves movement started, not that it finished.
        // Reprojecting from a moving camera can steer the next click elsewhere.
        await settle();
        const { player, wizard, range } = await read();
        const dx = wizard?.x - player?.x, dz = wizard?.z - player?.z;
        const distance = Math.hypot(dx, dz);
        if (!Number.isFinite(distance) || !Number.isFinite(range) || range < 2) {
            throw new Error('Story wizard approach requires a live NPC and interaction range');
        }
        if (distance <= range - 1) return;
        if (step === 12) throw new Error(`Story wizard remains out of range (${distance.toFixed(2)}m)`);
        const scale = Math.min(12, distance - (range - 2)) / distance;
        await move(dx * scale, dz * scale, { moveOnly: true, allowJumpFallback: false });
    }
}

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
