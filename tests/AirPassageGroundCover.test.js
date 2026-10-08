import { jest } from '@jest/globals';
import * as THREE from 'three';
import { airPassageGroundCoverPlacements, createAirPassageGroundCover, updateElementalGroundCoverQuality } from '../src/art/ElementalGroundCover.js';
import { AIR_LOCATIONS, AIR_PATHS } from '../src/data/elementalPopulation.js';
import { FOLIAGE_HAZARD_CLEARINGS } from '../src/data/worldFoliage.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';
import { distanceToPath } from '../src/data/worldPopulation.js';

test('Air passage heath/scree use frozen deterministic placements and exact Low subsets', () => {
    const high = airPassageGroundCoverPlacements('high'), low = airPassageGroundCoverPlacements('low');
    expect(high).toBe(airPassageGroundCoverPlacements('medium'));
    expect(low).toBe(airPassageGroundCoverPlacements('low'));
    expect(high).toHaveLength(2022); expect(low).toHaveLength(1093);
    expect(Object.isFrozen(high)).toBe(true); expect(Object.isFrozen(low)).toBe(true);
    const highSet = new Set(high);
    for (const plant of low) { expect(highSet.has(plant)).toBe(true); expect(Object.isFrozen(plant)).toBe(true); }
    expect(new Set(high.map(plant => plant.cell))).toEqual(new Set(low.map(plant => plant.cell)));
    expect(high.filter(plant => plant.kind === 'heath')).toHaveLength(1440);
    expect(high.filter(plant => plant.kind === 'scree')).toHaveLength(582);
});

test('the whole conservative footprint remains outside every path, site, permanent hazard and portal approach', () => {
    const region = WORLD_REGIONS.air;
    const margins = { x: Infinity, z: Infinity, cardinal: Infinity, portal: Infinity, paths: Infinity, sites: Infinity, hazards: Infinity };
    for (const { x, z, radius } of airPassageGroundCoverPlacements()) {
        margins.x = Math.min(margins.x, x - radius - region.minX, region.maxX - x - radius);
        margins.z = Math.min(margins.z, z - radius - region.minZ, region.maxZ - z - radius);
        margins.cardinal = Math.min(margins.cardinal, Math.abs(z - 200) - 8 - radius);
        margins.portal = Math.min(margins.portal, Math.hypot(x - 2400, z - 200) - 72 - radius);
        for (const path of AIR_PATHS) margins.paths = Math.min(margins.paths, distanceToPath(x, z, path.points) - path.width / 2 - 2 - radius);
        for (const site of AIR_LOCATIONS) margins.sites = Math.min(margins.sites, Math.hypot(x - site.x, z - site.z) - site.radius - 3 - radius);
        for (const [hx, hz, r] of FOLIAGE_HAZARD_CLEARINGS.air) margins.hazards = Math.min(margins.hazards, Math.hypot(x - hx, z - hz) - r - 8 - radius);
    }
    // Each minimum spans every original point/pair, without tens of thousands
    // of redundant assertion objects. No tolerance or clearance is reduced.
    for (const [kind, minimum] of Object.entries(margins)) expect({ kind, clear: minimum >= 0 }).toEqual({ kind, clear: true });
});

test.each(['high', 'low'])('%s passage dressing is cell-batched, grounded and finite with one shared existing material', quality => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const root = createAirPassageGroundCover(material, quality);
    expect(root.children).toHaveLength(86);
    expect(root.children.reduce((sum, mesh) => sum + mesh.userData.plantCount, 0)).toBe(quality === 'low' ? 1093 : 2022);
    for (const mesh of root.children) {
        expect(mesh.material).toBe(material); expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
        expect(mesh.geometry.boundingSphere.radius).toBeGreaterThan(0);
        expect(mesh.geometry.boundingBox.min.y).toBeCloseTo(.015, 6);
        expect(mesh.geometry.boundingBox.max.y).toBeLessThan(.75);
        expect([...mesh.geometry.attributes.position.array, ...mesh.geometry.attributes.normal.array, ...mesh.geometry.attributes.color.array]
            .every(Number.isFinite)).toBe(true);
        mesh.geometry.dispose();
    }
    material.dispose();
});

test('settings replace only owned cell geometry, dispose it once and preserve every mesh/material/transform', () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const root = createAirPassageGroundCover(material, 'low');
    const originals = root.children.map(mesh => ({ mesh, position: mesh.position.clone() }));
    for (const quality of ['high', 'low', 'high']) {
        const previous = root.children.map(mesh => ({ geometry: mesh.geometry, disposed: jest.spyOn(mesh.geometry, 'dispose') }));
        updateElementalGroundCoverQuality(root, quality);
        expect(root.children.reduce((sum, mesh) => sum + mesh.userData.plantCount, 0)).toBe(quality === 'low' ? 1093 : 2022);
        root.children.forEach((mesh, i) => {
            expect(mesh).toBe(originals[i].mesh); expect(mesh.material).toBe(material);
            expect(mesh.position).toEqual(originals[i].position);
            expect(mesh.userData.airPassageGroundCover.quality).toBe(quality);
            expect(mesh.geometry).not.toBe(previous[i].geometry); expect(previous[i].disposed).toHaveBeenCalledTimes(1);
        });
        const geometries = root.children.map(mesh => mesh.geometry);
        updateElementalGroundCoverQuality(root, quality);
        expect(root.children.map(mesh => mesh.geometry)).toEqual(geometries);
    }
    for (const mesh of root.children) mesh.geometry.dispose();
    material.dispose();
});
