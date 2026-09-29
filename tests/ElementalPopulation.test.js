import { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS, WATER_PATHS, FIRE_PATHS, AIR_PATHS } from '../src/data/elementalPopulation.js';
import { distanceToPath, WORLD_READINGS } from '../src/data/worldPopulation.js';
import { FOLIAGE_HAZARD_CLEARINGS } from '../src/data/worldFoliage.js';
import { WORLD_REGIONS, containsWorldPosition } from '../src/data/worldGeography.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import { getAtlasWorldLocations } from '../src/ui/AtlasNavigation.js';
import { createElementalLocations } from '../src/art/ProceduralElementalLocations.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { readFileSync } from 'node:fs';
import { createProceduralFoliagePlacements, PROCEDURAL_FOLIAGE_RECIPES } from '../src/data/worldFoliage.js';

// Sample at <=0.5m with an extra half-step margin. Use the real rectangular
// footprint: a long hull's enclosing circle would falsely block its side aisle.
function pathClearsFootprint(path, box) {
    for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
        for (let j = 0; j <= steps; j++) {
            const x = a[0] + (b[0] - a[0]) * j / steps, z = a[1] + (b[1] - a[1]) * j / steps;
            const dx = Math.max(0, Math.abs(x - box.x) - box.width / 2), dz = Math.max(0, Math.abs(z - box.z) - box.depth / 2);
            if (Math.hypot(dx, dz) <= path.width / 2 + 1.25 + .25) return false;
        }
    }
    return true;
}

test.each([['water', WATER_LOCATIONS, WATER_PATHS], ['fire', FIRE_LOCATIONS, FIRE_PATHS], ['air', AIR_LOCATIONS, AIR_PATHS]])(
    '%s has eight distinct, canonical places and hazard-aware flat routes', (realm, places, paths) => {
        expect(places).toHaveLength(8); expect(Object.isFrozen(places)).toBe(true);
        expect(new Set(places.map(site => site.id)).size).toBe(8);
        for (const role of ['story', 'landmark', 'camp', 'lore']) expect(places.filter(s => s.role === role)).toHaveLength(2);
        for (const site of places) {
            expect(containsWorldPosition(WORLD_REGIONS[realm], site.x, site.z)).toBe(true);
            if (site.source?.kind === 'investigation') {
                const original = chronicleInvestigations.flatMap(c => c.sites).find(s => s.id === site.source.id);
                expect([site.x, site.z]).toEqual([original.x, original.z]); expect(site.visibility).toBe('quest');
            }
            if (site.source?.kind === 'entrance') {
                const original = DUNGEON_ENTRANCE_DEFINITIONS[site.source.id];
                expect([site.x, site.z]).toEqual([original.position[0], original.position[2]]);
            }
            if (site.reading) {
                expect(site.reading.paragraphs).toHaveLength(3);
                expect(site.reading.paragraphs.every(p => p.length > 100)).toBe(true);
                expect(site).not.toHaveProperty('reward'); expect(site).not.toHaveProperty('questId');
            }
        }
        for (const path of paths) {
            for (const [x, z, radius] of FOLIAGE_HAZARD_CLEARINGS[realm]) {
                expect({ path: path.id, hazard: [x, z], clear: distanceToPath(x, z, path.points) - radius > path.width / 2 + 1.5 })
                    .toEqual({ path: path.id, hazard: [x, z], clear: true });
            }
            // Protect actual preserved buildings/entrances, not just POI dots.
            for (const site of places.filter(p => p.source && !['echo-bank', 'exhaust-channel', 'vane-array'].includes(p.recipe))) {
                const bounds = site.source.kind === 'entrance' ? DUNGEON_ENTRANCE_DEFINITIONS[site.source.id].bounds : [7.2, 3, 7.2];
                const margin = path.width / 2 + 1.25;
                for (let i = 1; i < path.points.length; i++) {
                    const a = path.points[i - 1], b = path.points[i], length = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
                    for (let step = 0; step <= length; step++) {
                        const x = a[0] + (b[0] - a[0]) * step / length, z = a[1] + (b[1] - a[1]) * step / length;
                        expect(Math.abs(x - site.x) > bounds[0] / 2 + margin || Math.abs(z - site.z) > bounds[2] / 2 + margin).toBe(true);
                    }
                }
            }
        }
    });

test('public realm destinations and readings agree with built scenes without revealing story-gated markers', () => {
    const publicPlaces = getAtlasWorldLocations({});
    for (const site of [...WATER_LOCATIONS, ...FIRE_LOCATIONS, ...AIR_LOCATIONS]) {
        const place = publicPlaces.find(p => p.id === site.id);
        if (site.visibility === 'quest') { expect(place).toBeUndefined(); continue; }
        expect(place).toBeDefined();
        const offset = site.readingOffset || site.arrivalOffset || [0, 0];
        expect([place.x, place.z]).toEqual([site.x + offset[0], site.z + offset[1]]);
        if (site.reading) expect(WORLD_READINGS.find(r => r.locationId === site.id))
            .toEqual(expect.objectContaining({ x: place.x, z: place.z, reading: site.reading }));
    }
    expect(getAtlasWorldLocations({ currentInstanceId: 'private-run' })).toEqual([]);
});

test.each([['water', WATER_PATHS], ['fire', FIRE_PATHS], ['air', AIR_PATHS]])('%s scenery solids clear paths and hazards at both qualities', (realm, paths) => {
    const high = createElementalLocations(realm), low = createElementalLocations(realm, { quality: 'low' });
    expect(high.userData.walkFootprints).toEqual(low.userData.walkFootprints);
    const generated = JSON.parse(readFileSync(new URL('../server/internal/game/content/world-population-footprints.json', import.meta.url), 'utf8'));
    const sites = realm === 'air' ? AIR_LOCATIONS : realm === 'water' ? WATER_LOCATIONS : FIRE_LOCATIONS;
    const ids = new Set(sites.map(site => site.id));
    expect(generated.footprints.filter(f => ids.has(f.siteId))).toEqual(
        high.userData.walkFootprints.map(({ siteId, x, z, width, depth }) => ({ siteId, x, z, width, depth })));
    for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(r => r.region === realm)) {
        expect(recipe.collision).toBeNull();
        const placements = createProceduralFoliagePlacements(recipe);
        expect(placements).toHaveLength(recipe.count);
        for (const p of placements) {
            for (const site of sites) expect(Math.hypot(p.x - site.x, p.z - site.z)).toBeGreaterThan(site.radius + 8);
            for (const path of paths) expect(distanceToPath(p.x, p.z, path.points)).toBeGreaterThan(path.width / 2 + 8);
        }
    }
    for (const scene of [high, low]) {
        expect(scene.children).toHaveLength(8);
        // One new opaque, scene-owned ground-cover batch on Water/Fire. Air
        // retains the previous budget; roads/colliders keep their old contract.
        expect(scene.children.every(root => root.children.length >= 3 && root.children.length <= (realm === 'air' ? 7 : 8))).toBe(true);
        for (const root of scene.children) {
            const apron = root.getObjectByName(`${root.userData.locationId}:ground-wear`);
            expect(apron).toBeDefined(); expect(apron.material.depthWrite).toBe(false);
            expect(apron.position.y).toBeLessThan(.035); // stays below the authored path overlay
            const extent = Math.hypot(apron.geometry.parameters.width, apron.geometry.parameters.height) / 2;
            for (const [hx, hz, radius] of FOLIAGE_HAZARD_CLEARINGS[realm]) {
                expect(Math.hypot(root.position.x + apron.position.x - hx, root.position.z + apron.position.z - hz) - extent)
                    .toBeGreaterThan(radius + 1.5);
            }
            const chips = root.getObjectByName(`${root.userData.locationId}:ground-chips`);
            if (chips) {
                chips.geometry.computeBoundingBox();
                expect(chips.geometry.boundingBox.max.y).toBeLessThan(.3);
                expect(chips.geometry.attributes.color).toBeDefined();
            }
        }
        for (const f of scene.userData.walkFootprints) {
            for (const path of paths) {
                const clear = pathClearsFootprint(path, f);
                expect({ site: f.siteId, path: path.id, position: [f.x, f.z], clear })
                    .toEqual({ site: f.siteId, path: path.id, position: [f.x, f.z], clear: true });
            }
            for (const [x, z, radius] of FOLIAGE_HAZARD_CLEARINGS[realm]) {
                expect(Math.hypot(x - f.x, z - f.z)).toBeGreaterThan(radius + Math.hypot(f.width, f.depth) / 2 + 1.25);
            }
        }
        scene.traverse(mesh => { if (mesh.isMesh) expect([...mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true); });
        RenderSystem.prototype.disposeObjectResources.call({}, scene);
    }
});
