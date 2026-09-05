import { buildDungeonSurfaceUnion } from '../src/world/dungeonSurfaceUnion.js';

const contains = (r, x, z) => x > r.x - r.width / 2 && x < r.x + r.width / 2 && z > r.z - r.height / 2 && z < r.z + r.height / 2;

function verifyUnion(rects) {
    const result = buildDungeonSurfaceUnion(rects);
    const xs = [...new Set(rects.flatMap(r => [r.x - r.width / 2, r.x + r.width / 2]))].sort((a, b) => a - b);
    const zs = [...new Set(rects.flatMap(r => [r.z - r.height / 2, r.z + r.height / 2]))].sort((a, b) => a - b);
    for (let x = 1; x < xs.length; x++) for (let z = 1; z < zs.length; z++) {
        const cx = (xs[x - 1] + xs[x]) / 2;
        const cz = (zs[z - 1] + zs[z]) / 2;
        const count = result.floors.filter(r => cx > r.left && cx < r.right && cz > r.top && cz < r.bottom).length;
        expect(count).toBe(rects.some(r => contains(r, cx, cz)) ? 1 : 0);
    }
    for (const wall of result.walls) {
        const cuts = (wall.axis === 'x' ? xs : zs).filter(value => value >= wall.start && value <= wall.end);
        for (let i = 1; i < cuts.length; i++) {
            const mid = (cuts[i - 1] + cuts[i]) / 2;
            const inside = wall.at - wall.normal * 0.001;
            const outside = wall.at + wall.normal * 0.001;
            expect(rects.some(r => contains(r, wall.axis === 'x' ? mid : inside, wall.axis === 'x' ? inside : mid))).toBe(true);
            expect(rects.some(r => contains(r, wall.axis === 'x' ? mid : outside, wall.axis === 'x' ? outside : mid))).toBe(false);
        }
    }
    return result;
}

test('deduplicates identical floors and merges exposed wall segments', () => {
    const rect = { x: 0, z: 0, width: 80, height: 40 };
    const result = verifyUnion([rect, rect]);
    expect(result.floors).toHaveLength(1);
    expect(result.walls).toHaveLength(4);
});

test('crossing halls and overlapping rectangular rooms share one floor and no interior walls', () => {
    verifyUnion([
        { x: 0, z: 0, width: 100, height: 20 },
        { x: 0, z: 0, width: 20, height: 100 },
        { x: 40, z: 20, width: 60, height: 80 }
    ]);
});

test('preserves holes in a ring instead of filling non-walkable space', () => {
    const result = verifyUnion([
        { x: 0, z: -40, width: 100, height: 20 },
        { x: 0, z: 40, width: 100, height: 20 },
        { x: -40, z: 0, width: 20, height: 100 },
        { x: 40, z: 0, width: 20, height: 100 }
    ]);
    expect(result.walls).toHaveLength(8);
});

test('deterministic seed sweep preserves exact coverage and boundaries at instance coordinates', () => {
    for (let seed = 1; seed <= 40; seed++) {
        let state = seed;
        const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
        const rects = Array.from({ length: 10 }, () => ({
            x: 20000 + Math.floor(random() * 16) * 10,
            z: 20000 + Math.floor(random() * 16) * 10,
            width: 20 + Math.floor(random() * 8) * 10,
            height: 20 + Math.floor(random() * 8) * 10
        }));
        verifyUnion(rects);
    }
});

test('empty or invalid geometry produces no surfaces', () => {
    expect(buildDungeonSurfaceUnion([])).toEqual({ floors: [], walls: [] });
    expect(buildDungeonSurfaceUnion([{ x: NaN, z: 0, width: 10, height: 10 }])).toEqual({ floors: [], walls: [] });
});
