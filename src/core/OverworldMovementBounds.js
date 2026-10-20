import { WORLD_GEOGRAPHY } from '../data/worldGeography.js';

const regions = WORLD_GEOGRAPHY.regions.filter(region => region.id !== 'town');

export function constrainOverworldMovement(start, end) {
    let nearest = start, best = Infinity;
    for (const r of regions) {
        const x = Math.max(r.minX, Math.min(r.maxX, start.x));
        const z = Math.max(r.minZ, Math.min(r.maxZ, start.z));
        const distance = (x - start.x) ** 2 + (z - start.z) ** 2;
        if (distance < best) { best = distance; nearest = { x, z }; }
    }
    if (best > 0) {
        best = Infinity;
        for (const r of regions) {
            const x = Math.max(r.minX + 2.5, Math.min(r.maxX - 2.5, start.x));
            const z = Math.max(r.minZ + 2.5, Math.min(r.maxZ - 2.5, start.z));
            const distance = (x - start.x) ** 2 + (z - start.z) ** 2;
            if (distance < best) { best = distance; nearest = { x, z }; }
        }
        return nearest;
    }
    const dx = end.x - start.x, dz = end.z - start.z, intervals = [];
    for (const r of regions) {
        let enter = 0, leave = 1, valid = true;
        for (const [position, delta, min, max] of [[start.x, dx, r.minX, r.maxX], [start.z, dz, r.minZ, r.maxZ]]) {
            if (Math.abs(delta) < 1e-12) {
                if (position < min || position > max) { valid = false; break; }
            } else {
                const a = (min - position) / delta, b = (max - position) / delta;
                enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
                if (enter > leave) { valid = false; break; }
            }
        }
        if (valid && enter <= 0 && leave >= 1) return end;
        if (valid) intervals.push([enter, leave]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let covered = 0;
    for (const [enter, leave] of intervals) {
        if (enter > covered + 1e-10) break;
        covered = Math.max(covered, leave);
        if (covered >= 1 - 1e-10) return end;
    }
    const distance = Math.hypot(dx, dz) * covered;
    const fraction = distance > 0 ? covered * Math.max(0, (distance - .05) / distance) : 0;
    return { x: start.x + dx * fraction, z: start.z + dz * fraction };
}
