// Match server/internal/game/dungeon_projectile_walls.go: cover the entire
// segment with the union of canonical floors, not just its destination.
export function clipDungeonEffectSegment(rects, from, to) {
    if (![from?.x, from?.z, to?.x, to?.z].every(Number.isFinite)) {
        return { x: from?.x, z: from?.z, blocked: true };
    }
    if (!Array.isArray(rects) || rects.length === 0) return { x: to.x, z: to.z, blocked: false };
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const intervals = [];
    for (const rect of rects) {
        if (![rect?.x, rect?.z, rect?.width, rect?.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) continue;
        let enter = 0;
        let leave = 1;
        let intersects = true;
        for (const [position, delta, minimum, maximum] of [
            [from.x, dx, rect.x - rect.width / 2, rect.x + rect.width / 2],
            [from.z, dz, rect.z - rect.height / 2, rect.z + rect.height / 2]
        ]) {
            if (Math.abs(delta) < 1e-12) {
                if (position < minimum || position > maximum) { intersects = false; break; }
                continue;
            }
            const a = (minimum - position) / delta;
            const b = (maximum - position) / delta;
            enter = Math.max(enter, Math.min(a, b));
            leave = Math.min(leave, Math.max(a, b));
            if (enter > leave) { intersects = false; break; }
        }
        if (!intersects) continue;
        if (enter <= 0 && leave >= 1) return { x: to.x, z: to.z, blocked: false };
        intervals.push({ enter, leave });
    }
    intervals.sort((a, b) => a.enter - b.enter);
    let covered = 0;
    for (const interval of intervals) {
        if (interval.enter > covered + 1e-10) break;
        covered = Math.max(covered, interval.leave);
        if (covered >= 1 - 1e-10) return { x: to.x, z: to.z, blocked: false };
    }
    return { x: from.x + dx * covered, z: from.z + dz * covered, blocked: true };
}

// A line attack reaches its full authored range along the cursor direction.
// A close cursor must not shorten the visual while the server hits beyond it.
export function resolveDungeonBeamEndpoint(rects, from, aim, range) {
    if (![from?.x, from?.z, aim?.x, aim?.z, range].every(Number.isFinite) || range < 0) {
        return { x: from?.x, z: from?.z, blocked: true };
    }
    const distance = Math.hypot(aim.x - from.x, aim.z - from.z);
    if (distance === 0) return { x: from.x, z: from.z, blocked: false };
    return clipDungeonEffectSegment(rects, from, {
        x: from.x + (aim.x - from.x) / distance * range,
        z: from.z + (aim.z - from.z) / distance * range
    });
}
