import * as THREE from 'three';
import { createEarthUnderstory, createEarthUnderstoryPlacements, isEarthUnderstoryClear } from '../src/art/EarthUnderstory.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';

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

// Test the sampler contract independently of the opt-in world terrain profile.
// Include flat production ground as well as a nonconstant elevated surface.
test.each([null, { sample: (x, z) => 2 + Math.sin(x * .01) * .5 + Math.cos(z * .01) * .5 }])(
    'understory uses cullable opaque shared geometry and samples each instance (%p)', terrainElevation => {
    const root = createEarthUnderstory({ quality: 'low', terrainElevation });
    const geometries = new Set(), materials = new Set(), matrix = new THREE.Matrix4(), position = new THREE.Vector3();
    let count = 0, raised = 0;
    for (const mesh of root.children) {
        geometries.add(mesh.geometry); materials.add(mesh.material);
        expect(mesh.isInstancedMesh).toBe(true);
        expect(mesh.castShadow).toBe(false);
        expect(mesh.material.transparent).toBe(false);
        expect(mesh.boundingSphere.radius).toBeLessThan(38);
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
