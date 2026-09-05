// Partition the authoritative walkable union, rather than independently drawing
// rooms, corridors and corners on top of each other. Coordinates are layout edges,
// not a sampled tile grid, so narrow openings and rectangular rooms stay exact.
export function buildDungeonSurfaceUnion(walkRects) {
    const rects = (walkRects || []).filter((rect) =>
        [rect.x, rect.z, rect.width, rect.height].every(Number.isFinite)
        && rect.width > 0 && rect.height > 0
    ).map((rect) => ({
        left: rect.x - rect.width / 2, right: rect.x + rect.width / 2,
        top: rect.z - rect.height / 2, bottom: rect.z + rect.height / 2
    }));
    const xs = [...new Set(rects.flatMap((rect) => [rect.left, rect.right]))].sort((a, b) => a - b);
    const zs = [...new Set(rects.flatMap((rect) => [rect.top, rect.bottom]))].sort((a, b) => a - b);
    const occupied = zs.slice(1).map((bottom, z) => xs.slice(1).map((right, x) =>
        rects.some((rect) => xs[x] >= rect.left && right <= rect.right && zs[z] >= rect.top && bottom <= rect.bottom)
    ));
    const floors = [];
    const edges = [];
    let previousRuns = new Map();
    for (let z = 0; z < occupied.length; z++) {
        const runs = new Map();
        for (let x = 0; x < xs.length - 1;) {
            if (!occupied[z][x]) { x++; continue; }
            const start = x;
            while (occupied[z][x]) x++;
            const key = `${start}:${x}`;
            const existing = previousRuns.get(key);
            if (existing) {
                existing.bottom = zs[z + 1];
                runs.set(key, existing);
            } else {
                const floor = { left: xs[start], right: xs[x], top: zs[z], bottom: zs[z + 1] };
                floors.push(floor);
                runs.set(key, floor);
            }
        }
        previousRuns = runs;
        for (let x = 0; x < xs.length - 1; x++) {
            if (!occupied[z][x]) continue;
            if (!occupied[z - 1]?.[x]) edges.push({ axis: 'x', at: zs[z], start: xs[x], end: xs[x + 1], normal: -1 });
            if (!occupied[z + 1]?.[x]) edges.push({ axis: 'x', at: zs[z + 1], start: xs[x], end: xs[x + 1], normal: 1 });
            if (!occupied[z][x - 1]) edges.push({ axis: 'z', at: xs[x], start: zs[z], end: zs[z + 1], normal: -1 });
            if (!occupied[z][x + 1]) edges.push({ axis: 'z', at: xs[x + 1], start: zs[z], end: zs[z + 1], normal: 1 });
        }
    }
    edges.sort((a, b) => a.axis.localeCompare(b.axis) || a.at - b.at || a.normal - b.normal || a.start - b.start);
    const walls = [];
    for (const edge of edges) {
        const last = walls.at(-1);
        if (last && last.axis === edge.axis && last.at === edge.at && last.normal === edge.normal && last.end === edge.start) last.end = edge.end;
        else walls.push({ ...edge });
    }
    return { floors, walls };
}
