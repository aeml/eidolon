import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { WORLD_GEOGRAPHY, WORLD_REGIONS, WORLD_BOUNDARY_SEGMENTS, getOverworldRegion, getRegionWallSegments } from '../src/data/worldGeography.js';
import { Minimap } from '../src/ui/Minimap.js';

test('client projection is fresh, deeply frozen, and equal to authoritative geometry', () => {
    execFileSync(process.execPath, ['scripts/generate-world-geography.mjs', '--check']);
    const source = JSON.parse(fs.readFileSync('server/internal/game/content/world-geography.json', 'utf8'));
    expect(WORLD_GEOGRAPHY).toEqual(source);
    expect(Object.isFrozen(WORLD_REGIONS.town.walls[0].gap)).toBe(true);
    expect(Object.isFrozen(WORLD_BOUNDARY_SEGMENTS[0])).toBe(true);
    expect(Minimap._REALM_BOUNDARIES).toBe(WORLD_BOUNDARY_SEGMENTS);
});

test.each([
    [-100, 100, 'town'], [100, 300, 'town'], [0, 200, 'town'],
    [110, 200, 'earth'], [0, 90, 'earth'], [-101, 101, 'earth'],
    [0, -600, 'earth'], [-1000, 200, 'earth'], [1000, 200, 'earth'],
    [0, -601, 'water'], [-1001, 200, 'fire'], [1001, 200, 'air'],
    [3001, 200, null], [0, -2201, null], [2000, -1000, null], [NaN, 200, null]
])('position %s,%s belongs to %s, with rectangular town safety', (x, z, expected) => {
    expect(getOverworldRegion(x, z)).toBe(expected);
});

test('map walls preserve seven real gate openings without phantom passages', () => {
    const crossedByLine = (x, z) => WORLD_BOUNDARY_SEGMENTS.some(([x1, z1, x2, z2]) =>
        (x1 === x2 && x === x1 && z >= Math.min(z1, z2) && z <= Math.max(z1, z2)) ||
        (z1 === z2 && z === z1 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)));
    for (const [x, z] of [[0, -600], [-1000, 200], [1000, 200], [0, 100], [0, 300], [-100, 200], [100, 200]]) {
        expect(crossedByLine(x, z)).toBe(false);
    }
    for (const [x, z] of [[30, -600], [-1000, 170], [1000, 230], [30, 100], [30, 300], [-100, 230], [100, 230]]) {
        expect(crossedByLine(x, z)).toBe(true);
    }
    expect(getRegionWallSegments(WORLD_REGIONS.town)).toHaveLength(8);
    expect(getRegionWallSegments(WORLD_REGIONS.earth)).toHaveLength(7);
});
