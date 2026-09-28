import { jest } from '@jest/globals';
import { AtlasCartography } from '../src/ui/AtlasCartography.js';
import { drawAtlasLocations, drawAtlasPlayer } from '../src/ui/AtlasMarkers.js';
import { getAtlasLocations, ATLAS_CATEGORIES } from '../src/ui/AtlasNavigation.js';
import { PROCEDURAL_FOLIAGE_RECIPES as dataRecipes, createProceduralFoliagePlacements as dataPlacements } from '../src/data/worldFoliage.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/art/ProceduralRealmFoliage.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

const context = () => ({ ...Object.fromEntries(['fillRect', 'strokeRect', 'save', 'restore', 'transform', 'drawImage', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'fillText'].map(k => [k, jest.fn()])),
    measureText: text => ({ width: text.length * 7 }) });

test('Earth cartography draws every authored physical path from the same centerline', () => {
    const ctx = context();
    const art = new AtlasCartography({ createCanvas: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    const tile = art.tile('earth'), region = WORLD_REGIONS.earth;
    for (const path of EARTH_PATHS) path.points.forEach(([x, z], index) => {
        const method = index ? ctx.lineTo : ctx.moveTo;
        expect(method).toHaveBeenCalledWith(expect.closeTo((x - region.minX) / (region.maxX - region.minX) * tile.width, 8),
            expect.closeTo((z - region.minZ) / (region.maxZ - region.minZ) * tile.height, 8));
    });
    art.dispose();
});

test('player facing uses the actor quaternion and the shared map axes at any zoom', () => {
    for (const scale of [.05, 4]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const ctx = context(), player = { position: { x: 10, z: 200 }, rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } };
        const project = (x, z) => ({ x: 100 + ((x - 10) - (z - 200)) * scale, y: 100 + ((x - 10) + (z - 200)) * scale });
        drawAtlasPlayer(ctx, player, project);
        const [x, y] = ctx.moveTo.mock.calls[0];
        expect(x).toBeCloseTo(100 + (Math.sin(yaw) - Math.cos(yaw)) * 14 / Math.SQRT2);
        expect(y).toBeCloseTo(100 + (Math.sin(yaw) + Math.cos(yaw)) * 14 / Math.SQRT2);
        expect(ctx.arc).toHaveBeenCalledWith(100, 100, 4, 0, Math.PI * 2);
    }
});

test('cartography reuses production foliage data, caches art across marker/pan updates, and releases storage', () => {
    expect(dataRecipes).toBe(PROCEDURAL_FOLIAGE_RECIPES);
    expect(dataPlacements).toBe(createProceduralFoliagePlacements);
    const createCanvas = jest.fn(() => ({ width: 0, height: 0, getContext: () => context() }));
    const art = new AtlasCartography({ mobile: true, createCanvas });
    const ctx = context(), project = (x, z) => ({ x: 300 + x * .05, y: 200 + z * .05 });
    art.draw(ctx, project, 640, 480);
    expect(art.buildCount).toBe(5); expect(createCanvas).toHaveBeenCalledTimes(5);
    const tiles = [...art.tiles.values()];
    expect(tiles.every(t => t.width === 512)).toBe(true);
    art.draw(ctx, (x, z) => ({ x: project(x, z).x + 5, y: project(x, z).y + 3 }), 640, 480);
    expect(art.buildCount).toBe(5); expect(ctx.drawImage).toHaveBeenCalledTimes(10);
    art.dispose(); expect(art.tiles.size).toBe(0);
    expect(tiles.every(t => t.width === 0 && t.height === 0)).toBe(true);
});

test('overview clusters town services and only exposes actually drawn markers for picking', () => {
    const locations = getAtlasLocations({ player: { position: { x: 0, z: 200 } } });
    const ctx = context();
    const markers = drawAtlasLocations(ctx, locations, { project: (x, z) => ({ x: 300 + x * .06, y: 200 + (z - 200) * .06 }),
        width: 640, height: 480, scale: .06, filters: new Set(Object.keys(ATLAS_CATEGORIES)) });
    expect(markers.some(m => m.id === 'lanternhold')).toBe(true);
    expect(markers.some(m => m.id === 'forge')).toBe(false);
    const hidden = drawAtlasLocations(ctx, locations, { project: () => ({ x: 300, y: 200 }), width: 640, height: 480,
        scale: 2, selectedId: 'forge', filters: new Set(['services']) });
    expect(hidden).toHaveLength(1); expect(hidden[0].id).toBe('forge');
    expect(ctx.fillText).toHaveBeenCalledWith('Forge', expect.any(Number), expect.any(Number));
});
