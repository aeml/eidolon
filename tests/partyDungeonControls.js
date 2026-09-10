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

// The static floor query does not include actors. Check the same logical
// circles used by entity collision, allowing movement away from an existing
// overlap but never a new intersection or deeper penetration.
export function partyPathAvoidsActors(state, step, actors, radius = 1.25) {
    const lengthSquared = step.dx ** 2 + step.dz ** 2;
    if (!Number.isFinite(lengthSquared) || lengthSquared <= 0) return false;
    return actors.every(actor => {
        const x = actor.x - state.x, z = actor.z - state.z;
        const separation = radius + (actor.radius || 1.25) + .1;
        const startSquared = x * x + z * z;
        const dot = x * step.dx + z * step.dz;
        // CollisionManager treats distances below .001 as coincident and
        // applies a deterministic separation. Float32 replication can place a
        // shared spawn on either side of that origin; do not forbid departure.
        if (startSquared < .001 ** 2) return true;
        if (startSquared < separation * separation) return dot <= 0;
        const t = Math.max(0, Math.min(1, dot / lengthSquared));
        return (x - t * step.dx) ** 2 + (z - t * step.dz) ** 2 >= separation * separation;
    });
}

// At a hallway turn, a direct chord to the tank can cross a wall. Every prior
// gathering ended near the previous anchor; use that already-walked corner as
// an intermediate destination when the direct segment is not physically clear.
export function partyFormationStep(state, anchor, previousAnchor, canStep, spacing = 4) {
    const direct = partyFollowStep(state, anchor, spacing);
    if (!direct || canStep(direct)) return direct;
    // Do not aim every follower at the same occupied point on the gathering
    // circle. Nearby alternatives retain the same formation radius.
    const angle = Math.atan2(state.z - anchor.z, state.x - anchor.x);
    for (const offset of [.5, -.5, 1, -1, 1.5, -1.5, Math.PI]) {
        const destination = { x: anchor.x + Math.cos(angle + offset) * spacing,
            z: anchor.z + Math.sin(angle + offset) * spacing };
        const alternative = partyFollowStep(state, destination, 0);
        if (alternative && canStep(alternative)) return alternative;
    }
    const via = previousAnchor ? partyFollowStep(state, previousAnchor, 0) : null;
    if (via && canStep(via)) return via;
    // A nearby body can block every longer approach. Take a short lateral
    // step first, only if its complete floor/body path is verified clear.
    for (const distance of [3, -3, 4.5, -4.5]) {
        const side = { dx: -Math.sin(angle) * distance, dz: Math.cos(angle) * distance };
        if (canStep(side)) return side;
    }
    throw new Error('Party formation has no verified walking segment');
}

export function partyWarningInputPolicy({ active, safe }) {
    return { holdMelee: active, allowCasts: !active || safe, allowApproach: !active };
}

// Walking a single unit is evidence that an input worked, not that a follower
// caught up. Hold the leader at the waypoint until every actual position is in
// formation. The caller's clock/read/move hooks never mutate game state.
export async function gatherPartyFormation({ read, move, plan, now = Date.now, timeout = 15_000, spacing = 4 }) {
    const deadline = now() + timeout;
    while (now() < deadline) {
        const states = await read();
        if (states.some(s => s.dead)) throw new Error('Party formation cannot hide a death');
        if (states.some(s => s.instance !== states[0].instance)) throw new Error('Party formation cannot cross instances');
        const needed = states.slice(1).map(state => partyFollowStep(state, states[0], spacing));
        if (needed.every(step => !step)) return;
        // Simultaneous planning sees the same unoccupied destination for all
        // followers. Finish one real move, then reread before planning another;
        // otherwise a static body-safe path can become occupied during input.
        const index = needed.findIndex(Boolean) + 1;
        const step = plan ? await plan(index, states[index], states[0], spacing) : needed[index - 1];
        // A member can finish moving between the shared snapshot and its own
        // browser's planning read. A null plan triggers another actual-position
        // check; only the distance check above can declare the group gathered.
        if (step) await move(index, step);
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
