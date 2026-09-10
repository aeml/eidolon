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

// Walking a single unit is evidence that an input worked, not that a follower
// caught up. Hold the leader at the waypoint until every actual position is in
// formation. The caller's clock/read/move hooks never mutate game state.
export async function gatherPartyFormation({ read, move, now = Date.now, timeout = 15_000, spacing = 4 }) {
    const deadline = now() + timeout;
    while (now() < deadline) {
        const states = await read();
        if (states.some(s => s.dead)) throw new Error('Party formation cannot hide a death');
        const steps = states.slice(1).map(state => partyFollowStep(state, states[0], spacing));
        if (steps.every(step => !step)) return;
        await Promise.all(steps.map((step, index) => step ? move(index + 1, step) : undefined));
    }
    throw new Error('Party failed to gather before the next pull');
}

// Read-only input planning for the replicated warning circles. The caller
// validates each complete route against real collision and encounter bounds.
export function planPartyTelegraphEscape(state, warnings, canStep = () => true) {
    if (![state?.x, state?.z].every(Number.isFinite)) throw new Error('Invalid party position');
    const circles = warnings.filter(w => [w?.x, w?.z, w?.radius].every(Number.isFinite) && w.radius > 0);
    const danger = circles.find(w => Math.hypot(state.x - w.x, state.z - w.z) < w.radius + 1.5);
    if (!danger) return null;
    const angle = Math.atan2(state.z - danger.z, state.x - danger.x);
    const candidates = [0, .25, -.25, .5, -.5, 1, -1, Math.PI].map(offset => {
        const x = danger.x + Math.cos(angle + offset) * (danger.radius + 2) - state.x;
        const z = danger.z + Math.sin(angle + offset) * (danger.radius + 2) - state.z;
        return { x, z };
    }).filter(delta => Math.hypot(delta.x, delta.z) >= 1 && Math.hypot(delta.x, delta.z) <= 18)
        .filter(delta => circles.every(w => Math.hypot(state.x + delta.x - w.x, state.z + delta.z - w.z) >= w.radius + 1.5))
        .filter(delta => canStep(delta))
        .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    return candidates[0] || null;
}

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
