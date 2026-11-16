// Periodic fitted slabs with interrupted joints. The small immutable layout is
// shared CPU data; a scene still owns its usual four generated surface maps.
const wrap = (value, period) => ((value % period) + period) % period;
const smooth = (a, b, value) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y) => {
    let n = Math.imul(x + 43, 1597334677) ^ Math.imul(y + 79, 3812015801);
    n = Math.imul(n ^ n >>> 16, 2246822519);
    return ((n ^ n >>> 13) >>> 0) / 4294967296;
};
const site = (x, y) => ({ x: (x + .5 + (hash(wrap(x, 8), wrap(y, 8)) - .5) * .5) * 8,
    y: (y + .5 + (hash(wrap(x, 8) + 19, wrap(y, 8) + 31) - .5) * .5) * 8 });

const cells = Object.freeze(Array.from({ length: 64 }, (_, index) => {
    const column = index % 8, row = Math.floor(index / 8), center = site(column, row), planes = [];
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        if (x === 0 && y === 0) continue;
        const neighbor = site(column + x, row + y), dx = neighbor.x - center.x, dy = neighbor.y - center.y;
        const length = Math.hypot(dx, dy);
        planes.push({ x: dx / length, y: dy / length, at: length / 2 });
    }
    let polygon = [[-16, -16], [16, -16], [16, 16], [-16, 16]];
    for (const plane of planes) {
        const clipped = [], distance = p => plane.at - p[0] * plane.x - p[1] * plane.y;
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
            if (da >= 0) clipped.push(a);
            if ((da >= 0) !== (db >= 0)) {
                const t = da / (da - db); clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }
        polygon = clipped;
    }
    const active = planes.filter(p => polygon.some(v => Math.abs(p.at - v[0] * p.x - v[1] * p.y) < 1e-6));
    return Object.freeze({ ...center, row, column, stone: hash(column + 7, row + 53),
        width: Math.max(...polygon.map(p => p[0])) - Math.min(...polygon.map(p => p[0])),
        height: Math.max(...polygon.map(p => p[1])) - Math.min(...polygon.map(p => p[1])),
        planes: Object.freeze(active.map(Object.freeze)) });
}));

export function sampleVerdantFlagstone(x, y) {
    x = wrap(x, 64); y = wrap(y, 64);
    const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
    let nearest, localX = 0, localY = 0, distance = Infinity;
    for (let iy = cy - 1; iy <= cy + 1; iy++) for (let ix = cx - 1; ix <= cx + 1; ix++) {
        const cell = cells[wrap(iy, 8) * 8 + wrap(ix, 8)];
        const dx = x - cell.x - (ix - cell.column) * 8, dy = y - cell.y - (iy - cell.row) * 8;
        const squared = dx * dx + dy * dy;
        if (squared < distance) { nearest = cell; distance = squared; localX = dx; localY = dy; }
    }
    let edge = Infinity;
    for (const plane of nearest.planes) edge = Math.min(edge, plane.at - localX * plane.x - localY * plane.y);
    const bevel = smooth(.035, .46, edge), angle = nearest.stone * Math.PI * 2;
    const along = localX * Math.cos(angle) + localY * Math.sin(angle);
    const across = -localX * Math.sin(angle) + localY * Math.cos(angle);
    const cleave = Math.abs(across - Math.sin(along * 1.7 + nearest.stone * 13) * .07);
    const fracture = nearest.stone > .64 ? (1 - smooth(.035, .13, cleave))
        * (1 - smooth(1.5, 3.3, Math.abs(along))) * smooth(.8, 1.4, edge) : 0;
    return { row: nearest.row, column: nearest.column, width: nearest.width, height: nearest.height,
        stone: nearest.stone, bevel: bevel * (1 - fracture * .22), fracture };
}
