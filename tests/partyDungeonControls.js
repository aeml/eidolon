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

// A bounded visibility graph joins verified walking segments around actor
// capsules and the walked hallway corner. A legal side step alone is not a
// route: selecting it then returning to the previous anchor can loop forever.
// canStep(delta, origin) must check the complete floor/body path from origin.
export function partyFormationStep(state, anchor, previousAnchor, canStep, spacing = 4, slotOffset = null, actors = []) {
    const direct = partyFollowStep(state, anchor, spacing);
    if (!direct) return null;
    const angle = Math.atan2(state.z - anchor.z, state.x - anchor.x);
    const approach = previousAnchor && Math.hypot(previousAnchor.x - anchor.x, previousAnchor.z - anchor.z) > 1
        ? Math.atan2(previousAnchor.z - anchor.z, previousAnchor.x - anchor.x) : angle;
    if (!Number.isFinite(slotOffset) && canStep(direct, state)) return direct;
    const nodes = [{ x: state.x, z: state.z, goal: false }];
    const add = (x, z, goal = false) => {
        if (![x, z].every(Number.isFinite)) return;
        const duplicate = nodes.find(node => Math.hypot(node.x - x, node.z - z) < .05);
        if (duplicate) { duplicate.goal ||= goal; return; }
        nodes.push({ x, z, goal });
    };
    const preferredAngle = approach + (Number.isFinite(slotOffset) ? slotOffset : 0);
    const addGoal = direction => add(anchor.x + Math.cos(direction) * (spacing + .5),
        anchor.z + Math.sin(direction) * (spacing + .5), true);
    addGoal(preferredAngle);
    for (let index = 1; index < 16; index++) addGoal(preferredAngle + index * Math.PI / 8);
    // Include cardinal directions for narrow axis-aligned hallway joins.
    for (let index = 0; index < 4; index++) addGoal(index * Math.PI / 2);
    const delta = (from, to) => ({ dx: to.x - from.x, dz: to.z - from.z });
    const firstInput = point => {
        const step = delta(state, point), scale = Math.min(1, 12 / Math.hypot(step.dx, step.dz));
        return { dx: step.dx * scale, dz: step.dz * scale };
    };
    for (const goal of nodes.slice(1)) {
        if (canStep(delta(state, goal), state)) return firstInput(goal);
    }
    if (previousAnchor) add(previousAnchor.x, previousAnchor.z);
    // At most eight nearby bodies contribute detour vertices. All bodies still
    // participate in canStep collision checks; the cap can fail a search, never
    // make an omitted obstacle passable. Twelve sides plus clearance keep their
    // connecting chords outside each actor's collision circle.
    const nearby = actors.filter(actor => [actor.x, actor.z].every(Number.isFinite))
        .map(actor => ({ actor, distance: Math.min(Math.hypot(actor.x - state.x, actor.z - state.z),
            Math.hypot(actor.x - anchor.x, actor.z - anchor.z)) }))
        .filter(entry => entry.distance <= 24).sort((a, b) => a.distance - b.distance).slice(0, 8);
    for (const { actor } of nearby) {
        const radius = ((state.radius || 1.25) + (actor.radius || 1.25) + .1) / Math.cos(Math.PI / 12) + .15;
        for (let index = 0; index < 12; index++) {
            const direction = index * Math.PI / 6;
            add(actor.x + Math.cos(direction) * radius, actor.z + Math.sin(direction) * radius);
        }
    }
    const costs = nodes.map(() => Infinity), parents = nodes.map(() => -1), visited = new Set();
    costs[0] = 0;
    for (let search = 0; search < nodes.length; search++) {
        let current = -1;
        for (let index = 0; index < nodes.length; index++) {
            if (!visited.has(index) && Number.isFinite(costs[index]) && (current < 0 || costs[index] < costs[current])) current = index;
        }
        if (current < 0) break;
        if (nodes[current].goal) {
            while (parents[current] > 0) current = parents[current];
            return firstInput(nodes[current]);
        }
        visited.add(current);
        for (let index = 1; index < nodes.length; index++) {
            if (visited.has(index)) continue;
            const step = delta(nodes[current], nodes[index]), length = Math.hypot(step.dx, step.dz);
            if (length > 24 || (current === 0 && length < 1 && !nodes[index].goal) || costs[current] + length >= costs[index]) continue;
            if (!canStep(step, nodes[current])) continue;
            costs[index] = costs[current] + length;
            parents[index] = current;
        }
    }
    throw new Error('Party formation has no verified walking route');
}

export function partyWarningInputPolicy({ active, safe }) {
    return { holdMelee: active, allowCasts: !active || safe, allowApproach: !active };
}

// Conservative swept-circle reservations, independent of browser scheduling:
// concurrent routes must be separated for their full lengths, not merely have
// different destinations or be clear of actors at the initial snapshot.
export function partyFormationPathsDisjoint(first, a, second, b) {
    if (![first?.x, first?.z, a?.dx, a?.dz, second?.x, second?.z, b?.dx, b?.dz].every(Number.isFinite)) return false;
    const aLength = a.dx ** 2 + a.dz ** 2, bLength = b.dx ** 2 + b.dz ** 2;
    if (aLength <= 0 || bLength <= 0) return false;
    const cross = (x, z, dx, dz) => x * dz - z * dx;
    const determinant = cross(a.dx, a.dz, b.dx, b.dz);
    const qx = second.x - first.x, qz = second.z - first.z;
    if (Math.abs(determinant) > 1e-8) {
        const t = cross(qx, qz, b.dx, b.dz) / determinant;
        const u = cross(qx, qz, a.dx, a.dz) / determinant;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return false;
    }
    const pointDistance = (point, start, delta, length) => {
        const x = point.x - start.x, z = point.z - start.z;
        const t = Math.max(0, Math.min(1, (x * delta.dx + z * delta.dz) / length));
        return (x - t * delta.dx) ** 2 + (z - t * delta.dz) ** 2;
    };
    const endA = { x: first.x + a.dx, z: first.z + a.dz };
    const endB = { x: second.x + b.dx, z: second.z + b.dz };
    const clearance = (first.radius || 1.25) + (second.radius || 1.25) + .1;
    return Math.min(pointDistance(first, second, b, bLength), pointDistance(endA, second, b, bLength),
        pointDistance(second, first, a, aLength), pointDistance(endB, first, a, aLength)) >= clearance ** 2;
}

// Walking a single unit is evidence that an input worked, not that a follower
// caught up. Hold the leader at the waypoint until every actual position is in
// formation. The caller's clock/read/move hooks never mutate game state.
export async function gatherPartyFormation({ read, move, plan, trace, now = Date.now, timeout = 15_000, spacing = 4 }) {
    const started = now(), deadline = started + timeout;
    while (now() < deadline) {
        const states = await read();
        if (states.some(s => s.dead)) throw new Error('Party formation cannot hide a death');
        if (states.some(s => s.instance !== states[0].instance)) throw new Error('Party formation cannot cross instances');
        const needed = states.slice(1).map(state => partyFollowStep(state, states[0], spacing));
        if (needed.every(step => !step)) return;
        const steps = await Promise.all(needed.map((step, index) => step && plan
            ? plan(index + 1, states[index + 1], states[0], spacing) : step));
        const origins = steps.map((step, index) => step?.origin || states[index + 1]);
        const batch = [];
        steps.forEach((step, index) => {
            if (step && batch.every(other => partyFormationPathsDisjoint(origins[index], step,
                origins[other], steps[other]))) batch.push(index);
        });
        // A member can finish moving between the shared snapshot and its own
        // browser's planning read. A null plan triggers another actual-position
        // check; only the distance check above can declare the group gathered.
        if (now() >= deadline) break;
        if (!batch.length) continue;
        trace?.({ phase: 'planned', elapsedMs: now() - started, members: batch.map(index => ({ index: index + 1,
            from: { x: origins[index].x, z: origins[index].z },
            delta: { dx: steps[index].dx, dz: steps[index].dz } })) });
        // Finish every issued input before reporting an error or taking another
        // body snapshot. A failed member never turns another move into success.
        const results = await Promise.allSettled(batch.map(index => move(index + 1, steps[index])));
        trace?.({ phase: 'settled', elapsedMs: now() - started, members: batch.map((index, result) =>
            ({ index: index + 1, outcome: results[result].status })) });
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
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
