import * as THREE from 'three';
import { createElementalLocations } from '../src/art/ProceduralElementalLocations.js';
import { elementalGroundCoverPlacements, createElementalCoverTuft } from '../src/art/ElementalGroundCover.js';
import { WATER_LOCATIONS, FIRE_LOCATIONS, WATER_PATHS, FIRE_PATHS } from '../src/data/elementalPopulation.js';
import { distanceToPath } from '../src/data/worldPopulation.js';
import { FOLIAGE_HAZARD_CLEARINGS } from '../src/data/worldFoliage.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each([['water', WATER_LOCATIONS, WATER_PATHS], ['fire', FIRE_LOCATIONS, FIRE_PATHS]])(
    '%s edge beds preserve routes, hazards, reading space and exact Low subsets', (realm, sites, paths) => {
        const root = createElementalLocations(realm), solids = root.userData.walkFootprints;
        const materials = new Set();
        for (const site of sites) {
            const high = elementalGroundCoverPlacements(site, realm, solids), low = elementalGroundCoverPlacements(site, realm, solids, 'low');
            expect(high.length).toBeGreaterThan(20); expect(high.length).toBeLessThan(300);
            expect(high).toEqual(elementalGroundCoverPlacements(site, realm, solids));
            const keys = new Set(high.map(p => JSON.stringify(p)));
            expect(low.length).toBeLessThan(high.length); expect(low.every(p => keys.has(JSON.stringify(p)))).toBe(true);
            for (const p of high) {
                const wx = site.x + p.x, wz = site.z + p.z;
                expect(Math.hypot(p.x, p.z) + p.radius).toBeLessThanOrEqual(site.radius);
                if (site.role === 'story') expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(10 + p.radius);
                if (site.readingOffset) expect(Math.hypot(p.x - site.readingOffset[0], p.z - site.readingOffset[1])).toBeGreaterThanOrEqual(4 + p.radius);
                for (const path of paths) if (distanceToPath(wx, wz, path.points) < path.width / 2 + 2 + p.radius) throw new Error('road occluded');
                for (const [hx, hz, radius] of FOLIAGE_HAZARD_CLEARINGS[realm]) {
                    if (Math.hypot(wx - hx, wz - hz) < radius + 8 + p.radius) throw new Error('hazard apron occluded');
                }
                for (const f of solids.filter(s => s.siteId === site.id)) {
                    if (Math.hypot(Math.max(0, Math.abs(wx - f.x) - f.width / 2), Math.max(0, Math.abs(wz - f.z) - f.depth / 2)) < p.radius + .45) {
                        throw new Error('scenery overlap');
                    }
                }
            }
            const mesh = root.getObjectByName(`${site.id}:ground-cover`);
            expect(mesh.userData.plantCount).toBe(high.length);
            expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
            expect(mesh.material.transparent).toBe(false); expect(mesh.material.side).toBe(THREE.DoubleSide);
            expect(mesh.geometry.attributes.position.count / 3).toBeLessThan(50000);
            expect(mesh.geometry.boundingBox.max.y).toBeLessThan(1.15);
            expect(mesh.geometry.attributes.color).toBeDefined();
            materials.add(mesh.material);
        }
        expect(materials.size).toBe(1);
        let disposals = 0;
        [...materials][0].addEventListener('dispose', () => disposals++);
        RenderSystem.prototype.disposeObjectResources.call({}, root);
        expect(disposals).toBe(1);
    });

test.each(['water', 'fire'])('%s curved cover geometry is finite and fits its whole-tuft clearance', realm => {
    for (const quality of ['high', 'low']) for (let variant = 0; variant < 4; variant++) {
        const geometry = createElementalCoverTuft(realm, variant, quality), p = geometry.attributes.position;
        expect([...p.array, ...geometry.attributes.normal.array, ...geometry.attributes.color.array].every(Number.isFinite)).toBe(true);
        expect(p.count / 3).toBeLessThanOrEqual(quality === 'low' ? 60 : 180);
        for (let i = 0; i < p.count; i++) {
            expect(Math.hypot(p.getX(i), p.getZ(i)) * 1.15).toBeLessThan(1.35);
            expect(p.getY(i) * 1.15).toBeLessThan(1.12);
            expect(p.getY(i)).toBeGreaterThanOrEqual(-.04);
        }
        geometry.dispose();
    }
});
