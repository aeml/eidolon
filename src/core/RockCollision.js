// Keep this math contract aligned with server/internal/game/world_rock_solids.go.
// The generator records JS results for independent Go parity checks. No scene,
// actor, rendering or automatic runtime activation belongs in this module.
export function compileRockSolids(definitions) {
    const ids = new Set();
    return definitions.map(({ id, outline }) => {
        if (!id || ids.has(id) || outline.length < 3) throw new Error('Invalid rock solid');
        ids.add(id);
        const planes = outline.map((a, i) => {
            const b = outline[(i + 1) % outline.length], dx = b[0] - a[0], dz = b[1] - a[1];
            const length = Math.hypot(dx, dz);
            if (![...a, ...b].every(Number.isFinite) || length < 1e-6) throw new Error('Invalid rock edge');
            const x = dz / length, z = -dx / length, limit = x * a[0] + z * a[1];
            if (outline.some(p => x * p[0] + z * p[1] > limit + 1e-7)) throw new Error('Rock must be convex and counterclockwise');
            return { x, z, limit };
        });
        return { id, planes };
    });
}

export function insideRockSolids(solids, p, radius) {
    return solids.some(solid => solid.planes.every(plane =>
        plane.x * p.x + plane.z * p.z < plane.limit + radius - 1e-7));
}

export function recoverRockPosition(solids, p, radius) {
    if (!insideRockSolids(solids, p, radius)) return { x: p.x, z: p.z };
    // Tiny separation pushes need a tiny correction, not a half-metre radial
    // hop. Prefer the closest valid face projection outside the entire union.
    let best = null, distance = 64;
    for (const solid of solids) for (const plane of solid.planes) {
        const step = plane.limit + radius + .001 - plane.x * p.x - plane.z * p.z;
        if (step <= 0 || step >= distance) continue;
        const candidate = { x: p.x + plane.x * step, z: p.z + plane.z * step };
        if (!insideRockSolids(solids, candidate, radius)) { best = candidate; distance = step; }
    }
    if (best) return best;
    for (let distance = .5; distance <= 64; distance += .5) for (let direction = 0; direction < 32; direction++) {
        const angle = direction * Math.PI / 16;
        const candidate = { x: p.x + Math.cos(angle) * distance, z: p.z + Math.sin(angle) * distance };
        if (!insideRockSolids(solids, candidate, radius + .001)) return candidate;
    }
    return { x: p.x, z: p.z };
}

export function firstRockHit(solids, start, end, radius) {
    if (insideRockSolids(solids, start, radius)) return { at: 0, normal: { x: 0, z: 0 }, hit: true };
    const dx = end.x - start.x, dz = end.z - start.z;
    let first = 1, normal = { x: 0, z: 0 }, hit = false;
    for (const solid of solids) {
        let enter = 0, leave = 1, outward = { x: 0, z: 0 }, valid = true;
        for (const plane of solid.planes) {
            const signed = plane.x * start.x + plane.z * start.z - plane.limit - radius;
            const speed = plane.x * dx + plane.z * dz;
            if (Math.abs(speed) < 1e-12) {
                if (signed > 0) { valid = false; break; }
                continue;
            }
            const at = -signed / speed;
            if (speed < 0 && at >= enter) { enter = at; outward = { x: plane.x, z: plane.z }; }
            if (speed > 0) leave = Math.min(leave, at);
            if (enter > leave) { valid = false; break; }
        }
        if (valid && enter >= 0 && enter <= first && leave >= 0 && outward.x * dx + outward.z * dz < -1e-10) {
            first = enter; normal = outward; hit = true;
        }
    }
    return { at: first, normal, hit };
}

export function moveAroundRockSolids(solids, start, end, radius) {
    let dx = end.x - start.x, dz = end.z - start.z;
    const p = recoverRockPosition(solids, start, radius);
    for (let contact = 0; contact < 4; contact++) {
        const target = { x: p.x + dx, z: p.z + dz };
        const { at, normal, hit } = firstRockHit(solids, p, target, radius);
        if (!hit) return target;
        const travel = Math.max(0, at - .001 / Math.hypot(dx, dz));
        p.x += dx * travel; p.z += dz * travel;
        dx *= 1 - travel; dz *= 1 - travel;
        const inward = Math.min(0, dx * normal.x + dz * normal.z);
        dx -= normal.x * inward; dz -= normal.z * inward;
    }
    return p;
}

export function stopAtRockSolids(solids, start, end, radius) {
    const { at, hit } = firstRockHit(solids, start, end, radius);
    if (!hit) return { x: end.x, z: end.z };
    const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz);
    if (length === 0) return { x: start.x, z: start.z };
    const travel = Math.max(0, at - .001 / length);
    return { x: start.x + dx * travel, z: start.z + dz * travel };
}
