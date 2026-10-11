import { firstRockHit } from '../src/core/RockCollision.js';

// QA planning only. Every edge is queried against the production collision
// manager; callers still issue and verify ordinary pointer movement. This never
// changes actor state, collision geometry, camera, cooldowns or server intent.
export function planCollisionAwareWalk(manager, start, radius, target, {
    sampleHeight = () => start.y, clearance = .8, detourMargin = 20, maxQueries = 100000
} = {}) {
    if (!manager?.checkCollision || !start?.clone ||
        ![start.x, start.z, target?.x, target?.z, radius].every(Number.isFinite) || radius <= 0) return null;
    let queries = 0, exhausted = false;
    const localBoxes = (manager.colliders || []).filter(box =>
        box.max.x + radius >= Math.min(start.x, target.x) - detourMargin &&
        box.min.x - radius <= Math.max(start.x, target.x) + detourMargin &&
        box.max.z + radius >= Math.min(start.z, target.z) - detourMargin &&
        box.min.z - radius <= Math.max(start.z, target.z) + detourMargin);
    const crossesBox = (a, b, box) => {
        let enter = 0, leave = 1;
        for (const axis of ['x', 'z']) {
            const low = box.min[axis] - radius, high = box.max[axis] + radius, delta = b[axis] - a[axis];
            if (Math.abs(delta) < 1e-10) { if (a[axis] < low || a[axis] > high) return false; }
            else {
                const u = (low - a[axis]) / delta, v = (high - a[axis]) / delta;
                enter = Math.max(enter, Math.min(u, v)); leave = Math.min(leave, Math.max(u, v));
                if (enter > leave) return false;
            }
        }
        return true;
    };
    const point = p => start.clone().set(p.x, sampleHeight(p.x, p.z), p.z);
    const clear = (a, b) => {
        // Cheap conservative rejection only. Every accepted edge still uses
        // the full production manager at .25-unit intervals. A roof/height
        // exception may refuse a QA plan; it can never admit unchecked travel.
        if (localBoxes.some(box => crossesBox(a, b, box)) ||
            firstRockHit(manager.rockSolids || [], a, b, radius).hit) return false;
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25));
        let previous = point(a);
        for (let index = 1; index <= steps; index++) {
            if (++queries > maxQueries) { exhausted = true; return false; }
            const next = point({ x: a.x + (b.x - a.x) * index / steps, z: a.z + (b.z - a.z) * index / steps });
            const corrected = manager.checkCollision(next, radius, previous);
            if (corrected && corrected.distanceTo(next) > .00001) return false;
            previous = next;
        }
        return true;
    };
    const finish = waypoints => ({ waypoints, queries, detour: waypoints.length > 1 });
    if (clear(start, target)) return finish([{ x: target.x, z: target.z }]);
    const nodes = [{ x: start.x, z: start.z }, { x: target.x, z: target.z }];
    const padding = radius + clearance;
    const add = p => {
        if (![p.x, p.z].every(Number.isFinite) ||
            p.x < Math.min(start.x, target.x) - detourMargin || p.x > Math.max(start.x, target.x) + detourMargin ||
            p.z < Math.min(start.z, target.z) - detourMargin || p.z > Math.max(start.z, target.z) + detourMargin ||
            nodes.some(n => Math.hypot(n.x - p.x, n.z - p.z) < .01)) return;
        nodes.push(p);
    };
    for (const box of localBoxes) {
        for (const x of [box.min.x - padding, box.max.x + padding])
            for (const z of [box.min.z - padding, box.max.z + padding]) add({ x, z });
    }
    // Convex rock vertices are the intersections of adjacent outward planes.
    // Expand by the actual actor radius plus arrival clearance, rather than
    // following a visual mesh or allowing the movement helper to slide through.
    for (const rock of manager.rockSolids || []) for (let index = 0; index < rock.planes.length; index++) {
        const a = rock.planes[index], b = rock.planes[(index + 1) % rock.planes.length];
        const determinant = a.x * b.z - b.x * a.z;
        if (Math.abs(determinant) < 1e-8) continue;
        const u = a.limit + padding, v = b.limit + padding;
        add({ x: (u * b.z - v * a.z) / determinant, z: (a.x * v - b.x * u) / determinant });
    }
    // Bounded visibility graph. Unsupported/overcrowded geometry is an explicit
    // unavailable plan, never a reason to drop a collider or issue unchecked input.
    if (nodes.length > 128 || exhausted) return null;
    const costs = nodes.map(() => Infinity), parents = [], visited = new Set();
    costs[0] = 0;
    while (visited.size < nodes.length && !exhausted) {
        let current = -1, best = Infinity;
        for (let index = 0; index < nodes.length; index++) {
            const estimate = costs[index] + Math.hypot(nodes[index].x - target.x, nodes[index].z - target.z);
            if (!visited.has(index) && estimate < best) { best = estimate; current = index; }
        }
        if (current < 0) break;
        if (current === 1) {
            const waypoints = [];
            for (let index = 1; index !== 0; index = parents[index]) waypoints.unshift(nodes[index]);
            return finish(waypoints);
        }
        visited.add(current);
        for (let next = 1; next < nodes.length && !exhausted; next++) {
            if (visited.has(next)) continue;
            const cost = costs[current] + Math.hypot(nodes[current].x - nodes[next].x, nodes[current].z - nodes[next].z);
            if (cost >= costs[next] || !clear(nodes[current], nodes[next])) continue;
            costs[next] = cost; parents[next] = current;
        }
    }
    return null;
}
