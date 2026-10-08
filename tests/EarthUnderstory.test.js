import * as THREE from 'three';
import { createEarthUnderstory, createEarthUnderstoryPlacements, isEarthUnderstoryClear } from '../src/art/EarthUnderstory.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { WOODLAND_WIND_REACH } from '../src/art/WoodlandWindMaterial.js';
import { STARTER_ROAD_CLEARINGS } from '../src/data/lanternholdApproach.js';

test('low roadside cover uses path shoulders without inheriting the tree-trunk exclusion', () => {
    expect(isEarthUnderstoryClear(340, 209)).toBe(true);
    expect(isEarthUnderstoryClear(340, 207)).toBe(false);
    expect(isEarthUnderstoryClear(9, -400)).toBe(true);
    expect(isEarthUnderstoryClear(7, -400)).toBe(false);
    expect(isEarthUnderstoryClear(100, 240)).toBe(false);
    for (const [x, z, radius] of STARTER_ROAD_CLEARINGS) {
        expect(isEarthUnderstoryClear(x, z)).toBe(false);
        expect(isEarthUnderstoryClear(x + radius + 1, z)).toBe(false);
    }
    for (const quality of ['high', 'low']) {
        const verge = createEarthUnderstoryPlacements(quality)
            .filter(p => p.x > 220 && p.x < 700 && Math.abs(p.z - 200) < 16.2);
        expect(verge.length).toBeGreaterThan(100);
        expect(verge.every(p => Math.abs(p.z - 200) >= 8.2)).toBe(true);
    }
});

test('understory forms repeatable beds with a matching Low subset and clear travel space', () => {
    const high = createEarthUnderstoryPlacements(), low = createEarthUnderstoryPlacements('low');
    expect(high).toEqual(createEarthUnderstoryPlacements());
    expect(high.length).toBeGreaterThan(1000);
    expect(high.length).toBeLessThan(16000);
    expect(low.length).toBeLessThan(high.length);
    const keys = new Set(high.map(p => JSON.stringify(p)));
    expect(low.every(p => keys.has(JSON.stringify(p)))).toBe(true);
    const sizes = new Set(high.map(p => Math.floor(p.scale * 10)));
    expect(sizes.size).toBeGreaterThanOrEqual(7);
    expect(high.every(p => p.scale >= .65 && p.scale <= 1.4)).toBe(true);
    for (const plant of high) {
        if (!isEarthUnderstoryClear(plant.x, plant.z)) throw new Error('plant entered a clearing');
        for (const path of EARTH_PATHS) {
            if (distanceToPath(plant.x, plant.z, path.points) < path.width / 2 + 3.5) throw new Error('plant entered a route');
        }
        for (const site of EARTH_LOCATIONS) {
            if (Math.hypot(plant.x-site.x, plant.z-site.z) < site.radius + 3.5) throw new Error('plant entered a location');
        }
    }
});

test.each([['high', 5.5], ['low', 16]])('smaller High batches preserve every plant transform and full wind reach (%s)', (quality, cellSize) => {
    const terrainElevation = { sample: (x, z) => Math.sin(x * .03) + Math.cos(z * .02) };
    const plants = createEarthUnderstoryPlacements(quality);
    const root = createEarthUnderstory({ quality, terrainElevation });
    const expected = new Set(), actual = new Set(), transform = new THREE.Object3D(), matrix = new THREE.Matrix4();
    const key = (variant, values) => `${variant}:${Array.from(values).join(',')}`;
    for (const plant of plants) {
        transform.position.set(plant.x, terrainElevation.sample(plant.x, plant.z), plant.z);
        transform.rotation.set(0, plant.rotation, 0); transform.scale.setScalar(plant.scale); transform.updateMatrix();
        expected.add(key(plant.variant, new Float32Array(transform.matrix.elements)));
    }
    const geometries = new Set(), materials = new Set();
    try {
        for (const mesh of root.children) {
            geometries.add(mesh.geometry); materials.add(mesh.material);
            const [cx, cz, variant] = mesh.name.slice('understory:'.length).split(':').map(Number);
            expect(mesh.userData.windBoundsIncluded).toBe(true);
            for (let i = 0; i < mesh.count; i++) {
                mesh.getMatrixAt(i, matrix);
                const x = matrix.elements[12], z = matrix.elements[14];
                expect(Math.floor(x / cellSize)).toBe(cx); expect(Math.floor(z / cellSize)).toBe(cz);
                actual.add(key(variant, matrix.elements));
            }
            const padded = mesh.boundingBox.clone(); mesh.computeBoundingBox();
            expect(padded.min.x).toBeCloseTo(mesh.boundingBox.min.x - WOODLAND_WIND_REACH * 1.4, 6);
            expect(padded.max.z).toBeCloseTo(mesh.boundingBox.max.z + WOODLAND_WIND_REACH * 1.4, 6);
        }
        expect(actual).toEqual(expected); expect(actual.size).toBe(plants.length);
        expect(root.userData.plantCount).toBe(plants.length);
        expect(geometries.size).toBe(2); expect(materials.size).toBe(1);
    } finally {
        root.children.forEach(mesh => mesh.dispose());
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    }
});

// Test the sampler contract independently of the opt-in world terrain profile.
// Include flat production ground as well as a nonconstant elevated surface.
test.each([null, { sample: (x, z) => 2 + Math.sin(x * .01) * .5 + Math.cos(z * .01) * .5 }])(
    'understory uses cullable opaque shared geometry and samples each instance (%p)', terrainElevation => {
    const root = createEarthUnderstory({ quality: 'low', terrainElevation });
    const geometries = new Set(), materials = new Set(), matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    const first = root.children[0], animatedBounds = first.boundingBox.clone();
    first.computeBoundingBox();
    expect(animatedBounds.min.x).toBeCloseTo(first.boundingBox.min.x - WOODLAND_WIND_REACH * 1.4, 5);
    expect(animatedBounds.max.z).toBeCloseTo(first.boundingBox.max.z + WOODLAND_WIND_REACH * 1.4, 5);
    expect(animatedBounds.min.y).toBe(first.boundingBox.min.y);
    first.boundingBox.copy(animatedBounds);
    let count = 0, raised = 0;
    for (const mesh of root.children) {
        geometries.add(mesh.geometry); materials.add(mesh.material);
        expect(mesh.isInstancedMesh).toBe(true);
        expect(mesh.castShadow).toBe(false);
        expect(mesh.material.transparent).toBe(false);
        expect(mesh.material.userData.woodlandWind).toBe(true);
        expect(mesh.boundingSphere.radius).toBeLessThan(22);
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
            const expected = terrainElevation?.sample(position.x, position.z) ?? 0;
            if (Math.abs(position.y - expected) > .0001) throw new Error('floating understory');
            if (expected > 1) raised++;
            count++;
        }
    }
    expect(count).toBe(root.userData.plantCount);
    if (terrainElevation) expect(raised).toBeGreaterThan(0);
    else expect(raised).toBe(0);
    expect(geometries.size).toBe(2); expect(materials.size).toBe(1);
    for (const geometry of geometries) {
        const vertices = geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
            // Clearance includes the complete plant at its largest scale.
            expect(Math.hypot(vertices.getX(i), vertices.getZ(i)) * 1.4).toBeLessThan(2.2);
        }
    }
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
});
