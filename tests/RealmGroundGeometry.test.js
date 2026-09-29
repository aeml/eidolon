import * as THREE from 'three';
import { createRealmGroundGeometry } from '../src/art/RealmGroundGeometry.js';
import { WORLD_REGIONS } from '../src/data/worldGeography.js';

test.each(Object.keys(WORLD_REGIONS))('%s keeps continuous UVs and upward faces without extending beyond realm bounds', id => {
    const region = WORLD_REGIONS[id], geometry = createRealmGroundGeometry(region);
    const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    const width = region.maxX - region.minX, depth = region.maxZ - region.minZ;
    for (let i = 0; i < pos.count; i++) {
        expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(width / 2);
        expect(Math.abs(pos.getY(i))).toBeLessThanOrEqual(depth / 2);
        expect(pos.getZ(i)).toBe(0);
        expect(geometry.getAttribute('normal').getZ(i)).toBe(1);
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / (width - 1.5) + .5, 6);
        expect(uv.getY(i)).toBeCloseTo(pos.getY(i) / (depth - 1.5) + .5, 6);
    }
    expect(geometry.groups).toHaveLength(0); // One material/draw, including gate patches.
    geometry.dispose();
});

test('both sides of each shared gate are covered while closed shoreline stays inset', () => {
    const material = new THREE.MeshBasicMaterial();
    const floors = Object.values(WORLD_REGIONS).filter(r => r.id !== 'town').map(region => {
        const mesh = new THREE.Mesh(createRealmGroundGeometry(region), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((region.minX + region.maxX) / 2, 0, (region.minZ + region.maxZ) / 2);
        mesh.updateMatrixWorld(true); return mesh;
    });
    const ray = new THREE.Raycaster();
    for (const [x, z, axis] of [[0, -600, 'z'], [-1000, 200, 'x'], [1000, 200, 'x']]) {
        for (const offset of [-1, -.5, -.05, .05, .5, 1]) {
            ray.set(new THREE.Vector3(x + (axis === 'x' ? offset : 0), 20, z + (axis === 'z' ? offset : 0)), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObjects(floors)).toHaveLength(1);
        }
        // A point well outside the gate must retain the shoreline gap.
        ray.set(new THREE.Vector3(x + (axis === 'z' ? 40 : 0), 20, z + (axis === 'x' ? 40 : 0)), new THREE.Vector3(0, -1, 0));
        expect(ray.intersectObjects(floors)).toHaveLength(0);
    }
    floors.forEach(mesh => mesh.geometry.dispose()); material.dispose();
});
