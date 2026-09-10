// Input planning only: retain spacing around the Fighter instead of aiming
// followers at the same point (which may be covered by a large boss model).
export function partyFollowStep(state, anchor, spacing = 4) {
    if (![state?.x, state?.z, anchor?.x, anchor?.z, spacing].every(Number.isFinite) || spacing < 0) {
        throw new Error('Party following requires finite world coordinates and nonnegative spacing');
    }
    const dx = anchor.x - state.x, dz = anchor.z - state.z, distance = Math.hypot(dx, dz);
    const travel = Math.min(12, distance - spacing);
    // The ordinary movement helper requires a one-unit witnessed displacement.
    if (travel < 1) return null;
    return { dx: dx * travel / distance, dz: dz * travel / distance };
}

export const PARTY_FOLLOW_INPUT_OPTIONS = Object.freeze({ moveOnly: true, allowJumpFallback: false });

// Look for an exposed point on the ally's real hitbox. Projection onto the
// canvas alone does not prove that the foreground boss isn't under the cursor.
// These hooks perform ordinary mouse input/read-only observations, never set
// hoveredEntity or invoke a skill/network command directly.
export async function acquirePartyAllyPointer(input, targetId) {
    for (const point of [null, { x: .5, y: .85, z: .5 }, { x: .15, y: .5, z: .5 },
        { x: .85, y: .5, z: .5 }, { x: .5, y: .5, z: .15 }, { x: .5, y: .5, z: .85 }]) {
        const projected = await input.project(targetId, point);
        if (!projected?.visible) continue;
        await input.move(projected.x, projected.y);
        await input.settle();
        if (await input.hoveredId() === targetId) return true;
    }
    return false;
}
