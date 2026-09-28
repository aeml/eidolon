import { EARTH_LOCATIONS, EARTH_PATHS, WORLD_READINGS, distanceToPath } from '../src/data/worldPopulation.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements, FOLIAGE_HAZARD_CLEARINGS } from '../src/data/worldFoliage.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import { createEarthPathNetwork, createWorldPathGeometry } from '../src/art/ProceduralWorldPaths.js';
import { createEarthLocations } from '../src/art/ProceduralEarthLocations.js';
import { readFileSync } from 'node:fs';

test('all eight scenery recipes render bounded per-location batches with shared exact spawn footprints', () => {
    const high = createEarthLocations(), low = createEarthLocations({ quality: 'low' });
    expect(high.children.map(site => site.userData.locationId)).toEqual(EARTH_LOCATIONS.map(site => site.id));
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    const generated = JSON.parse(readFileSync(new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url), 'utf8'));
    expect(generated.footprints).toEqual(high.userData.walkFootprints.map(({ siteId, x, z, width, depth }) => ({ siteId, x, z, width, depth })));
    expect(generated.readings).toEqual(WORLD_READINGS.map(({ id, name, x, z }) => ({ id, name, x, z })));
    for (const f of high.userData.walkFootprints) {
        expect(f.angle).toBe(0);
        for (const path of EARTH_PATHS) {
            expect(distanceToPath(f.x, f.z, path.points)).toBeGreaterThan(Math.hypot(f.width, f.depth) / 2 + path.width / 2 + 1);
        }
    }
    for (const scene of [high, low]) {
        expect(scene.children.reduce((count, site) => count + site.children.length, 0)).toBeLessThanOrEqual(40);
        const materials = new Set();
        scene.traverse(mesh => {
            if (!mesh.isMesh) return;
            materials.add(mesh.material);
            expect([...mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
            expect(mesh.geometry.attributes.normal.count).toBe(mesh.geometry.attributes.position.count);
            mesh.geometry.dispose();
        });
        for (const material of materials) { material.map?.dispose(); material.dispose(); }
    }
});

test('Earth has eight distinct compositions and exactly two freely readable optional lore sites', () => {
    expect(EARTH_LOCATIONS).toHaveLength(8);
    expect(new Set(EARTH_LOCATIONS.map(site => site.id)).size).toBe(8);
    expect(new Set(EARTH_LOCATIONS.map(site => site.recipe)).size).toBe(8);
    for (const role of ['story', 'landmark', 'camp', 'lore']) expect(EARTH_LOCATIONS.filter(site => site.role === role)).toHaveLength(2);
    for (const site of EARTH_LOCATIONS) {
        expect(Object.isFrozen(site)).toBe(true);
        expect(site.radius).toBeGreaterThan(0);
        if (site.reading) {
            expect(site.visibility).toBe('public');
            expect(site.reading.paragraphs).toHaveLength(3);
            expect(site.reading.paragraphs.every(p => p.length > 100)).toBe(true);
            expect(site).not.toHaveProperty('reward');
            expect(site).not.toHaveProperty('questId');
        }
        if (site.source?.kind === 'investigation') {
            const source = chronicleInvestigations.flatMap(chapter => chapter.sites).find(s => s.id === site.source.id);
            expect([site.x, site.z]).toEqual([source.x, source.z]);
            expect(site.visibility).toBe('quest');
        }
        if (site.source?.kind === 'entrance') {
            const source = DUNGEON_ENTRANCE_DEFINITIONS[site.source.id];
            expect([site.x, site.z]).toEqual([source.position[0], source.position[2]]);
        }
    }
});

test('authored paths leave a hero-sized margin beyond their surface at every existing tree and permanent hazard', () => {
    const trees = PROCEDURAL_FOLIAGE_RECIPES.filter(r => r.region === 'earth').flatMap(r =>
        createProceduralFoliagePlacements(r).map(p => ({ ...p, radius: r.collision[0] * p.scale })));
    for (const path of EARTH_PATHS) {
        for (const tree of trees) expect(distanceToPath(tree.x, tree.z, path.points) - tree.radius).toBeGreaterThan(path.width / 2 + 1.5);
        for (const [x, z, radius] of FOLIAGE_HAZARD_CLEARINGS.earth) {
            expect(distanceToPath(x, z, path.points) - radius).toBeGreaterThan(path.width / 2 + 1.5);
        }
    }
});

test('diary approach stays outside the existing house and the eastern route bypasses the dungeon bounds', () => {
    const house = EARTH_LOCATIONS.find(s => s.id === 'keepers-empty-house');
    const entrance = DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs;
    // Sample each actual ribbon centerline densely, including the width and a
    // full-size character margin; this checks more than destination positions.
    for (const path of EARTH_PATHS) for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
        for (let j = 0; j <= steps; j++) {
            const x = a[0] + (b[0] - a[0]) * j / steps, z = a[1] + (b[1] - a[1]) * j / steps;
            const margin = path.width / 2 + 1;
            expect(Math.abs(x - house.x) > 3.6 + margin || Math.abs(z - house.z) > 3.1 + margin).toBe(true);
            expect(Math.abs(x - entrance.position[0]) > entrance.bounds[0] / 2 + margin ||
                Math.abs(z - entrance.position[2]) > entrance.bounds[2] / 2 + margin).toBe(true);
        }
    }
});

test('path network uses upward-facing, continuous joins and one owned surface material', () => {
    const group = createEarthPathNetwork();
    expect(group.children).toHaveLength(EARTH_PATHS.length);
    expect(new Set(group.children.map(mesh => mesh.material)).size).toBe(1);
    let vertices = 0;
    for (const mesh of group.children) {
        const position = mesh.geometry.getAttribute('position'), normals = mesh.geometry.getAttribute('normal');
        vertices += position.count;
        for (let i = 0; i < position.count; i++) {
            expect(position.getY(i)).toBeCloseTo(.035);
            expect(normals.getY(i)).toBeCloseTo(1);
        }
        expect(mesh.geometry.index.count).toBe((position.count / 2 - 1) * 6);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.castShadow).toBe(false);
        mesh.geometry.dispose();
    }
    expect(vertices).toBeLessThan(500);
    const material = group.children[0].material;
    expect(material.map.image.data).toHaveLength(128 * 128 * 4);
    expect(material.depthWrite).toBe(false);
    material.map.dispose(); material.dispose();
});

test('invalid and zero-length paths fail instead of generating NaN scene bounds', () => {
    for (const path of [{ width: 0, points: [[0, 0], [1, 1]] }, { width: 4, points: [[0, 0], [NaN, 1]] },
        { width: 4, points: [[0, 0], [0, 0]] }, { width: 4, points: [[0, 0], [4, 0], [0, 0]] }]) {
        expect(() => createWorldPathGeometry(path)).toThrow(TypeError);
    }
    expect(distanceToPath(4, 3, [[0, 0], [0, 0], [8, 0]])).toBe(3);
});
