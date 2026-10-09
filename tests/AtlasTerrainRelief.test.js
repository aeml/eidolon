import { jest } from '@jest/globals';
import { drawAtlasTerrainRelief, getAtlasContourSegments } from '../src/ui/AtlasTerrainRelief.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';
import { EARTH_OUTCROP_COLLISIONS, EARTH_OUTCROP_PROFILE } from '../src/data/earthOutcrops.js';
import { AtlasCartography } from '../src/ui/AtlasCartography.js';

const context = () => ({
    ...Object.fromEntries(['fillRect', 'save', 'restore', 'putImageData', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].map(k => [k, jest.fn()])),
    getImageData: jest.fn((x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }))
});

test('every contour endpoint and midpoint lies on the canonical rendered triangle at its labeled elevation', () => {
    const segments = getAtlasContourSegments(EARTH_ELEVATION);
    expect(segments.length).toBeGreaterThan(1000);
    let maxError = 0, invalid = 0;
    for (const { elevation, points: [a, b] } of segments) {
        if (elevation % 3 || Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-8) invalid++;
        for (const [x, z] of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
            maxError = Math.max(maxError, Math.abs(EARTH_ELEVATION.sample(x, z) - elevation));
            if (x >= -100 && x <= 100 && z >= 100 && z <= 300) invalid++;
        }
    }
    expect(invalid).toBe(0); expect(maxError).toBeLessThan(1e-8);
});

test('flat profiles and other realms get no invented relief or rock formations', () => {
    for (const [region, field] of [[WORLD_REGIONS.earth, null], [WORLD_REGIONS.water, EARTH_ELEVATION], [WORLD_REGIONS.town, EARTH_ELEVATION]]) {
        const ctx = context();
        drawAtlasTerrainRelief(ctx, region, 512, 410, field, EARTH_OUTCROP_PROFILE);
        expect(ctx.beginPath).not.toHaveBeenCalled(); expect(ctx.fill).not.toHaveBeenCalled();
        expect(ctx.getImageData).not.toHaveBeenCalled();
    }
    expect(new AtlasCartography().elevation).toBeNull();
    expect(() => new AtlasCartography({ terrainProfile: 'unknown-profile' })).toThrow('Unsupported server terrain profile');
});

test.each([512, 1024])('rock cartography at %ipx uses all exact collision footprints only on the rocks profile', width => {
    const region = WORLD_REGIONS.earth, height = width * .8;
    const plain = context(), rocky = context();
    drawAtlasTerrainRelief(plain, region, width, height, EARTH_ELEVATION, 'earth-elevation-v1');
    drawAtlasTerrainRelief(rocky, region, width, height, EARTH_ELEVATION, EARTH_OUTCROP_PROFILE);
    expect(rocky.fill.mock.calls.length - plain.fill.mock.calls.length).toBe(EARTH_OUTCROP_COLLISIONS.length);
    expect(rocky.stroke.mock.calls.length - plain.stroke.mock.calls.length).toBe(EARTH_OUTCROP_COLLISIONS.length);
    const projected = ([x, z]) => [expect.closeTo((x - region.minX) * width / (region.maxX - region.minX), 8),
        expect.closeTo((z - region.minZ) * height / (region.maxZ - region.minZ), 8)];
    expect(rocky.moveTo.mock.calls.slice(-18)).toEqual(EARTH_OUTCROP_COLLISIONS.map(r => projected(r.outline[0])));
    expect(rocky.lineTo.mock.calls.slice(-126)).toEqual(EARTH_OUTCROP_COLLISIONS.flatMap(r => r.outline.slice(1).map(projected)));
    expect(rocky.save).toHaveBeenCalledTimes(1); expect(rocky.restore).toHaveBeenCalledTimes(1);
});

test('raised tile is baked once, shared across pans and released without extra canvases', () => {
    const ctx = context();
    const createCanvas = jest.fn(() => ({ width: 0, height: 0, getContext: () => ctx }));
    const art = new AtlasCartography({ mobile: true, terrainProfile: EARTH_OUTCROP_PROFILE, createCanvas });
    const tile = art.tile('earth'), calls = ctx.fill.mock.calls.length;
    expect(art.elevation).toBe(EARTH_ELEVATION); expect(calls).toBeGreaterThan(18);
    expect(art.tile('earth')).toBe(tile); expect(ctx.fill).toHaveBeenCalledTimes(calls);
    expect(createCanvas).toHaveBeenCalledTimes(1); expect(art.buildCount).toBe(1);
    expect(ctx.getImageData).toHaveBeenCalledTimes(1); expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    art.dispose(); expect(tile.width).toBe(0); expect(tile.height).toBe(0); expect(art.tiles.size).toBe(0);
});
