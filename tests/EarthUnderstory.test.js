import * as THREE from 'three';
import { composeEarthUnderstoryPlacement, createEarthUnderstory, createEarthUnderstoryPlacements, isEarthUnderstoryClear, earthUnderstoryTint } from '../src/art/EarthUnderstory.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { WOODLAND_WIND_REACH } from '../src/art/WoodlandWindMaterial.js';
import { STARTER_ROAD_CLEARINGS } from '../src/data/lanternholdApproach.js';

test.each([['high', 13087, 3294, .6], ['low', 7439, 1876, .4]])('composed %s beds retain the original population while forming tighter local stands', (quality, count, bracken, pairedMinimum) => {
    const plants = createEarthUnderstoryPlacements(quality);
    expect(plants).toHaveLength(count);
    expect(plants.filter(p => p.variant === 0)).toHaveLength(bracken);
    const sample = plants.filter(p => p.x > -60 && p.x < 60 && p.z > -400 && p.z < -300);
    const paired = sample.filter(a => sample.some(b => a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 2));
    // Original jittered lattice: High.437/Low.273 have another plant within2m
    // in this grove patch. This is structure, not a screen coverage/art claim.
    expect(paired.length / sample.length).toBeGreaterThan(pairedMinimum);
});

test('composition keeps invalid destinations at their source anchor and never crosses clear routes', () => {
    for (const [x, z] of [[100, 200], [340, 200], [0, -260]]) {
        expect(composeEarthUnderstoryPlacement(x, z)).toEqual({ x, z });
    }
    let moved = 0;
    for (const [x, z] of [[-45, -350], [-32, -330], [340, 214], [620, 213]]) {
        const first = composeEarthUnderstoryPlacement(x, z);
        expect(first).toEqual(composeEarthUnderstoryPlacement(x, z));
        expect(Math.hypot(first.x - x, first.z - z)).toBeLessThan(5.4);
        if (first.x !== x || first.z !== z) {
            moved++;
            expect(isEarthUnderstoryClear(first.x, first.z)).toBe(true);
        }
    }
    expect(moved).toBeGreaterThan(0);
});

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
    const expectedTints = new Map();
    const key = (variant, values) => `${variant}:${Array.from(values).join(',')}`;
    for (const plant of plants) {
        transform.position.set(plant.x, terrainElevation.sample(plant.x, plant.z), plant.z);
        transform.rotation.set(0, plant.rotation, 0); transform.scale.setScalar(plant.scale); transform.updateMatrix();
        expected.add(key(plant.variant, new Float32Array(transform.matrix.elements)));
        expectedTints.set(key(plant.variant, new Float32Array(transform.matrix.elements)),
            Array.from(new Float32Array(earthUnderstoryTint(plant).toArray())));
    }
    const geometries = new Set(), materials = new Set(), vertex = new THREE.Vector3();
    try {
        for (const mesh of root.children) {
            geometries.add(mesh.geometry); materials.add(mesh.material);
            const [cx, cz, variant] = mesh.name.slice('understory:'.length).split(':').map(Number);
            expect(mesh.instanceColor.count).toBe(mesh.count);
            expect(mesh.userData.windBoundsIncluded).toBe(true);
            const exact = new THREE.Box3(), restSphere = mesh.boundingSphere.clone();
            const reach = WOODLAND_WIND_REACH * 1.4;
            restSphere.radius -= reach;
            for (let i = 0; i < mesh.count; i++) {
                mesh.getMatrixAt(i, matrix);
                const x = matrix.elements[12], z = matrix.elements[14];
                expect(Math.floor(x / cellSize)).toBe(cx); expect(Math.floor(z / cellSize)).toBe(cz);
                actual.add(key(variant, matrix.elements));
                const color = new THREE.Color(); mesh.getColorAt(i, color);
                expect(color.toArray()).toEqual(expectedTints.get(key(variant, matrix.elements)));
                for (let v = 0; v < mesh.geometry.attributes.position.count; v++) {
                    vertex.fromBufferAttribute(mesh.geometry.attributes.position, v).applyMatrix4(matrix);
                    exact.expandByPoint(vertex);
                    if (!restSphere.containsPoint(vertex)) throw new Error('Tight rest sphere clips a blade');
                    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
                        vertex[axis] += sign * reach;
                        if (!mesh.boundingSphere.containsPoint(vertex)) throw new Error('Tight sphere clips the wind envelope');
                        vertex[axis] -= sign * reach;
                    }
                }
            }
            exact.expandByScalar(.000001).expandByVector(new THREE.Vector3(reach, 0, reach));
            expect(mesh.boundingBox.min.toArray()).toEqual(exact.min.toArray());
            expect(mesh.boundingBox.max.toArray()).toEqual(exact.max.toArray());
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
    const first = root.children[0];
    expect(first.boundingBox.isEmpty()).toBe(false);
    expect(first.boundingSphere.radius).toBeGreaterThan(WOODLAND_WIND_REACH * 1.4);
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
